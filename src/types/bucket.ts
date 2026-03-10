/**
 * R2 存储桶信息
 */
export interface Bucket {
  name: string
  creationDate: string
  // 扩展信息（需要额外 API 调用）
  size?: number
  objectCount?: number
}

/**
 * 桶列表响应
 */
export interface BucketListResponse {
  buckets: Bucket[]
  isTruncated: boolean
}
