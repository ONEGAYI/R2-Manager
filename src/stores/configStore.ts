import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppConfig, R2Credentials, ConnectionStatus } from '@/types/config'

interface ConfigState extends AppConfig, R2Credentials, ConnectionStatus {
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
}

const emptyCredentials: R2Credentials = {
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
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
    }),
    {
      name: 'r2-manager-config',
      storage: createJSONStorage(() => localStorage),
      // 不持久化连接状态
      partialize: (state) => ({
        accountId: state.accountId,
        accessKeyId: state.accessKeyId,
        secretAccessKey: state.secretAccessKey,
        theme: state.theme,
        viewMode: state.viewMode,
        defaultBucket: state.defaultBucket,
      }),
    }
  )
)
