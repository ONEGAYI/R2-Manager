import {
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { R2Object, ObjectListResponse } from '@/types/file'

/**
 * 文件服务
 */
export const fileService = {
  /**
   * 列出存储桶内的对象
   */
  async listObjects(
    client: S3Client,
    bucketName: string,
    prefix: string = '',
    continuationToken?: string
  ): Promise<ObjectListResponse> {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: '/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    })

    const response = await client.send(command)

    const objects: R2Object[] = (response.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || '',
      etag: obj.ETag || '',
    }))

    return {
      objects,
      prefixes: response.CommonPrefixes?.map((p) => p.Prefix || '') || [],
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken,
    }
  },

  /**
   * 上传文件
   */
  async uploadFile(
    client: S3Client,
    bucketName: string,
    key: string,
    body: Buffer | Blob | string,
    contentType?: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
    await client.send(command)
  },

  /**
   * 下载文件
   */
  async downloadFile(
    client: S3Client,
    bucketName: string,
    key: string
  ): Promise<Blob> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
    const response = await client.send(command)
    return await response.Body!.transformToByteArray().then(
      (bytes) => new Blob([bytes])
    )
  },

  /**
   * 删除单个文件
   */
  async deleteFile(
    client: S3Client,
    bucketName: string,
    key: string
  ): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
    await client.send(command)
  },

  /**
   * 批量删除文件
   */
  async deleteFiles(
    client: S3Client,
    bucketName: string,
    keys: string[]
  ): Promise<{ deleted: string[]; errors: string[] }> {
    const command = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: false,
      },
    })
    const response = await client.send(command)

    return {
      deleted: response.Deleted?.map((d) => d.Key || '') || [],
      errors: response.Errors?.map((e) => e.Key || '') || [],
    }
  },

  /**
   * 获取文件元数据
   */
  async getFileInfo(
    client: S3Client,
    bucketName: string,
    key: string
  ): Promise<R2Object | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
      const response = await client.send(command)

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified?.toISOString() || '',
        etag: response.ETag || '',
        httpMetadata: {
          contentType: response.ContentType,
          contentEncoding: response.ContentEncoding,
          cacheControl: response.CacheControl,
        },
      }
    } catch {
      return null
    }
  },
}
