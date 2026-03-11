/**
 * 分块上传服务
 *
 * 实现 S3 Multipart Upload 多线程分块上传、并发控制、进度回调、真取消
 */

import type { ChunkUploadInfo, CompletedPart } from '@/types/chunk'
import { transferLogger } from '@/lib/transferLogger'

const API_BASE = 'http://localhost:3001/api'

/** 最小分块大小 (S3 限制) */
const MIN_PART_SIZE = 5 * 1024 * 1024 // 5MB

/** 推荐分块大小 */
const RECOMMENDED_PART_SIZE = 10 * 1024 * 1024 // 10MB

/** 最大分块数 (S3 限制) */
const MAX_PART_COUNT = 10000

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
  /** 进度回调 */
  onProgress?: ProgressCallback
}

/**
 * 分块上传器
 *
 * 使用 S3 Multipart Upload API 实现多线程并发上传
 */
export class ChunkedUploader {
  private bucketName: string
  private key: string
  private file: File
  private maxConcurrency: number
  private onProgress?: ProgressCallback

  private uploadId: string | null = null
  private parts: ChunkUploadInfo[] = []
  private completedParts: CompletedPart[] = []
  private aborted: boolean = false
  private startTime: number = 0
  private lastReportTime: number = 0
  private lastLoadedBytes: number = 0
  private lastSpeedTime: number = 0

  /** 进度报告节流间隔（毫秒） */
  private static readonly PROGRESS_THROTTLE_MS = 200

  constructor(options: ChunkedUploaderOptions) {
    this.bucketName = options.bucketName
    this.key = options.key
    this.file = options.file
    this.maxConcurrency = options.maxConcurrency ?? 4
    this.onProgress = options.onProgress
  }

  /**
   * 开始上传
   *
   * 1. 初始化 Multipart Upload
   * 2. 并发上传所有分块
   * 3. 完成合并
   */
  async start(): Promise<void> {
    this.startTime = Date.now()
    this.lastReportTime = 0
    this.lastLoadedBytes = 0
    this.lastSpeedTime = Date.now()
    this.aborted = false
    this.completedParts = []

    const fileSize = this.file.size

    // 1. 初始化上传
    this.uploadId = await this.initiateMultipartUpload()
    transferLogger.uploadInitiated(this.uploadId, `${this.bucketName}/${this.key}`)

    // 2. 计算分块
    this.parts = this.calculateParts(fileSize)
    const concurrency = this.getRecommendedConcurrency(this.parts.length)

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

    // 4. 强制报告最终进度
    this.reportProgress()

    // 5. 完成上传
    await this.completeMultipartUpload()

    const duration = Date.now() - this.startTime
    transferLogger.taskCompleted(`${this.bucketName}/${this.key}`, duration)
  }

  /**
   * 取消上传
   *
   * 设置标志位 + 调用后端 AbortMultipartUpload 清理已上传分块
   */
  async abort(): Promise<void> {
    this.aborted = true
    transferLogger.uploadAborted(`${this.bucketName}/${this.key}`)

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
   * 上传单个分块
   */
  private async uploadPart(part: ChunkUploadInfo): Promise<void> {
    if (this.aborted) {
      throw new Error('Upload aborted')
    }

    transferLogger.uploadPartStarted(part.partNumber, part.start, part.end)

    // 切片文件
    const slice = this.file.slice(part.start, part.end)
    const url = `${API_BASE}/buckets/${encodeURIComponent(this.bucketName)}/objects/${encodeURIComponent(this.key)}/multipart/upload-part`

    // 使用 XHR 上传以获取进度
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (event) => {
        if (this.aborted) {
          xhr.abort()
          return
        }

        // 更新分块进度
        this.parts[part.partNumber - 1].loadedBytes = event.loaded

        // 节流报告进度
        this.reportProgressThrottled()
      }

      xhr.onload = () => {
        if (this.aborted) {
          reject(new Error('Upload aborted'))
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
          reject(new Error(`Part ${part.partNumber} failed: ${xhr.statusText}`))
        }
      }

      xhr.onerror = () => {
        transferLogger.uploadPartFailed(part.partNumber, xhr.statusText)
        reject(new Error(`Part ${part.partNumber} network error`))
      }

      xhr.onabort = () => {
        reject(new Error('Upload aborted'))
      }

      xhr.open('POST', url)
      xhr.setRequestHeader('X-Upload-Id', this.uploadId!)
      xhr.setRequestHeader('X-Part-Number', String(part.partNumber))
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')

      xhr.send(slice)
    })
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
    const parts: ChunkUploadInfo[] = []

    // 计算分块大小，确保不超过最大分块数
    let partSize = RECOMMENDED_PART_SIZE
    const minPartSizeForMaxParts = Math.ceil(fileSize / MAX_PART_COUNT)
    if (minPartSizeForMaxParts > partSize) {
      partSize = minPartSizeForMaxParts
    }

    // 确保不小于最小分块大小
    if (partSize < MIN_PART_SIZE) {
      partSize = MIN_PART_SIZE
    }

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
   * 并发执行任务
   */
  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    taskFn: (item: T) => Promise<void>
  ): Promise<void> {
    const executing: Promise<void>[] = []

    for (const item of items) {
      if (this.aborted) break

      const promise = taskFn(item).finally(() => {
        const index = executing.indexOf(promise)
        if (index > -1) {
          executing.splice(index, 1)
        }
      })

      executing.push(promise)

      if (executing.length >= concurrency) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)
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
