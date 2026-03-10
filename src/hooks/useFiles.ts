import { useCallback } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { fileService } from '@/services/fileService'
import { getDefaultClient } from '@/services/r2Client'

/**
 * 文件操作 Hook
 */
export function useFiles() {
  const {
    objects,
    prefixes,
    currentPrefix,
    selectedKeys,
    isLoading,
    error,
    uploads,
    setObjects,
    setPrefixes,
    setPrefix,
    selectKey,
    selectAll,
    clearSelection,
    setLoading,
    setError,
    addUpload,
    updateUpload,
    removeUpload,
  } = useFileStore()

  const client = getDefaultClient()

  const refreshFiles = useCallback(
    async (bucketName: string, prefix: string = '') => {
      if (!client) {
        setError('未连接到 R2')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fileService.listObjects(client, bucketName, prefix)
        setObjects(response.objects)
        setPrefixes(response.prefixes)
        setPrefix(prefix)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取文件列表失败')
      } finally {
        setLoading(false)
      }
    },
    [client, setObjects, setPrefixes, setPrefix, setLoading, setError]
  )

  const uploadFile = useCallback(
    async (bucketName: string, file: File) => {
      if (!client) return false

      const uploadId = Math.random().toString(36).substring(7)
      addUpload({
        id: uploadId,
        file,
        progress: 0,
        status: 'uploading',
      })

      try {
        const key = currentPrefix + file.name
        const buffer = await file.arrayBuffer()
        await fileService.uploadFile(
          client,
          bucketName,
          key,
          new Uint8Array(buffer),
          file.type
        )
        updateUpload(uploadId, { progress: 100, status: 'completed' })
        return true
      } catch (err) {
        updateUpload(uploadId, {
          status: 'error',
          error: err instanceof Error ? err.message : '上传失败',
        })
        return false
      }
    },
    [client, currentPrefix, addUpload, updateUpload]
  )

  const deleteFiles = useCallback(
    async (bucketName: string, keys: string[]) => {
      if (!client) return { deleted: [], errors: [] }

      try {
        return await fileService.deleteFiles(client, bucketName, keys)
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除文件失败')
        return { deleted: [], errors: keys }
      }
    },
    [client, setError]
  )

  return {
    objects,
    prefixes,
    currentPrefix,
    selectedKeys,
    isLoading,
    error,
    uploads,
    selectKey,
    selectAll,
    clearSelection,
    refreshFiles,
    uploadFile,
    deleteFiles,
  }
}
