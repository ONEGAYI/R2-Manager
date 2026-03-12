/**
 * 传输方向
 */
export type TransferDirection = 'upload' | 'download'

/**
 * 传输状态
 */
export type TransferStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error'

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
}

/**
 * 传输历史记录（已完成的任务）
 */
export interface TransferHistory {
  id: string
  direction: TransferDirection
  fileName: string
  filePath: string
  bucketName: string
  fileSize: number
  status: 'completed' | 'error'
  error?: string
  startTime: number
  completedAt: number
  localPath?: string         // 下载文件的本地路径
}

/**
 * 传输页面标签类型
 */
export type TransferTab = 'uploading' | 'downloading' | 'uploadCompleted' | 'downloadCompleted'
