import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FolderInput, Copy, ChevronLeft, Home, Database, ChevronRight, RefreshCw, PanelRightClose, PanelRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { FileIcon } from '@/components/common/FileIcon'

interface MoveCopyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'move' | 'copy'
  item: {
    key: string
    name: string
    isFolder: boolean
  } | null
  currentPrefix: string
  sourceBucket: string
  buckets: string[]
  folders: string[] // 当前路径下的文件夹列表
  onConfirm: (sourceKey: string, destinationKey: string, destinationBucket?: string) => Promise<boolean>
  onLoadFolders?: (bucket: string, prefix: string) => Promise<void>
  // 批量模式
  batchMode?: boolean
  batchItems?: Array<{
    key: string
    name: string
    isFolder: boolean
  }>
  onBatchConfirm?: (items: Array<{
    sourceKey: string
    destinationKey: string
    isFolder: boolean
  }>, destinationBucket?: string) => Promise<boolean>
}

/**
 * 检测是否为自身或子目录移动（仅对同桶文件夹有意义）
 */
function isSelfOrDescendant(source: string, target: string, isFolder: boolean): boolean {
  if (source === target) return true
  if (!isFolder) return false
  const sourcePrefix = source.endsWith('/') ? source : source + '/'
  return target.startsWith(sourcePrefix)
}

export function MoveCopyDialog({
  open,
  onOpenChange,
  mode,
  item,
  currentPrefix,
  sourceBucket,
  buckets,
  folders,
  onConfirm,
  onLoadFolders,
  // 批量模式
  batchMode = false,
  batchItems = [],
  onBatchConfirm,
}: MoveCopyDialogProps) {
  const [destinationPath, setDestinationPath] = useState('')
  const [destinationBucket, setDestinationBucket] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true) // 右侧栏展开状态
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const skipDebounceRef = useRef(false) // 是否跳过防抖（用于按钮点击）

  // 当对话框打开时，设置初始值
  useEffect(() => {
    if (open && item) {
      setDestinationPath(currentPrefix)
      setDestinationBucket(sourceBucket)
      setError('')
    }
  }, [open, item, currentPrefix, sourceBucket])

  // 当对话框打开或目标桶/路径改变时，重新加载文件夹（带防抖）
  useEffect(() => {
    if (!open || !onLoadFolders || !destinationBucket) return

    // 规范化路径：非空路径确保以 / 结尾
    const normalizedPath = destinationPath && !destinationPath.endsWith('/')
      ? destinationPath + '/'
      : destinationPath

    const executeLoad = () => {
      setIsLoadingFolders(true)
      onLoadFolders(destinationBucket, normalizedPath).finally(() => setIsLoadingFolders(false))
    }

    // 如果标记跳过防抖，立即执行
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false
      executeLoad()
      return
    }

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 防抖：等待 1 秒后执行
    debounceTimerRef.current = setTimeout(executeLoad, 1000)

    // 清理函数
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [open, destinationBucket, destinationPath, onLoadFolders])

  // 当目标桶或路径改变时，重新加载文件夹
  const handleLoadFolders = useCallback((bucket: string, prefix: string) => {
    if (onLoadFolders) {
      // 规范化路径：非空路径确保以 / 结尾
      const normalizedPath = prefix && !prefix.endsWith('/')
        ? prefix + '/'
        : prefix
      setIsLoadingFolders(true)
      onLoadFolders(bucket, normalizedPath).finally(() => setIsLoadingFolders(false))
    }
  }, [onLoadFolders])

  // 计算完整的目标 key（单文件模式）
  const destinationKey = useMemo(() => {
    if (batchMode || !item) return ''
    if (!destinationPath) {
      return item.name + (item.isFolder ? '/' : '')
    }
    const path = destinationPath.endsWith('/') ? destinationPath : destinationPath + '/'
    return path + item.name + (item.isFolder ? '/' : '')
  }, [batchMode, item, destinationPath])

  // 批量模式：检测是否有任何项目移动到自身或子目录
  const batchInvalidMoves = useMemo(() => {
    if (!batchMode || mode !== 'move') return []
    if (destinationBucket !== sourceBucket) return []
    // 检查所有批量项目
    return batchItems.filter(bi => {
    const destKey = destinationPath
      ? (destinationPath.endsWith('/') ? destinationPath : destinationPath + '/') + bi.name + (bi.isFolder ? '/' : '')
      : bi.name + (bi.isFolder ? '/' : '')
    return isSelfOrDescendant(bi.key, destKey, bi.isFolder)
  })
  }, [batchMode, batchItems, mode, destinationBucket, sourceBucket, destinationPath])

  // 单文件模式：检测是否为同桶自身或子目录移动
  const isInvalidMove = useMemo(() => {
    if (batchMode || !item || mode !== 'move') return false
    if (destinationBucket !== sourceBucket) return false
    return isSelfOrDescendant(item.key, destinationKey, item.isFolder)
  }, [batchMode, item, mode, destinationKey, destinationBucket, sourceBucket])

  const handleSubmit = async () => {
    // 批量模式
    if (batchMode && batchItems.length > 0 && onBatchConfirm) {
      setIsLoading(true)
      setError('')

      try {
        const items = batchItems.map(bi => ({
          sourceKey: bi.key,
          destinationKey: destinationPath
            ? (destinationPath.endsWith('/') ? destinationPath : destinationPath + '/') + bi.name + (bi.isFolder ? '/' : '')
            : bi.name + (bi.isFolder ? '/' : ''),
          isFolder: bi.isFolder
        }))

        const destBucket = destinationBucket !== sourceBucket ? destinationBucket : undefined
        const success = await onBatchConfirm(items, destBucket)
        if (success) {
          onOpenChange(false)
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // 单文件模式
    if (!item || !destinationKey || isInvalidMove) return

    setIsLoading(true)
    setError('')

    try {
      const destBucket = destinationBucket !== sourceBucket ? destinationBucket : undefined
      const success = await onConfirm(item.key, destinationKey, destBucket)
      if (success) {
        onOpenChange(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDestinationPath('')
      setDestinationBucket('')
      setError('')
    }
    onOpenChange(open)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isInvalidMove) {
      handleSubmit()
    }
  }

  // 返回上一级目录
  const goToParent = () => {
    if (!destinationPath) return
    const parts = destinationPath.replace(/\/$/, '').split('/').filter(Boolean)
    parts.pop()
    const newPath = parts.length > 0 ? parts.join('/') + '/' : ''
    skipDebounceRef.current = true
    setDestinationPath(newPath)
  }

  // 进入子文件夹
  const enterFolder = (folderName: string) => {
    const newPath = destinationPath
      ? (destinationPath.endsWith('/') ? destinationPath : destinationPath + '/') + folderName + '/'
      : folderName + '/'
    skipDebounceRef.current = true
    setDestinationPath(newPath)
  }

  // 过滤掉当前操作的文件夹
  const availableFolders = useMemo(() => {
    // 批量模式下过滤所有被移动的文件夹
    if (batchMode && mode === 'move' && destinationBucket === sourceBucket) {
      const folderKeys = new Set(batchItems.filter(i => i.isFolder).map(i => i.key))
      return folders.filter(f => {
        const folderPath = destinationPath
          ? (destinationPath.endsWith('/') ? destinationPath : destinationPath + '/') + f + '/'
          : f + '/'
        return !folderKeys.has(folderPath)
      })
    }
    // 单文件模式
    if (!item || mode !== 'move' || destinationBucket !== sourceBucket) {
      return folders
    }
    return folders.filter(f => {
      const folderPath = destinationPath
        ? (destinationPath.endsWith('/') ? destinationPath : destinationPath + '/') + f + '/'
        : f + '/'
      if (item.isFolder && folderPath === item.key) {
        return false
      }
      return true
    })
  }, [folders, item, mode, destinationBucket, sourceBucket, destinationPath, batchMode, batchItems])

  // 单文件模式且没有 item 时返回 null
  if (!batchMode && !item) return null

  // 批量模式时计算批量项信息
  const batchFolderCount = batchItems.filter(i => i.isFolder).length
  const batchFileCount = batchItems.length - batchFolderCount
  const batchDescription = batchFolderCount > 0 && batchFileCount > 0
    ? `${batchFolderCount} 个文件夹和 ${batchFileCount} 个文件`
    : batchFolderCount > 0
      ? `${batchFolderCount} 个文件夹`
      : `${batchFileCount} 个文件`

  const ModeIcon = mode === 'move' ? FolderInput : Copy
  const modeText = mode === 'move' ? '移动' : '复制'

  // 解析面包屑
  const breadcrumbs = destinationPath
    ? destinationPath.replace(/\/$/, '').split('/').filter(Boolean)
    : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[680px] p-0 gap-0 overflow-hidden">
        {/* 主内容区 - 左右分栏布局 */}
        <div className="flex">
          {/* 左侧主内容 */}
          <div className="flex-1 p-6 space-y-4 min-w-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ModeIcon className="h-5 w-5" />
                {batchMode
                  ? `批量${modeText}`
                  : `${modeText}${item?.isFolder ? '文件夹' : '文件'}`
                }
              </DialogTitle>
              <DialogDescription className="pt-2">
                {batchMode ? (
                  <>
                    将 <span className="font-semibold text-foreground mx-1">{batchDescription}</span>
                    {modeText}到指定位置
                  </>
                ) : (
                  <>
                    将
                    <span className="font-semibold text-foreground mx-1">"{item?.name}"</span>
                    {modeText}到指定位置
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {/* 目标桶选择 */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" />
                目标存储桶
              </label>
              <Select
                value={destinationBucket}
                onValueChange={(value) => {
                  skipDebounceRef.current = true
                  setDestinationBucket(value)
                  setDestinationPath('')
                  setError('')
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择目标存储桶" />
                </SelectTrigger>
                <SelectContent>
                  {buckets.map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>
                      {bucket}
                      {bucket === sourceBucket && ' (当前)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 当前路径显示 + 快捷按钮 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">目标路径</label>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      skipDebounceRef.current = true
                      setDestinationPath('')
                    }}
                    disabled={isLoading || destinationPath === ''}
                    className="h-6 w-6 p-0"
                    title="根目录"
                  >
                    <Home className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={goToParent}
                    disabled={isLoading || !destinationPath}
                    className="h-6 w-6 p-0"
                    title="上一级"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="h-6 w-6 p-0"
                    title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}
                  >
                    {showSidebar ? (
                      <PanelRightClose className="h-3 w-3" />
                    ) : (
                      <PanelRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 面包屑路径显示 */}
              <div className="flex items-center gap-0.5 text-xs flex-wrap p-1.5 bg-muted/30 rounded min-h-[32px] border overflow-x-auto">
                <button
                  onClick={() => {
                    skipDebounceRef.current = true
                    setDestinationPath('')
                  }}
                  className="hover:text-primary transition-colors shrink-0"
                >
                  /
                </button>
                {breadcrumbs.map((crumb, index) => (
                  <span key={index} className="flex items-center gap-0.5 shrink-0">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button
                      onClick={() => {
                        const newPath = breadcrumbs.slice(0, index + 1).join('/') + '/'
                        skipDebounceRef.current = true
                        setDestinationPath(newPath)
                      }}
                      className="hover:text-primary transition-colors"
                    >
                      {crumb}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* 自定义路径输入 */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">手动输入路径</label>
              <Input
                value={destinationPath}
                onChange={(e) => {
                  setDestinationPath(e.target.value)
                  setError('')
                }}
                onKeyDown={handleKeyDown}
                placeholder="例如: folder/subfolder/"
                className={cn(error || isInvalidMove ? 'border-destructive' : '')}
                disabled={isLoading}
              />
            </div>

            {/* 错误提示 */}
            {isInvalidMove && !batchMode && item && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">
                  {item.isFolder
                    ? '不能将文件夹移动到自身或子目录中'
                    : '源路径和目标路径不能相同'}
                </p>
              </div>
            )}
            {batchInvalidMoves.length > 0 && batchMode && (
              <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="text-sm text-amber-600">
                  {batchInvalidMoves.length} 个项目无法移动到自身或子目录中，将被跳过
                </p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isLoading ||
                  isInvalidMove ||
                  (batchMode ? batchItems.length === 0 : !destinationKey)
                }
              >
                {isLoading ? '处理中...' : modeText}
              </Button>
            </DialogFooter>
          </div>

          {/* 右侧文件夹浏览器 */}
          <div
            className={cn(
              "border-l bg-muted/20 transition-all duration-300 ease-in-out overflow-hidden",
              showSidebar ? "w-[220px]" : "w-0"
            )}
          >
            <div className="w-[220px] h-full flex flex-col pt-10">
              {/* 右侧标题 */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                <span className="text-sm font-medium">文件夹</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={goToParent}
                    disabled={isLoading || !destinationPath}
                    className="h-6 w-6 p-0"
                    title="上一层"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoadFolders(destinationBucket, destinationPath)}
                    disabled={isLoadingFolders}
                    className="h-6 w-6 p-0"
                    title="刷新"
                  >
                    <RefreshCw className={cn("h-3 w-3", isLoadingFolders && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* 文件夹列表 */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingFolders ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm">加载中...</span>
                  </div>
                ) : availableFolders.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <span className="text-sm">无子文件夹</span>
                  </div>
                ) : (
                  <div className="divide-y">
                    {availableFolders.map((folder) => (
                      <button
                        key={folder}
                        onClick={() => enterFolder(folder)}
                        disabled={isLoading}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left disabled:opacity-50"
                      >
                        <FileIcon filename={folder} isFolder size="sm" />
                        <span className="flex-1 truncate text-sm">{folder}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 当前位置提示 */}
              <div className="px-3 py-2 border-t bg-muted/50">
                <div className="text-xs text-muted-foreground truncate">
                  当前: /{breadcrumbs.join('/')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
