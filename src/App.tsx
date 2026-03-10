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
import { createR2Client, setDefaultClient } from '@/services/r2Client'
import '@/styles/globals.css'

function App() {
  const [showUploader, setShowUploader] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [forceShowConfig, setForceShowConfig] = useState(false)

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

  // 初始化 R2 客户端
  useEffect(() => {
    if (hasValidCredentials && accountId && accessKeyId && secretAccessKey) {
      const client = createR2Client({
        accountId,
        accessKeyId,
        secretAccessKey,
      })
      setDefaultClient(client)
      setConnected({ isConnected: true })
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
          onRefresh={() => selectedBucket && refreshFiles(selectedBucket, currentPrefix)}
          onUpload={() => setShowUploader(true)}
          onCreateFolder={() => console.log('Create folder')}
        />

        <AnimatePresence mode="wait">
          {isLoading ? (
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
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpenFile}
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
