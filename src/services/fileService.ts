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
    onProgress?: (loaded: number, total: number, speed: number) => void,
    onAbort?: (abortFn: () => void) => void
  ): Promise<void> {
    await api.uploadFile(bucketName, key, file, onProgress, onAbort)
  },

  /**
   * 创建文件夹
   */
  async createFolder(bucketName: string, folderPath: string): Promise<{ path: string }> {
    const response = await api.createFolder(bucketName, folderPath)
    return { path: response.path }
  },

  /**
   * 复制文件或文件夹
   */
  async copyFile(
    bucketName: string,
    sourceKey: string,
    destinationKey: string,
    overwrite: boolean = false,
    destinationBucket?: string
  ): Promise<{ success: boolean; copied: number; key?: string; bucket?: string }> {
    const response = await api.copyObject(bucketName, sourceKey, destinationKey, overwrite, destinationBucket)
    return {
      success: response.success,
      copied: response.copied,
      key: response.key,
      bucket: response.bucket,
    }
  },

  /**
   * 移动文件或文件夹
   */
  async moveFile(
    bucketName: string,
    sourceKey: string,
    destinationKey: string,
    overwrite: boolean = false,
    destinationBucket?: string
  ): Promise<{ success: boolean; moved: number; key?: string; bucket?: string }> {
    const response = await api.moveObject(bucketName, sourceKey, destinationKey, overwrite, destinationBucket)
    return {
      success: response.success,
      moved: response.moved,
      key: response.key,
      bucket: response.bucket,
    }
  },

  /**
   * 重命名文件或文件夹（移动的特例）
   * @param bucketName 桶名
   * @param sourceKey 原始路径
   * @param newName 新名称（仅文件名/文件夹名，不含路径）
   */
  async renameFile(
    bucketName: string,
    sourceKey: string,
    newName: string
  ): Promise<{ success: boolean; key?: string }> {
    // 解析原路径，提取目录部分
    const lastSlash = sourceKey.lastIndexOf('/')
    const dirPath = lastSlash > 0 ? sourceKey.substring(0, lastSlash + 1) : ''

    // 构建新路径（确保文件夹以 / 结尾）
    let destinationKey: string
    if (sourceKey.endsWith('/')) {
      // 文件夹
      destinationKey = dirPath + newName + '/'
    } else {
      // 文件
      destinationKey = dirPath + newName
    }

    const response = await api.moveObject(bucketName, sourceKey, destinationKey, false)
    return {
      success: response.success,
      key: response.key,
    }
  },
}
