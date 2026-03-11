import { useCallback } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { fileService } from '@/services/fileService'

/**
 * 文件操作 Hook（通过后端代理）
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
  } = useFileStore()

  const refreshFiles = useCallback(
    async (bucketName: string, prefix: string = '') => {
      setLoading(true)
      setError(null)

      try {
        const response = await fileService.listObjects(bucketName, prefix)
        // 过滤掉以 / 结尾的对象（这些是文件夹标记，已通过 prefixes 显示）
        const filteredObjects = response.objects.filter(obj => !obj.key.endsWith('/'))
        setObjects(filteredObjects)
        setPrefixes(response.prefixes)
        setPrefix(prefix)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取文件列表失败')
      } finally {
        setLoading(false)
      }
    },
    [setObjects, setPrefixes, setPrefix, setLoading, setError]
  )

  const uploadFile = useCallback(
    async (bucketName: string, file: File) => {
      const uploadId = Math.random().toString(36).substring(7)
      addUpload({
        id: uploadId,
        file,
        progress: 0,
        status: 'uploading',
      })

      try {
        const key = currentPrefix + file.name
        await fileService.uploadFile(bucketName, key, file)
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
    [currentPrefix, addUpload, updateUpload]
  )

  const deleteFiles = useCallback(
    async (bucketName: string, keys: string[]) => {
      try {
        return await fileService.deleteFiles(bucketName, keys)
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除文件失败')
        return { deleted: [], errors: keys }
      }
    },
    [setError]
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
