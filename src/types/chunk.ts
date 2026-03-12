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

// ==================== 分块上传相关类型 ====================

/**
 * 分块上传信息
 */
export interface ChunkUploadInfo {
  /** S3 PartNumber 从 1 开始 */
  partNumber: number
  /** 起始字节位置 */
  start: number
  /** 结束字节位置（不包含） */
  end: number
  /** 分块大小 */
  size: number
  /** 已上传字节数 */
  loadedBytes: number
  /** 是否完成 */
  completed: boolean
  /** 上传完成后返回的 ETag */
  etag?: string
}

/**
 * 已完成的分块（用于 CompleteMultipartUpload）
 */
export interface CompletedPart {
  PartNumber: number
  ETag: string
}

/**
 * 上传会话信息
 */
export interface MultipartUploadSession {
  /** S3 UploadId */
  uploadId: string
  /** 存储桶名称 */
  bucketName: string
  /** 文件键名 */
  key: string
  /** 文件大小 */
  fileSize: number
}

/**
 * 分块上传任务状态
 */
export type ChunkedUploadStatus = 'idle' | 'initializing' | 'uploading' | 'completing' | 'completed' | 'error' | 'aborted'

// ==================== 暂停/恢复相关类型 ====================

/**
 * 服务端分块信息（ListParts API 返回）
 */
export interface ServerPartInfo {
  PartNumber: number
  ETag: string
  Size: number
  LastModified?: string
}

/**
 * ListParts API 响应
 */
export interface ListPartsResponse {
  uploadId: string
  parts: ServerPartInfo[]
  isExpired: boolean
  error?: string
}

/**
 * ChunkedUploader 内部状态（用于持久化）
 */
export interface ChunkedUploaderState {
  /** S3 UploadId */
  uploadId: string
  /** 存储桶名称 */
  bucketName: string
  /** 文件键名 */
  key: string
  /** 文件大小 */
  fileSize: number
  /** 文件名（用于显示） */
  fileName: string
  /** 文件类型 */
  fileType: string
  /** 分块大小 */
  partSize: number
  /** 总分块数 */
  totalParts: number
  /** 已完成的分块信息 */
  completedParts: CompletedPart[]
  /** 已上传字节数 */
  loadedBytes: number
  /** 暂停时间戳 */
  pausedAt: number
}

/**
 * 暂停的上传任务状态（用于持久化到 store）
 */
export interface PausedUploadState {
  /** 任务 ID */
  taskId: string
  /** ChunkedUploader 状态 */
  uploaderState: ChunkedUploaderState
  /** 创建时间 */
  createdAt: number
}
