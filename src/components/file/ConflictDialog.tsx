import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileIcon } from '@/components/common/FileIcon'
import { cn } from '@/lib/cn'

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

export type ConflictResolution = 'overwrite' | 'skip' | 'rename'

interface ConflictWithResolution extends ConflictItem {
  resolution: ConflictResolution
}

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictItem[]
  onConfirm: (resolutions: Array<{ item: ConflictItem; resolution: ConflictResolution }>) => void
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

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  mode,
}: ConflictDialogProps) {
  // 每个冲突的独立处理策略
  const [conflictResolutions, setConflictResolutions] = useState<ConflictWithResolution[]>([])
  // 全局策略（用于"应用到所有"）
  const [globalResolution, setGlobalResolution] = useState<ConflictResolution | null>(null)

  // 当冲突列表变化时，初始化每个冲突的策略为 'skip'
  useEffect(() => {
    if (conflicts.length > 0) {
      setConflictResolutions(
        conflicts.map(c => ({
          ...c,
          resolution: 'skip' as ConflictResolution
        }))
      )
      setGlobalResolution(null)
    }
  }, [conflicts])

  // 更新单个冲突的策略
  const updateResolution = (index: number, resolution: ConflictResolution) => {
    setConflictResolutions(prev => {
      const updated = [...prev]
      if (updated[index]) {
        updated[index] = { ...updated[index], resolution }
      }
      return updated
    })
  }

  // 应用全局策略到所有冲突
  const applyGlobalResolution = (resolution: ConflictResolution) => {
    setGlobalResolution(resolution)
    setConflictResolutions(prev =>
      prev.map(item => ({ ...item, resolution }))
    )
  }

  // 检查是否所有冲突都已选择策略
  const allResolved = conflictResolutions.length > 0 && conflictResolutions.every(c => c.resolution)

  // 处理确认
  const handleConfirm = () => {
    const results = conflictResolutions.map(item => ({
      item: {
        sourceKey: item.sourceKey,
        targetKey: item.targetKey,
        isFolder: item.isFolder,
        sourceInfo: item.sourceInfo,
        targetInfo: item.targetInfo,
      },
      resolution: item.resolution,
    }))
    onConfirm(results)
    onOpenChange(false)
  }

  // 处理取消
  const handleCancel = () => {
    onOpenChange(false)
  }

  // 统计各策略数量
  const stats = {
    overwrite: conflictResolutions.filter(c => c.resolution === 'overwrite').length,
    skip: conflictResolutions.filter(c => c.resolution === 'skip').length,
    rename: conflictResolutions.filter(c => c.resolution === 'rename').length,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            发现 {conflicts.length} 个冲突
          </DialogTitle>
          <DialogDescription>
            {mode === 'move' ? '移动' : '复制'}操作时，以下对象在目标位置已存在，请为每个冲突选择处理方式
          </DialogDescription>
        </DialogHeader>

        {/* 全局操作栏 */}
        <div className="flex items-center justify-between gap-4 py-2 px-1 bg-muted/30 rounded-md">
          <span className="text-sm text-muted-foreground">全部设为：</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyGlobalResolution('skip')}
              className={cn(
                "h-7",
                globalResolution === 'skip' && "border-primary bg-primary/10"
              )}
            >
              全部跳过
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyGlobalResolution('rename')}
              className={cn(
                "h-7",
                globalResolution === 'rename' && "border-primary bg-primary/10"
              )}
            >
              全部保留
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyGlobalResolution('overwrite')}
              className={cn(
                "h-7 text-destructive hover:bg-destructive/10",
                globalResolution === 'overwrite' && "border-destructive bg-destructive/10"
              )}
            >
              全部覆盖
            </Button>
          </div>
        </div>

        {/* 冲突列表 */}
        <div className="flex-1 overflow-y-auto border rounded-md">
          <div className="divide-y">
            {conflictResolutions.map((conflict, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 space-y-2 transition-colors",
                  conflict.resolution === 'overwrite' && "bg-destructive/5",
                  conflict.resolution === 'skip' && "bg-muted/50",
                  conflict.resolution === 'rename' && "bg-primary/5"
                )}
              >
                {/* 对象名称和策略选择 */}
                <div className="flex items-center gap-3">
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
                  {/* 策略选择器 */}
                  <Select
                    value={conflict.resolution}
                    onValueChange={(value) => updateResolution(index, value as ConflictResolution)}
                  >
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        <span className="text-muted-foreground">跳过</span>
                      </SelectItem>
                      <SelectItem value="rename">
                        <span className="text-primary">保留两者</span>
                      </SelectItem>
                      <SelectItem value="overwrite">
                        <span className="text-destructive">覆盖</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 详细信息 */}
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pl-6">
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground">源文件</div>
                    {conflict.sourceInfo ? (
                      <>
                        <div>大小: {formatSize(conflict.sourceInfo.size)}</div>
                        <div className="text-[10px] opacity-70">
                          {formatDate(conflict.sourceInfo.lastModified)}
                        </div>
                      </>
                    ) : (
                      <div>-</div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground">目标文件</div>
                    {conflict.targetInfo ? (
                      <>
                        <div>大小: {formatSize(conflict.targetInfo.size)}</div>
                        <div className="text-[10px] opacity-70">
                          {formatDate(conflict.targetInfo.lastModified)}
                        </div>
                      </>
                    ) : (
                      <div>-</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-t">
          <div className="flex gap-4">
            {stats.skip > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {stats.skip} 项跳过
              </span>
            )}
            {stats.rename > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle className="h-3 w-3" />
                {stats.rename} 项保留
              </span>
            )}
            {stats.overwrite > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <CheckCircle className="h-3 w-3" />
                {stats.overwrite} 项覆盖
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            取消操作
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allResolved}
          >
            确认执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
