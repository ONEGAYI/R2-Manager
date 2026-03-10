import { motion } from 'framer-motion'
import { Database, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Bucket as BucketType } from '@/types/bucket'

interface BucketCardProps {
  bucket: BucketType
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function BucketCard({
  bucket,
  isSelected,
  onSelect,
  onDelete,
}: BucketCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-colors group relative',
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-primary/10">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{bucket.name}</h3>
          <p className="text-sm text-muted-foreground">
            {bucket.objectCount ?? '--'} 个对象
          </p>
        </div>

        {/* 操作菜单 */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
