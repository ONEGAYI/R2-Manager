import { Upload, Download, CheckCircle, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TransferTab } from '@/types/transfer'

interface TransferTabsProps {
  activeTab: TransferTab
  onTabChange: (tab: TransferTab) => void
  uploadingCount: number
  downloadingCount: number
  batchOperationsCount: number
  uploadCompletedCount: number
  downloadCompletedCount: number
  batchCompletedCount: number
}

interface TabConfig {
  id: TransferTab
  label: string
  icon: React.ReactNode
  count: number
}

export function TransferTabs({
  activeTab,
  onTabChange,
  uploadingCount,
  downloadingCount,
  batchOperationsCount,
  uploadCompletedCount,
  downloadCompletedCount,
  batchCompletedCount,
}: TransferTabsProps) {
  const tabs: TabConfig[] = [
    {
      id: 'uploading',
      label: '上传中',
      icon: <Upload className="w-4 h-4" />,
      count: uploadingCount,
    },
    {
      id: 'downloading',
      label: '下载中',
      icon: <Download className="w-4 h-4" />,
      count: downloadingCount,
    },
    {
      id: 'batchOperations',
      label: '批量操作',
      icon: <Copy className="w-4 h-4" />,
      count: batchOperationsCount,
    },
    {
      id: 'uploadCompleted',
      label: '上传完成',
      icon: <CheckCircle className="w-4 h-4" />,
      count: uploadCompletedCount,
    },
    {
      id: 'downloadCompleted',
      label: '下载完成',
      icon: <CheckCircle className="w-4 h-4" />,
      count: downloadCompletedCount,
    },
    {
      id: 'batchCompleted',
      label: '批量完成',
      icon: <CheckCircle className="w-4 h-4" />,
      count: batchCompletedCount,
    },
  ]

  return (
    <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count > 0 && (
            <span
              className={cn(
                'min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-medium px-1.5',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
