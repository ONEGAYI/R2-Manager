/**
 * 分块上传服务
 *
 * 实现 S3 Multipart Upload 多线程分块上传、并发控制、进度回调、真取消、暂停/恢复
 */

import type { ChunkUploadInfo, CompletedPart, ChunkedUploaderState, ListPartsResponse } from '@/types/chunk'
import {
  MIN_UPLOAD_CHUNK_STEP,
  MAX_UPLOAD_CHUNK_STEP,
  DEFAULT_UPLOAD_CHUNK_STEP,
  S3_MAX_PART_COUNT,
} from '@/types/chunk'
import type { ThreadPoolClient } from '@/types/threadPool'
import type { RetryConfig, RetryContext } from '@/types/retry'
import { transferLogger } from '@/lib/transferLogger'
import { withRetry, getRetryConfig } from '@/lib/retryHelper'

const API_BASE = 'http://localhost:3001/api'

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (
  loaded: number,
  total: number,
  speed: number
) => void

/**
 * 分块上传器配置
 */
export interface ChunkedUploaderOptions {
  /** 存储桶名称 */
  bucketName: string
  /** 文件键名 */
  key: string
  /** 要上传的文件 */
  file: File
  /** 最大并发线程数 */
  maxConcurrency?: number
  /** 分块步长（字节） */
  chunkStep?: number
  /** 进度回调 */
  onProgress?: ProgressCallback
  /** 线程池客户端（可选，用于全局并发控制） */
  threadPoolClient?: ThreadPoolClient
}

/**
 * 恢复上传的配置
 */
export interface ResumeOptions {
  /** 已有的 UploadId */
  uploadId: string
  /** 已完成的分块 */
  completedParts: CompletedPart[]
  /** 分块大小 */
  partSize: number
}

/**
 * 分块上传器
 *
 * 使用 S3 Multipart Upload API 实现多线程并发上传
 * 支持暂停/恢复功能
 */
export class ChunkedUploader {
  private bucketName: string
  private key: string
  private file: File
  private maxConcurrency: number
  private onProgress?: ProgressCallback
  private chunkStep: number
  private threadPoolClient?: ThreadPoolClient

  private uploadId: string | null = null
  private parts: ChunkUploadInfo[] = []
  private completedParts: CompletedPart[] = []
  private aborted: boolean = false
  private paused: boolean = false
  private startTime: number = 0
  private lastReportTime: number = 0
  private lastLoadedBytes: number = 0
  private lastSpeedTime: number = 0

  /** 活跃的 XHR 请求映射（用于暂停时中断） */
  private activeXhrs: Map<number, XMLHttpRequest> = new Map()

  /** 分块大小（用于恢复） */
  private partSize: number = DEFAULT_UPLOAD_CHUNK_STEP

  /** 进度报告节流间隔（毫秒） */
  private static readonly PROGRESS_THROTTLE_MS = 200

  constructor(options: ChunkedUploaderOptions) {
    this.bucketName = options.bucketName
    this.key = options.key
    this.file = options.file
    this.maxConcurrency = options.maxConcurrency ?? 4
    this.onProgress = options.onProgress
    this.threadPoolClient = options.threadPoolClient
    // Clamp 分块步长到有效范围
    this.chunkStep = Math.max(
      MIN_UPLOAD_CHUNK_STEP,
      Math.min(MAX_UPLOAD_CHUNK_STEP, options.chunkStep ?? DEFAULT_UPLOAD_CHUNK_STEP)
    )
  }

  /**
   * 开始上传
   *
   * @param resumeOptions 可选的恢复配置（用于从暂停状态恢复）
   */
  async start(resumeOptions?: ResumeOptions): Promise<void> {
    this.startTime = Date.now()
    this.lastReportTime = 0
    this.lastLoadedBytes = 0
    this.lastSpeedTime = Date.now()
    this.aborted = false
    this.paused = false

    // 通知线程池任务开始运行
    if (this.threadPoolClient) {
      this.threadPoolClient.notifyStatusChange('running')
    }

    const fileSize = this.file.size

    if (resumeOptions) {
      // 从暂停状态恢复
      this.uploadId = resumeOptions.uploadId
      this.completedParts = [...resumeOptions.completedParts]
      this.partSize = resumeOptions.partSize

      transferLogger.uploadResuming(this.uploadId, `${this.bucketName}/${this.key}`)

      // 重建分块列表
      this.parts = this.calculatePartsWithSize(fileSize, this.partSize)

      // 标记已完成的分块
      const completedPartNumbers = new Set(
        this.completedParts.map((p) => p.PartNumber)
      )

      for (const part of this.parts) {
        if (completedPartNumbers.has(part.partNumber)) {
          part.completed = true
          part.loadedBytes = part.size
          part.etag = this.completedParts.find(
            (p) => p.PartNumber === part.partNumber
          )?.ETag
        }
      }

      // 过滤出待上传的分块
      const pendingParts = this.parts.filter((p) => !p.completed)

      transferLogger.uploadSkippingParts(
        `${this.bucketName}/${this.key}`,
        Array.from(completedPartNumbers)
      )

      if (pendingParts.length === 0) {
        // 所有分块已完成，直接合并
        transferLogger.uploadCompleting(this.completedParts.length)
        await this.completeMultipartUpload()
        const duration = Date.now() - this.startTime
        transferLogger.taskCompleted(`${this.bucketName}/${this.key}`, duration)
        return
      }

      // 获取实际并发数（优先使用线程池分配）
      const concurrency = this.getEffectiveConcurrency(pendingParts.length)

      transferLogger.usingChunkedUploadMode(fileSize, this.parts.length, concurrency)

      // 并发上传剩余分块
      await this.runWithConcurrency(
        pendingParts,
        concurrency,
        (part) => this.uploadPart(part)
      )

      if (this.aborted) {
        await this.abortMultipartUpload()
        throw new Error('Upload aborted')
      }

      if (this.paused) {
        // 暂停由 pause() 方法处理
        return
      }

      // 强制报告最终进度
      this.reportProgress()

      // 完成上传
      await this.completeMultipartUpload()

      const duration = Date.now() - this.startTime
      transferLogger.taskCompleted(`${this.bucketName}/${this.key}`, duration)
    } else {
      // 全新上传
      this.completedParts = []

      // 1. 初始化上传
      this.uploadId = await this.initiateMultipartUpload()
      transferLogger.uploadInitiated(this.uploadId, `${this.bucketName}/${this.key}`)

      // 2. 计算分块
      this.parts = this.calculateParts(fileSize)
      // 获取实际并发数（优先使用线程池分配）
      const concurrency = this.getEffectiveConcurrency(this.parts.length)

      transferLogger.usingChunkedUploadMode(fileSize, this.parts.length, concurrency)

      // 3. 并发上传所有分块
      await this.runWithConcurrency(
        this.parts,
        concurrency,
        (part) => this.uploadPart(part)
      )

      if (this.aborted) {
        // 已取消，调用后端清理
        await this.abortMultipartUpload()
        throw new Error('Upload aborted')
      }

      if (this.paused) {
        // 暂停由 pause() 方法处理
        return
      }

      // 4. 强制报告最终进度
      this.reportProgress()

      // 5. 完成上传
      await this.completeMultipartUpload()

      const duration = Date.now() - this.startTime
      transferLogger.taskCompleted(`${this.bucketName}/${this.key}`, duration)
    }
  }

  /**
   * 暂停上传
   *
   * @returns 当前上传状态（用于持久化）
   */
  async pause(): Promise<ChunkedUploaderState> {
    if (this.paused) {
      return this.getState()
    }

    this.paused = true

    // 通知线程池任务已暂停（释放资源给其他任务）
    if (this.threadPoolClient) {
      this.threadPoolClient.notifyStatusChange('paused')
    }

    const completedCount = this.completedParts.length
    const totalCount = this.parts.length

    transferLogger.uploadPaused(
      `${this.bucketName}/${this.key}`,
      completedCount,
      totalCount
    )

    // 中断所有活跃的 XHR 请求
    for (const [partNumber, xhr] of this.activeXhrs) {
      xhr.abort()
      // 重置该分块的进度
      const part = this.parts.find((p) => p.partNumber === partNumber)
      if (part && !part.completed) {
        part.loadedBytes = 0
      }
    }
    this.activeXhrs.clear()

    // 等待一小段时间确保所有 XHR 都已中断
    await new Promise((resolve) => setTimeout(resolve, 100))

    return this.getState()
  }

  /**
   * 获取当前状态（用于持久化）
   */
  getState(): ChunkedUploaderState {
    const totalLoaded = this.parts.reduce((sum, p) => sum + p.loadedBytes, 0)

    return {
      uploadId: this.uploadId || '',
      bucketName: this.bucketName,
      key: this.key,
      fileSize: this.file.size,
      fileName: this.file.name,
      fileType: this.file.type || 'application/octet-stream',
      partSize: this.partSize,
      totalParts: this.parts.length,
      completedParts: [...this.completedParts],
      loadedBytes: totalLoaded,
      pausedAt: Date.now(),
    }
  }

  /**
   * 从服务端查询已上传的分块
   *
   * @returns 服务端分块信息，如果会话过期则 isExpired 为 true
   */
  static async listPartsFromServer(
    bucketName: string,
    key: string,
    uploadId: string
  ): Promise<ListPartsResponse> {
    const url = `${API_BASE}/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(key)}/multipart/parts?uploadId=${encodeURIComponent(uploadId)}`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(error.error || response.statusText)
      }

      const data = await response.json()
      return data as ListPartsResponse
    } catch (error) {
      console.error('[ChunkedUploader] List parts failed:', error)
      throw error
    }
  }

  /**
   * 取消上传
   *
   * 设置标志位 + 调用后端 AbortMultipartUpload 清理已上传分块
   */
  async abort(): Promise<void> {
    this.aborted = true
    transferLogger.uploadAborted(`${this.bucketName}/${this.key}`)

    // 释放线程池资源
    if (this.threadPoolClient) {
      this.threadPoolClient.releaseAll()
    }

    // 中断所有活跃的 XHR 请求
    for (const [, xhr] of this.activeXhrs) {
      xhr.abort()
    }
    this.activeXhrs.clear()

    // 如果已有 uploadId，立即调用后端清理
    if (this.uploadId) {
      try {
        await this.abortMultipartUpload()
      } catch (error) {
        console.error('[ChunkedUploader] Failed to abort multipart upload:', error)
      }
    }
  }

  /**
   * 检查是否已暂停
   */
  isPaused(): boolean {
    return this.paused
  }

  /**
   * 检查是否已取消
   */
  isAborted(): boolean {
    return this.aborted
  }

  /**
   * 初始化分块上传
   */
  private async initiateMultipartUpload(): Promise<string> {
    const url = `${API_BASE}/buckets/${encodeURIComponent(this.bucketName)}/objects/${encodeURIComponent(this.key)}/multipart/initiate`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: this.file.type || 'application/octet-stream',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(`Initiate failed: ${error.error || response.statusText}`)
    }

    const data = await response.json()
    return data.uploadId
  }

  /**
   * 上传单个分块（带重试）
   */
  private async uploadPart(part: ChunkUploadInfo): Promise<void> {
    const retryConfig = this.getRetryConfig()

    // 创建重试上下文
    const context: RetryContext = {
      operation: 'upload',
      attempt: 0,
      maxAttempts: retryConfig.retryMaxAttempts,
      partNumber: part.partNumber,
    }

    // 创建 AbortController 用于暂停/取消
    const abortController = new AbortController()

    // 监听暂停/取消状态
    const checkPaused = () => this.paused
    const checkAborted = () => this.aborted

    try {
      await withRetry(
        () => this.uploadPartOnce(part),
        {
          config: retryConfig,
          context,
          signal: abortController.signal,
          isPaused: checkPaused,
          isAborted: checkAborted,
        }
      )

      // 重试成功
      if (context.attempt > 0) {
        transferLogger.retrySucceeded('upload', context.attempt, part.partNumber)
      }
    } catch (error) {
      // 如果是暂停/取消导致的错误，直接抛出
      if (this.paused || this.aborted) {
        throw error
      }

      // 重试失败，抛出错误
      throw error
    }
  }

  /**
   * 上传单个分块（单次尝试）
   */
  private async uploadPartOnce(part: ChunkUploadInfo): Promise<void> {
    if (this.aborted || this.paused) {
      throw new Error(this.paused ? 'Upload paused' : 'Upload aborted')
    }

    transferLogger.uploadPartStarted(part.partNumber, part.start, part.end)

    // 切片文件
    const slice = this.file.slice(part.start, part.end)
    const url = `${API_BASE}/buckets/${encodeURIComponent(this.bucketName)}/objects/${encodeURIComponent(this.key)}/multipart/upload-part`

    // 使用 XHR 上传以获取进度
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // 注册到活跃 XHR 映射
      this.activeXhrs.set(part.partNumber, xhr)

      xhr.upload.onprogress = (event) => {
        if (this.aborted || this.paused) {
          xhr.abort()
          return
        }

        // 更新分块进度
        this.parts[part.partNumber - 1].loadedBytes = event.loaded

        // 节流报告进度
        this.reportProgressThrottled()
      }

      xhr.onload = () => {
        // 从活跃 XHR 映射中移除
        this.activeXhrs.delete(part.partNumber)

        if (this.aborted) {
          reject(new Error('Upload aborted'))
          return
        }

        if (this.paused) {
          reject(new Error('Upload paused'))
          return
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            const etag = response.etag

            if (!etag) {
              reject(new Error(`Part ${part.partNumber} missing ETag`))
              return
            }

            // 标记完成
            this.parts[part.partNumber - 1].completed = true
            this.parts[part.partNumber - 1].etag = etag

            // 记录完成的分块
            this.completedParts.push({
              PartNumber: part.partNumber,
              ETag: etag,
            })

            transferLogger.uploadPartCompleted(part.partNumber, part.size)
            resolve()
          } catch (error) {
            reject(new Error(`Part ${part.partNumber} parse error: ${error}`))
          }
        } else {
          // 返回 HTTP 错误，包含状态码（用于重试判断）
          const errorMsg = `HTTP ${xhr.status} ${xhr.statusText}`
          transferLogger.uploadPartFailed(part.partNumber, errorMsg)
          reject(new Error(errorMsg))
        }
      }

      xhr.onerror = () => {
        this.activeXhrs.delete(part.partNumber)
        const errorMsg = 'network error'
        transferLogger.uploadPartFailed(part.partNumber, errorMsg)
        reject(new Error(errorMsg))
      }

      xhr.onabort = () => {
        this.activeXhrs.delete(part.partNumber)
        if (this.paused) {
          reject(new Error('Upload paused'))
        } else {
          reject(new Error('Upload aborted'))
        }
      }

      xhr.open('POST', url)
      xhr.setRequestHeader('X-Upload-Id', this.uploadId!)
      xhr.setRequestHeader('X-Part-Number', String(part.partNumber))
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')

      xhr.send(slice)
    })
  }

  /**
   * 获取重试配置
   */
  private getRetryConfig(): RetryConfig {
    return getRetryConfig()
  }

  /**
   * 完成分块上传
   */
  private async completeMultipartUpload(): Promise<void> {
    const url = `${API_BASE}/buckets/${encodeURIComponent(this.bucketName)}/objects/${encodeURIComponent(this.key)}/multipart/complete`

    // 按 PartNumber 排序
    const sortedParts = this.completedParts.sort((a, b) => a.PartNumber - b.PartNumber)

    transferLogger.uploadCompleting(sortedParts.length)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId: this.uploadId,
        parts: sortedParts,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(`Complete failed: ${error.error || response.statusText}`)
    }

    const data = await response.json()
    transferLogger.uploadCompleted(data.key, data.location)
  }

  /**
   * 取消分块上传（清理后端资源）
   */
  private async abortMultipartUpload(): Promise<void> {
    if (!this.uploadId) return

    const url = `${API_BASE}/buckets/${encodeURIComponent(this.bucketName)}/objects/${encodeURIComponent(this.key)}/multipart/abort`

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: this.uploadId,
        }),
      })
    } catch (error) {
      console.error('[ChunkedUploader] Abort request failed:', error)
    }
  }

  /**
   * 计算分块
   */
  private calculateParts(fileSize: number): ChunkUploadInfo[] {
    // 使用配置的分块步长
    let partSize = this.chunkStep

    // 确保不超过最大分块数
    const minPartSizeForMaxParts = Math.ceil(fileSize / S3_MAX_PART_COUNT)
    if (minPartSizeForMaxParts > partSize) {
      partSize = minPartSizeForMaxParts
    }

    // 确保不小于最小分块大小（S3 限制）
    if (partSize < MIN_UPLOAD_CHUNK_STEP) {
      partSize = MIN_UPLOAD_CHUNK_STEP
    }

    // 保存分块大小用于恢复
    this.partSize = partSize

    return this.calculatePartsWithSize(fileSize, partSize)
  }

  /**
   * 使用指定分块大小计算分块
   */
  private calculatePartsWithSize(fileSize: number, partSize: number): ChunkUploadInfo[] {
    const parts: ChunkUploadInfo[] = []

    let partNumber = 1
    let start = 0

    while (start < fileSize) {
      const end = Math.min(start + partSize, fileSize)
      parts.push({
        partNumber,
        start,
        end,
        size: end - start,
        loadedBytes: 0,
        completed: false,
      })
      partNumber++
      start = end
    }

    return parts
  }

  /**
   * 获取推荐并发数
   */
  private getRecommendedConcurrency(partCount: number): number {
    // 分块数较少时，不超过分块数
    return Math.min(partCount, this.maxConcurrency)
  }

  /**
   * 获取实际使用的并发数
   *
   * 优先使用线程池分配的并发数，如果未使用线程池则回退到推荐并发数
   */
  private getEffectiveConcurrency(partCount: number): number {
    if (this.threadPoolClient) {
      const allocated = this.threadPoolClient.getAllocatedConcurrency()
      // 如果分配了0，表示资源不足，需要等待
      // 但为了优雅降级，至少使用1个并发
      return Math.max(1, Math.min(allocated, partCount))
    }
    return this.getRecommendedConcurrency(partCount)
  }

  /**
   * 报告进度（节流版本）
   */
  private reportProgressThrottled(): void {
    const now = Date.now()
    if (now - this.lastReportTime < ChunkedUploader.PROGRESS_THROTTLE_MS) {
      return
    }
    this.lastReportTime = now
    this.reportProgress()
  }

  /**
   * 报告进度（立即执行）
   */
  private reportProgress(): void {
    if (!this.onProgress) return

    const totalLoaded = this.parts.reduce((sum, p) => sum + p.loadedBytes, 0)
    const fileSize = this.file.size
    const now = Date.now()

    // 计算瞬时速度（基于时间间隔）
    const deltaTime = (now - this.lastSpeedTime) / 1000
    let speed = 0

    if (deltaTime > 0) {
      const deltaBytes = totalLoaded - this.lastLoadedBytes
      speed = deltaBytes / deltaTime

      // 更新上次记录
      this.lastLoadedBytes = totalLoaded
      this.lastSpeedTime = now
    }

    this.onProgress(totalLoaded, fileSize, speed)

    // 输出日志
    transferLogger.progress(
      `${this.bucketName}/${this.key}`,
      totalLoaded,
      fileSize,
      speed
    )
  }

  /**
   * 并发执行任务（支持暂停）
   */
  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    taskFn: (item: T) => Promise<void>
  ): Promise<void> {
    const executing: Promise<void>[] = []

    for (const item of items) {
      if (this.aborted || this.paused) break

      const promise = taskFn(item).finally(() => {
        const index = executing.indexOf(promise)
        if (index > -1) {
          executing.splice(index, 1)
        }
      })

      executing.push(promise)

      if (executing.length >= concurrency) {
        try {
          await Promise.race(executing)
        } catch (error) {
          // 如果是暂停或取消导致的错误，检查状态后决定是否继续
          if (this.paused || this.aborted) {
            break
          }
          // 其他错误继续抛出
          throw error
        }
      }
    }

    // 使用 Promise.allSettled 等待所有任务（包括被中断的任务）
    const results = await Promise.allSettled(executing)

    // 检查是否有被暂停中断的任务
    if (this.paused) {
      // 暂停时，不抛出错误，让调用者处理
      return
    }

    // 检查是否有错误（非暂停导致的错误）
    for (const result of results) {
      if (result.status === 'rejected') {
        const error = result.reason
        if (error?.message !== 'Upload paused' && error?.message !== 'Upload aborted') {
          throw error
        }
      }
    }
  }
}

/**
 * 判断是否应该使用分块上传
 *
 * @param fileSize 文件大小
 * @param threshold 阈值（默认 10MB）
 * @returns 是否使用分块上传
 */
export function shouldUseChunkedUpload(
  fileSize: number,
  threshold: number = 10 * 1024 * 1024
): boolean {
  return fileSize >= threshold
}
