/**
 * 分块下载服务
 *
 * 实现多线程分块下载、并发控制、进度回调、分块合并、暂停/恢复（支持断点续传）
 */

import type { ChunkInfo, ChunkDownloadResult, ChunkedDownloaderState, ResumeDownloadOptions, PartialChunkState } from '@/types/chunk'
import {
  MIN_DOWNLOAD_CHUNK_STEP,
  MAX_DOWNLOAD_CHUNK_STEP,
  DEFAULT_DOWNLOAD_CHUNK_STEP,
} from '@/types/chunk'
import type { ThreadPoolClient } from '@/types/threadPool'
import type { RetryConfig, RetryContext } from '@/types/retry'
import {
  calculateChunksByStep,
  createRangeHeader,
  calculateTotalLoaded,
  getRecommendedConcurrency,
} from '@/lib/chunkManager'
import { transferLogger } from '@/lib/transferLogger'
import { downloadCacheManager } from '@/lib/downloadCacheManager'
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
 * 分块下载器配置
 */
export interface ChunkedDownloaderOptions {
  /** 存储桶名称 */
  bucketName: string
  /** 文件键名 */
  key: string
  /** 文件大小 */
  fileSize: number
  /** 任务 ID（用于缓存管理） */
  taskId?: string
  /** 文件名（用于状态持久化） */
  fileName?: string
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
 * 分块下载器
 *
 * 使用多线程并发下载文件分块，支持进度回调、取消和暂停/恢复（断点续传）
 */
export class ChunkedDownloader {
  private bucketName: string
  private key: string
  private fileSize: number
  private taskId: string
  private fileName: string
  private maxConcurrency: number
  private chunkStep: number
  private onProgress?: ProgressCallback
  private threadPoolClient?: ThreadPoolClient

  private chunks: ChunkInfo[] = []
  private results: Map<number, ArrayBuffer> = new Map()
  /** 部分下载的数据（用于断点续传） */
  private partialData: Map<number, Uint8Array> = new Map()
  private aborted: boolean = false
  private paused: boolean = false
  private startTime: number = 0
  private lastReportTime: number = 0
  private lastLoadedBytes: number = 0
  private lastSpeedTime: number = 0

  /** 活跃的流读取器（用于暂停时取消） */
  private activeReaders: Map<number, ReadableStreamDefaultReader<Uint8Array>> = new Map()

  /** 进度报告节流间隔（毫秒） */
  private static readonly PROGRESS_THROTTLE_MS = 200

  constructor(options: ChunkedDownloaderOptions) {
    this.bucketName = options.bucketName
    this.key = options.key
    this.fileSize = options.fileSize
    this.taskId = options.taskId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    this.fileName = options.fileName ?? options.key.split('/').pop() ?? 'download'
    this.maxConcurrency = options.maxConcurrency ?? 4
    // Clamp 分块步长到有效范围
    this.chunkStep = Math.max(
      MIN_DOWNLOAD_CHUNK_STEP,
      Math.min(MAX_DOWNLOAD_CHUNK_STEP, options.chunkStep ?? DEFAULT_DOWNLOAD_CHUNK_STEP)
    )
    this.onProgress = options.onProgress
    this.threadPoolClient = options.threadPoolClient
  }

  /**
   * 开始下载
   *
   * @param resumeOptions 恢复下载选项（可选）
   * @returns 下载完成后的 Blob
   */
  async start(resumeOptions?: ResumeDownloadOptions): Promise<Blob> {
    this.startTime = Date.now()
    this.lastReportTime = 0
    this.lastLoadedBytes = 0
    this.lastSpeedTime = Date.now()
    this.aborted = false
    this.paused = false
    this.results.clear()
    this.partialData.clear()
    this.activeReaders.clear()

    // 通知线程池任务开始运行
    if (this.threadPoolClient) {
      this.threadPoolClient.notifyStatusChange('running')
    }

    // 使用配置的步长计算分块
    this.chunks = calculateChunksByStep(this.fileSize, this.chunkStep)

    // 获取实际并发数（优先使用线程池分配）
    const concurrency = this.getEffectiveConcurrency(this.chunks.length)

    // 确定需要下载的分块
    let chunksToDownload = this.chunks

    if (resumeOptions) {
      // 恢复模式：从缓存加载分块数据
      const cachedChunks = await downloadCacheManager.loadAllChunks(this.taskId)
      console.log('[Resume] Cached chunks from IndexedDB:', Array.from(cachedChunks.keys()))

      for (const [index, { blob, loadedBytes }] of cachedChunks) {
        const expectedSize = this.chunks[index].end - this.chunks[index].start + 1

        if (loadedBytes >= expectedSize) {
          // 完整分块：直接使用
          const buffer = await blob.arrayBuffer()
          this.results.set(index, buffer)
          this.chunks[index].completed = true
          this.chunks[index].loadedBytes = expectedSize
          console.log(`[Resume] Loaded complete chunk ${index}, size: ${buffer.byteLength}`)
        } else {
          // 部分分块：保存部分数据，后续续传
          const buffer = await blob.arrayBuffer()
          this.partialData.set(index, new Uint8Array(buffer))
          this.chunks[index].loadedBytes = loadedBytes
          this.chunks[index].completed = false
          console.log(`[Resume] Loaded partial chunk ${index}, ${loadedBytes} / ${expectedSize} bytes`)
        }
      }

      const initialLoadedBytes = resumeOptions.loadedBytes
      this.lastLoadedBytes = initialLoadedBytes

      // 只下载未完成的分块
      chunksToDownload = this.chunks.filter((chunk) => !chunk.completed)

      console.log(
        `[Download] Resuming with ${this.results.size} complete + ${this.partialData.size} partial chunks, ${chunksToDownload.length} to download`
      )
    }

    transferLogger.usingChunkedMode(this.fileSize, this.chunks.length, concurrency)

    if (chunksToDownload.length > 0) {
      // 并发下载剩余分块
      await this.runWithConcurrency(
        chunksToDownload,
        concurrency,
        (chunk) => this.downloadChunk(chunk)
      )
    }

    if (this.aborted) {
      throw new Error('Download aborted')
    }

    if (this.paused) {
      throw new Error('Download paused')
    }

    // 强制报告最终进度（确保显示 100%）
    this.reportProgress()

    // 合并分块
    const blob = this.mergeChunks()
    const duration = Date.now() - this.startTime

    transferLogger.taskCompleted(`${this.bucketName}/${this.key}`, duration)

    // 下载完成，清理缓存
    await downloadCacheManager.clearCache(this.taskId)

    return blob
  }

  /**
   * 取消下载
   */
  abort(): void {
    this.aborted = true

    // 释放线程池资源
    if (this.threadPoolClient) {
      this.threadPoolClient.releaseAll()
    }

    // 取消所有活跃的流读取器
    for (const reader of this.activeReaders.values()) {
      reader.cancel().catch(() => {})
    }
    this.activeReaders.clear()
    transferLogger.downloadAborted(`${this.bucketName}/${this.key}`)
  }

  /**
   * 暂停下载
   *
   * @returns 当前下载状态（用于持久化）
   */
  async pause(): Promise<ChunkedDownloaderState> {
    if (this.paused) {
      return this.getState()
    }

    this.paused = true

    // 通知线程池任务已暂停（释放资源给其他任务）
    if (this.threadPoolClient) {
      this.threadPoolClient.notifyStatusChange('paused')
    }

    // 调试：记录暂停时的状态
    const activeReaderIndexes = Array.from(this.activeReaders.keys())
    const resultIndexes = Array.from(this.results.keys())
    const partialIndexes = Array.from(this.partialData.keys())
    console.log('[Pause] State before cancel:', {
      activeReaders: activeReaderIndexes,
      results: resultIndexes,
      partialData: partialIndexes,
    })

    // 取消所有活跃的流读取器
    // 注意：需要先复制 activeReaders 的 keys，因为在 await 期间可能有分块完成
    const activeIndexes = Array.from(this.activeReaders.keys())

    for (const index of activeIndexes) {
      const reader = this.activeReaders.get(index)
      if (reader) {
        try {
          await reader.cancel()
        } catch {
          // 忽略取消错误
        }
      }

      // 检查分块是否在 await 期间完成
      if (this.results.has(index)) {
        // 分块已完成，保持状态
        console.log(`[Pause] Chunk ${index} completed during cancel`)
      } else if (this.partialData.has(index)) {
        // 有部分数据，保持状态用于续传
        console.log(`[Pause] Chunk ${index} has partial data: ${this.chunks[index].loadedBytes} bytes`)
      } else {
        // 分块未开始或数据丢失，重置进度
        this.chunks[index].loadedBytes = 0
        this.chunks[index].completed = false
        console.log(`[Pause] Chunk ${index} reset (no data)`)
      }
    }
    this.activeReaders.clear()

    // 保存已完成的分块到缓存
    let savedCount = 0
    for (const [index, buffer] of this.results) {
      const blob = new Blob([buffer], { type: 'application/octet-stream' })
      const loadedBytes = this.chunks[index].loadedBytes
      await downloadCacheManager.saveChunk(this.taskId, index, blob, loadedBytes)
      savedCount++
    }

    // 保存部分下载的分块到缓存（用于断点续传）
    let partialCount = 0
    for (const [index, data] of this.partialData) {
      // 复制数据到新的 ArrayBuffer，确保类型兼容
      const buffer = new ArrayBuffer(data.byteLength)
      new Uint8Array(buffer).set(data)
      const blob = new Blob([buffer], { type: 'application/octet-stream' })
      const loadedBytes = this.chunks[index].loadedBytes
      await downloadCacheManager.saveChunk(this.taskId, index, blob, loadedBytes)
      partialCount++
    }

    console.log(`[Pause] Saved ${savedCount} complete + ${partialCount} partial chunks to cache`)

    transferLogger.downloadPaused(`${this.bucketName}/${this.key}`)

    const state = this.getState()
    console.log('[Pause] Final state:', {
      completedChunks: state.completedChunks,
      partialChunks: state.partialChunks,
      loadedBytes: state.loadedBytes,
    })
    return state
  }

  /**
   * 获取当前状态（用于持久化）
   */
  getState(): ChunkedDownloaderState {
    const completedChunks = this.chunks
      .filter((c) => c.completed)
      .map((c) => c.index)

    // 收集部分下载的分块状态
    const partialChunks: PartialChunkState[] = this.chunks
      .filter((c) => !c.completed && c.loadedBytes > 0)
      .map((c) => ({ index: c.index, loadedBytes: c.loadedBytes }))

    const loadedBytes = calculateTotalLoaded(this.chunks)

    return {
      taskId: this.taskId,
      bucketName: this.bucketName,
      key: this.key,
      fileName: this.fileName,
      fileSize: this.fileSize,
      totalChunks: this.chunks.length,
      completedChunks,
      partialChunks,
      loadedBytes,
      pausedAt: Date.now(),
    }
  }

  /**
   * 获取任务 ID
   */
  getTaskId(): string {
    return this.taskId
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
   * 获取实际使用的并发数
   *
   * 优先使用线程池分配的并发数，如果未使用线程池则回退到推荐并发数
   */
  private getEffectiveConcurrency(chunkCount: number): number {
    const recommendedConcurrency = getRecommendedConcurrency(chunkCount, this.maxConcurrency)

    if (this.threadPoolClient) {
      const allocated = this.threadPoolClient.getAllocatedConcurrency()
      // 如果分配了0，表示资源不足，需要等待
      // 但为了优雅降级，至少使用1个并发
      return Math.max(1, Math.min(allocated, recommendedConcurrency))
    }
    return recommendedConcurrency
  }

  /**
   * 下载单个分块（带重试）
   */
  private async downloadChunk(chunk: ChunkInfo): Promise<ChunkDownloadResult> {
    const retryConfig = this.getRetryConfig()

    // 创建重试上下文
    const context: RetryContext = {
      operation: 'download',
      attempt: 0,
      maxAttempts: retryConfig.retryMaxAttempts,
      chunkIndex: chunk.index,
    }

    // 创建 AbortController 用于暂停/取消
    const abortController = new AbortController()

    // 监听暂停/取消状态
    const checkPaused = () => this.paused
    const checkAborted = () => this.aborted

    try {
      const result = await withRetry(
        () => this.downloadChunkOnce(chunk),
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
        transferLogger.retrySucceeded('download', context.attempt, undefined, chunk.index)
      }

      return result
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
   * 下载单个分块（单次尝试）
   */
  private async downloadChunkOnce(chunk: ChunkInfo): Promise<ChunkDownloadResult> {
    if (this.aborted || this.paused) {
      throw new Error(this.paused ? 'Download paused' : 'Download aborted')
    }

    // 计算实际下载范围（支持断点续传）
    const existingPartial = this.partialData.get(chunk.index)
    const resumeOffset = existingPartial ? this.chunks[chunk.index].loadedBytes : 0
    const actualStart = chunk.start + resumeOffset
    const expectedSize = chunk.end - chunk.start + 1
    const remainingSize = expectedSize - resumeOffset

    if (remainingSize <= 0) {
      // 已经完成，不需要下载
      console.log(`[Download] Chunk ${chunk.index} already complete from partial data`)
      if (existingPartial) {
        // 复制数据到新的 ArrayBuffer
        const buffer = new ArrayBuffer(existingPartial.byteLength)
        new Uint8Array(buffer).set(existingPartial)
        this.results.set(chunk.index, buffer)
        this.chunks[chunk.index].completed = true
      }
      return { index: chunk.index, data: this.results.get(chunk.index)!, size: expectedSize }
    }

    transferLogger.chunkStarted(chunk.index, actualStart, chunk.end)

    // 使用断点续传的 Range 请求
    const rangeHeader = createRangeHeader(actualStart, chunk.end)
    const url = `${API_BASE}/buckets/${this.bucketName}/objects/${encodeURIComponent(this.key)}/download`

    console.log(`[Download] Chunk ${chunk.index}: resuming from ${resumeOffset}, requesting ${remainingSize} bytes`)

    let response: Response
    try {
      response = await fetch(url, {
        headers: { Range: rangeHeader },
      })
    } catch (networkError) {
      // 网络错误（可重试）
      const errorMsg = 'network error'
      transferLogger.chunkFailed(chunk.index, errorMsg)
      throw new Error(errorMsg)
    }

    if (!response.ok) {
      // HTTP 错误（包含状态码，用于重试判断）
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`
      transferLogger.chunkFailed(chunk.index, errorMsg)
      throw new Error(errorMsg)
    }

    // 读取响应体
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    // 注册活跃读取器（用于暂停时取消）
    this.activeReaders.set(chunk.index, reader)

    // 如果有部分数据，先创建完整大小的 buffer
    const finalData = new Uint8Array(expectedSize)
    let loadedBytes = resumeOffset

    // 复制已有的部分数据到最终 buffer 的开头
    if (existingPartial) {
      finalData.set(existingPartial, 0)
    }

    try {
      while (true) {
        if (this.aborted || this.paused) {
          // 暂停时保存已下载的部分数据
          const partialBuffer = finalData.slice(0, loadedBytes)
          this.partialData.set(chunk.index, partialBuffer)
          this.chunks[chunk.index].loadedBytes = loadedBytes
          console.log(`[Pause] Chunk ${chunk.index} saved partial data: ${loadedBytes} / ${expectedSize} bytes`)
          reader.cancel()
          throw new Error('Download paused')
        }

        const { done, value } = await reader.read()
        if (done) break

        // 将新数据追加到已有数据后面
        finalData.set(value, loadedBytes)
        loadedBytes += value.length

        // 更新分块进度
        this.chunks[chunk.index].loadedBytes = loadedBytes

        // 节流：仅当距离上次报告超过阈值时才触发回调
        this.reportProgressThrottled()
      }

      // 验证：检查数据是否完整
      if (loadedBytes !== expectedSize) {
        console.warn(`[Download] Chunk ${chunk.index} incomplete: ${loadedBytes} / ${expectedSize} bytes`)

        // 保存部分数据
        const partialBuffer = finalData.slice(0, loadedBytes)
        this.partialData.set(chunk.index, partialBuffer)
        this.chunks[chunk.index].loadedBytes = loadedBytes

        if (this.paused) {
          throw new Error('Download paused')
        }
        throw new Error(`Chunk ${chunk.index} incomplete: expected ${expectedSize}, got ${loadedBytes}`)
      }

      // 标记完成
      this.chunks[chunk.index].completed = true
      // 使用 slice() 确保返回 ArrayBuffer 而不是 ArrayBufferLike
      this.results.set(chunk.index, finalData.buffer.slice(0))
      this.partialData.delete(chunk.index) // 清除部分数据

      transferLogger.chunkCompleted(chunk.index, expectedSize)

      return { index: chunk.index, data: finalData.buffer.slice(0), size: expectedSize }
    } finally {
      // 移除活跃读取器
      this.activeReaders.delete(chunk.index)
    }
  }

  /**
   * 获取重试配置
   */
  private getRetryConfig(): RetryConfig {
    return getRetryConfig()
  }

  /**
   * 报告进度（节流版本）
   *
   * 限制回调频率，避免过于频繁的 UI 更新
   */
  private reportProgressThrottled(): void {
    const now = Date.now()
    if (now - this.lastReportTime < ChunkedDownloader.PROGRESS_THROTTLE_MS) {
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

    const totalLoaded = calculateTotalLoaded(this.chunks)
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

    this.onProgress(totalLoaded, this.fileSize, speed)

    // 输出日志
    transferLogger.progress(
      `${this.bucketName}/${this.key}`,
      totalLoaded,
      this.fileSize,
      speed
    )
  }

  /**
   * 合并所有分块为 Blob
   */
  private mergeChunks(): Blob {
    transferLogger.mergeStarted(this.chunks.length)

    // 验证：检查所有分块是否都有数据
    const missingChunks = this.chunks.filter((chunk) => !this.results.has(chunk.index))
    if (missingChunks.length > 0) {
      console.error('[Merge] Missing chunks:', missingChunks.map(c => c.index))
      console.error('[Merge] Available results:', Array.from(this.results.keys()))
      throw new Error(`Missing ${missingChunks.length} chunks during merge`)
    }

    // 按序号排序并合并
    const sortedChunks = this.chunks
      .filter((chunk) => this.results.has(chunk.index))
      .sort((a, b) => a.index - b.index)
      .map((chunk) => this.results.get(chunk.index)!)

    console.log('[Merge] Merging chunks:', sortedChunks.length, 'total size:', sortedChunks.reduce((sum, b) => sum + b.byteLength, 0))

    const blob = new Blob(sortedChunks, { type: 'application/octet-stream' })

    transferLogger.mergeCompleted(blob.size)

    return blob
  }

  /**
   * 并发执行任务
   *
   * @param items 任务项数组
   * @param concurrency 并发数
   * @param taskFn 任务函数
   */
  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    taskFn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = []
    const executing: Promise<void>[] = []

    for (const item of items) {
      if (this.aborted || this.paused) break

      const promise = taskFn(item)
        .then((result) => {
          results.push(result)
        })
        .finally(() => {
          const index = executing.indexOf(promise)
          if (index > -1) {
            executing.splice(index, 1)
          }
        })

      executing.push(promise as unknown as Promise<void>)

      if (executing.length >= concurrency) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)
    return results
  }
}

/**
 * 判断是否应该使用分块下载
 *
 * @param fileSize 文件大小
 * @param threshold 阈值（默认 10MB）
 * @returns 是否使用分块下载
 */
export function shouldUseChunkedDownload(
  fileSize: number,
  threshold: number = 10 * 1024 * 1024
): boolean {
  return fileSize >= threshold
}
