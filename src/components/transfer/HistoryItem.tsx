import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TransferHistory } from '@/types/transfer'

interface HistoryItemProps {
  history: TransferHistory
  onRemove: (id: string) => void
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '1 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function HistoryItem({ history, onRemove }: HistoryItemProps) {
  const isCompleted = history.status === 'completed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        isCompleted ? "bg-muted/20 hover:bg-muted/40" : "bg-destructive/5 hover:bg-destructive/10"
      )}
    >
      {/* 状态图标 */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
      </div>

      {/* 文件信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {history.direction === 'upload' ? '📤' : '📥'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={history.fileName}>
              {history.fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {history.bucketName} · {formatSize(history.fileSize)}
              {history.localPath && <span className="ml-2">· {history.localPath}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* 完成时间 */}
      <div className="text-xs text-muted-foreground flex-shrink-0">
        {formatTime(history.completedAt)}
      </div>

      {/* 删除按钮 */}
      <button
        onClick={() => onRemove(history.id)}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        title="删除记录"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
