import { RefreshCw, Upload, FolderPlus, Grid, List } from 'lucide-react'
import { motion } from 'framer-motion'
import { useConfig } from '@/hooks/useConfig'

interface HeaderProps {
  bucketName: string | null
  currentPath: string
  onRefresh: () => void
  onUpload: () => void
  onCreateFolder: () => void
}

export function Header({
  bucketName,
  currentPath,
  onRefresh,
  onUpload,
  onCreateFolder,
}: HeaderProps) {
  const { viewMode, setViewMode } = useConfig()

  if (!bucketName) {
    return (
      <header className="h-14 border-b bg-card flex items-center px-4">
        <h1 className="text-lg font-medium">请选择一个存储桶</h1>
      </header>
    )
  }

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      {/* 路径面包屑 */}
      <div className="flex items-center gap-2">
        <span className="font-medium">{bucketName}</span>
        {currentPath && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{currentPath}</span>
          </>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onUpload}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
        >
          <Upload className="h-4 w-4" />
          上传
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCreateFolder}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm hover:bg-accent"
        >
          <FolderPlus className="h-4 w-4" />
          新建文件夹
        </motion.button>

        <motion.button
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          onClick={onRefresh}
          className="p-2 rounded-md hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
        </motion.button>

        <div className="flex border rounded-md">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 ${viewMode === 'list' ? 'bg-accent' : ''}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 ${viewMode === 'grid' ? 'bg-accent' : ''}`}
          >
            <Grid className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
