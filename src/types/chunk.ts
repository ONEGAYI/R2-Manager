/**
 * 分块下载相关类型定义
 */

/**
 * 分块信息
 */
export interface ChunkInfo {
  /** 分块序号（0 开始） */
  index: number
  /** 起始字节位置 */
  start: number
  /** 结束字节位置（包含） */
  end: number
  /** 已下载字节数 */
  loadedBytes: number
  /** 是否完成 */
  completed: boolean
}

/**
 * 分块下载结果
 */
export interface ChunkDownloadResult {
  /** 分块序号 */
  index: number
  /** 下载的数据 */
  data: ArrayBuffer
  /** 数据大小 */
  size: number
}

/**
 * 分块策略配置
 */
export interface ChunkStrategy {
  /** 文件大小阈值（字节） */
  threshold: number
  /** 对应的分块数 */
  chunks: number
}

/**
 * 默认分块策略
 * - < 10MB: 不分块
 * - 10-50MB: 2 块
 * - 50-200MB: 4 块
 * - > 200MB: 8 块
 */
export const DEFAULT_CHUNK_STRATEGIES: ChunkStrategy[] = [
  { threshold: 10 * 1024 * 1024, chunks: 1 },    // < 10MB
  { threshold: 50 * 1024 * 1024, chunks: 2 },    // 10-50MB
  { threshold: 200 * 1024 * 1024, chunks: 4 },   // 50-200MB
  { threshold: Infinity, chunks: 8 },            // > 200MB
]

/**
 * 分块下载任务状态
 */
export type ChunkedDownloadStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'
