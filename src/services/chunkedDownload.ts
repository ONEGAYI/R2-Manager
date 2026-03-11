/**
 * 分块下载服务
 *
 * 实现多线程分块下载、并发控制、进度回调、分块合并
 */

import type { ChunkInfo, ChunkDownloadResult } from '@/types/chunk'
import {
  calculateChunks,
  createRangeHeader,
  calculateTotalLoaded,
  getRecommendedConcurrency,
} from '@/lib/chunkManager'
import { transferLogger } from '@/lib/transferLogger'

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
  /** 最大并发线程数 */
  maxConcurrency?: number
  /** 进度回调 */
  onProgress?: ProgressCallback
}

/**
 * 分块下载器
 *
 * 使用多线程并发下载文件分块，支持进度回调和取消
 */
export class ChunkedDownloader {
  private bucketName: string
  private key: string
  private fileSize: number
  private maxConcurrency: number
  private onProgress?: ProgressCallback

  private chunks: ChunkInfo[] = []
  private results: Map<number, ArrayBuffer> = new Map()
  private aborted: boolean = false
  private startTime: number = 0
  private lastReportTime: number = 0
  private lastLoadedBytes: number = 0
  private lastSpeedTime: number = 0

  /** 进度报告节流间隔（毫秒） */
  private static readonly PROGRESS_THROTTLE_MS = 200

  constructor(options: ChunkedDownloaderOptions) {
    this.bucketName = options.bucketName
    this.key = options.key
    this.fileSize = options.fileSize
    this.maxConcurrency = options.maxConcurrency ?? 4
    this.onProgress = options.onProgress
  }

  /**
   * 开始下载
   *
   * @returns 下载完成后的 Blob
   */
  async start(): Promise<Blob> {
    this.startTime = Date.now()
    this.lastReportTime = 0
    this.lastLoadedBytes = 0
    this.lastSpeedTime = Date.now()
    this.aborted = false
    this.results.clear()

    // 计算分块
    this.chunks = calculateChunks(this.fileSize)
    const concurrency = getRecommendedConcurrency(this.chunks.length, this.maxConcurrency)

    transferLogger.usingChunkedMode(this.fileSize, this.chunks.length, concurrency)

    // 并发下载所有分块
    await this.runWithConcurrency(
      this.chunks,
      concurrency,
      (chunk) => this.downloadChunk(chunk)
    )

    if (this.aborted) {
      throw new Error('Download aborted')
    }

    // 强制报告最终进度（确保显示 100%）
    this.reportProgress()

    // 合并分块
    const blob = this.mergeChunks()
    const duration = Date.now() - this.startTime

    transferLogger.taskCompleted(`${this.bucketName}/${this.key}`, duration)

    return blob
  }

  /**
   * 取消下载
   */
  abort(): void {
    this.aborted = true
    transferLogger.downloadAborted(`${this.bucketName}/${this.key}`)
  }

  /**
   * 下载单个分块
   */
  private async downloadChunk(chunk: ChunkInfo): Promise<ChunkDownloadResult> {
    if (this.aborted) {
      throw new Error('Download aborted')
    }

    transferLogger.chunkStarted(chunk.index, chunk.start, chunk.end)

    const rangeHeader = createRangeHeader(chunk.start, chunk.end)
    const url = `${API_BASE}/buckets/${this.bucketName}/objects/${encodeURIComponent(this.key)}/download`

    const response = await fetch(url, {
      headers: { Range: rangeHeader },
    })

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      transferLogger.chunkFailed(chunk.index, error)
      throw error
    }

    // 读取响应体为 ArrayBuffer
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const chunks: Uint8Array[] = []
    let loadedBytes = 0

    while (true) {
      if (this.aborted) {
        reader.cancel()
        throw new Error('Download aborted')
      }

      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loadedBytes += value.length

      // 更新分块进度（始终更新，用于最终统计）
      this.chunks[chunk.index].loadedBytes = loadedBytes

      // 节流：仅当距离上次报告超过阈值时才触发回调
      this.reportProgressThrottled()
    }

    // 合并分块数据
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0)
    const data = new Uint8Array(totalSize)
    let offset = 0
    for (const c of chunks) {
      data.set(c, offset)
      offset += c.length
    }

    // 标记完成
    this.chunks[chunk.index].completed = true
    this.results.set(chunk.index, data.buffer)

    transferLogger.chunkCompleted(chunk.index, totalSize)

    return { index: chunk.index, data: data.buffer, size: totalSize }
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

    // 按序号排序并合并
    const sortedChunks = this.chunks
      .filter((chunk) => this.results.has(chunk.index))
      .sort((a, b) => a.index - b.index)
      .map((chunk) => this.results.get(chunk.index)!)

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
      if (this.aborted) break

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
