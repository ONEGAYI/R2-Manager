import { useConfigStore } from '@/stores/configStore'

/**
 * 配置相关 Hook
 */
export function useConfig() {
  const {
    theme,
    viewMode,
    defaultBucket,
    setTheme,
    setViewMode,
    setDefaultBucket,
  } = useConfigStore()

  return {
    theme,
    viewMode,
    defaultBucket,
    setTheme,
    setViewMode,
    setDefaultBucket,
  }
}

/**
 * R2 凭证相关 Hook
 */
export function useR2Credentials() {
  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    isConnected,
    error,
    lastChecked,
    setCredentials,
    clearCredentials,
    hasCredentials,
    setConnected,
  } = useConfigStore()

  return {
    credentials: { accountId, accessKeyId, secretAccessKey },
    isConnected,
    error,
    lastChecked,
    setCredentials,
    clearCredentials,
    hasCredentials,
    setConnected,
  }
}
