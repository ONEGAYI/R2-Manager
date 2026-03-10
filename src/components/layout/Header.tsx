import { RefreshCw, Upload, FolderPlus, Grid, List, ChevronLeft, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfig } from '@/hooks/useConfig'
import { useState } from 'react'

interface HeaderProps {
  bucketName: string | null
  currentPath: string
  onRefresh: () => void
  onUpload: () => void
  onCreateFolder: () => void
  onNavigateBack?: () => void
  onNavigateTo?: (prefix: string) => void
}

export function Header({
  bucketName,
  currentPath,
  onRefresh,
  onUpload,
  onCreateFolder,
  onNavigateBack,
  onNavigateTo,
}: HeaderProps) {
  const { viewMode, setViewMode } = useConfig()
  const [copySuccess, setCopySuccess] = useState(false)

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
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          onClick={onRefresh}
          className="p-2 rounded-md hover:bg-accent"
          title="刷新"
        >
          <RefreshCw className="h-4 w-4" />
        </motion.button>

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
