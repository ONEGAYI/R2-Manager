import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, Key, User, Lock, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfigStore } from '@/stores/configStore'
import { api } from '@/services/api'

interface ConfigPageProps {
  onConfigured: () => void
}

export function ConfigPage({ onConfigured }: ConfigPageProps) {
  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    setCredentials,
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

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setTestError(null)
  }

  const handleTestAndSave = async () => {
    if (!formData.accountId || !formData.accessKeyId || !formData.secretAccessKey) {
      setTestError('请填写所有必填字段')
      return
    }

    setIsTesting(true)
    setTestError(null)

    try {
      // 配置后端代理客户端
      await api.configure(formData)

      // 测试连接
      await api.testConnection()

      // 连接成功，保存配置到本地
      setCredentials(formData)
      setConnected({ isConnected: true, lastChecked: new Date().toISOString() })

      // 通知父组件配置完成
      onConfigured()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '连接失败'
      setTestError(errorMessage)
      setConnected({ isConnected: false, error: errorMessage })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4"
          >
            <Database className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold">R2 Manager</h1>
          <p className="text-muted-foreground mt-1">Cloudflare R2 存储管理工具</p>
        </div>

        {/* 配置表单 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card border rounded-xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-6">
            <Key className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">配置 R2 凭证</span>
          </div>

          <div className="space-y-4">
            {/* Account ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5" />
                Account ID
              </label>
              <Input
                value={formData.accountId}
                onChange={(e) => handleInputChange('accountId', e.target.value)}
                placeholder="your-account-id"
                className="font-mono"
              />
            </div>

            {/* Access Key ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Key className="w-3.5 h-3.5" />
                Access Key ID
              </label>
              <Input
                value={formData.accessKeyId}
                onChange={(e) => handleInputChange('accessKeyId', e.target.value)}
                placeholder="your-access-key-id"
                className="font-mono"
              />
            </div>

            {/* Secret Access Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Secret Access Key
              </label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={formData.secretAccessKey}
                  onChange={(e) => handleInputChange('secretAccessKey', e.target.value)}
                  placeholder="your-secret-access-key"
                  className="font-mono pr-10"
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

            {/* 错误提示 */}
            {testError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
              >
                {testError}
              </motion.div>
            )}

            {/* 提交按钮 */}
            <Button
              onClick={handleTestAndSave}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  正在连接...
                </>
              ) : (
                '测试连接并保存'
              )}
            </Button>
          </div>

          {/* 帮助链接 */}
          <div className="mt-6 pt-4 border-t">
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              前往 Cloudflare 控制台获取 API Token
            </a>
          </div>
        </motion.div>

        {/* 安全提示 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-muted-foreground mt-4"
        >
          🔐 凭证仅保存在本地浏览器，不会上传到任何服务器
        </motion.p>
      </motion.div>
    </div>
  )
}
