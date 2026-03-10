import { api } from './api'
import type { Bucket } from '@/types/bucket'

/**
 * 存储桶服务（通过后端代理）
 */
export const bucketService = {
  /**
   * 获取所有存储桶列表
   */
  async listBuckets(): Promise<{ buckets: Bucket[] }> {
    const response = await api.listBuckets()
    return {
      buckets: response.buckets.map((b) => ({
        name: b.name,
        creationDate: b.creationDate || '',
      })),
    }
  },

  /**
   * 创建存储桶
   */
  async createBucket(bucketName: string): Promise<void> {
    await api.createBucket(bucketName)
  },

  /**
   * 删除存储桶
   */
  async deleteBucket(bucketName: string): Promise<void> {
    await api.deleteBucket(bucketName)
  },

  /**
   * 检查存储桶是否存在
   */
  async bucketExists(bucketName: string): Promise<boolean> {
    try {
      const { buckets } = await api.listBuckets()
      return buckets.some((b: Bucket) => b.name === bucketName)
    } catch {
      return false
    }
  },
}
