/**
 * 全局线程池类型定义
 *
 * 用于管理上传/下载任务的全局并发资源分配
 */

/**
 * 任务在线程池中的状态
 */
export type ThreadPoolTaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error'

/**
 * 线程池方向（上传或下载独立管理）
 */
export type ThreadPoolDirection = 'upload' | 'download'

/**
 * 任务槽位信息
 */
export interface TaskSlotInfo {
  /** 任务 ID */
  taskId: string
  /** 请求的并发数 */
  requestedConcurrency: number
  /** 实际分配的并发数 */
  allocatedConcurrency: number
  /** 当前状态 */
  status: ThreadPoolTaskStatus
  /** 注册时间戳 */
  registeredAt: number
  /** 优先级（列表顺序，越小越优先） */
  priority: number
}

/**
 * 线程池客户端接口
 *
 * 分块传输类通过此接口与线程池交互
 */
export interface ThreadPoolClient {
  /**
   * 获取当前分配的并发数
   *
   * 在 start() 方法中调用此方法获取实际可用的并发数
   */
  getAllocatedConcurrency(): number

  /**
   * 释放所有资源
   *
   * 任务完成或取消时调用
   */
  releaseAll(): void

  /**
   * 通知状态变化
   *
   * 暂停/恢复时调用，触发资源重新分配
   */
  notifyStatusChange(status: ThreadPoolTaskStatus): void
}

/**
 * 方向线程池状态
 */
export interface DirectionalPoolState {
  /** 全局并发限制 */
  globalLimit: number
  /** 已注册的任务 */
  tasks: TaskSlotInfo[]
  /** 已使用的并发槽 */
  usedSlots: number
  /** 可用的并发槽 */
  availableSlots: number
}

/**
 * 全局线程池状态
 */
export interface ThreadPoolState {
  upload: DirectionalPoolState
  download: DirectionalPoolState
}
