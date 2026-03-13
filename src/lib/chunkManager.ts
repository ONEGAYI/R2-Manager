/**
 * 分块管理器
 *
 * 负责计算文件分块、进度计算、Range 请求头生成
 */

import type { ChunkInfo, ChunkStrategy } from '@/types/chunk'
import {
  DEFAULT_CHUNK_STRATEGIES,
  S3_MAX_PART_COUNT,
} from '@/types/chunk'

/**
 * 根据文件大小计算分块信息
 *
 * @param fileSize 文件大小（字节）
 * @param strategies 分块策略（默认使用 DEFAULT_CHUNK_STRATEGIES）
 * @returns 分块信息数组
 */
export function calculateChunks(
  fileSize: number,
  strategies: ChunkStrategy[] = DEFAULT_CHUNK_STRATEGIES
): ChunkInfo[] {
  // 确定分块数
  let chunkCount = 1
  for (const strategy of strategies) {
    if (fileSize < strategy.threshold) {
      chunkCount = strategy.chunks
      break
    }
  }

  // 不分块时返回单个分块
  if (chunkCount === 1) {
    return [{
      index: 0,
      start: 0,
      end: fileSize - 1,
      loadedBytes: 0,
      completed: false,
    }]
  }

  // 计算每块大小（向上取整，确保覆盖整个文件）
  const chunkSize = Math.ceil(fileSize / chunkCount)
  const chunks: ChunkInfo[] = []

  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize - 1, fileSize - 1)

    chunks.push({
      index: i,
      start,
      end,
      loadedBytes: 0,
      completed: false,
    })
  }

  return chunks
}

/**
 * 计算总下载进度
 *
 * @param chunks 分块信息数组
 * @param fileSize 文件总大小
 * @returns 进度百分比（0-100）
 */
export function calculateTotalProgress(chunks: ChunkInfo[], fileSize: number): number {
  if (fileSize === 0) return 0

  const totalLoaded = chunks.reduce((sum, chunk) => sum + chunk.loadedBytes, 0)
  return Math.round((totalLoaded / fileSize) * 100)
}

/**
 * 计算总已下载字节数
 *
 * @param chunks 分块信息数组
 * @returns 已下载字节数
 */
export function calculateTotalLoaded(chunks: ChunkInfo[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.loadedBytes, 0)
}

/**
 * 生成 Range 请求头
 *
 * @param start 起始字节
 * @param end 结束字节
 * @returns Range 请求头值，如 "bytes=0-1023"
 */
export function createRangeHeader(start: number, end: number): string {
  return `bytes=${start}-${end}`
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

/**
 * 获取推荐的并发线程数
 *
 * @param chunkCount 分块数
 * @param maxThreads 最大线程数（从配置读取）
 * @returns 推荐的并发数
 */
export function getRecommendedConcurrency(chunkCount: number, maxThreads: number): number {
  // 并发数不超过分块数，也不超过用户配置的最大线程数
  return Math.min(chunkCount, maxThreads)
}

/**
 * 格式化字节大小为可读字符串
 *
 * @param bytes 字节数
 * @returns 格式化后的字符串，如 "10.5 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

/**
 * 根据固定步长计算分块信息
 *
 * @param fileSize 文件大小（字节）
 * @param stepSize 分块步长（字节）
 * @param maxPartCount 最大分块数（默认 S3 限制 10000）
 * @returns 分块信息数组
 */
export function calculateChunksByStep(
  fileSize: number,
  stepSize: number,
  maxPartCount: number = S3_MAX_PART_COUNT
): ChunkInfo[] {
  // 计算初始分块数
  let chunkCount = Math.ceil(fileSize / stepSize)

  // 如果分块数超过最大限制，自动增大步长
  if (chunkCount > maxPartCount) {
    stepSize = Math.ceil(fileSize / maxPartCount)
    chunkCount = maxPartCount
  }

  // 不分块时返回单个分块
  if (chunkCount <= 1) {
    return [{
      index: 0,
      start: 0,
      end: fileSize - 1,
      loadedBytes: 0,
      completed: false,
    }]
  }

  const chunks: ChunkInfo[] = []

  for (let i = 0; i < chunkCount; i++) {
    const start = i * stepSize
    const end = Math.min(start + stepSize - 1, fileSize - 1)

    chunks.push({
      index: i,
      start,
      end,
      loadedBytes: 0,
      completed: false,
    })
  }

  return chunks
}
