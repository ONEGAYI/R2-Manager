import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Loader2, Trash2, CheckCircle, RefreshCw, Settings2, ShieldAlert, FolderOpen, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useConfigStore, DEFAULT_CONFIG } from '@/stores/configStore'
import { api } from '@/services/api'
import { cn } from '@/lib/cn'
import { isTauri } from '@/lib/isTauri'
import {
  MIN_UPLOAD_CHUNK_STEP,
  MAX_UPLOAD_CHUNK_STEP,
  MIN_DOWNLOAD_CHUNK_STEP,
  MAX_DOWNLOAD_CHUNK_STEP,
} from '@/types/chunk'

type SettingsTab = 'credentials' | 'concurrency' | 'system' | 'danger'

interface TabItem {
  id: SettingsTab
  label: string
  icon: React.ReactNode
}

const tabs: TabItem[] = [
  { id: 'credentials', label: '凭证', icon: <Key className="w-4 h-4" /> },
  { id: 'concurrency', label: '传输', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'system', label: '系统', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'danger', label: '危险', icon: <ShieldAlert className="w-4 h-4" /> },
]

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
    maxUploadThreads,
    maxDownloadThreads,
    uploadChunkStep,
    downloadChunkStep,
    defaultDownloadPath,
    setCredentials,
    clearCredentials,
    setConnected,
    setConcurrencySettings,
    setDownloadPath,
    setChunkStepSettings,
    resetToDefaults,
  } = useConfigStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('credentials')
  const [formData, setFormData] = useState({
    accountId,
    accessKeyId,
    secretAccessKey,
  })
  const [concurrencyData, setConcurrencyData] = useState({
    maxUploadThreads,
    maxDownloadThreads,
    uploadChunkStepMB: uploadChunkStep / (1024 * 1024),
    downloadChunkStepMB: downloadChunkStep / (1024 * 1024),
    defaultDownloadPath,
  })

  // 同步 store 中的并发设置到本地状态
  useEffect(() => {
    setConcurrencyData({
      maxUploadThreads,
      maxDownloadThreads,
      uploadChunkStepMB: uploadChunkStep / (1024 * 1024),
      downloadChunkStepMB: downloadChunkStep / (1024 * 1024),
      defaultDownloadPath,
    })
  }, [maxUploadThreads, maxDownloadThreads, uploadChunkStep, downloadChunkStep, defaultDownloadPath])

  const [showSecret, setShowSecret] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

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
    setConcurrencySettings({
      maxUploadThreads: concurrencyData.maxUploadThreads,
      maxDownloadThreads: concurrencyData.maxDownloadThreads,
    })
    setChunkStepSettings({
      uploadChunkStep: concurrencyData.uploadChunkStepMB * 1024 * 1024,
      downloadChunkStep: concurrencyData.downloadChunkStepMB * 1024 * 1024,
    })
    setDownloadPath(concurrencyData.defaultDownloadPath)

    await api.configure(formData)
    setConnected({ isConnected: true, lastChecked: new Date().toISOString() })

    onCredentialsChanged?.()
    onOpenChange(false)
  }

  const handleClear = () => {
    if (confirm('确定要清除所有配置吗？这将退出登录。')) {
      clearCredentials()
      onOpenChange(false)
      window.location.reload()
    }
  }

  const handleRestart = async () => {
    if (!confirm('确定要重启前后端服务吗？\n这将暂时中断当前连接。')) {
      return
    }

    setIsRestarting(true)

    try {
      await api.restartServer()
      alert('后端服务正在重启...\n\n请等待几秒后刷新页面。')
      // 刷新页面以重新连接
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error('Restart failed:', error)
      alert('重启失败: ' + (error as Error).message)
      setIsRestarting(false)
    }
  }

  // 渲染凭证设置页面
  const renderCredentialsTab = () => (
    <div className="space-y-4 py-4">
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

      <p className="text-xs text-muted-foreground text-center">
        🔐 凭证仅保存在本地浏览器，不会上传到任何服务器
      </p>
    </div>
  )

  // 渲染并发设置页面
  const renderConcurrencyTab = () => {
    const minUploadStepMB = MIN_UPLOAD_CHUNK_STEP / (1024 * 1024)
    const maxUploadStepMB = MAX_UPLOAD_CHUNK_STEP / (1024 * 1024)
    const minDownloadStepMB = MIN_DOWNLOAD_CHUNK_STEP / (1024 * 1024)
    const maxDownloadStepMB = MAX_DOWNLOAD_CHUNK_STEP / (1024 * 1024)

    return (
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">最大上传并发数</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={concurrencyData.maxUploadThreads}
              onChange={(e) =>
                setConcurrencyData((prev) => ({
                  ...prev,
                  maxUploadThreads: Math.max(1, Math.min(10, parseInt(e.target.value) || 4)),
                }))
              }
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">最大下载并发数</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={concurrencyData.maxDownloadThreads}
              onChange={(e) =>
                setConcurrencyData((prev) => ({
                  ...prev,
                  maxDownloadThreads: Math.max(1, Math.min(10, parseInt(e.target.value) || 4)),
                }))
              }
              className="font-mono text-sm"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          限制同时上传/下载的文件数量（1-10），较高的值可能会增加系统负载
        </p>

        {/* 分块步长设置 */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-3">分块设置</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">
                  上传分块大小
                </label>
                <span className="text-xs font-mono text-foreground">
                  {concurrencyData.uploadChunkStepMB} MB
                </span>
              </div>
              <Slider
                min={minUploadStepMB}
                max={maxUploadStepMB}
                step={1}
                value={[concurrencyData.uploadChunkStepMB]}
                onValueChange={([value]) =>
                  setConcurrencyData((prev) => ({
                    ...prev,
                    uploadChunkStepMB: value,
                  }))
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minUploadStepMB} MB</span>
                <span>{maxUploadStepMB} MB</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">
                  下载分块大小
                </label>
                <span className="text-xs font-mono text-foreground">
                  {concurrencyData.downloadChunkStepMB} MB
                </span>
              </div>
              <Slider
                min={minDownloadStepMB}
                max={maxDownloadStepMB}
                step={1}
                value={[concurrencyData.downloadChunkStepMB]}
                onValueChange={([value]) =>
                  setConcurrencyData((prev) => ({
                    ...prev,
                    downloadChunkStepMB: value,
                  }))
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{minDownloadStepMB} MB</span>
                <span>{maxDownloadStepMB} MB</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            较小的分块提供更频繁的进度反馈，较大的分块减少请求开销
          </p>
        </div>

        {/* 下载路径配置 */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">默认下载路径</label>
          {isTauri() ? (
            <div className="flex gap-2">
              <Input
                value={concurrencyData.defaultDownloadPath || ''}
                onChange={(e) =>
                  setConcurrencyData((prev) => ({
                    ...prev,
                    defaultDownloadPath: e.target.value,
                  }))
                }
                placeholder="~/Downloads"
                className="font-mono text-sm flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Tauri 文件夹选择器
                  try {
                    const { open } = await import('@tauri-apps/plugin-dialog')
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      title: '选择下载路径',
                    })
                    if (selected) {
                      setConcurrencyData((prev) => ({
                        ...prev,
                        defaultDownloadPath: selected as string,
                      }))
                    }
                  } catch (error) {
                    console.error('Failed to open folder picker:', error)
                  }
                }}
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-muted/30 text-sm text-muted-foreground">
              浏览器端使用系统默认下载路径
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    )
  }

  // 渲染系统设置页面
  const renderSystemTab = () => (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div>
          <p className="text-sm font-medium">重启服务</p>
          <p className="text-xs text-muted-foreground">
            重启前后端服务以应用代码更改
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestart}
          disabled={isRestarting}
        >
          {isRestarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1" />
          )}
          {isRestarting ? '重启中...' : '重启'}
        </Button>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div>
          <p className="text-sm font-medium">重置默认值</p>
          <p className="text-xs text-muted-foreground">
            恢复所有设置为默认值（保留 R2 凭证）
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm('确定要重置所有设置为默认值吗？\n\n这将重置：主题、视图模式、并发数、分块大小、下载路径等。\nR2 凭证将被保留。')) {
              resetToDefaults()
              // 同步本地状态
              setConcurrencyData({
                maxUploadThreads: DEFAULT_CONFIG.maxUploadThreads,
                maxDownloadThreads: DEFAULT_CONFIG.maxDownloadThreads,
                uploadChunkStepMB: DEFAULT_CONFIG.uploadChunkStep / (1024 * 1024),
                downloadChunkStepMB: DEFAULT_CONFIG.downloadChunkStep / (1024 * 1024),
                defaultDownloadPath: DEFAULT_CONFIG.defaultDownloadPath,
              })
              alert('设置已重置为默认值')
            }
          }}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          重置
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        重启操作会暂时中断当前连接，请确保没有正在进行的上传/下载任务。
      </p>
    </div>
  )

  // 渲染危险操作页面
  const renderDangerTab = () => (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
        <div>
          <p className="text-sm font-medium text-destructive">清除配置</p>
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

      <p className="text-xs text-muted-foreground">
        ⚠️ 此操作不可撤销，清除后需要重新配置 R2 凭证才能使用。
      </p>
    </div>
  )

  // 根据当前标签渲染对应内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'credentials':
        return renderCredentialsTab()
      case 'concurrency':
        return renderConcurrencyTab()
      case 'system':
        return renderSystemTab()
      case 'danger':
        return renderDangerTab()
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <motion.div
          layout
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 30,
          }}
        >
          <DialogHeader>
            <DialogTitle>设置</DialogTitle>
            <DialogDescription>
              管理 R2 连接配置和应用设置
            </DialogDescription>
          </DialogHeader>

          {/* 标签导航 */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg relative">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                'relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors z-10',
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
          {/* 滑动指示框 */}
          <motion.div
            layoutId="activeTabIndicator"
            className="absolute top-1 bottom-1 bg-background rounded-md shadow-sm"
            style={{
              left: `calc(0.25rem + ${tabs.findIndex(t => t.id === activeTab) * 25}%)`,
              width: 'calc(25% - 0.25rem)',
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
          />
        </div>

        {/* 标签内容 - 带切换动画 */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
