/**
 * 检测当前是否运行在 Tauri 桌面环境中
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 检测当前是否运行在浏览器环境中
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && !isTauri()
}
