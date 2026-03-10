import { S3Client } from '@aws-sdk/client-s3'
import type { R2Config } from '@/types/config'

/**
 * 创建 R2 客户端
 */
export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Cloudflare R2 不支持某些 S3 功能
    forcePathStyle: false,
  })
}

// 默认客户端实例（登录后设置）
let defaultClient: S3Client | null = null

export function setDefaultClient(client: S3Client) {
  defaultClient = client
}

export function getDefaultClient(): S3Client | null {
  return defaultClient
}
