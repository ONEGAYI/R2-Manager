import { forwardRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Trash2, AlertTriangle, Copy, Move, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TransferHistory } from '@/types/transfer'
import { OperationResultDetails } from './OperationResultDetails'

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

// 获取操作图标和文字
function getOperationInfo(history: TransferHistory) {
  if (history.operation === 'copy') {
    return { icon: Copy, text: '复制' }
  }
  if (history.operation === 'move') {
    return { icon: Move, text: '移动' }
  }
  if (history.direction === 'upload') {
    return { icon: null, text: '上传', emoji: '📤' }
  }
  return { icon: null, text: '下载', emoji: '📥' }
}

export const HistoryItem = forwardRef<HTMLDivElement, HistoryItemProps>(
  function HistoryItem({ history, onRemove }, ref) {
    const [showDetails, setShowDetails] = useState(false)

    const isCompleted = history.status === 'completed'
    const isPartial = history.status === 'partial'
    const isFailed = history.status === 'error'

    const operationInfo = getOperationInfo(history)
    const hasResultDetails = history.resultDetails && history.resultDetails.items.length > 0

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "rounded-lg transition-colors",
          isCompleted ? "bg-muted/20 hover:bg-muted/40" :
          isPartial ? "bg-amber-500/5 hover:bg-amber-500/10" :
          "bg-destructive/5 hover:bg-destructive/10"
        )}
      >
        <div className="flex items-center gap-3 p-3">
          {/* 状态图标 */}
          <div className="flex-shrink-0">
            {isCompleted ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : isPartial ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
          </div>

          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* 操作类型图标 */}
              {operationInfo.icon ? (
                <operationInfo.icon className="w-4 h-4 text-muted-foreground" />
              ) : (
                <span className="text-lg">{operationInfo.emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" title={history.fileName}>
                  {history.fileName}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {history.bucketName} · {formatSize(history.fileSize)}
                    {history.localPath && <span className="ml-2">· {history.localPath}</span>}
                  </p>
                  {/* 统计标签（仅批量操作显示） */}
                  {history.resultDetails && (
                    <div className="flex gap-1 text-[10px]">
                      {history.resultDetails.totalSuccess > 0 && (
                        <span className="text-green-500">
                          ✓{history.resultDetails.totalSuccess}
                        </span>
                      )}
                      {history.resultDetails.totalRenamed && history.resultDetails.totalRenamed > 0 && (
                        <span className="text-blue-500">
                          📝{history.resultDetails.totalRenamed}
                        </span>
                      )}
                      {history.resultDetails.totalSkipped > 0 && (
                        <span className="text-amber-500">
                          ⏭{history.resultDetails.totalSkipped}
                        </span>
                      )}
                      {history.resultDetails.totalErrors > 0 && (
                        <span className="text-red-500">
                          ✗{history.resultDetails.totalErrors}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 完成时间 */}
          <div className="text-xs text-muted-foreground flex-shrink-0">
            {formatTime(history.completedAt)}
          </div>

          {/* 展开/收起详情按钮（仅批量操作有） */}
          {hasResultDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title={showDetails ? '收起详情' : '展开详情'}
            >
              {showDetails ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          {/* 删除按钮 */}
          <button
            onClick={() => onRemove(history.id)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="删除记录"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* 结果详情 */}
        {showDetails && hasResultDetails && (
          <div className="px-3 pb-3 pt-0">
            <OperationResultDetails resultDetails={history.resultDetails} />
          </div>
        )}

        {/* 错误信息 */}
        {isFailed && history.error && !showDetails && (
          <div className="px-3 pb-3 pt-0">
            <p className="text-xs text-destructive truncate" title={history.error}>
              {history.error}
            </p>
          </div>
        )}
      </motion.div>
    )
  }
)
