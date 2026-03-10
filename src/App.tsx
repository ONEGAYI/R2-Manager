import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MainLayout } from '@/components/layout/MainLayout'
import { Header } from '@/components/layout/Header'
import { FileList } from '@/components/file/FileList'
import { FileGrid } from '@/components/file/FileGrid'
import { FileUploader } from '@/components/file/FileUploader'
import { Empty } from '@/components/common/Empty'
import { Loading } from '@/components/common/Loading'
import { ConfigPage } from '@/components/config/ConfigPage'
import { SettingsDialog } from '@/components/config/SettingsDialog'
import { useBuckets } from '@/hooks/useBuckets'
import { useConfig } from '@/hooks/useConfig'
import { useFiles } from '@/hooks/useFiles'
import { useConfigStore } from '@/stores/configStore'
import { api } from '@/services/api'
import '@/styles/globals.css'

function App() {
  const [showUploader, setShowUploader] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [forceShowConfig, setForceShowConfig] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { buckets, selectedBucket, isLoading, selectBucket, refreshBuckets } =
    useBuckets()
  const { viewMode } = useConfig()
  const {
    objects,
    prefixes,
    currentPrefix,
    selectedKeys,
    refreshFiles,
    selectKey,
    selectAll,
    clearSelection,
  } = useFiles()

  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    isConnected,
    hasCredentials,
    setConnected,
  } = useConfigStore()

  // 检查是否有有效凭证
  const hasValidCredentials = hasCredentials()

  // 选中项数量
  const selectedCount = selectedKeys.size

  // 初始化 API 客户端
  useEffect(() => {
    if (hasValidCredentials && accountId && accessKeyId && secretAccessKey) {
      // 配置后端代理
      api.configure({ accountId, accessKeyId, secretAccessKey })
        .then(() => {
          setConnected({ isConnected: true })
        })
        .catch((err) => {
          console.error('Failed to configure API:', err)
          setConnected({ isConnected: false, error: err.message })
        })
    }
  }, [hasValidCredentials, accountId, accessKeyId, secretAccessKey, setConnected])

  // 加载桶列表
  useEffect(() => {
    if (isConnected) {
      refreshBuckets()
    }
  }, [isConnected, refreshBuckets])

  // 选择桶时加载文件
  useEffect(() => {
    if (selectedBucket && isConnected) {
      refreshFiles(selectedBucket, '')
    }
  }, [selectedBucket, isConnected, refreshFiles])

  // 处理配置完成
  const handleConfigured = useCallback(() => {
    setForceShowConfig(false)
    refreshBuckets()
  }, [refreshBuckets])

  // 处理凭证变更
  const handleCredentialsChanged = useCallback(() => {
    refreshBuckets()
  }, [refreshBuckets])

  // 处理清除凭证
  const handleClearCredentials = useCallback(() => {
    setForceShowConfig(true)
    setShowSettings(false)
  }, [])

  // 处理桶选择
  const handleSelectBucket = (name: string) => {
    selectBucket(name)
  }

  // 处理文件夹打开
  const handleOpenFolder = (prefix: string) => {
    if (selectedBucket) {
      refreshFiles(selectedBucket, prefix)
    }
  }

  // 处理文件打开（预览）
  const handleOpenFile = (key: string) => {
    console.log('Open file:', key)
    // TODO: 实现文件预览
  }

  // 处理全选/取消全选
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        // 选中当前层级所有文件和文件夹
        const allKeys = [...prefixes, ...objects.map((obj) => obj.key)]
        selectAll(allKeys)
      } else {
        clearSelection()
      }
    },
    [prefixes, objects, selectAll, clearSelection]
  )

  // 处理单个删除
  const handleDelete = useCallback(
    async (key: string, isFolder: boolean) => {
      if (!selectedBucket) return

      const confirmMsg = isFolder
        ? `确定要删除文件夹 "${key}" 及其所有内容吗？\n此操作不可恢复。`
        : `确定要删除 "${key.split('/').pop()}" 吗？`

      if (!window.confirm(confirmMsg)) return

      try {
        setDeleting(true)
        await api.deleteObject(selectedBucket, key)
        refreshFiles(selectedBucket, currentPrefix)
      } catch (error) {
        console.error('Delete failed:', error)
        alert('删除失败: ' + (error as Error).message)
      } finally {
        setDeleting(false)
      }
    },
    [selectedBucket, currentPrefix, refreshFiles]
  )

  // 处理单个下载
  const handleDownload = useCallback(
    async (key: string) => {
      if (!selectedBucket) return

      try {
        const { url } = await api.getDownloadUrl(selectedBucket, key)
        // 创建一个隐藏的 a 标签来触发下载
        const a = document.createElement('a')
        a.href = url
        a.download = key.split('/').pop() || 'download'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch (error) {
        console.error('Download failed:', error)
        alert('下载失败: ' + (error as Error).message)
      }
    },
    [selectedBucket]
  )

  // 处理批量删除
  const handleBatchDelete = useCallback(async () => {
    if (!selectedBucket || selectedCount === 0) return

    const keys = Array.from(selectedKeys)
    const confirmMsg = `确定要删除选中的 ${selectedCount} 项吗？\n\n${keys.slice(0, 5).map((k) => '• ' + k.split('/').pop()).join('\n')}${keys.length > 5 ? `\n... 还有 ${keys.length - 5} 项` : ''}`

    if (!window.confirm(confirmMsg)) return

    try {
      setDeleting(true)
      const result = await api.batchDelete(selectedBucket, keys)

      if (result.errors && result.errors.length > 0) {
        alert(`删除完成，但有 ${result.errors.length} 项失败:\n${result.errors.map((e) => e.key).join('\n')}`)
      }

      clearSelection()
      refreshFiles(selectedBucket, currentPrefix)
    } catch (error) {
      console.error('Batch delete failed:', error)
      alert('批量删除失败: ' + (error as Error).message)
    } finally {
      setDeleting(false)
    }
  }, [selectedBucket, selectedKeys, selectedCount, clearSelection, refreshFiles, currentPrefix])

  // 处理批量下载
  const handleBatchDownload = useCallback(async () => {
    if (!selectedBucket || selectedCount === 0) return

    const keys = Array.from(selectedKeys)

    try {
      const { results } = await api.batchGetDownloadUrls(selectedBucket, keys)

      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      if (failCount > 0) {
        alert(`${successCount} 个文件开始下载，${failCount} 个失败`)
      }

      // 触发所有成功的下载
      results.forEach((result) => {
        if (result.success && result.url) {
          const a = document.createElement('a')
          a.href = result.url
          a.download = result.key.split('/').pop() || 'download'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      })
    } catch (error) {
      console.error('Batch download failed:', error)
      alert('批量下载失败: ' + (error as Error).message)
    }
  }, [selectedBucket, selectedKeys, selectedCount])

  // 未配置凭证或强制显示配置页面时显示配置页面
  if (!hasValidCredentials || forceShowConfig) {
    return <ConfigPage onConfigured={handleConfigured} />
  }

  return (
    <>
      <MainLayout
        buckets={buckets.map((b) => b.name)}
        selectedBucket={selectedBucket}
        onSelectBucket={handleSelectBucket}
        onOpenSettings={() => setShowSettings(true)}
      >
        <Header
          bucketName={selectedBucket}
          currentPath={currentPrefix}
          selectedCount={selectedCount}
          onRefresh={() => selectedBucket && refreshFiles(selectedBucket, currentPrefix)}
          onUpload={() => setShowUploader(true)}
          onCreateFolder={() => console.log('Create folder')}
          onNavigateBack={() => {
            if (selectedBucket && currentPrefix) {
              // 返回上一级
              const parts = currentPrefix.split('/').filter(Boolean)
              parts.pop()
              const parentPrefix = parts.length > 0 ? parts.join('/') + '/' : ''
              refreshFiles(selectedBucket, parentPrefix)
            }
          }}
          onNavigateTo={(prefix: string) => {
            if (selectedBucket) {
              refreshFiles(selectedBucket, prefix)
            }
          }}
          onBatchDelete={handleBatchDelete}
          onBatchDownload={handleBatchDownload}
        />

        <AnimatePresence mode="wait">
          {isLoading || deleting ? (
            <Loading key="loading" />
          ) : !selectedBucket ? (
            <Empty
              key="empty-bucket"
              message="请选择一个存储桶"
              description="从左侧列表选择或创建新的存储桶"
            />
          ) : objects.length === 0 && prefixes.length === 0 ? (
            <Empty
              key="empty-files"
              message="存储桶为空"
              description="上传文件开始使用"
            />
          ) : viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FileGrid
                objects={objects}
                prefixes={prefixes}
                selectedKeys={selectedKeys}
                onSelect={selectKey}
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpenFile}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FileList
                objects={objects}
                prefixes={prefixes}
                selectedKeys={selectedKeys}
                onSelect={selectKey}
                onSelectAll={handleSelectAll}
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpenFile}
                onDelete={handleDelete}
                onDownload={handleDownload}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 上传对话框 */}
        <AnimatePresence>
          {showUploader && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowUploader(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
              >
                <h2 className="text-lg font-medium mb-4">上传文件</h2>
                <FileUploader
                  uploads={[]}
                  onDrop={(files) => console.log('Upload:', files)}
                  onRemove={() => {}}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </MainLayout>

      {/* 设置对话框 */}
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onCredentialsChanged={handleCredentialsChanged}
      />
    </>
  )
}

export default App
