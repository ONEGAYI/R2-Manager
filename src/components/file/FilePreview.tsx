import { X, Download, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import type { R2Object } from '@/types/file'
import { formatFileSize, formatDate } from '@/lib/utils'

interface FilePreviewProps {
  file: R2Object | null
  url?: string
  onClose: () => void
  onDownload: () => void
}

export function FilePreview({ file, url, onClose, onDownload }: FilePreviewProps) {
  if (!file) return null

  const ext = file.key.split('.').pop()?.toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')
  const isVideo = ['mp4', 'webm', 'ogg'].includes(ext || '')
  const isAudio = ['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium truncate flex-1">{file.key.split('/').pop()}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="p-2 rounded hover:bg-accent"
              title="下载"
            >
              <Download className="h-4 w-4" />
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded hover:bg-accent"
                title="新窗口打开"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 预览内容 */}
        <div className="p-4 overflow-auto max-h-[60vh]">
          {url && isImage && (
            <img
              src={url}
              alt={file.key}
              className="max-w-full max-h-[50vh] mx-auto object-contain"
            />
          )}

          {url && isVideo && (
            <video
              src={url}
              controls
              className="max-w-full max-h-[50vh] mx-auto"
            />
          )}

          {url && isAudio && (
            <audio src={url} controls className="w-full mx-auto" />
          )}

          {!url && (
            <div className="text-center py-12 text-muted-foreground">
              预览不可用
            </div>
          )}
        </div>

        {/* 文件信息 */}
        <div className="p-4 border-t bg-muted/50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">大小：</span>
              {formatFileSize(file.size)}
            </div>
            <div>
              <span className="text-muted-foreground">修改时间：</span>
              {formatDate(file.lastModified)}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
