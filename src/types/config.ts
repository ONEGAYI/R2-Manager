/**
 * R2 连接配置（敏感信息）
 */
export interface R2Credentials {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
}

/**
 * 应用配置状态
 */
export interface AppConfig {
  theme: 'light' | 'dark' | 'system'
  viewMode: 'list' | 'grid'
  defaultBucket?: string
}

/**
 * 连接状态
 */
export interface ConnectionStatus {
  isConnected: boolean
  lastChecked?: string
  error?: string
}
