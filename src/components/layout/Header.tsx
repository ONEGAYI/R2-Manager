import { RefreshCw, Upload, FolderPlus, Grid, List, ChevronLeft, Copy, Check, Layers, Trash2, Download, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfig } from '@/hooks/useConfig'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/common/ThemeToggle'

interface HeaderProps {
  bucketName: string | null
  currentPath: string
  selectedCount: number
  isLoading?: boolean
  onRefresh: () => void | Promise<void>
  onUpload: () => void
  onCreateFolder: () => void
  onNavigateBack?: () => void
  onNavigateTo?: (prefix: string) => void
  onBatchDelete?: () => void
  onBatchDownload?: () => void
}

export function Header({
  bucketName,
  currentPath,
  selectedCount,
  isLoading = false,
  onRefresh,
  onUpload,
  onCreateFolder,
  onNavigateBack,
  onNavigateTo,
  onBatchDelete,
  onBatchDownload,
}: HeaderProps) {
  const { viewMode, setViewMode } = useConfig()
  const [copySuccess, setCopySuccess] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 合并外部 loading 状态和内部刷新状态
  const showLoading = isLoading || isRefreshing

  // 处理刷新按钮点击
  const handleRefresh = async () => {
    if (showLoading) return // 防止重复点击

    setIsRefreshing(true)
    const startTime = Date.now()

    try {
      // 添加 20s 超时机制
      const refreshPromise = onRefresh()
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('刷新超时')), 20000)
      )

      await Promise.race([refreshPromise, timeoutPromise])
    } catch (err) {
      console.error('[Header] Refresh failed:', err)
    } finally {
      // 确保动画至少播放 1 秒
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 1000 - elapsed)

      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining))
      }

      setIsRefreshing(false)
    }
  }

  // 解析路径为层级数组
  const pathSegments = currentPath
    ? currentPath.split('/').filter(Boolean)
    : []

  // 构建每个层级的完整路径
  const getPathUpTo = (index: number) => {
    return pathSegments.slice(0, index + 1).join('/') + '/'
  }

  // 复制当前路径
  const handleCopyPath = async () => {
    const fullPath = currentPath ? `${bucketName}/${currentPath}` : bucketName
    if (fullPath) {
      try {
        await navigator.clipboard.writeText(fullPath)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (err) {
        console.error('Failed to copy path:', err)
      }
    }
  }

  // 是否有选中项
  const hasSelection = selectedCount > 0

  if (!bucketName) {
    return (
      <header className="h-14 border-b bg-card flex items-center px-4">
        <h1 className="text-lg font-medium">请选择一个存储桶</h1>
      </header>
    )
  }

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      {/* 左侧：返回按钮 + 路径面包屑 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* 返回上一级按钮 */}
        {currentPath && onNavigateBack && (
          <motion.button
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onNavigateBack}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="返回上一级"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}

        {/* 路径面包屑 */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* 桶名（根级） */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigateTo?.('')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            {bucketName}
          </motion.button>

          {/* 路径层级 */}
          {pathSegments.map((segment, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">/</span>
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigateTo?.(getPathUpTo(index))}
                className="px-2.5 py-1 rounded-full text-sm text-muted-foreground hover:text-foreground bg-blue-500/10 hover:bg-blue-500/20 transition-colors truncate max-w-[120px]"
                title={segment}
              >
                {segment}
              </motion.button>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 批量操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={hasSelection ? { scale: 1.05 } : {}}
              whileTap={hasSelection ? { scale: 0.95 } : {}}
              disabled={!hasSelection}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition-colors',
                hasSelection
                  ? 'hover:bg-accent cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              )}
              title={hasSelection ? `已选择 ${selectedCount} 项` : '请先选择文件或文件夹'}
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">
                {hasSelection ? `批量操作 (${selectedCount})` : '批量操作'}
              </span>
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onBatchDownload}>
              <Download className="h-4 w-4 mr-2" />
              下载选中项
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onBatchDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除选中项
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 复制路径按钮 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCopyPath}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm hover:bg-accent transition-colors"
          title="复制当前路径"
        >
          <AnimatePresence mode="wait">
            {copySuccess ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1 text-green-500"
              >
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">已复制</span>
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1"
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">复制路径</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onUpload}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">上传</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCreateFolder}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm hover:bg-accent"
        >
          <FolderPlus className="h-4 w-4" />
          <span className="hidden sm:inline">新建文件夹</span>
        </motion.button>

        <motion.button
          whileHover={showLoading ? {} : { rotate: 180 }}
          transition={{ duration: 0.3 }}
          onClick={handleRefresh}
          disabled={showLoading}
          className={cn(
            "p-2 rounded-md hover:bg-accent transition-colors",
            showLoading && "cursor-not-allowed opacity-70"
          )}
          title={showLoading ? "加载中..." : "刷新"}
        >
          {showLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </motion.button>

        {/* 主题切换 */}
        <ThemeToggle />

        <div className="flex border rounded-md">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 ${viewMode === 'list' ? 'bg-accent' : ''}`}
            title="列表视图"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 ${viewMode === 'grid' ? 'bg-accent' : ''}`}
            title="网格视图"
          >
            <Grid className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
