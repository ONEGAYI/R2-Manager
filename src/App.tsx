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
import { CreateBucket } from '@/components/bucket/CreateBucket'
import { useBuckets } from '@/hooks/useBuckets'
import { useConfig } from '@/hooks/useConfig'
import { useFiles } from '@/hooks/useFiles'
import { useConfigStore } from '@/stores/configStore'
import { api } from '@/services/api'
import { fileService } from '@/services/fileService'
import type { UploadFile } from '@/types/file'
import '@/styles/globals.css'

// 并发限制工具函数
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  taskFn: (item: T) => Promise<void>
): Promise<void> {
  const executing: Set<Promise<void>> = new Set()

  for (const item of items) {
    // 如果已达到并发上限，等待任意一个任务完成
    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }

    // 创建任务并添加到执行集合
    const promise = taskFn(item).finally(() => {
      executing.delete(promise)
    })
    executing.add(promise)
  }

  // 等待所有剩余任务完成
  await Promise.all(executing)
}

function App() {
  const [showUploader, setShowUploader] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateBucket, setShowCreateBucket] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [forceShowConfig, setForceShowConfig] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploads, setUploads] = useState<UploadFile[]>([])

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
    maxUploadThreads,
    maxDownloadThreads,
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

  // 处理桶选择
  const handleSelectBucket = (name: string) => {
    selectBucket(name)
  }

  // 处理创建桶
  const handleCreateBucket = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        await api.createBucket(name)
        refreshBuckets()
        selectBucket(name)
        return true
      } catch (error) {
        console.error('Create bucket failed:', error)
        alert('创建存储桶失败: ' + (error as Error).message)
        return false
      }
    },
    [refreshBuckets, selectBucket]
  )

  // 处理删除桶
  const handleDeleteBucket = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        await api.deleteBucket(name)
        // 如果删除的是当前选中的桶，清除选择
        if (selectedBucket === name) {
          selectBucket(null)
        }
        refreshBuckets()
        return true
      } catch (error) {
        console.error('Delete bucket failed:', error)
        throw error
      }
    },
    [selectedBucket, selectBucket, refreshBuckets]
  )

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
    (key: string) => {
      if (!selectedBucket) return

      // 使用代理下载端点，避免跨域问题
      const url = api.getProxyDownloadUrl(selectedBucket, key)
      const a = document.createElement('a')
      a.href = url
      a.download = key.split('/').pop() || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
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

    // 使用并发限制下载
    await runWithConcurrency(keys, maxDownloadThreads, async (key) => {
      const url = api.getProxyDownloadUrl(selectedBucket, key)
      const filename = key.split('/').pop() || 'download'

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename
        a.click()
        URL.revokeObjectURL(blobUrl)
      } catch (error) {
        console.error(`下载失败: ${filename}`, error)
      }
    })
  }, [selectedBucket, selectedKeys, selectedCount, maxDownloadThreads])

  // 处理文件上传
  const handleUpload = useCallback((files: File[]) => {
    console.log('handleUpload called with files:', files.length, 'bucket:', selectedBucket)
    if (!selectedBucket) {
      console.error('No bucket selected')
      return
    }

    // 创建上传任务
    const newUploads: UploadFile[] = files.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }))

    console.log('Creating upload tasks:', newUploads)
    setUploads((prev) => [...prev, ...newUploads])

    // 使用并发限制上传
    const bucket = selectedBucket
    const prefix = currentPrefix

    runWithConcurrency(newUploads, maxUploadThreads, async (upload) => {
      // 更新状态为上传中
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'uploading', progress: 0 } : u
        )
      )

      // 计算上传路径
      const key = prefix + upload.file.name
      console.log('Upload key:', key, 'to bucket:', bucket)

      // 执行上传，带进度回调
      await fileService.uploadFile(bucket, key, upload.file, (progress) => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id ? { ...u, progress } : u
          )
        )
      })

      // 上传完成
      console.log('Upload completed:', upload.file.name)
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'completed', progress: 100 } : u
        )
      )
      // 刷新文件列表
      refreshFiles(bucket, prefix)
    }).catch((error) => {
      console.error('Upload failed:', error)
      // 标记失败的任务
      setUploads((prev) =>
        prev.map((u) =>
          newUploads.some((nu) => nu.id === u.id) && u.status === 'uploading'
            ? { ...u, status: 'error', error: error.message }
            : u
        )
      )
    })
  }, [selectedBucket, currentPrefix, refreshFiles, maxUploadThreads])

  // 移除上传项
  const handleUploadRemove = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }, [])

  // 处理创建文件夹
  const handleCreateFolder = useCallback(async () => {
    if (!selectedBucket || !folderName.trim()) return

    try {
      setCreating(true)
      // 构建完整路径：当前前缀 + 文件夹名 + /
      const folderPath = currentPrefix + folderName.trim() + '/'
      await fileService.createFolder(selectedBucket, folderPath)
      // 关闭对话框并重置
      setShowCreateFolder(false)
      setFolderName('')
      // 刷新文件列表
      refreshFiles(selectedBucket, currentPrefix)
    } catch (error) {
      console.error('Create folder failed:', error)
      alert('创建文件夹失败: ' + (error as Error).message)
    } finally {
      setCreating(false)
    }
  }, [selectedBucket, currentPrefix, folderName, refreshFiles])

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
        onCreateBucket={() => setShowCreateBucket(true)}
        onDeleteBucket={handleDeleteBucket}
      >
        <Header
          bucketName={selectedBucket}
          currentPath={currentPrefix}
          selectedCount={selectedCount}
          onRefresh={() => selectedBucket && refreshFiles(selectedBucket, currentPrefix)}
          onUpload={() => setShowUploader(true)}
          onCreateFolder={() => {
            setFolderName('')
            setShowCreateFolder(true)
          }}
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
                  uploads={uploads}
                  onDrop={handleUpload}
                  onRemove={handleUploadRemove}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 创建文件夹对话框 */}
        <AnimatePresence>
          {showCreateFolder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => !creating && setShowCreateFolder(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
              >
                <h2 className="text-lg font-medium mb-4">新建文件夹</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      文件夹名称
                    </label>
                    <input
                      type="text"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                      placeholder="输入文件夹名称"
                      disabled={creating}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => !creating && setShowCreateFolder(false)}
                      disabled={creating}
                      className="px-4 py-2 text-sm rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreateFolder}
                      disabled={creating || !folderName.trim()}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {creating ? '创建中...' : '创建'}
                    </button>
                  </div>
                </div>
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

      {/* 创建存储桶对话框 */}
      <CreateBucket
        open={showCreateBucket}
        onOpenChange={setShowCreateBucket}
        onCreate={handleCreateBucket}
      />
    </>
  )
}

export default App
