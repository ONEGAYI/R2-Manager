import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TransferTabs } from './TransferTabs'
import { TaskList } from './TaskList'
import { HistoryList } from './HistoryList'
import { useTransferStore } from '@/stores/transferStore'
import { Button } from '@/components/ui/button'
import type { TransferTab, TransferDirection } from '@/types/transfer'

interface TransferPageProps {
  onPauseUpload?: (taskId: string) => void
  onResumeUpload?: (taskId: string) => void
  onPauseDownload?: (taskId: string) => void
  onResumeDownload?: (taskId: string) => void
}

export function TransferPage({ onPauseUpload, onResumeUpload, onPauseDownload, onResumeDownload }: TransferPageProps) {
  const [activeTab, setActiveTab] = useState<TransferTab>('uploading')

  const {
    tasks,
    history,
    cancelTask,
    removeHistory,
    clearHistory,
  } = useTransferStore()

  // 计算各标签数量（包含暂停状态的任务）
  const uploadingCount = tasks.filter(t => t.direction === 'upload' && (t.status === 'pending' || t.status === 'running' || t.status === 'paused')).length
  const downloadingCount = tasks.filter(t => t.direction === 'download' && (t.status === 'pending' || t.status === 'running' || t.status === 'paused')).length
  const uploadCompletedCount = history.filter(h => h.direction === 'upload' && h.status === 'completed').length
  const downloadCompletedCount = history.filter(h => h.direction === 'download' && h.status === 'completed').length

  // 根据标签获取当前显示的内容
  const getCurrentContent = () => {
    switch (activeTab) {
      case 'uploading':
        return {
          tasks: tasks.filter(t => t.direction === 'upload' && (t.status === 'pending' || t.status === 'running' || t.status === 'paused' || t.status === 'error')),
          emptyMessage: '没有正在上传的文件',
        }
      case 'downloading':
        return {
          tasks: tasks.filter(t => t.direction === 'download' && (t.status === 'pending' || t.status === 'running' || t.status === 'paused' || t.status === 'error')),
          emptyMessage: '没有正在下载的文件',
        }
      case 'uploadCompleted':
        return {
          histories: history.filter(h => h.direction === 'upload'),
          emptyMessage: '没有上传完成的记录',
        }
      case 'downloadCompleted':
        return {
          histories: history.filter(h => h.direction === 'download'),
          emptyMessage: '没有下载完成的记录',
        }
    }
  }

  const handleClearHistory = () => {
    const direction: TransferDirection | undefined =
      activeTab === 'uploadCompleted' ? 'upload' :
      activeTab === 'downloadCompleted' ? 'download' : undefined

    if (direction) {
      clearHistory(direction)
    }
  }

  const content = getCurrentContent()
  const isHistoryTab = activeTab === 'uploadCompleted' || activeTab === 'downloadCompleted'

  // 根据任务方向调用相应的暂停/恢复回调
  const handlePause = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.direction === 'upload') {
      onPauseUpload?.(taskId)
    } else {
      onPauseDownload?.(taskId)
    }
  }

  const handleResume = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.direction === 'upload') {
      onResumeUpload?.(taskId)
    } else {
      onResumeDownload?.(taskId)
    }
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">传输中心</h1>
        {isHistoryTab && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={isHistoryTab && (activeTab === 'uploadCompleted' ? uploadCompletedCount : downloadCompletedCount) === 0}
            className="text-muted-foreground"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空记录
          </Button>
        )}
      </div>

      {/* 标签页 */}
      <div className="mb-6">
        <TransferTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          uploadingCount={uploadingCount}
          downloadingCount={downloadingCount}
          uploadCompletedCount={uploadCompletedCount}
          downloadCompletedCount={downloadCompletedCount}
        />
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {isHistoryTab ? (
          <HistoryList
            histories={(content as { histories: typeof history }).histories}
            onRemove={removeHistory}
            emptyMessage={(content as { emptyMessage: string }).emptyMessage}
          />
        ) : (
          <TaskList
            tasks={(content as { tasks: typeof tasks }).tasks}
            onCancel={cancelTask}
            onPause={handlePause}
            onResume={handleResume}
            emptyMessage={(content as { emptyMessage: string }).emptyMessage}
          />
        )}
      </div>
    </div>
  )
}
