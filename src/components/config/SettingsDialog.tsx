import { useState } from 'react'
import { Key, Eye, EyeOff, Loader2, Trash2, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfigStore } from '@/stores/configStore'
import { api } from '@/services/api'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCredentialsChanged?: () => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  onCredentialsChanged,
}: SettingsDialogProps) {
  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    setCredentials,
    clearCredentials,
    setConnected,
  } = useConfigStore()

  const [formData, setFormData] = useState({
    accountId,
    accessKeyId,
    secretAccessKey,
  })
  const [showSecret, setShowSecret] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setTestError(null)
    setTestSuccess(false)
  }

  const handleTest = async () => {
    if (!formData.accountId || !formData.accessKeyId || !formData.secretAccessKey) {
      setTestError('请填写所有必填字段')
      return
    }

    setIsTesting(true)
    setTestError(null)
    setTestSuccess(false)

    try {
      // 临时配置 API 进行测试
      await api.configure(formData)
      await api.testConnection()
      setTestSuccess(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '连接失败'
      setTestError(errorMessage)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    setCredentials(formData)

    // 配置 API 客户端
    await api.configure(formData)
    setConnected({ isConnected: true, lastChecked: new Date().toISOString() })

    onCredentialsChanged?.()
    onOpenChange(false)
  }

  const handleClear = () => {
    if (confirm('确定要清除所有配置吗？这将退出登录。')) {
      clearCredentials()
      onOpenChange(false)
      // 刷新页面以返回配置页面
      window.location.reload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            管理 R2 连接配置和应用设置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* R2 凭证 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="w-4 h-4" />
              R2 凭证
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Account ID</label>
                <Input
                  value={formData.accountId}
                  onChange={(e) => handleInputChange('accountId', e.target.value)}
                  placeholder="your-account-id"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Access Key ID</label>
                <Input
                  value={formData.accessKeyId}
                  onChange={(e) => handleInputChange('accessKeyId', e.target.value)}
                  placeholder="your-access-key-id"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Secret Access Key</label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={formData.secretAccessKey}
                    onChange={(e) => handleInputChange('secretAccessKey', e.target.value)}
                    placeholder="your-secret-access-key"
                    className="font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* 测试结果 */}
            {testError && (
              <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">
                {testError}
              </div>
            )}
            {testSuccess && (
              <div className="p-2 rounded bg-green-500/10 text-green-600 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                连接成功
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '测试连接'
                )}
              </Button>
              <Button size="sm" onClick={handleSave}>
                保存
              </Button>
            </div>
          </div>

          {/* 危险操作 */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">清除配置</p>
                <p className="text-xs text-muted-foreground">
                  清除所有保存的凭证并退出登录
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClear}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                清除
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          🔐 凭证仅保存在本地浏览器，不会上传到任何服务器
        </p>
      </DialogContent>
    </Dialog>
  )
}
