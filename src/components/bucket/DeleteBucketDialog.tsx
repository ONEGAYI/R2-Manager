import { useState } from 'react'
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
import { Input } from '@/components/ui/input'

interface DeleteBucketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bucketName: string
  onDelete: (name: string) => Promise<boolean>
}

export function DeleteBucketDialog({
  open,
  onOpenChange,
  bucketName,
  onDelete,
}: DeleteBucketDialogProps) {
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const canDelete = inputValue === bucketName

  const handleSubmit = async () => {
    if (!canDelete) return

    setIsLoading(true)
    setError('')

    try {
      const success = await onDelete(bucketName)
      if (success) {
        setInputValue('')
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
      setInputValue('')
      setError('')
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            删除存储桶
          </DialogTitle>
          <DialogDescription className="pt-2">
            此操作不可撤销。这将永久删除存储桶
            <span className="font-semibold text-foreground mx-1">"{bucketName}"</span>
            及其所有内容。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              请输入 <span className="font-mono font-semibold">{bucketName}</span> 以确认删除
            </p>
          </div>
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setError('')
            }}
            placeholder="输入存储桶名称"
            className={error ? 'border-destructive' : ''}
            disabled={isLoading}
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canDelete || isLoading}
          >
            {isLoading ? '删除中...' : '删除存储桶'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
