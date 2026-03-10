import { api } from './api'
import type { R2Object, ObjectListResponse } from '@/types/file'

/**
 * 文件服务（通过后端代理）
 */
export const fileService = {
  /**
   * 列出存储桶内的对象
   */
  async listObjects(bucketName: string, prefix: string = ''): Promise<ObjectListResponse> {
    const response = await api.listObjects(bucketName, prefix)

    const objects: R2Object[] = (response.objects || []).map((obj) => ({
      key: obj.key,
      size: obj.size,
      lastModified: obj.lastModified,
      etag: obj.etag || '',
    }))

    return {
      objects,
      prefixes: response.prefixes || [],
      isTruncated: false,
    }
  },

  /**
   * 获取文件下载 URL
   */
  async getDownloadUrl(bucketName: string, key: string): Promise<string> {
    const response = await api.getDownloadUrl(bucketName, key)
    return response.url
  },

  /**
   * 获取文件上传 URL
   */
  async getUploadUrl(bucketName: string, key: string, contentType: string): Promise<string> {
    const response = await api.getUploadUrl(bucketName, key, contentType)
    return response.url
  },

  /**
   * 删除单个文件
   */
  async deleteFile(bucketName: string, key: string): Promise<void> {
    await api.deleteObject(bucketName, key)
  },

  /**
   * 批量删除文件
   */
  async deleteFiles(
    bucketName: string,
    keys: string[]
  ): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = []
    const errors: string[] = []

    for (const key of keys) {
      try {
        await api.deleteObject(bucketName, key)
        deleted.push(key)
      } catch {
        errors.push(key)
      }
    }

    return { deleted, errors }
  },

  /**
   * 上传文件（通过后端代理，避免CORS)
   */
  async uploadFile(
    bucketName: string,
    key: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await api.uploadFile(bucketName, key, file, onProgress)
  },

  /**
   * 创建文件夹
   */
  async createFolder(bucketName: string, folderPath: string): Promise<{ path: string }> {
    const response = await api.createFolder(bucketName, folderPath)
    return { path: response.path }
  },
}
