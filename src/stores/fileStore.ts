import { create } from 'zustand'
import type { R2Object, UploadFile } from '@/types/file'

interface FileState {
  objects: R2Object[]
  prefixes: string[]
  currentPrefix: string
  selectedKeys: Set<string>
  isLoading: boolean
  error: string | null
  uploads: UploadFile[]

  setObjects: (objects: R2Object[]) => void
  setPrefixes: (prefixes: string[]) => void
  setPrefix: (prefix: string) => void
  selectKey: (key: string, selected: boolean) => void
  selectAll: (keys: string[]) => void
  clearSelection: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addUpload: (upload: UploadFile) => void
  updateUpload: (id: string, updates: Partial<UploadFile>) => void
  removeUpload: (id: string) => void
}

export const useFileStore = create<FileState>((set) => ({
  objects: [],
  prefixes: [],
  currentPrefix: '',
  selectedKeys: new Set(),
  isLoading: false,
  error: null,
  uploads: [],

  setObjects: (objects) => set({ objects }),
  setPrefixes: (prefixes) => set({ prefixes }),
  setPrefix: (currentPrefix) => set({ currentPrefix, selectedKeys: new Set() }),
  selectKey: (key, selected) =>
    set((state) => {
      const newSet = new Set(state.selectedKeys)
      if (selected) {
        newSet.add(key)
      } else {
        newSet.delete(key)
      }
      return { selectedKeys: newSet }
    }),
  selectAll: (keys) => set({ selectedKeys: new Set(keys) }),
  clearSelection: () => set({ selectedKeys: new Set() }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  addUpload: (upload) =>
    set((state) => ({ uploads: [...state.uploads, upload] })),
  updateUpload: (id, updates) =>
    set((state) => ({
      uploads: state.uploads.map((u) =>
        u.id === id ? { ...u, ...updates } : u
      ),
    })),
  removeUpload: (id) =>
    set((state) => ({
      uploads: state.uploads.filter((u) => u.id !== id),
    })),
}))
