import { motion } from 'framer-motion'
import { X, Pause, Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TransferTask } from '@/types/transfer'

interface TaskItemProps {
  task: TransferTask
  onCancel: (id: string) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化速度
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  return formatSize(bytesPerSecond) + '/s'
}

// 获取文件名（不含路径）
function getFileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

export function TaskItem({ task, onCancel, onPause, onResume }: TaskItemProps) {
  const fileName = task.fileName || getFileName(task.filePath)
  const progress = task.progress || 0
  const loaded = task.loadedBytes || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
    >
      {/* 文件图标和信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {task.direction === 'upload' ? '📤' : '📥'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={fileName}>
              {fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {task.bucketName} · {formatSize(task.fileSize)}
            </p>
          </div>
        </div>
      </div>

      {/* 进度信息 */}
      <div className="w-32 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-medium">
            {formatSize(loaded)} / {formatSize(task.fileSize)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSpeed(task.speed)}
          </p>
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-20 flex-shrink-0">
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-medium w-10 text-right">
            {progress}%
          </span>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full transition-all",
                task.status === 'error' ? "bg-destructive" : "bg-primary"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1">
        {task.status === 'running' && onPause && (
          <button
            onClick={() => onPause(task.id)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="暂停"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        {task.status === 'paused' && onResume && (
          <button
            onClick={() => onResume(task.id)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="继续"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {task.status === 'running' && (
          <button
            onClick={() => onCancel(task.id)}
            className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="取消"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {task.status === 'pending' && (
          <div className="p-1.5">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {task.status === 'error' && (
          <button
            onClick={() => onCancel(task.id)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
