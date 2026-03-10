import { motion } from 'framer-motion'
import { File, Folder, Square } from 'lucide-react'
import { formatFileSize, formatDate, getFileType } from '@/lib/utils'
import { cn } from '@/lib/cn'
import type { R2Object } from '@/types/file'

interface FileListProps {
  objects: R2Object[]
  prefixes: string[]
  selectedKeys: Set<string>
  onSelect: (key: string, selected: boolean) => void
  onOpenFolder: (prefix: string) => void
  onOpenFile: (key: string) => void
}

export function FileList({
  objects,
  prefixes,
  selectedKeys,
  onSelect,
  onOpenFolder,
  onOpenFile,
}: FileListProps) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-background border-b">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="w-10 p-3"></th>
            <th className="p-3">名称</th>
            <th className="p-3 w-32">大小</th>
            <th className="p-3 w-44">修改时间</th>
          </tr>
        </thead>
        <tbody>
          {/* 文件夹 */}
          {prefixes.map((prefix, index) => (
            <motion.tr
              key={prefix}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => onOpenFolder(prefix)}
              className="border-b hover:bg-accent/50 cursor-pointer transition-colors"
            >
              <td className="p-3">
                <Square className="pointer-events-none opacity-50 h-4 w-4" />
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" />
                  <span>{prefix.replace(/\/$/, '').split('/').pop()}</span>
                </div>
              </td>
              <td className="p-3 text-muted-foreground">--</td>
              <td className="p-3 text-muted-foreground">--</td>
            </motion.tr>
          ))}

          {/* 文件 */}
          {objects.map((obj, index) => (
            <motion.tr
              key={obj.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (prefixes.length + index) * 0.02 }}
              onClick={() => onOpenFile(obj.key)}
              className={cn(
                'border-b hover:bg-accent/50 cursor-pointer transition-colors',
                selectedKeys.has(obj.key) && 'bg-primary/10'
              )}
            >
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selectedKeys.has(obj.key)}
                  onChange={(e) => {
                    e.stopPropagation()
                    onSelect(obj.key, e.target.checked)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-gray-300"
                />
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <File
                    className={cn(
                      'h-4 w-4',
                      getFileType(obj.key) === 'image' && 'text-green-500',
                      getFileType(obj.key) === 'video' && 'text-purple-500',
                      getFileType(obj.key) === 'code' && 'text-blue-500'
                    )}
                  />
                  <span className="truncate">{obj.key.split('/').pop()}</span>
                </div>
              </td>
              <td className="p-3 text-muted-foreground">
                {formatFileSize(obj.size)}
              </td>
              <td className="p-3 text-muted-foreground">
                {formatDate(obj.lastModified)}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
