import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AppConfig, R2Credentials, ConnectionStatus } from '@/types/config'
import { createHybridStorage } from '@/lib/tauriStorage'
import {
  DEFAULT_UPLOAD_CHUNK_STEP,
  DEFAULT_DOWNLOAD_CHUNK_STEP,
} from '@/types/chunk'

// 默认配置值（单一数据源，方便维护）
export const DEFAULT_CONFIG = {
  theme: 'system' as const,
  viewMode: 'list' as const,
  defaultBucket: undefined as string | undefined,
  maxUploadThreads: 4,
  maxDownloadThreads: 4,
  uploadChunkStep: DEFAULT_UPLOAD_CHUNK_STEP,
  downloadChunkStep: DEFAULT_DOWNLOAD_CHUNK_STEP,
  defaultDownloadPath: '',
}

interface ConfigState extends AppConfig, R2Credentials, ConnectionStatus {
  // 并发设置
  maxUploadThreads: number
  maxDownloadThreads: number

  // 分块步长设置（字节）
  uploadChunkStep: number
  downloadChunkStep: number

  // 下载设置
  defaultDownloadPath: string

  // R2 凭证操作
  setCredentials: (creds: Partial<R2Credentials>) => void
  clearCredentials: () => void
  hasCredentials: () => boolean

  // 连接状态
  setConnected: (status: Partial<ConnectionStatus>) => void

  // 应用设置
  setTheme: (theme: AppConfig['theme']) => void
  setViewMode: (mode: AppConfig['viewMode']) => void
  setDefaultBucket: (bucket?: string) => void
  setConcurrencySettings: (settings: { maxUploadThreads?: number; maxDownloadThreads?: number }) => void
  setDownloadPath: (path: string) => void
  setChunkStepSettings: (settings: { uploadChunkStep?: number; downloadChunkStep?: number }) => void

  // 重置默认值（保留凭证）
  resetToDefaults: () => void
}

const emptyCredentials: R2Credentials = {
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
}

// 需要持久化的状态类型
type PersistedConfigState = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  theme: AppConfig['theme']
  viewMode: AppConfig['viewMode']
  defaultBucket: string | undefined
  maxUploadThreads: number
  maxDownloadThreads: number
  uploadChunkStep: number
  downloadChunkStep: number
  defaultDownloadPath: string
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // 初始状态
      ...emptyCredentials,
      ...DEFAULT_CONFIG,
      isConnected: false,

      // R2 凭证操作
      setCredentials: (creds) =>
        set((state) => ({
          ...state,
          ...creds,
          isConnected: false, // 凭证变更时重置连接状态
          error: undefined,
        })),

      clearCredentials: () =>
        set({
          ...emptyCredentials,
          isConnected: false,
          error: undefined,
          defaultBucket: undefined,
        }),

      hasCredentials: () => {
        const { accountId, accessKeyId, secretAccessKey } = get()
        return !!(accountId && accessKeyId && secretAccessKey)
      },

      // 连接状态
      setConnected: (status) => set((state) => ({ ...state, ...status })),

      // 应用设置
      setTheme: (theme) => set({ theme }),
      setViewMode: (viewMode) => set({ viewMode }),
      setDefaultBucket: (defaultBucket) => set({ defaultBucket }),
      setConcurrencySettings: (settings) => set((state) => ({ ...state, ...settings })),
      setDownloadPath: (defaultDownloadPath) => set({ defaultDownloadPath }),
      setChunkStepSettings: (settings) => set((state) => ({ ...state, ...settings })),

      // 重置默认值（保留凭证）
      resetToDefaults: () =>
        set((state) => ({
          ...state,
          // 保留凭证: accountId, accessKeyId, secretAccessKey
          ...DEFAULT_CONFIG,
          isConnected: false,
        })),
    }),
    {
      name: 'r2-manager-config',
      storage: createJSONStorage(() => createHybridStorage() as StateStorage),
      // 不持久化连接状态
      partialize: (state): PersistedConfigState => ({
        accountId: state.accountId,
        accessKeyId: state.accessKeyId,
        secretAccessKey: state.secretAccessKey,
        theme: state.theme,
        viewMode: state.viewMode,
        defaultBucket: state.defaultBucket,
        maxUploadThreads: state.maxUploadThreads,
        maxDownloadThreads: state.maxDownloadThreads,
        uploadChunkStep: state.uploadChunkStep,
        downloadChunkStep: state.downloadChunkStep,
        defaultDownloadPath: state.defaultDownloadPath,
      }),
    }
  )
)
