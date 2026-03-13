import { RefreshCw, Upload, FolderPlus, Grid, List, ChevronLeft, Copy, Check, Layers, Trash2, Download, Loader2, ChevronDown, MoreHorizontal, Sun, Moon, Monitor, MoreVertical, FolderInput } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfig } from '@/hooks/useConfig'
import { useThemeStore } from '@/stores/themeStore'
import { useState, useRef, useLayoutEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  onBatchMove?: () => void
  onBatchCopy?: () => void
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
  onBatchMove,
  onBatchCopy,
}: HeaderProps) {
  const { viewMode, setViewMode } = useConfig()
  const { theme, setTheme } = useThemeStore()
  const [copySuccess, setCopySuccess] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isHoveringRefresh, setIsHoveringRefresh] = useState(false)

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

  // 响应式布局：检测容器宽度动态切换
  const headerRef = useRef<HTMLElement>(null)
  const [isCompact, setIsCompact] = useState(false)

  useLayoutEffect(() => {
    const checkWidth = () => {
      if (headerRef.current) {
        const width = headerRef.current.offsetWidth
        // 右侧宽屏按钮约需 500px，路径区域至少需要 250px
        // 总宽度 < 900px 时切换到紧凑模式
        setIsCompact(width < 900)
      }
    }

    // 初始检测
    checkWidth()

    // 监听 window resize 事件
    window.addEventListener('resize', checkWidth)

    return () => {
      window.removeEventListener('resize', checkWidth)
    }
  }, [bucketName]) // bucketName 变化时重新绑定

  if (!bucketName) {
    return (
      <header className="h-14 border-b bg-card flex items-center px-4">
        <h1 className="text-lg font-medium">请选择一个存储桶</h1>
      </header>
    )
  }

  return (
    <header ref={headerRef} className="h-14 border-b bg-card flex items-center justify-between px-4">
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

        {/* 路径面包屑 - Win11 风格：前面折叠 + 下拉菜单 */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {/* 计算需要折叠的层级 */}
          {(() => {
            // 最多直接显示 3 个层级（不含桶名），超过的折叠到前面
            const maxVisibleSegments = 3
            const totalCount = pathSegments.length
            const shouldCollapse = totalCount > maxVisibleSegments
            const collapseCount = totalCount - maxVisibleSegments

            // 被折叠的层级（前面的部分）
            const collapsedSegments = shouldCollapse
              ? pathSegments.slice(0, collapseCount)
              : []
            // 直接显示的层级（后面的部分）
            const visibleSegments = shouldCollapse
              ? pathSegments.slice(collapseCount)
              : pathSegments

            return (
              <>
                {/* 桶名（根级） */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigateTo?.('')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                >
                  {bucketName}
                </motion.button>

                {/* 折叠菜单 - 前面的层级 */}
                {shouldCollapse && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-0.5 px-2 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        title={`${collapseCount} 个隐藏层级`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <ChevronDown className="h-3 w-3" />
                      </motion.button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                      {collapsedSegments.map((segment, index) => (
                        <DropdownMenuItem
                          key={index}
                          onClick={() => onNavigateTo?.(getPathUpTo(index))}
                          className="cursor-pointer"
                        >
                          <span className="truncate max-w-[200px]" title={segment}>
                            {segment}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* 直接显示的层级 */}
                {visibleSegments.map((segment, index) => {
                  // 计算实际索引（如果有折叠的层级，需要加上偏移）
                  const actualIndex = shouldCollapse ? collapseCount + index : index
                  return (
                    <div key={actualIndex} className="flex items-center gap-1.5 shrink-0">
                      <span className="text-muted-foreground text-sm">/</span>
                      <motion.button
                        whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onNavigateTo?.(getPathUpTo(actualIndex))}
                        className="px-2.5 py-1 rounded-full text-sm text-muted-foreground hover:text-foreground bg-blue-500/10 hover:bg-blue-500/20 transition-colors truncate max-w-[120px]"
                        title={segment}
                      >
                        {segment}
                      </motion.button>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* ===== 宽屏布局：显示所有按钮 ===== */}
        {!isCompact && (
        <div className="flex items-center gap-2">
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
                <AnimatePresence mode="wait">
                  <motion.div
                    key={hasSelection ? 'selected' : 'empty'}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-1"
                  >
                    <Layers className="h-4 w-4" />
                    <span>
                      {hasSelection ? `批量操作 (${selectedCount})` : '批量操作'}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onBatchDownload}>
                <Download className="h-4 w-4 mr-2" />
                下载选中项
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBatchMove}>
                <FolderInput className="h-4 w-4 mr-2" />
                移动选中项
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBatchCopy}>
                <Copy className="h-4 w-4 mr-2" />
                复制选中项
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
                  <span>已复制</span>
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
                  <span>复制路径</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* 上传按钮 */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onUpload}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <Upload className="h-4 w-4" />
              <span>上传</span>
            </motion.div>
          </motion.button>

          {/* 新建文件夹 */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreateFolder}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm hover:bg-accent"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <FolderPlus className="h-4 w-4" />
              <span>新建文件夹</span>
            </motion.div>
          </motion.button>

          {/* 刷新按钮 */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            onMouseEnter={() => setIsHoveringRefresh(true)}
            onMouseLeave={() => setIsHoveringRefresh(false)}
            disabled={showLoading}
            className={cn(
              "p-2 rounded-md hover:bg-accent transition-colors",
              showLoading && "cursor-not-allowed opacity-70"
            )}
            title={showLoading ? "加载中..." : "刷新"}
          >
            <AnimatePresence mode="wait">
              {showLoading ? (
                <motion.div
                  key="loading"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="refresh"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: isHoveringRefresh ? 180 : 0 }}
                  exit={{ scale: 0 }}
                  transition={{ rotate: { duration: 0.3 } }}
                >
                  <RefreshCw className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* 主题切换 */}
          <ThemeToggle />

          {/* 视图切换 */}
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
        )}

        {/* ===== 窄屏布局：只显示核心按钮 + 更多菜单 ===== */}
        {isCompact && (
        <div className="flex items-center gap-1">
          {/* 上传按钮（核心功能，始终显示） */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onUpload}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Upload className="h-4 w-4" />
            </motion.div>
          </motion.button>

          {/* 刷新按钮（动效关键，始终显示） */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            onMouseEnter={() => setIsHoveringRefresh(true)}
            onMouseLeave={() => setIsHoveringRefresh(false)}
            disabled={showLoading}
            className={cn(
              "p-2 rounded-md hover:bg-accent transition-colors",
              showLoading && "cursor-not-allowed opacity-70"
            )}
            title={showLoading ? "加载中..." : "刷新"}
          >
            <AnimatePresence mode="wait">
              {showLoading ? (
                <motion.div
                  key="loading"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="refresh"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: isHoveringRefresh ? 180 : 0 }}
                  exit={{ scale: 0 }}
                  transition={{ rotate: { duration: 0.3 } }}
                >
                  <RefreshCw className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* 视图切换（高频操作，始终显示） */}
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

          {/* 更多操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 rounded-md hover:bg-accent transition-colors"
                title="更多操作"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* 批量操作 - 平铺展示 */}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                批量操作
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onBatchDownload}
                disabled={!hasSelection}
                className={!hasSelection ? 'opacity-50' : ''}
              >
                <Download className="h-4 w-4 mr-2" />
                下载选中项
                {hasSelection && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {selectedCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onBatchMove}
                disabled={!hasSelection}
                className={!hasSelection ? 'opacity-50' : ''}
              >
                <FolderInput className="h-4 w-4 mr-2" />
                移动选中项
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onBatchCopy}
                disabled={!hasSelection}
                className={!hasSelection ? 'opacity-50' : ''}
              >
                <Copy className="h-4 w-4 mr-2" />
                复制选中项
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onBatchDelete}
                disabled={!hasSelection}
                className={!hasSelection ? 'opacity-50' : 'text-destructive focus:text-destructive'}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除选中项
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* 其他操作 */}
              <DropdownMenuItem onClick={handleCopyPath}>
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-green-500">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    复制路径
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateFolder}>
                <FolderPlus className="h-4 w-4 mr-2" />
                新建文件夹
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* 主题切换 - 平铺展示 */}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                主题
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="h-4 w-4 mr-2" />
                浅色
                {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="h-4 w-4 mr-2" />
                深色
                {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="h-4 w-4 mr-2" />
                跟随系统
                {theme === 'system' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        )}
      </div>
    </header>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
