import { motion } from 'framer-motion'
import { Bucket } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Bucket as BucketType } from '@/types/bucket'

interface BucketListProps {
  buckets: BucketType[]
  selectedBucket: string | null
  onSelect: (name: string) => void
}

export function BucketList({ buckets, selectedBucket, onSelect }: BucketListProps) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-medium mb-4">存储桶</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buckets.map((bucket, index) => (
          <motion.div
            key={bucket.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(bucket.name)}
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
              selectedBucket === bucket.name
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Bucket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{bucket.name}</h3>
                <p className="text-sm text-muted-foreground">
                  创建于 {formatDate(bucket.creationDate)}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
