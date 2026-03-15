/**
 * 跨平台确认对话框
 * 在 Tauri 环境中使用原生对话框，在浏览器中使用 window.confirm
 */

import { isTauri } from './isTauri'

/**
 * 显示确认对话框
 * @param message 确认消息
 * @param title 对话框标题（仅 Tauri 环境）
 * @returns 用户是否确认
 */
export async function confirm(message: string, title?: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog')
      return await ask(message, {
        title: title || '确认',
        kind: 'warning',
      })
    } catch (error) {
      console.warn('Tauri dialog failed, falling back to window.confirm:', error)
      return window.confirm(message)
    }
  }

  return window.confirm(message)
}
