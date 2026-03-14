/**
 * 传输方向
 */
export type TransferDirection = 'upload' | 'download' | 'copy' | 'move'

/**
 * 批量操作子项状态
 */
export interface BatchOperationItem {
  sourceKey: string
  destinationKey: string
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'error'
  error?: string
}

/**
 * 传输操作类型
 */
export type TransferOperation = 'upload' | 'download' | 'copy' | 'move'

/**
 * 传输状态
 */
export type TransferStatus = 'pending' | 'running' | 'paused' | 'retrying' | 'completed' | 'error'

/**
 * 暂停状态的任务（用于持久化恢复）
 */
export interface PausedTask {
  /** 任务 ID */
  taskId: string
  /** 任务创建时间 */
  createdAt: number
  /** 任务数据（用于恢复 UI） */
  taskData: {
    direction: 'upload'
    fileName: string
    filePath: string
    bucketName: string
    fileSize: number
    progress: number
    loadedBytes: number
    startTime: number
  }
}

/**
 * 传输任务（进行中的任务）
 */
export interface TransferTask {
  id: string
  direction: TransferDirection
  operation?: TransferOperation    // 操作类型（上传/下载/复制/移动）
  fileName: string
  filePath: string           // R2 key
  bucketName: string
  fileSize: number
  progress: number           // 0-100
  loadedBytes: number        // 已传输字节数
  speed: number              // B/s
  status: TransferStatus
  error?: string
  startTime: number
  file?: File                // 仅上传，用于引用原始文件
  localPath?: string         // 仅下载，本地保存路径
  xhr?: XMLHttpRequest       // 用于取消请求
  // 批量操作相关字段
  sourceKey?: string         // 源路径（复制/移动）
  destinationBucket?: string // 目标桶（跨桶操作）
  totalItems?: number        // 总项目数（批量操作）
  completedItems?: number    // 已完成项目数
  items?: BatchOperationItem[]  // 批量操作的子项列表
  currentSourceKey?: string  // 当前正在处理的源文件路径
  // 重试相关字段
  retrying?: boolean         // 是否正在重试
  retryAttempt?: number      // 当前重试次数
  retryMaxAttempts?: number  // 最大重试次数
  retryError?: string        // 重试错误信息
}

/**
 * 批量操作结果详情项
 */
export interface ResultDetailItem {
  sourceKey: string
  status: 'success' | 'skipped' | 'error' | 'renamed'
  error?: string
  skipReason?: string
  renamedTo?: string
}

/**
 * 批量操作结果详情
 */
export interface ResultDetails {
  totalSuccess: number
  totalSkipped: number
  totalErrors: number
  totalRenamed?: number
  items: ResultDetailItem[]
}

/**
 * 传输历史记录（已完成的任务）
 */
export interface TransferHistory {
  id: string
  direction: TransferDirection
  operation?: 'copy' | 'move'  // 操作类型
  fileName: string
  filePath: string
  bucketName: string
  fileSize: number
  status: 'completed' | 'error' | 'partial'  // 新增 partial 部分成功
  error?: string
  startTime: number
  completedAt: number
  localPath?: string         // 下载文件的本地路径
  resultDetails?: ResultDetails  // 批量操作结果详情
}

/**
 * 传输页面标签类型
 */
export type TransferTab = 'uploading' | 'downloading' | 'batchOperations' | 'uploadCompleted' | 'downloadCompleted' | 'batchCompleted'
