import { motion } from 'framer-motion'
import { X, Pause, Play, Loader2, AlertCircle } from 'lucide-react'
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
  const isError = task.status === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        isError ? "bg-destructive/10 border border-destructive/30" : "bg-muted/30 hover:bg-muted/50"
      )}
    >
      {/* 文件图标和信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {isError ? '❌' : task.direction === 'upload' ? '📤' : '📥'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={fileName}>
              {fileName}
            </p>
            {isError && task.error ? (
              <p className="text-xs text-destructive truncate" title={task.error}>
                {task.error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {task.bucketName} · {formatSize(task.fileSize)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 进度信息 */}
      <div className="flex-shrink-0 text-right min-w-[100px]">
        {isError ? (
          <p className="text-sm font-medium text-destructive whitespace-nowrap">上传失败</p>
        ) : (
          <p className="text-sm font-medium whitespace-nowrap">
            {formatSize(loaded)} / {formatSize(task.fileSize)}
          </p>
        )}
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {isError ? '点击关闭' : formatSpeed(task.speed)}
        </p>
      </div>

      {/* 进度条 */}
      <div className="w-20 flex-shrink-0">
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-medium w-10 text-right">
            {isError ? '!' : `${progress}%`}
          </span>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full transition-all",
                isError ? "bg-destructive" : "bg-primary"
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
