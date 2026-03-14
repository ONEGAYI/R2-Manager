/**
 * 重试机制核心逻辑
 *
 * 提供指数退避 + 随机抖动的重试策略
 */

import type { RetryConfig, RetryContext } from '@/types/retry'
import { DEFAULT_RETRY_SETTINGS } from '@/types/retry'
import { transferLogger } from '@/lib/transferLogger'
import { useConfigStore } from '@/stores/configStore'

/**
 * 可重试的 HTTP 状态码
 */
export const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

/**
 * 可重试的错误类型
 */
const RETRYABLE_ERROR_PATTERNS = [
  /network error/i,
  /timeout/i,
  /abort/i,
  /failed to fetch/i,
  /networkerror/i,
]

/**
 * 判断错误是否可重试
 *
 * @param error 错误对象或错误消息
 * @param retryableStatusCodes 可重试的状态码列表
 * @returns 是否可重试
 */
export function isRetryableError(
  error: Error | string,
  retryableStatusCodes: number[] = RETRYABLE_STATUS_CODES
): boolean {
  const errorMsg = error instanceof Error ? error.message : error

  // 检查 HTTP 状态码
  const httpMatch = errorMsg.match(/HTTP\s*(\d{3})/i)
  if (httpMatch) {
    const statusCode = parseInt(httpMatch[1], 10)
    return retryableStatusCodes.includes(statusCode)
  }

  // 检查网络错误类型
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return true
    }
  }

  return false
}

/**
 * 计算重试延迟（指数退避 + 随机抖动）
 *
 * @param attempt 当前尝试次数（0-indexed）
 * @param baseDelay 基础延迟 ms
 * @param maxDelay 最大延迟 ms
 * @returns 延迟时间 ms
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number = DEFAULT_RETRY_SETTINGS.retryBaseDelay,
  maxDelay: number = DEFAULT_RETRY_SETTINGS.retryMaxDelay
): number {
  // 指数退避：baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)

  // 随机抖动（30%）
  const jitter = Math.random() * 0.3 * exponentialDelay

  // 限制最大延迟
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * 支持 AbortSignal 的等待函数
 *
 * @param ms 等待时间 ms
 * @param signal 可选的 AbortSignal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }

    const timeout = setTimeout(() => {
      resolve()
    }, ms)

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      reject(new Error('Aborted'))
    })
  })
}

/**
 * 重试配置选项
 */
export interface WithRetryOptions {
  /** 重试配置 */
  config: RetryConfig
  /** 重试上下文 */
  context: RetryContext
  /** AbortSignal（用于暂停/取消） */
  signal?: AbortSignal
  /** 暂停检查函数 */
  isPaused?: () => boolean
  /** 取消检查函数 */
  isAborted?: () => boolean
}

/**
 * 带重试的异步操作包装器
 *
 * @param fn 要执行的异步函数
 * @param options 重试选项
 * @returns 函数执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions
): Promise<T> {
  const { config, context, signal, isPaused, isAborted } = options
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.retryMaxAttempts; attempt++) {
    // 检查暂停/取消状态
    if (isAborted?.() || signal?.aborted) {
      throw new Error('Aborted')
    }
    if (isPaused?.()) {
      throw new Error('Paused')
    }

    try {
      const result = await fn()
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 检查是否可重试
      if (!isRetryableError(lastError, config.retryableStatusCodes)) {
        // 不可重试的错误，立即抛出
        transferLogger.retryFailed(
          context.operation,
          lastError.message,
          attempt,
          'non-retryable',
          context.partNumber,
          context.chunkIndex
        )
        throw lastError
      }

      // 达到最大重试次数
      if (attempt === config.retryMaxAttempts) {
        transferLogger.retryFailed(
          context.operation,
          lastError.message,
          attempt + 1,
          'max-attempts',
          context.partNumber,
          context.chunkIndex
        )
        break
      }

      // 计算延迟
      const delay = calculateDelay(attempt, config.retryBaseDelay, config.retryMaxDelay)

      // 记录重试计划
      transferLogger.retryScheduled(
        context.operation,
        attempt + 1,
        delay,
        lastError.message,
        context.partNumber,
        context.chunkIndex
      )

      // 等待重试（支持中断）
      try {
        await sleep(delay, signal)
      } catch (sleepError) {
        // 等待被中断（暂停/取消）
        throw new Error(isPaused?.() ? 'Paused' : 'Aborted')
      }
    }
  }

  // 所有重试都失败
  throw lastError
}

/**
 * 从 configStore 获取重试配置
 */
export function getRetryConfig(): RetryConfig {
  const state = useConfigStore.getState()

  return {
    retryMaxAttempts: state.retryMaxAttempts ?? DEFAULT_RETRY_SETTINGS.retryMaxAttempts,
    retryBaseDelay: state.retryBaseDelay ?? DEFAULT_RETRY_SETTINGS.retryBaseDelay,
    retryMaxDelay: state.retryMaxDelay ?? DEFAULT_RETRY_SETTINGS.retryMaxDelay,
    retryableStatusCodes: RETRYABLE_STATUS_CODES,
  }
}
