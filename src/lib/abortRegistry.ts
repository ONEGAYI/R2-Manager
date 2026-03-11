/**
 * 任务取消注册表
 *
 * 用于实现"真取消"机制：
 * - 注册每个任务的 abort 函数
 * - 取消时调用对应的 abort 函数清理资源
 */

/**
 * 全局 abort 函数注册表
 * key: taskId
 * value: abort 函数
 */
const abortRegistry = new Map<string, () => void>()

/**
 * 注册 abort 函数
 *
 * @param taskId 任务 ID
 * @param abortFn 取消函数（调用后清理资源）
 */
export function registerAbortFn(taskId: string, abortFn: () => void): void {
  abortRegistry.set(taskId, abortFn)
}

/**
 * 取消任务（真取消）
 *
 * 调用注册的 abort 函数，执行实际的清理操作
 *
 * @param taskId 任务 ID
 * @returns 是否成功调用 abort 函数
 */
export function abortTask(taskId: string): boolean {
  const abortFn = abortRegistry.get(taskId)
  if (abortFn) {
    try {
      abortFn()
    } catch (error) {
      console.error(`[AbortRegistry] Error executing abort for task ${taskId}:`, error)
    }
    abortRegistry.delete(taskId)
    return true
  }
  return false
}

/**
 * 注销 abort 函数（任务完成时调用）
 *
 * @param taskId 任务 ID
 */
export function unregisterAbortFn(taskId: string): void {
  abortRegistry.delete(taskId)
}

/**
 * 检查是否存在指定的 abort 函数
 *
 * @param taskId 任务 ID
 */
export function hasAbortFn(taskId: string): boolean {
  return abortRegistry.has(taskId)
}

/**
 * 清空所有注册的 abort 函数
 */
export function clearAbortRegistry(): void {
  abortRegistry.clear()
}
