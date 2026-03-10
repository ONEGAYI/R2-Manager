import { useCallback } from 'react'
import { useBucketStore } from '@/stores/bucketStore'
import { bucketService } from '@/services/bucketService'
import { getDefaultClient } from '@/services/r2Client'
import type { Bucket } from '@/types/bucket'

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

  const client = getDefaultClient()

  const refreshBuckets = useCallback(async () => {
    if (!client) {
      setError('未连接到 R2')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await bucketService.listBuckets(client)
      setBuckets(response.buckets)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取桶列表失败')
    } finally {
      setLoading(false)
    }
  }, [client, setBuckets, setLoading, setError])

  const createBucket = useCallback(
    async (name: string) => {
      if (!client) return false

      try {
        await bucketService.createBucket(client, name)
        addBucket({ name, creationDate: new Date().toISOString() })
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建桶失败')
        return false
      }
    },
    [client, addBucket, setError]
  )

  const deleteBucket = useCallback(
    async (name: string) => {
      if (!client) return false

      try {
        await bucketService.deleteBucket(client, name)
        removeBucket(name)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除桶失败')
        return false
      }
    },
    [client, removeBucket, setError]
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
