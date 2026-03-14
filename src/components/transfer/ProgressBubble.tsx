import { motion, AnimatePresence } from 'framer-motion'
import { Copy, FolderInput } from 'lucide-react'
import { useTransferStore } from '@/stores/transferStore'
import { CircularProgress } from './CircularProgress'
import { cn } from '@/lib/cn'

interface ProgressBubbleProps {
  /** 点击回调，通常用于跳转到传输中心 */
  onClick?: () => void
}

/**
 * 进度气泡组件
 * 显示批量复制/移动操作的实时进度
 * 位于屏幕右下角，点击跳转到传输中心
 */
export function ProgressBubble({ onClick }: ProgressBubbleProps) {
  const tasks = useTransferStore((state) => state.tasks)

  // 筛选批量操作任务（复制/移动）
  const batchTasks = tasks.filter(
    (task) => task.direction === 'copy' || task.direction === 'move'
  )

  // 如果没有进行中的批量任务，不显示气泡
  if (batchTasks.length === 0) {
    return null
  }

  // 聚合计算总进度
  const totalItems = batchTasks.reduce((sum, task) => sum + (task.totalItems || 0), 0)
  const completedItems = batchTasks.reduce((sum, task) => sum + (task.completedItems || 0), 0)
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // 判断是否是移动操作
  const hasMove = batchTasks.some((task) => task.direction === 'move')
  const hasCopy = batchTasks.some((task) => task.direction === 'copy')

  // 优先显示移动图标
  const Icon = hasMove ? FolderInput : Copy
  const text = hasMove ? '正在移动...' : hasCopy ? '正在复制...' : '处理中...'

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
        }}
        onClick={onClick}
        className={cn(
          'fixed bottom-5 right-5 z-50',
          'flex items-center gap-2 px-3 py-2',
          'w-[200px] h-[40px]',
          'bg-background/95 backdrop-blur-sm',
          'border border-border/50',
          'rounded-full shadow-lg',
          'cursor-pointer',
          'hover:bg-accent/10 hover:border-accent/30',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-accent/50'
        )}
        title="点击查看传输中心"
      >
        {/* 环形进度条 */}
        <div className="text-primary flex-shrink-0">
          <CircularProgress
            percentage={percentage}
            size={28}
            strokeWidth={3}
          />
        </div>

        {/* 百分比数字 */}
        <motion.span
          key={percentage}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className="text-sm font-medium tabular-nums w-10"
        >
          {percentage}%
        </motion.span>

        {/* 操作类型图标和文本 */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">{text}</span>
        </div>
      </motion.button>
    </AnimatePresence>
  )
}
