const API_BASE = 'http://localhost:3001/api'

interface ApiResponse<T = unknown> {
  success?: boolean
  error?: string
  message?: string
  data?: T
}

interface Bucket {
  name: string
  creationDate?: string
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // 如果 body 是 File 或 FormData，不设置默认 Content-Type
    const isFileUpload = options.body instanceof File || options.body instanceof FormData

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...(isFileUpload ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    })

    const data: ApiResponse<T> = await response.json()

    if (!response.ok || data.error) {
      throw new Error(data.error || `请求失败: ${response.status}`)
    }

    return data as T
  }

  // 配置凭证
  async configure(credentials: {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
  }): Promise<ApiResponse> {
    return this.request('/config', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  // 测试连接
  async testConnection(): Promise<ApiResponse> {
    return this.request('/test')
  }

  // 获取存储桶列表
  async listBuckets(): Promise<{ buckets: Bucket[] }> {
    return this.request('/buckets')
  }

  // 创建存储桶
  async createBucket(bucketName: string): Promise<ApiResponse> {
    return this.request('/buckets', {
      method: 'POST',
      body: JSON.stringify({ bucketName }),
    })
  }

  // 删除存储桶
  async deleteBucket(bucketName: string): Promise<ApiResponse> {
    return this.request(`/buckets/${bucketName}`, {
      method: 'DELETE',
    })
  }

  // 列出对象
  async listObjects(
    bucketName: string,
    prefix: string = ''
  ): Promise<{
    objects: Array<{ key: string; size: number; lastModified: string; etag?: string }>
    prefixes: string[]
  }> {
    const params = new URLSearchParams({ prefix })
    return this.request(`/buckets/${bucketName}/objects?${params}`)
  }

  // 获取下载 URL
  async getDownloadUrl(bucketName: string, key: string): Promise<{ url: string }> {
    return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(key)}/url`)
  }

  // 获取代理下载 URL（用于直接下载，避免跨域问题）
  getProxyDownloadUrl(bucketName: string, key: string): string {
    return `${API_BASE}/buckets/${bucketName}/objects/${encodeURIComponent(key)}/download`
  }

  // 获取上传 URL
  async getUploadUrl(
    bucketName: string,
    key: string,
    contentType: string
  ): Promise<{ url: string }> {
    return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(key)}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    })
  }

  // 直接上传文件（通过后端代理，使用 XHR 支持进度跟踪）
  uploadFile(
    bucketName: string,
    key: string,
    file: File,
    onProgress?: (loaded: number, total: number, speed: number) => void,
    onAbort?: (abortFn: () => void) => void
  ): Promise<{ success: boolean; key: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API_BASE}/buckets/${bucketName}/objects/${encodeURIComponent(key)}/upload`

      // 记录开始时间和已加载字节数，用于计算速度
      let startTime = Date.now()
      let lastLoaded = 0

      // 速度过低检测
      const LOW_SPEED_THRESHOLD = 10 * 1024 // 10 KB/s
      const LOW_SPEED_TIMEOUT = 2 * 60 * 1000 // 2 分钟
      let lowSpeedStartTime: number | null = null

      // 检测速度过低的定时器
      const checkLowSpeed = () => {
        if (lowSpeedStartTime && Date.now() - lowSpeedStartTime >= LOW_SPEED_TIMEOUT) {
          xhr.abort()
          reject(new Error('上传速度过低，已自动取消'))
        }
      }
      const lowSpeedCheckInterval = setInterval(checkLowSpeed, 5000) // 每5秒检查一次

      // 上传进度事件
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const now = Date.now()
          const timeDiff = (now - startTime) / 1000 // 秒
          const loadedDiff = e.loaded - lastLoaded

          // 计算速度 (B/s)
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0

          onProgress(e.loaded, e.total, speed)

          // 速度过低检测
          if (speed < LOW_SPEED_THRESHOLD && speed > 0) {
            if (!lowSpeedStartTime) {
              lowSpeedStartTime = now
            }
          } else {
            lowSpeedStartTime = null // 速度恢复正常，重置计时
          }

          // 更新记录
          lastLoaded = e.loaded
          startTime = now
        }
      })

      // 请求完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            clearInterval(lowSpeedCheckInterval)
            resolve(response)
          } catch {
            clearInterval(lowSpeedCheckInterval)
            reject(new Error('Invalid response'))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            clearInterval(lowSpeedCheckInterval)
            reject(new Error(error.error || `Upload failed: ${xhr.status}`))
          } catch {
            clearInterval(lowSpeedCheckInterval)
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        }
      })

      // 请求错误
      xhr.addEventListener('error', () => {
        clearInterval(lowSpeedCheckInterval)
        reject(new Error('Network error'))
      })
      xhr.addEventListener('abort', () => {
        clearInterval(lowSpeedCheckInterval)
        reject(new Error('Upload aborted'))
      })
      xhr.addEventListener('timeout', () => {
        clearInterval(lowSpeedCheckInterval)
        reject(new Error('Upload timeout'))
      })

      // 设置超时（大文件上传需要更长时间，设置 60 分钟）
      xhr.timeout = 60 * 60 * 1000

      // 发送请求
      xhr.open('POST', url)
      xhr.send(file)

      // 提供中止函数
      if (onAbort) {
        onAbort(() => xhr.abort())
      }
    })
  }

  // 删除对象
  async deleteObject(bucketName: string, key: string): Promise<ApiResponse> {
    return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    })
  }

  // 批量删除对象
  async batchDelete(
    bucketName: string,
    keys: string[]
  ): Promise<{ success: boolean; deleted: string[]; errors: Array<{ key: string; message: string }>; message: string }> {
    return this.request(`/buckets/${bucketName}/objects/batch-delete`, {
      method: 'POST',
      body: JSON.stringify({ keys }),
    })
  }

  // 批量获取下载 URL
  async batchGetDownloadUrls(
    bucketName: string,
    keys: string[]
  ): Promise<{
    results: Array<{ key: string; url?: string; error?: string; success: boolean }>
  }> {
    return this.request(`/buckets/${bucketName}/objects/batch-urls`, {
      method: 'POST',
      body: JSON.stringify({ keys }),
    })
  }

  // 创建文件夹
  async createFolder(
    bucketName: string,
    folderPath: string
  ): Promise<{ success: boolean; message: string; path: string }> {
    return this.request(`/buckets/${bucketName}/folders`, {
      method: 'POST',
      body: JSON.stringify({ folderPath }),
    })
  }

  // 复制对象
  async copyObject(
    bucketName: string,
    sourceKey: string,
    destinationKey: string,
    overwrite: boolean = false,
    destinationBucket?: string
  ): Promise<{ success: boolean; message: string; copied: number; key?: string; bucket?: string }> {
    return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(sourceKey)}/copy`, {
      method: 'POST',
      body: JSON.stringify({ destinationKey, overwrite, destinationBucket }),
    })
  }

  // 移动对象
  async moveObject(
    bucketName: string,
    sourceKey: string,
    destinationKey: string,
    overwrite: boolean = false,
    destinationBucket?: string
  ): Promise<{ success: boolean; message: string; moved: number; key?: string; bucket?: string }> {
    return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(sourceKey)}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationKey, overwrite, destinationBucket }),
    })
  }

  // 批量复制对象
  async batchCopy(
    bucketName: string,
    items: Array<{
      sourceKey: string
      destinationKey: string
      isFolder: boolean
    }>,
    destinationBucket?: string,
    overwrite: boolean = false
  ): Promise<{
    success: boolean
    message: string
    results: Array<{
      sourceKey: string
      destinationKey: string
      status: 'success' | 'skipped' | 'error'
      copied?: number
      error?: string
      skipReason?: string
    }>
    totalCopied: number
    totalSkipped: number
    totalErrors: number
  }> {
    return this.request(`/buckets/${bucketName}/objects/batch-copy`, {
      method: 'POST',
      body: JSON.stringify({ items, destinationBucket, overwrite }),
    })
  }

  // 批量移动对象
  async batchMove(
    bucketName: string,
    items: Array<{
      sourceKey: string
      destinationKey: string
      isFolder: boolean
    }>,
    destinationBucket?: string,
    overwrite: boolean = false
  ): Promise<{
    success: boolean
    message: string
    results: Array<{
      sourceKey: string
      destinationKey: string
      status: 'success' | 'skipped' | 'error'
      moved?: number
      error?: string
      skipReason?: string
    }>
    totalMoved: number
    totalSkipped: number
    totalErrors: number
  }> {
    return this.request(`/buckets/${bucketName}/objects/batch-move`, {
      method: 'POST',
      body: JSON.stringify({ items, destinationBucket, overwrite }),
    })
  }

  // 批量复制对象（带 SSE 进度）
  async batchCopyWithProgress(
    bucketName: string,
    items: Array<{
      sourceKey: string
      destinationKey: string
      isFolder: boolean
    }>,
    destinationBucket?: string,
    overwrite: boolean = false,
    onProgress?: (data: {
      type: 'progress' | 'complete' | 'error'
      current?: number
      total?: number
      totalCopied?: number
      totalSkipped?: number
      totalErrors?: number
      message?: string
      error?: string
    }) => void
  ): Promise<{
    success: boolean
    message: string
    results: Array<{
      sourceKey: string
      destinationKey: string
      status: 'success' | 'skipped' | 'error'
      copied?: number
      error?: string
      skipReason?: string
    }>
    totalCopied: number
    totalSkipped: number
    totalErrors: number
  }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API_BASE}/buckets/${bucketName}/objects/batch-copy`

      xhr.open('POST', url)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.setRequestHeader('Accept', 'text/event-stream')

      let responseData = ''

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(responseData.length)
        responseData = xhr.responseText

        // 解析 SSE 事件
        const lines = newText.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (onProgress) {
                onProgress(data)
              }
              // 如果收到完成或错误事件，解析最终结果
              if (data.type === 'complete') {
                resolve({
                  success: data.success,
                  message: data.message,
                  results: data.results,
                  totalCopied: data.totalCopied,
                  totalSkipped: data.totalSkipped,
                  totalErrors: data.totalErrors,
                })
              } else if (data.type === 'error') {
                reject(new Error(data.error || '操作失败'))
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // 如果不是 SSE 响应，解析普通 JSON
          if (!xhr.getResponseHeader('Content-Type')?.includes('text/event-stream')) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve(data)
            } catch {
              reject(new Error('Invalid response'))
            }
          }
          // SSE 响应已经在 onprogress 中处理
        } else {
          reject(new Error(`Request failed: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))

      xhr.send(JSON.stringify({ items, destinationBucket, overwrite }))
    })
  }

  // 批量移动对象（带 SSE 进度）
  async batchMoveWithProgress(
    bucketName: string,
    items: Array<{
      sourceKey: string
      destinationKey: string
      isFolder: boolean
    }>,
    destinationBucket?: string,
    overwrite: boolean = false,
    onProgress?: (data: {
      type: 'progress' | 'complete' | 'error'
      current?: number
      total?: number
      totalMoved?: number
      totalSkipped?: number
      totalErrors?: number
      message?: string
      error?: string
    }) => void
  ): Promise<{
    success: boolean
    message: string
    results: Array<{
      sourceKey: string
      destinationKey: string
      status: 'success' | 'skipped' | 'error'
      moved?: number
      error?: string
      skipReason?: string
    }>
    totalMoved: number
    totalSkipped: number
    totalErrors: number
  }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API_BASE}/buckets/${bucketName}/objects/batch-move`

      xhr.open('POST', url)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.setRequestHeader('Accept', 'text/event-stream')

      let responseData = ''

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(responseData.length)
        responseData = xhr.responseText

        // 解析 SSE 事件
        const lines = newText.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (onProgress) {
                onProgress(data)
              }
              // 如果收到完成或错误事件，解析最终结果
              if (data.type === 'complete') {
                resolve({
                  success: data.success,
                  message: data.message,
                  results: data.results,
                  totalMoved: data.totalMoved,
                  totalSkipped: data.totalSkipped,
                  totalErrors: data.totalErrors,
                })
              } else if (data.type === 'error') {
                reject(new Error(data.error || '操作失败'))
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // 如果不是 SSE 响应，解析普通 JSON
          if (!xhr.getResponseHeader('Content-Type')?.includes('text/event-stream')) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve(data)
            } catch {
              reject(new Error('Invalid response'))
            }
          }
          // SSE 响应已经在 onprogress 中处理
        } else {
          reject(new Error(`Request failed: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))

      xhr.send(JSON.stringify({ items, destinationBucket, overwrite }))
    })
  }

  // 重启服务器
  async restartServer(): Promise<ApiResponse> {
    return this.request('/system/restart', {
      method: 'POST',
    })
  }

  // 下载文件（带进度回调，使用 XHR）
  downloadFileWithProgress(
    bucketName: string,
    key: string,
    onProgress?: (loaded: number, total: number, speed: number) => void,
    onAbort?: (abortFn: () => void) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API_BASE}/buckets/${bucketName}/objects/${encodeURIComponent(key)}/download`

      // 记录开始时间和已加载字节数，用于计算速度
      let startTime = Date.now()
      let lastLoaded = 0

      // 下载进度事件
      xhr.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const now = Date.now()
          const timeDiff = (now - startTime) / 1000 // 秒
          const loadedDiff = e.loaded - lastLoaded

          // 计算速度 (B/s)
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0

          onProgress(e.loaded, e.total, speed)

          // 更新记录
          lastLoaded = e.loaded
          startTime = now
        }
      })

      // 请求完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response
          if (blob instanceof Blob) {
            resolve(blob)
          } else {
            reject(new Error('Invalid response type'))
          }
        } else {
          reject(new Error(`Download failed: ${xhr.status}`))
        }
      })

      // 请求错误
      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.addEventListener('abort', () => reject(new Error('Download aborted')))

      // 设置响应类型为 blob
      xhr.responseType = 'blob'

      // 发送请求
      xhr.open('GET', url)
      xhr.send()

      // 提供中止函数
      if (onAbort) {
        onAbort(() => xhr.abort())
      }
    })
  }
}

export const api = new ApiService()
