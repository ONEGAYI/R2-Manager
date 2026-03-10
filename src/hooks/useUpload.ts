import { useState, useCallback } from 'react'

interface UploadQueueItem {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

/**
 * 文件上传管理 Hook
 */
export function useUpload() {
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const addToQueue = useCallback((files: File[]) => {
    const items: UploadQueueItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }))
    setQueue((prev) => [...prev, ...items])
    return items
  }, [])

  const updateProgress = useCallback((id: string, progress: number) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, progress, status: 'uploading' } : item
      )
    )
  }, [])

  const markCompleted = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, progress: 100, status: 'completed' } : item
      )
    )
  }, [])

  const markError = useCallback((id: string, error: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'error', error } : item
      )
    )
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status !== 'completed'))
  }, [])

  const clearAll = useCallback(() => {
    setQueue([])
  }, [])

  return {
    queue,
    isUploading,
    setIsUploading,
    addToQueue,
    updateProgress,
    markCompleted,
    markError,
    removeFromQueue,
    clearCompleted,
    clearAll,
  }
}
