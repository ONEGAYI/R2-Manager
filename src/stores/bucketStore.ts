import { create } from 'zustand'
import type { Bucket } from '@/types/bucket'

interface BucketState {
  buckets: Bucket[]
  selectedBucket: string | null
  isLoading: boolean
  error: string | null

  setBuckets: (buckets: Bucket[]) => void
  selectBucket: (name: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addBucket: (bucket: Bucket) => void
  removeBucket: (name: string) => void
}

export const useBucketStore = create<BucketState>((set) => ({
  buckets: [],
  selectedBucket: null,
  isLoading: false,
  error: null,

  setBuckets: (buckets) => set({ buckets }),
  selectBucket: (selectedBucket) => set({ selectedBucket }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  addBucket: (bucket) => set((state) => ({ buckets: [...state.buckets, bucket] })),
  removeBucket: (name) =>
    set((state) => ({
      buckets: state.buckets.filter((b) => b.name !== name),
      selectedBucket: state.selectedBucket === name ? null : state.selectedBucket,
    })),
}))
