/**
 * 下载分块缓存管理器
 *
 * 使用 IndexedDB 存储已下载的分块 Blob，支持暂停/恢复功能
 */

import type { CachedChunk } from '@/types/chunk'

const DB_NAME = 'r2-manager-download-cache'
const DB_VERSION = 1
const STORE_NAME = 'chunks'

/** 缓存过期时间（7天） */
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 下载缓存管理器类
 */
class DownloadCacheManager {
  private db: IDBDatabase | null = null
  private dbPromise: Promise<IDBDatabase> | null = null

  /**
   * 初始化 IndexedDB
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    // 避免重复初始化
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[DownloadCache] Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储，使用复合主键 [taskId, chunkIndex]
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: ['taskId', 'chunkIndex'] })
          // 创建索引用于按任务 ID 查询
          store.createIndex('taskId', 'taskId', { unique: false })
          store.createIndex('savedAt', 'savedAt', { unique: false })
        }
      }
    })

    return this.dbPromise
  }

  /**
   * 保存分块到缓存（支持部分数据）
   *
   * @param loadedBytes 已下载字节数（用于断点续传）
   */
  async saveChunk(taskId: string, chunkIndex: number, blob: Blob, loadedBytes?: number): Promise<void> {
    try {
      const db = await this.initDB()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)

        const cachedChunk: CachedChunk = {
          taskId,
          chunkIndex,
          blob,
          loadedBytes: loadedBytes ?? blob.size,
          savedAt: Date.now(),
        }

        const request = store.put(cachedChunk)

        request.onerror = () => {
          console.error('[DownloadCache] Failed to save chunk:', request.error)
          reject(request.error)
        }

        request.onsuccess = () => {
          resolve()
        }
      })
    } catch (error) {
      console.error('[DownloadCache] saveChunk error:', error)
      throw error
    }
  }

  /**
   * 加载单个分块
   */
  async loadChunk(taskId: string, chunkIndex: number): Promise<Blob | null> {
    try {
      const db = await this.initDB()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get([taskId, chunkIndex])

        request.onerror = () => {
          console.error('[DownloadCache] Failed to load chunk:', request.error)
          reject(request.error)
        }

        request.onsuccess = () => {
          const result = request.result as CachedChunk | undefined
          resolve(result?.blob ?? null)
        }
      })
    } catch (error) {
      console.error('[DownloadCache] loadChunk error:', error)
      return null
    }
  }

  /**
   * 加载任务的所有已缓存分块
   *
   * @returns Map<chunkIndex, { blob, loadedBytes }>
   */
  async loadAllChunks(taskId: string): Promise<Map<number, { blob: Blob; loadedBytes: number }>> {
    const result = new Map<number, { blob: Blob; loadedBytes: number }>()

    try {
      const db = await this.initDB()

      const chunks = await new Promise<CachedChunk[]>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const index = store.index('taskId')
        const request = index.getAll(taskId)

        request.onerror = () => {
          console.error('[DownloadCache] Failed to load all chunks:', request.error)
          reject(request.error)
        }

        request.onsuccess = () => {
          resolve(request.result)
        }
      })

      for (const chunk of chunks) {
        result.set(chunk.chunkIndex, {
          blob: chunk.blob,
          loadedBytes: chunk.loadedBytes ?? chunk.blob.size,
        })
      }
    } catch (error) {
      console.error('[DownloadCache] loadAllChunks error:', error)
    }

    return result
  }

  /**
   * 清理指定任务的所有缓存
   */
  async clearCache(taskId: string): Promise<void> {
    try {
      const db = await this.initDB()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const index = store.index('taskId')
        const request = index.openCursor(taskId)

        request.onerror = () => {
          console.error('[DownloadCache] Failed to clear cache:', request.error)
          reject(request.error)
        }

        const deletePromises: Promise<void>[] = []

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            deletePromises.push(
              new Promise((res, rej) => {
                const deleteRequest = cursor.delete()
                deleteRequest.onsuccess = () => res()
                deleteRequest.onerror = () => rej(deleteRequest.error)
              })
            )
            cursor.continue()
          } else {
            // 遍历完成
            Promise.all(deletePromises)
              .then(() => resolve())
              .catch(reject)
          }
        }
      })
    } catch (error) {
      console.error('[DownloadCache] clearCache error:', error)
      throw error
    }
  }

  /**
   * 清理过期的僵尸缓存（超过 7 天）
   */
  async cleanExpiredCache(): Promise<number> {
    let cleanedCount = 0

    try {
      const db = await this.initDB()
      const expiryTime = Date.now() - CACHE_EXPIRY_MS

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.openCursor()

        request.onerror = () => {
          console.error('[DownloadCache] Failed to clean expired cache:', request.error)
          reject(request.error)
        }

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            const chunk = cursor.value as CachedChunk
            if (chunk.savedAt < expiryTime) {
              cursor.delete()
              cleanedCount++
            }
            cursor.continue()
          } else {
            resolve()
          }
        }
      })

      if (cleanedCount > 0) {
        console.log(`[DownloadCache] Cleaned ${cleanedCount} expired chunks`)
      }
    } catch (error) {
      console.error('[DownloadCache] cleanExpiredCache error:', error)
    }

    return cleanedCount
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{ count: number; size: number }> {
    let count = 0
    let size = 0

    try {
      const db = await this.initDB()

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.openCursor()

        request.onerror = () => {
          reject(request.error)
        }

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            const chunk = cursor.value as CachedChunk
            count++
            size += chunk.blob.size
            cursor.continue()
          } else {
            resolve()
          }
        }
      })
    } catch (error) {
      console.error('[DownloadCache] getStats error:', error)
    }

    return { count, size }
  }
}

// 单例导出
export const downloadCacheManager = new DownloadCacheManager()
