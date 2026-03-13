import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
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

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: {
    key: string
    name: string
    isFolder: boolean
  } | null
  onRename: (sourceKey: string, newName: string) => Promise<boolean>
}

export function RenameDialog({
  open,
  onOpenChange,
  item,
  onRename,
}: RenameDialogProps) {
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 当对话框打开时，设置初始值
  useEffect(() => {
    if (open && item) {
      setNewName(item.name)
      setError('')
    }
  }, [open, item])

  const handleSubmit = async () => {
    if (!item || !newName.trim()) return

    // 名称未改变
    if (newName.trim() === item.name) {
      onOpenChange(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const success = await onRename(item.key, newName.trim())
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
      setNewName('')
      setError('')
    }
    onOpenChange(open)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            重命名{item.isFolder ? '文件夹' : '文件'}
          </DialogTitle>
          <DialogDescription className="pt-2">
            为
            <span className="font-semibold text-foreground mx-1">"{item.name}"</span>
            输入新名称
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setError('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入新名称"
            className={error ? 'border-destructive' : ''}
            disabled={isLoading}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!newName.trim() || isLoading}
          >
            {isLoading ? '处理中...' : '确定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
