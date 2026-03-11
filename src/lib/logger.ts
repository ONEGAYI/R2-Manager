/**
 * 日志工具
 *
 * 在 Tauri 环境下，拦截所有 console.log/warn/error 输出到日志文件
 * 在浏览器环境下，保持原有行为
 */

import { isTauri } from './isTauri'

// Tauri invoke 函数类型
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null
let initialized = false

/**
 * 初始化日志系统
 * 在 Tauri 环境下会拦截 console 方法
 */
export async function initLogger(): Promise<void> {
  if (initialized) return
  initialized = true

  if (!isTauri()) {
    console.log('[Logger] Browser environment, using native console')
    return
  }

  // 加载 Tauri API
  try {
    tauriInvoke = (await import('@tauri-apps/api/core')).invoke
    console.log('[Logger] Tauri environment detected, installing console interceptor')
  } catch (error) {
    console.warn('[Logger] Failed to load Tauri API:', error)
    return
  }

  // 保存原始 console 方法
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  /**
   * 发送日志到 Tauri 后端
   */
  async function sendToBackend(level: string, ...args: unknown[]): Promise<void> {
    if (!tauriInvoke) return

    try {
      // 将参数转换为字符串
      const message = args
        .map(arg => {
          if (typeof arg === 'string') return arg
          if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`
          try {
            return JSON.stringify(arg, null, 2)
          } catch {
            return String(arg)
          }
        })
        .join(' ')

      await tauriInvoke('log_from_frontend', { message, level })
    } catch {
      // 忽略日志发送错误
    }
  }

  // 重写 console.log
  console.log = (...args: unknown[]) => {
    originalLog.apply(console, args)
    sendToBackend('info', ...args)
  }

  // 重写 console.warn
  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args)
    sendToBackend('warn', ...args)
  }

  // 重写 console.error
  console.error = (...args: unknown[]) => {
    originalError.apply(console, args)
    sendToBackend('error', ...args)
  }

  console.log('[Logger] Console interceptor installed - all logs will be written to file')
}

/**
 * 获取日志文件路径（用于调试）
 */
export function getLogFilePath(): string {
  // Windows: C:\Users\{user}\AppData\Local\Temp\r2manager-debug.log
  // macOS: /var/folders/.../T/r2manager-debug.log
  // Linux: /tmp/r2manager-debug.log
  if (typeof process !== 'undefined' && process.env?.TEMP) {
    return `${process.env.TEMP}\\r2manager-debug.log`
  }
  return '/tmp/r2manager-debug.log'
}
