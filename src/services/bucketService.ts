import {
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { Bucket, BucketListResponse } from '@/types/bucket'

/**
 * 存储桶服务
 */
export const bucketService = {
  /**
   * 获取所有存储桶列表
   */
  async listBuckets(client: S3Client): Promise<BucketListResponse> {
    const command = new ListBucketsCommand({})
    const response = await client.send(command)

    const buckets: Bucket[] = (response.Buckets || []).map((bucket) => ({
      name: bucket.Name || '',
      creationDate: bucket.CreationDate?.toISOString() || '',
    }))

    return {
      buckets,
      isTruncated: false,
    }
  },

  /**
   * 创建存储桶
   */
  async createBucket(client: S3Client, bucketName: string): Promise<void> {
    const command = new CreateBucketCommand({ Bucket: bucketName })
    await client.send(command)
  },

  /**
   * 删除存储桶（必须为空）
   */
  async deleteBucket(client: S3Client, bucketName: string): Promise<void> {
    const command = new DeleteBucketCommand({ Bucket: bucketName })
    await client.send(command)
  },

  /**
   * 检查存储桶是否存在
   */
  async bucketExists(client: S3Client, bucketName: string): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({ Bucket: bucketName })
      await client.send(command)
      return true
    } catch {
      return false
    }
  },
}
