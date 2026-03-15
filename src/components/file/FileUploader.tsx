import { useState, useCallback } from 'react'
import { Upload, X, FolderUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { isTauri } from '@/lib/isTauri'
import { tauriSelectFolderForUpload } from '@/lib/tauriFolderPicker'
import {
  isFileSystemAccessSupported,
  selectFolderWithFileSystemAccess,
  readDroppedItems,
} from '@/lib/browserFolderPicker'
import type { UploadFile } from '@/types/file'

interface FileUploaderProps {
  uploads: UploadFile[]
  onDrop: (files: File[]) => void
  onRemove: (id: string) => void
  /** 选择文件夹时的回调，包含空目录信息 */
  onFolderSelect?: (files: File[], emptyDirs: string[]) => void
}

export function FileUploader({ uploads, onDrop, onRemove, onFolderSelect }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isSelectingFolder, setIsSelectingFolder] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 检查是否有文件
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有当离开拖拽区域时才重置状态
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      // 在浏览器环境下，尝试使用 webkitGetAsEntry 检测空目录
      if (!isTauri()) {
        const result = await readDroppedItems(e.dataTransfer)
        if (result) {
          console.log('[Browser Drag] Folder dropped:', result.folderName)
          console.log('[Browser Drag] Files:', result.files.length)
          console.log('[Browser Drag] Empty dirs:', result.emptyDirs)

          if (result.files.length > 0 || result.emptyDirs.length > 0) {
            if (onFolderSelect) {
              onFolderSelect(result.files, result.emptyDirs)
            } else {
              onDrop(result.files)
            }
          }
          return
        }
      }

      // 降级：使用原有的文件列表处理
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        onDrop(files)
      }
    },
    [onDrop, onFolderSelect]
  )

  // Tauri 环境下的文件夹选择
  const handleTauriFolderSelect = useCallback(async () => {
    if (!isTauri()) return

    setIsSelectingFolder(true)
    try {
      const result = await tauriSelectFolderForUpload()
      if (result) {
        console.log('[Tauri Folder] Selected folder:', result.folderName)
        console.log('[Tauri Folder] Files:', result.files.length)
        console.log('[Tauri Folder] Empty dirs:', result.emptyDirs)

        if (result.files.length > 0 || result.emptyDirs.length > 0) {
          if (onFolderSelect) {
            onFolderSelect(result.files, result.emptyDirs)
          } else {
            onDrop(result.files)
          }
        }
      }
    } catch (err) {
      console.error('[Tauri Folder] Failed to select folder:', err)
    } finally {
      setIsSelectingFolder(false)
    }
  }, [onDrop, onFolderSelect])

  // 浏览器环境：使用 File System Access API 选择文件夹
  const handleBrowserFolderSelect = useCallback(async () => {
    if (isTauri()) return

    setIsSelectingFolder(true)
    try {
      const result = await selectFolderWithFileSystemAccess()
      if (result) {
        console.log('[Browser API] Selected folder:', result.folderName)
        console.log('[Browser API] Files:', result.files.length)
        console.log('[Browser API] Empty dirs:', result.emptyDirs)

        if (result.files.length > 0 || result.emptyDirs.length > 0) {
          if (onFolderSelect) {
            onFolderSelect(result.files, result.emptyDirs)
          } else {
            onDrop(result.files)
          }
        }
      }
    } catch (err) {
      console.error('[Browser API] Failed to select folder:', err)
    } finally {
      setIsSelectingFolder(false)
    }
  }, [onDrop, onFolderSelect])

  // 浏览器环境：使用 webkitdirectory 降级方案
  const handleBrowserFolderFallback = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onDrop(files)
      }
      // 重置 input 以允许重新选择同一文件夹
      e.target.value = ''
    },
    [onDrop]
  )

  // 渲染文件夹选择按钮
  const renderFolderSelectButton = () => {
    if (isTauri()) {
      // Tauri 环境：使用原生文件夹选择
      return (
        <button
          type="button"
          onClick={handleTauriFolderSelect}
          disabled={isSelectingFolder}
          className="text-primary cursor-pointer hover:underline inline-flex items-center gap-1 disabled:opacity-50"
        >
          <FolderUp className="h-4 w-4" />
          {isSelectingFolder ? '选择中...' : '选择整个文件夹'}
        </button>
      )
    }

    if (isFileSystemAccessSupported()) {
      // 现代浏览器：使用 File System Access API（支持空目录）
      return (
        <button
          type="button"
          onClick={handleBrowserFolderSelect}
          disabled={isSelectingFolder}
          className="text-primary cursor-pointer hover:underline inline-flex items-center gap-1 disabled:opacity-50"
        >
          <FolderUp className="h-4 w-4" />
          {isSelectingFolder ? '选择中...' : '选择整个文件夹'}
        </button>
      )
    }

    // 降级方案：使用 webkitdirectory（不支持空目录）
    return (
      <label className="text-primary cursor-pointer hover:underline inline-flex items-center gap-1">
        <FolderUp className="h-4 w-4" />
        选择整个文件夹
        <input
          type="file"
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleBrowserFolderFallback}
        />
      </label>
    )
  }

  return (
    <div className="space-y-4">
      {/* 拖拽区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          拖拽文件到此处上传，或{' '}
          <label className="text-primary cursor-pointer hover:underline">
            点击选择文件
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length > 0) onDrop(files)
                e.target.value = ''
              }}
            />
          </label>
        </p>
        <p className="text-muted-foreground text-sm mt-2">也可以 {renderFolderSelectButton()}</p>
      </div>

      {/* 上传队列 */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {uploads.map((upload) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{upload.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.progress}%` }}
                        className={cn(
                          'h-full rounded-full',
                          upload.status === 'error' ? 'bg-destructive' : 'bg-primary'
                        )}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {upload.status === 'completed' ? '完成' : `${upload.progress}%`}
                    </span>
                  </div>
                </div>

                {upload.status !== 'uploading' && (
                  <button onClick={() => onRemove(upload.id)} className="p-1 rounded hover:bg-accent">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
