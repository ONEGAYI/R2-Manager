/**
 * 重试机制类型定义
 */

/**
 * 重试设置配置
 */
export interface RetrySettings {
  /** 最大重试次数 (0-10) */
  retryMaxAttempts: number
  /** 基础延迟 ms (500-5000) */
  retryBaseDelay: number
  /** 最大延迟 ms (10000-60000) */
  retryMaxDelay: number
}

/**
 * 默认重试设置
 */
export const DEFAULT_RETRY_SETTINGS: RetrySettings = {
  retryMaxAttempts: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 30000,
}

/**
 * 重试配置（用于 withRetry 函数）
 */
export interface RetryConfig extends RetrySettings {
  /** 可重试的 HTTP 状态码 */
  retryableStatusCodes: number[]
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_SETTINGS,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

/**
 * 重试上下文信息
 */
export interface RetryContext {
  /** 操作类型（upload/download） */
  operation: string
  /** 当前尝试次数 */
  attempt: number
  /** 最大尝试次数 */
  maxAttempts: number
  /** 分块编号（可选） */
  partNumber?: number
  /** 分块索引（可选） */
  chunkIndex?: number
}
