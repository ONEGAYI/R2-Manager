import { Upload, Download, CheckCircle, Copy } from 'lucide-react'
import { motion } from 'framer-motion'
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

  const activeIndex = tabs.findIndex((t) => t.id === activeTab)
  const tabCount = tabs.length
  const tabWidthPercent = 100 / tabCount

  return (
    <div className="grid grid-cols-6 p-1 bg-muted/30 rounded-lg relative">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-colors z-10',
            activeTab === tab.id
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
          {tab.count > 0 && (
            <span
              className={cn(
                'min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-medium px-1',
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
      {/* 滑动指示框 */}
      <motion.div
        layoutId="transferTabIndicator"
        className="absolute top-1 bottom-1 bg-background rounded-md shadow-sm"
        style={{
          left: `calc(0.25rem + ${activeIndex * tabWidthPercent}%)`,
          width: `calc(${tabWidthPercent}% - 0.25rem)`,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
      />
    </div>
  )
}
