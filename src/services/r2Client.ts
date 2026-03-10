import { S3Client } from '@aws-sdk/client-s3'
import type { R2Credentials } from '@/types/config'

let defaultClient: S3Client | null = null

export function createR2Client(config: R2Credentials): S3Client {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Cloudflare R2 不支持某些 S3 功能
    forcePathStyle: false,
  })

  defaultClient = client
  return client
}

export function getDefaultClient(): S3Client | null {
  return defaultClient
}

export function setDefaultClient(client: S3Client): void {
  defaultClient = client
}
