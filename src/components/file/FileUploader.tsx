import { useState, useCallback } from 'react'
import { Upload, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import type { UploadFile } from '@/types/file'

interface FileUploaderProps {
  uploads: UploadFile[]
  onDrop: (files: File[]) => void
  onRemove: (id: string) => void
}

export function FileUploader({ uploads, onDrop, onRemove }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 检查是否有文件
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有当离开拖拽区域时才重置状态
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        onDrop(files)
      }
    },
    [onDrop]
  )

  return (
    <div className="space-y-4">
      {/* 拖拽区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          拖拽文件到此处上传，或{' '}
          <label className="text-primary cursor-pointer hover:underline">
            点击选择文件
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length > 0) onDrop(files)
              }}
            />
          </label>
        </p>
      </div>

      {/* 上传队列 */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {uploads.map((upload) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{upload.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.progress}%` }}
                        className={cn(
                          'h-full rounded-full',
                          upload.status === 'error'
                            ? 'bg-destructive'
                            : 'bg-primary'
                        )}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {upload.status === 'completed'
                        ? '完成'
                        : `${upload.progress}%`}
                    </span>
                  </div>
                </div>

                {upload.status !== 'uploading' && (
                  <button
                    onClick={() => onRemove(upload.id)}
                    className="p-1 rounded hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
