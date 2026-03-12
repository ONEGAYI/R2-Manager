import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { TransferTask, TransferHistory, TransferDirection } from '@/types/transfer'
import type { PausedUploadState } from '@/types/chunk'
import { createHybridStorage } from '@/lib/tauriStorage'
import { abortTask, unregisterAbortFn } from '@/lib/abortRegistry'

interface TransferState {
  // 进行中的任务（不持久化）
  tasks: TransferTask[]

  // 历史记录（持久化最近 100 条）
  history: TransferHistory[]

  // 暂停的上传任务（持久化）
  pausedUploads: PausedUploadState[]

  // 任务操作
  addTask: (task: Omit<TransferTask, 'id' | 'startTime' | 'loadedBytes' | 'speed' | 'status' | 'progress'>) => string
  updateTask: (id: string, updates: Partial<TransferTask>) => void
  removeTask: (id: string) => void
  cancelTask: (id: string) => void
  removeTaskAndHistory: (id: string) => void
  getTaskById: (id: string) => TransferTask | undefined

  // 暂停/恢复操作
  pauseTask: (id: string) => void
  resumeTask: (id: string) => void
  savePausedUpload: (state: PausedUploadState) => void
  removePausedUpload: (taskId: string) => void
  getPausedUpload: (taskId: string) => PausedUploadState | undefined

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
  pausedUploads: PausedUploadState[]
}

export const useTransferStore = create<TransferState>()(
  persist(
    (set, get) => ({
      tasks: [],
      history: [],
      pausedUploads: [],

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

      // 暂停任务
      pauseTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, status: 'paused' } : task
          ),
        }))
      },

      // 恢复任务
      resumeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, status: 'pending' } : task
          ),
        }))
      },

      // 保存暂停的上传状态
      savePausedUpload: (pausedState: PausedUploadState) => {
        set((state) => {
          // 检查是否已存在，如果存在则更新
          const existingIndex = state.pausedUploads.findIndex(
            (p) => p.taskId === pausedState.taskId
          )
          const newPausedUploads =
            existingIndex >= 0
              ? state.pausedUploads.map((p, i) =>
                  i === existingIndex ? pausedState : p
                )
              : [...state.pausedUploads, pausedState]

          return { pausedUploads: newPausedUploads }
        })
      },

      // 移除暂停的上传状态
      removePausedUpload: (taskId: string) => {
        set((state) => ({
          pausedUploads: state.pausedUploads.filter((p) => p.taskId !== taskId),
        }))
      },

      // 获取暂停的上传状态
      getPausedUpload: (taskId: string) => {
        return get().pausedUploads.find((p) => p.taskId === taskId)
      },

      // 将任务移至历史记录
      moveToHistory: (task, status, error, localPath) => {
        const historyItem: TransferHistory = {
          id: task.id,
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

          // 移除暂停状态（如果存在）
          const newPausedUploads = state.pausedUploads.filter(
            (p) => p.taskId !== task.id
          )

          // 添加到历史，保持最大数量限制
          let newHistory = [historyItem, ...state.history]
          if (newHistory.length > MAX_HISTORY) {
            newHistory = newHistory.slice(0, MAX_HISTORY)
          }

          return {
            tasks: newTasks,
            history: newHistory,
            pausedUploads: newPausedUploads,
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
      removeHistory: (id: string) => {
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        }))
      },

      // 移除任务和历史（用于清理）
      removeTaskAndHistory: (id: string) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          history: state.history.filter((h) => h.id !== id),
        }))
      },

      // 根据 ID 获取任务
      getTaskById: (id: string) => {
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
      // 持久化历史记录和暂停的上传状态
      partialize: (state): PersistedTransferState => ({
        history: state.history,
        pausedUploads: state.pausedUploads,
      }),
    }
  )
)
