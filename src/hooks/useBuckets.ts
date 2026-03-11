import { useCallback } from 'react'
import { useBucketStore } from '@/stores/bucketStore'
import { bucketService } from '@/services/bucketService'

/**
 * 存储桶操作 Hook
 */
export function useBuckets() {
  const {
    buckets,
    selectedBucket,
    isLoading,
    error,
    setBuckets,
    selectBucket,
    setLoading,
    setError,
    addBucket,
    removeBucket,
  } = useBucketStore()

  const refreshBuckets = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await bucketService.listBuckets()
      setBuckets(response.buckets)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取桶列表失败')
    } finally {
      setLoading(false)
    }
  }, [setBuckets, setLoading, setError])

  const createBucket = useCallback(
    async (name: string) => {
      try {
        await bucketService.createBucket(name)
        addBucket({ name, creationDate: new Date().toISOString() })
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建桶失败')
        return false
      }
    },
    [addBucket, setError]
  )

  const deleteBucket = useCallback(
    async (name: string) => {
      try {
        await bucketService.deleteBucket(name)
        removeBucket(name)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除桶失败')
        return false
      }
    },
    [removeBucket, setError]
  )

  return {
    buckets,
    selectedBucket,
    isLoading,
    error,
    selectBucket,
    refreshBuckets,
    createBucket,
    deleteBucket,
  }
}
