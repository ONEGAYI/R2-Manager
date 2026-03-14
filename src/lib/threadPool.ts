/**
 * 全局线程池管理器
 *
 * 实现两个独立的全局线程池（上传和下载），按传输中心任务顺序动态分配并发资源。
 * 核心特性：
 * - 上传和下载分开设置线程池
 * - 按任务列表顺序分配资源（从上到下）
 * - 暂停的任务自动释放资源给后续任务
 * - 支持配置热更新
 */

import type {
  ThreadPoolTaskStatus,
  ThreadPoolDirection,
  TaskSlotInfo,
  ThreadPoolClient,
  ThreadPoolState,
  DirectionalPoolState,
} from '@/types/threadPool'
import { useConfigStore } from '@/stores/configStore'

/**
 * 方向线程池
 *
 * 管理单个方向（上传或下载）的并发资源
 */
class DirectionalThreadPool {
  private globalLimit: number
  private taskRegistry: Map<string, TaskSlotInfo> = new Map()
  private priorityCounter: number = 0
  private direction: ThreadPoolDirection

  constructor(direction: ThreadPoolDirection, initialLimit: number) {
    this.direction = direction
    this.globalLimit = initialLimit
  }

  /**
   * 更新全局并发限制
   *
   * 配置热更新时调用
   */
  updateGlobalLimit(newLimit: number): void {
    if (this.globalLimit !== newLimit) {
      console.log(`[ThreadPool:${this.direction}] Global limit updated: ${this.globalLimit} -> ${newLimit}`)
      this.globalLimit = newLimit
      this.reallocate()
    }
  }

  /**
   * 获取当前全局限制
   */
  getGlobalLimit(): number {
    return this.globalLimit
  }

  /**
   * 注册任务
   *
   * @param taskId 任务 ID
   * @param requestedConcurrency 请求的并发数
   * @returns 分配的并发数
   */
  registerTask(taskId: string, requestedConcurrency: number): number {
    if (this.taskRegistry.has(taskId)) {
      console.warn(`[ThreadPool:${this.direction}] Task ${taskId} already registered`)
      return this.taskRegistry.get(taskId)!.allocatedConcurrency
    }

    const taskInfo: TaskSlotInfo = {
      taskId,
      requestedConcurrency,
      allocatedConcurrency: 0,
      status: 'pending',
      registeredAt: Date.now(),
      priority: this.priorityCounter++,
    }

    this.taskRegistry.set(taskId, taskInfo)
    console.log(`[ThreadPool:${this.direction}] Task registered: ${taskId}, requested: ${requestedConcurrency}`)

    // 触发重新分配
    this.reallocate()

    return taskInfo.allocatedConcurrency
  }

  /**
   * 注销任务
   *
   * 任务完成或取消时调用
   */
  unregisterTask(taskId: string): void {
    if (!this.taskRegistry.has(taskId)) {
      return
    }

    this.taskRegistry.delete(taskId)
    console.log(`[ThreadPool:${this.direction}] Task unregistered: ${taskId}`)

    // 触发重新分配
    this.reallocate()
  }

  /**
   * 更新任务状态
   *
   * @param taskId 任务 ID
   * @param status 新状态
   */
  updateTaskStatus(taskId: string, status: ThreadPoolTaskStatus): void {
    const task = this.taskRegistry.get(taskId)
    if (!task) {
      console.warn(`[ThreadPool:${this.direction}] Task ${taskId} not found for status update`)
      return
    }

    if (task.status !== status) {
      const oldStatus = task.status
      task.status = status
      console.log(`[ThreadPool:${this.direction}] Task ${taskId} status changed: ${oldStatus} -> ${status}`)

      // 状态变化可能需要重新分配资源
      if (status === 'paused' || status === 'completed' || status === 'error') {
        this.reallocate()
      } else if (status === 'running' && oldStatus === 'paused') {
        this.reallocate()
      }
    }
  }

  /**
   * 获取任务当前分配的并发数
   */
  getAllocatedConcurrency(taskId: string): number {
    const task = this.taskRegistry.get(taskId)
    return task?.allocatedConcurrency ?? 0
  }

  /**
   * 创建任务客户端
   */
  createClient(taskId: string): ThreadPoolClient {
    const self = this

    return {
      getAllocatedConcurrency(): number {
        return self.getAllocatedConcurrency(taskId)
      },

      releaseAll(): void {
        self.unregisterTask(taskId)
      },

      notifyStatusChange(status: ThreadPoolTaskStatus): void {
        self.updateTaskStatus(taskId, status)
      },
    }
  }

  /**
   * 核心分配算法
   *
   * 1. 按任务优先级（列表顺序）排序
   * 2. 重置所有任务的 allocated 为 0
   * 3. 从高到低遍历，只给 running 或 pending 状态的任务分配
   * 4. 每个任务最多分配 min(requested, availableSlots)
   * 5. 资源耗尽时停止分配
   */
  private reallocate(): void {
    // 获取所有任务并按优先级排序
    const tasks = Array.from(this.taskRegistry.values()).sort((a, b) => a.priority - b.priority)

    // 重置所有任务的分配
    for (const task of tasks) {
      task.allocatedConcurrency = 0
    }

    let availableSlots = this.globalLimit

    // 从高优先级到低优先级分配
    for (const task of tasks) {
      // 只给运行中或待运行的任务分配资源
      if (task.status !== 'running' && task.status !== 'pending') {
        continue
      }

      if (availableSlots <= 0) {
        break
      }

      const allocation = Math.min(task.requestedConcurrency, availableSlots)
      task.allocatedConcurrency = allocation
      availableSlots -= allocation

      console.log(
        `[ThreadPool:${this.direction}] Allocated ${allocation} slots to task ${task.taskId} (requested: ${task.requestedConcurrency}, remaining: ${availableSlots})`
      )
    }
  }

  /**
   * 获取调试状态
   */
  getDebugState(): DirectionalPoolState {
    const tasks = Array.from(this.taskRegistry.values())
    const usedSlots = tasks.reduce((sum, t) => sum + t.allocatedConcurrency, 0)

    return {
      globalLimit: this.globalLimit,
      tasks,
      usedSlots,
      availableSlots: this.globalLimit - usedSlots,
    }
  }
}

/**
 * 全局线程池管理器（单例）
 *
 * 管理上传和下载两个独立的线程池
 */
class GlobalThreadPoolManager {
  private uploadPool: DirectionalThreadPool
  private downloadPool: DirectionalThreadPool
  private unsubscribe: (() => void) | null = null

  constructor() {
    // 从 configStore 获取初始配置
    const config = useConfigStore.getState()
    this.uploadPool = new DirectionalThreadPool('upload', config.maxUploadThreads)
    this.downloadPool = new DirectionalThreadPool('download', config.maxDownloadThreads)

    // 监听配置变化
    this.setupConfigSubscription()

    console.log('[ThreadPool] Initialized with config:', {
      upload: config.maxUploadThreads,
      download: config.maxDownloadThreads,
    })
  }

  /**
   * 设置配置订阅
   */
  private setupConfigSubscription(): void {
    this.unsubscribe = useConfigStore.subscribe((state, prevState) => {
      if (state.maxUploadThreads !== prevState.maxUploadThreads) {
        this.uploadPool.updateGlobalLimit(state.maxUploadThreads)
      }
      if (state.maxDownloadThreads !== prevState.maxDownloadThreads) {
        this.downloadPool.updateGlobalLimit(state.maxDownloadThreads)
      }
    })
  }

  /**
   * 注册任务
   *
   * @param taskId 任务 ID
   * @param direction 方向（upload/download）
   * @param requestedConcurrency 请求的并发数
   * @returns 分配的并发数
   */
  registerTask(
    taskId: string,
    direction: ThreadPoolDirection,
    requestedConcurrency: number
  ): number {
    const pool = direction === 'upload' ? this.uploadPool : this.downloadPool
    return pool.registerTask(taskId, requestedConcurrency)
  }

  /**
   * 注销任务
   */
  unregisterTask(taskId: string, direction: ThreadPoolDirection): void {
    const pool = direction === 'upload' ? this.uploadPool : this.downloadPool
    pool.unregisterTask(taskId)
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(
    taskId: string,
    direction: ThreadPoolDirection,
    status: ThreadPoolTaskStatus
  ): void {
    const pool = direction === 'upload' ? this.uploadPool : this.downloadPool
    pool.updateTaskStatus(taskId, status)
  }

  /**
   * 获取任务当前分配的并发数
   */
  getAllocatedConcurrency(taskId: string, direction: ThreadPoolDirection): number {
    const pool = direction === 'upload' ? this.uploadPool : this.downloadPool
    return pool.getAllocatedConcurrency(taskId)
  }

  /**
   * 创建任务客户端
   */
  createClient(taskId: string, direction: ThreadPoolDirection): ThreadPoolClient {
    const pool = direction === 'upload' ? this.uploadPool : this.downloadPool
    return pool.createClient(taskId)
  }

  /**
   * 获取调试状态
   */
  getDebugState(): ThreadPoolState {
    return {
      upload: this.uploadPool.getDebugState(),
      download: this.downloadPool.getDebugState(),
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }
}

// 导出单例
export const globalThreadPool = new GlobalThreadPoolManager()

// 开发环境下暴露调试接口
if (import.meta.env.DEV) {
  ;(window as unknown as { threadPoolDebug: () => ThreadPoolState }).threadPoolDebug = () => {
    const state = globalThreadPool.getDebugState()
    console.log('[ThreadPool] Current state:', state)
    return state
  }
}
