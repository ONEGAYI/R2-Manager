import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { TransferTask, TransferHistory, TransferDirection } from '@/types/transfer'
import { createHybridStorage } from '@/lib/tauriStorage'
import { abortTask, unregisterAbortFn } from '@/lib/abortRegistry'

interface TransferState {
  // 进行中的任务（不持久化）
  tasks: TransferTask[]

  // 历史记录（持久化最近 100 条）
  history: TransferHistory[]

  // 任务操作
  addTask: (task: Omit<TransferTask, 'id' | 'startTime' | 'loadedBytes' | 'speed' | 'status' | 'progress'>) => string
  updateTask: (id: string, updates: Partial<TransferTask>) => void
  removeTask: (id: string) => void
  cancelTask: (id: string) => void
  removeTaskAndHistory: (id: string) => void
  getTaskById: (id: string) => TransferTask | undefined

  // 历史操作
  moveToHistory: (task: TransferTask, status: 'completed' | 'error', error?: string, localPath?: string) => void
  removeHistory: (id: string) => void
  clearHistory: (direction?: TransferDirection) => void

  // 计算属性
  getActiveUploadCount: () => number
  getActiveDownloadCount: () => number
  getActiveCount: () => number
}

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// 历史记录最大数量
const MAX_HISTORY = 100

// 需要持久化的状态类型
type PersistedTransferState = {
  history: TransferHistory[]
}

export const useTransferStore = create<TransferState>()(
  persist(
    (set, get) => ({
      tasks: [],
      history: [],

      // 添加新任务
      addTask: (taskData) => {
        const id = generateId()
        const task: TransferTask = {
          ...taskData,
          id,
          startTime: Date.now(),
          loadedBytes: 0,
          speed: 0,
          progress: 0,
          status: 'pending',
        }
        set((state) => ({
          tasks: [...state.tasks, task],
        }))
        return id
      },

      // 更新任务
      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }))
      },

      // 移除任务
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }))
      },

      // 取消任务（真取消）
      cancelTask: (id) => {
        // 1. 调用真取消（清理资源）
        abortTask(id)

        // 2. 更新状态
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, status: 'error', error: '已取消' } : task
          ),
        }))

        // 3. 延迟移除，让用户看到取消状态
        setTimeout(() => {
          get().removeTask(id)
          // 注销 abort 函数
          unregisterAbortFn(id)
        }, 1000)
      },

      // 将任务移至历史记录
      moveToHistory: (task, status, error, localPath) => {
        const historyItem: TransferHistory = {
          id: generateId(),
          direction: task.direction,
          fileName: task.fileName,
          filePath: task.filePath,
          bucketName: task.bucketName,
          fileSize: task.fileSize,
          status,
          error,
          startTime: task.startTime,
          completedAt: Date.now(),
          localPath,
        }

        set((state) => {
          // 移除任务
          const newTasks = state.tasks.filter((t) => t.id !== task.id)

          // 添加到历史，保持最大数量限制
          let newHistory = [historyItem, ...state.history]
          if (newHistory.length > MAX_HISTORY) {
            newHistory = newHistory.slice(0, MAX_HISTORY)
          }

          return {
            tasks: newTasks,
            history: newHistory,
          }
        })
      },

      // 清空历史记录
      clearHistory: (direction) => {
        set((state) => ({
          history: direction
            ? state.history.filter((h) => h.direction !== direction)
            : [],
        }))
      },

      // 删除单条历史记录
      removeHistory: (id) => {
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        }))
      },

      // 移除任务和历史（用于清理）
      removeTaskAndHistory: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          history: state.history.filter((h) => h.id !== id),
        }))
      },

      // 根据 ID 获取任务
      getTaskById: (id) => {
        return get().tasks.find((t) => t.id === id)
      },

      // 获取活跃上传任务数
      getActiveUploadCount: () => {
        const { tasks } = get()
        return tasks.filter(
          (t) => t.direction === 'upload' && (t.status === 'pending' || t.status === 'running')
        ).length
      },

      // 获取活跃下载任务数
      getActiveDownloadCount: () => {
        const { tasks } = get()
        return tasks.filter(
          (t) => t.direction === 'download' && (t.status === 'pending' || t.status === 'running')
        ).length
      },

      // 获取总活跃任务数
      getActiveCount: () => {
        const { tasks } = get()
        return tasks.filter(
          (t) => t.status === 'pending' || t.status === 'running'
        ).length
      },
    }),
    {
      name: 'r2-manager-transfer',
      storage: createJSONStorage(() => createHybridStorage() as StateStorage),
      // 只持久化历史记录
      partialize: (state): PersistedTransferState => ({
        history: state.history,
      }),
    }
  )
)
