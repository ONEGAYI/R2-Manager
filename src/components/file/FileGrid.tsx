import { motion } from 'framer-motion'
import { File, Folder, Image, Video, Music, FileText, Code, Archive } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/cn'
import type { R2Object } from '@/types/file'

interface FileGridProps {
  objects: R2Object[]
  prefixes: string[]
  selectedKeys: Set<string>
  onSelect: (key: string, selected: boolean) => void
  onOpenFolder: (prefix: string) => void
  onOpenFile: (key: string) => void
}

const typeIcons: Record<string, typeof File> = {
  image: Image,
  video: Video,
  audio: Music,
  pdf: FileText,
  document: FileText,
  code: Code,
  archive: Archive,
  file: File,
}

export function FileGrid({
  objects,
  prefixes,
  selectedKeys,
  onSelect,
  onOpenFolder,
  onOpenFile,
}: FileGridProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* 文件夹 */}
        {prefixes.map((prefix, index) => (
          <motion.div
            key={prefix}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpenFolder(prefix)}
            className="p-4 rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-colors"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-primary/10">
                <Folder className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm text-center truncate w-full">
                {prefix.replace(/\/$/, '').split('/').pop()}
              </span>
            </div>
          </motion.div>
        ))}

        {/* 文件 */}
        {objects.map((obj, index) => {
          const type = obj.key.split('.').pop()?.toLowerCase() || 'file'
          const Icon = typeIcons[type] || File

          return (
            <motion.div
              key={obj.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: (prefixes.length + index) * 0.02 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onOpenFile(obj.key)}
              className={cn(
                'p-4 rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-colors',
                selectedKeys.has(obj.key) && 'border-primary bg-primary/5'
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-muted">
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <span className="text-sm text-center truncate w-full">
                  {obj.key.split('/').pop()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(obj.size)}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
