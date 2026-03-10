import { useState } from 'react'
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

interface CreateBucketProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<boolean>
}

export function CreateBucket({ open, onOpenChange, onCreate }: CreateBucketProps) {
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入存储桶名称')
      return
    }

    // R2 桶名称规则
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
      setError('名称只能包含小写字母、数字和连字符')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const success = await onCreate(name.trim())
      if (success) {
        setName('')
        onOpenChange(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建存储桶</DialogTitle>
          <DialogDescription>
            存储桶名称只能包含小写字母、数字和连字符，且必须以字母或数字开头和结尾
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="my-bucket-name"
            className={error ? 'border-destructive' : ''}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
