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
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
}

export const api = new ApiService()
