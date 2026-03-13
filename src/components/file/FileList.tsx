import { motion } from 'framer-motion'
import { MoreVertical, Trash2, Download } from 'lucide-react'
import { formatFileSize, formatDate } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { FileIcon } from '@/components/common/FileIcon'
import type { R2Object } from '@/types/file'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FileListProps {
  objects: R2Object[]
  prefixes: string[]
  selectedKeys: Set<string>
  onSelect: (key: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onOpenFolder: (prefix: string) => void
  onOpenFile: (key: string) => void
  onDelete?: (key: string, isFolder: boolean) => void
  onDownload?: (key: string) => void
}

export function FileList({
  objects,
  prefixes,
  selectedKeys,
  onSelect,
  onSelectAll,
  onOpenFolder,
  onOpenFile,
  onDelete,
  onDownload,
}: FileListProps) {
  // 计算全选状态
  const totalCount = prefixes.length + objects.length
  const selectedCount = selectedKeys.size
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-background border-b">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="w-10 p-3">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-gray-300"
                title={isAllSelected ? '取消全选' : '全选'}
              />
            </th>
            <th className="p-3">名称</th>
            <th className="p-3 w-32">大小</th>
            <th className="p-3 w-44">修改时间</th>
            <th className="p-3 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {/* 文件夹 */}
          {prefixes.map((prefix, index) => {
            const folderName = prefix.replace(/\/$/, '').split('/').pop() || ''
            return (
              <motion.tr
                key={prefix}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onOpenFolder(prefix)}
                className="border-b hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(prefix)}
                    onChange={(e) => {
                      e.stopPropagation()
                      onSelect(prefix, e.target.checked)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <FileIcon filename={folderName} isFolder size="sm" />
                    <span>{folderName}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">--</td>
                <td className="p-3 text-muted-foreground">--</td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded hover:bg-accent opacity-50 hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete?.(prefix, true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </motion.tr>
            )
          })}

          {/* 文件 */}
          {objects.map((obj, index) => {
            const filename = obj.key.split('/').pop() || ''
            return (
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
                    <FileIcon filename={filename} size="sm" />
                    <span className="truncate">{filename}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">
                  {formatFileSize(obj.size)}
                </td>
                <td className="p-3 text-muted-foreground">
                  {formatDate(obj.lastModified)}
                </td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded hover:bg-accent opacity-50 hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onDownload?.(obj.key)}>
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete?.(obj.key, false)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
