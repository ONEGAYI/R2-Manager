import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, FolderInput, Check, AlertCircle, MinusCircle, Loader2 } from 'lucide-react'
import { useTransferStore } from '@/stores/transferStore'
import { CircularProgress } from './CircularProgress'
import { cn } from '@/lib/cn'
import { truncatePath } from '@/lib/utils'
import type { BatchOperationItem } from '@/types/transfer'

interface ProgressBubbleProps {
  /** 点击回调，通常用于跳转到传输中心 */
  onClick?: () => void
}

/** 获取子项状态 UI 配置 */
function getItemStatusUI(status: BatchOperationItem['status'], error?: string) {
  switch (status) {
    case 'completed':
      return {
        icon: <Check className="w-3 h-3 text-green-500 flex-shrink-0" />,
        className: 'text-green-600 dark:text-green-400',
        title: '已完成'
      }
    case 'skipped':
      return {
        icon: <MinusCircle className="w-3 h-3 text-yellow-500 flex-shrink-0" />,
        className: 'text-yellow-600 dark:text-yellow-400',
        title: error || '已跳过'
      }
    case 'running':
      return {
        icon: <Loader2 className="w-3 h-3 text-blue-500 flex-shrink-0 animate-spin" />,
        className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
        title: '正在处理...'
      }
    case 'error':
      return {
        icon: <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />,
        className: 'text-red-600 dark:text-red-400',
        title: error || '失败'
      }
    default: // pending
      return {
        icon: <div className="w-3 h-3 rounded-full border border-muted-foreground/30 flex-shrink-0" />,
        className: 'text-muted-foreground',
        title: '等待中'
      }
  }
}

/**
 * 进度气泡组件
 * 显示批量复制/移动操作的实时进度
 * 位于屏幕右下角，hover 展开详情，点击跳转到传输中心
 */
export function ProgressBubble({ onClick }: ProgressBubbleProps) {
  const tasks = useTransferStore((state) => state.tasks)
  const [isExpanded, setIsExpanded] = useState(false)
  const [userScrolled, setUserScrolled] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const listRef = useRef<HTMLDivElement>(null)

  // 筛选批量操作任务（复制/移动）- 使用 useMemo
  const batchTasks = useMemo(() =>
    tasks.filter(
      (task) => task.direction === 'copy' || task.direction === 'move'
    ),
    [tasks]
  )

  // 聚合计算总进度
  const { totalItems, completedItems, percentage, allItems, currentSourceKey } = useMemo(() => {
    const total = batchTasks.reduce((sum, task) => sum + (task.totalItems || 0), 0)
    const completed = batchTasks.reduce((sum, task) => sum + (task.completedItems || 0), 0)
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    // 聚合所有子项
    const items: Array<BatchOperationItem & { taskId: string }> = []
    let currentKey: string | undefined

    batchTasks.forEach(task => {
      // 获取当前处理的 key
      if (task.currentSourceKey && !currentKey) {
        currentKey = task.currentSourceKey
      }

      if (task.items) {
        task.items.forEach(item => {
          items.push({
            ...item,
            taskId: task.id
          })
        })
      }
    })

    return { totalItems: total, completedItems: completed, percentage: pct, allItems: items, currentSourceKey: currentKey }
  }, [batchTasks])

  // 自动滚动到正在进行的项
  useEffect(() => {
    if (!userScrolled && currentSourceKey && listRef.current) {
      const runningItem = listRef.current.querySelector(`[data-key="${currentSourceKey}"]`)
      if (runningItem) {
        runningItem.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [currentSourceKey, userScrolled])

  // 用户滚动时暂停自动滚动，3 秒后恢复
  const handleScroll = () => {
    setUserScrolled(true)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setUserScrolled(false)
    }, 3000)
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // 如果没有进行中的批量任务，不显示气泡
  if (batchTasks.length === 0) {
    return null
  }

  // 判断操作类型
  const hasMove = batchTasks.some((task) => task.direction === 'move')
  const hasCopy = batchTasks.some((task) => task.direction === 'copy')
  const Icon = hasMove ? FolderInput : Copy
  const text = hasMove ? '正在移动...' : hasCopy ? '正在复制...' : '处理中...'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
        }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => {
          setIsExpanded(false)
          setUserScrolled(false)
        }}
        onClick={onClick}
        className={cn(
          'fixed bottom-5 right-5 z-50',
          'bg-background/95 backdrop-blur-sm',
          'border border-border/50',
          'rounded-xl shadow-lg overflow-hidden',
          'cursor-pointer',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-accent/50'
        )}
        title="点击查看传输中心"
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{ width: isExpanded ? 320 : 200 }}
        >
          {/* 标题区域 */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* 环形进度条 */}
            <div className="text-primary flex-shrink-0">
              <CircularProgress
                percentage={percentage}
                size={28}
                strokeWidth={3}
              />
            </div>

            {/* 操作类型图标和文本 */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{text}</span>
            </div>

            {/* 计数 */}
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedItems}/{totalItems}
            </span>
          </div>

          {/* 展开列表 */}
          <AnimatePresence>
            {isExpanded && allItems.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="border-t border-border/30"
              >
                <div
                  ref={listRef}
                  onScroll={handleScroll}
                  className="max-h-[240px] overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin"
                >
                  {allItems.map((item, index) => {
                    const { display, full } = truncatePath(item.sourceKey, 38)
                    const { icon, className, title } = getItemStatusUI(item.status, item.error)

                    return (
                      <div
                        key={`${item.taskId}-${index}`}
                        data-key={item.sourceKey}
                        title={title || full}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md',
                          'text-xs transition-colors duration-150',
                          className
                        )}
                      >
                        {icon}
                        <span className="truncate flex-1">{display}</span>
                        {item.status === 'skipped' && (
                          <span className="text-[10px] opacity-70">已跳过</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
