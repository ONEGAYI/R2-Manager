/**
 * 传输日志模块
 *
 * 提供统一的传输日志输出，支持进度节流
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/** 日志前缀 */
const LOG_PREFIX = '[Transfer]'

/** 进度日志节流间隔（毫秒） */
const PROGRESS_THROTTLE_MS = 1000

/** 进度日志上次输出时间 */
let lastProgressLogTime = 0

/**
 * 格式化时间戳
 */
function formatTime(): string {
  const now = new Date()
  return now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 输出日志
 */
function log(level: LogLevel, ...args: unknown[]): void {
  const timestamp = formatTime()
  const prefix = `${LOG_PREFIX} [${timestamp}]`

  switch (level) {
    case 'error':
      console.error(prefix, ...args)
      break
    case 'warn':
      console.warn(prefix, ...args)
      break
    case 'debug':
      console.debug(prefix, ...args)
      break
    default:
      console.log(prefix, ...args)
  }
}

export const transferLogger = {
  /**
   * 任务创建
   */
  taskCreated(taskId: string, fileName: string, fileSize: number): void {
    log('info', `Task created: ${taskId}`, {
      fileName,
      fileSize: formatSize(fileSize),
    })
  },

  /**
   * 任务开始
   */
  taskStarted(taskId: string, chunkCount: number): void {
    log('info', `Task started: ${taskId}`, { chunkCount })
  },

  /**
   * 任务完成
   */
  taskCompleted(taskId: string, duration: number): void {
    log('info', `Task completed: ${taskId}`, {
      duration: `${(duration / 1000).toFixed(2)}s`,
    })
  },

  /**
   * 任务失败
   */
  taskFailed(taskId: string, error: Error | string): void {
    const errorMsg = error instanceof Error ? error.message : error
    log('error', `Task failed: ${taskId}`, { error: errorMsg })
  },

  /**
   * 分块开始下载
   */
  chunkStarted(index: number, start: number, end: number): void {
    log('info', `Chunk ${index} started`, {
      range: `${formatSize(start)} - ${formatSize(end)}`,
    })
  },

  /**
   * 分块下载完成
   */
  chunkCompleted(index: number, size: number): void {
    log('info', `Chunk ${index} completed`, { size: formatSize(size) })
  },

  /**
   * 分块下载失败
   */
  chunkFailed(index: number, error: Error | string): void {
    const errorMsg = error instanceof Error ? error.message : error
    log('error', `Chunk ${index} failed`, { error: errorMsg })
  },

  /**
   * 进度更新（节流）
   */
  progress(
    taskId: string,
    loaded: number,
    total: number,
    speed: number,
    force: boolean = false
  ): void {
    const now = Date.now()

    // 节流检查（除非强制输出）
    if (!force && now - lastProgressLogTime < PROGRESS_THROTTLE_MS) {
      return
    }

    lastProgressLogTime = now
    const percent = ((loaded / total) * 100).toFixed(1)
    log('debug', `Progress: ${taskId}`, {
      percent: `${percent}%`,
      loaded: formatSize(loaded),
      total: formatSize(total),
      speed: `${formatSize(speed)}/s`,
    })
  },

  /**
   * 分块合并开始
   */
  mergeStarted(chunkCount: number): void {
    log('info', `Merging ${chunkCount} chunks...`)
  },

  /**
   * 分块合并完成
   */
  mergeCompleted(totalSize: number): void {
    log('info', `Merge completed`, { totalSize: formatSize(totalSize) })
  },

  /**
   * 下载被取消
   */
  downloadAborted(taskId: string): void {
    log('warn', `Download aborted: ${taskId}`)
  },

  /**
   * 使用分块下载模式
   */
  usingChunkedMode(fileSize: number, chunkCount: number, concurrency: number): void {
    log('info', 'Using chunked download mode', {
      fileSize: formatSize(fileSize),
      chunkCount,
      concurrency,
    })
  },

  /**
   * 使用单线程下载模式
   */
  usingSingleThreadMode(fileSize: number): void {
    log('info', 'Using single-thread download mode', {
      fileSize: formatSize(fileSize),
    })
  },

  // ==================== 分块上传相关日志 ====================

  /**
   * 分块上传初始化成功
   */
  uploadInitiated(uploadId: string, taskId: string): void {
    log('info', 'Multipart upload initiated', { uploadId, taskId })
  },

  /**
   * 使用分块上传模式
   */
  usingChunkedUploadMode(fileSize: number, partCount: number, concurrency: number): void {
    log('info', 'Using chunked upload mode', {
      fileSize: formatSize(fileSize),
      partCount,
      concurrency,
    })
  },

  /**
   * 分块上传开始
   */
  uploadPartStarted(partNumber: number, start: number, end: number): void {
    log('info', `Part ${partNumber} upload started`, {
      range: `${formatSize(start)} - ${formatSize(end)}`,
    })
  },

  /**
   * 分块上传完成
   */
  uploadPartCompleted(partNumber: number, size: number): void {
    log('info', `Part ${partNumber} upload completed`, { size: formatSize(size) })
  },

  /**
   * 分块上传失败
   */
  uploadPartFailed(partNumber: number, error: Error | string): void {
    const errorMsg = error instanceof Error ? error.message : error
    log('error', `Part ${partNumber} upload failed`, { error: errorMsg })
  },

  /**
   * 正在完成分块上传合并
   */
  uploadCompleting(partCount: number): void {
    log('info', `Completing multipart upload with ${partCount} parts...`)
  },

  /**
   * 分块上传合并完成
   */
  uploadCompleted(key: string, location?: string): void {
    log('info', 'Multipart upload completed', { key, location })
  },

  /**
   * 上传被取消
   */
  uploadAborted(taskId: string): void {
    log('warn', `Upload aborted: ${taskId}`)
  },
}

/**
 * 格式化字节大小
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

export default transferLogger
