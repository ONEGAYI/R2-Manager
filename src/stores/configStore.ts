import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AppConfig, R2Credentials, ConnectionStatus } from '@/types/config'
import { createHybridStorage } from '@/lib/tauriStorage'

interface ConfigState extends AppConfig, R2Credentials, ConnectionStatus {
  // 并发设置
  maxUploadThreads: number
  maxDownloadThreads: number

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
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // 初始状态
      ...emptyCredentials,
      theme: 'system',
      viewMode: 'list',
      defaultBucket: undefined,
      isConnected: false,
      // 并发设置
      maxUploadThreads: 4,
      maxDownloadThreads: 4,

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
      }),
    }
  )
)
