/**
 * R2 对象（文件）信息
 */
export interface R2Object {
  key: string
  size: number
  lastModified: string
  etag: string
  // 用户自定义元数据
  metadata?: Record<string, string>
  // HTTP 元数据
  httpMetadata?: {
    contentType?: string
    contentEncoding?: string
    cacheControl?: string
  }
}

/**
 * 文件列表响应
 */
export interface ObjectListResponse {
  objects: R2Object[]
  prefixes: string[]  // 子目录前缀
  isTruncated: boolean
  nextContinuationToken?: string
}

/**
 * 上传文件信息
 */
export interface UploadFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}
