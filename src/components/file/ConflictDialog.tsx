import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileIcon } from '@/components/common/FileIcon'

export interface ConflictItem {
  sourceKey: string
  targetKey: string
  isFolder: boolean
  sourceInfo?: {
    size: number
    lastModified: string
  }
  targetInfo?: {
    size: number
    lastModified: string
  }
}

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictItem[]
  onConfirm: (resolution: 'overwrite' | 'skip' | 'cancel') => void
  mode: 'copy' | 'move'
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  mode,
}: ConflictDialogProps) {
  const handleConfirm = (resolution: 'overwrite' | 'skip' | 'cancel') => {
    if (resolution === 'cancel') {
      onOpenChange(false)
      return
    }
    onConfirm(resolution)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            发现 {conflicts.length} 个冲突
          </DialogTitle>
          <DialogDescription>
            {mode === 'move' ? '移动' : '复制'}操作时，以下 {conflicts.length > 1 ? '对象' : '对象'}在目标位置已存在，请选择处理方式
          </DialogDescription>
        </DialogHeader>

        {/* 冲突列表 */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-3">
            {conflicts.slice(0, 10).map((conflict, index) => (
              <div
                key={index}
                className="rounded-lg border bg-muted/30 p-3 space-y-2"
              >
                {/* 对象名称 */}
                <div className="flex items-center gap-2">
                  <FileIcon
                    filename={conflict.targetKey.split('/').pop() || conflict.targetKey}
                    isFolder={conflict.isFolder}
                    size="sm"
                  />
                  <span className="text-sm font-medium truncate flex-1">
                    {conflict.targetKey}
                  </span>
                  {conflict.isFolder && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">文件夹</span>
                  )}
                </div>

                {/* 详细信息 */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pl-6">
                  <div>
                    <span className="text-muted-foreground">源: </span>
                    {conflict.sourceInfo ? (
                      <span>{formatSize(conflict.sourceInfo.size)}</span>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">目标: </span>
                    {conflict.targetInfo ? (
                      <span>{formatSize(conflict.targetInfo.size)}</span>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {conflicts.length > 10 && (
              <div className="text-center text-sm text-muted-foreground py-2">
                还有 {conflicts.length - 10} 个冲突...
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleConfirm('cancel')}
            className="w-full sm:w-auto"
          >
            取消操作
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => handleConfirm('skip')}
              className="flex-1 sm:flex-none"
            >
              跳过冲突
            </Button>
            <Button
              onClick={() => handleConfirm('overwrite')}
              className="flex-1 sm:flex-none"
            >
              覆盖所有
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
