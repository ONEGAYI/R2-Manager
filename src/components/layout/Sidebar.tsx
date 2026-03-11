import { useState } from 'react'
import { Database, Settings, Plus, MoreVertical, Trash2, Sun, Moon, Monitor, Radio } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useThemeStore } from '@/stores/themeStore'
import { useTransferStore } from '@/stores/transferStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteBucketDialog } from '@/components/bucket/DeleteBucketDialog'

// 传输中心特殊标识符
export const TRANSFER_PAGE_ID = '__transfer__'

interface SidebarProps {
  buckets: string[]
  selectedBucket: string | null
  onSelectBucket: (name: string) => void
  onOpenSettings?: () => void
  onCreateBucket?: () => void
  onDeleteBucket?: (name: string) => Promise<boolean>
}

export function Sidebar({
  buckets,
  selectedBucket,
  onSelectBucket,
  onOpenSettings,
  onCreateBucket,
  onDeleteBucket,
}: SidebarProps) {
  const { theme, setTheme } = useThemeStore()
  const { getActiveCount } = useTransferStore()
  const [deleteBucketName, setDeleteBucketName] = useState<string | null>(null)

  const activeTransferCount = getActiveCount()

  const handleDeleteBucket = async (name: string): Promise<boolean> => {
    if (!onDeleteBucket) return false
    return onDeleteBucket(name)
  }

  return (
    <>
      <aside className="w-64 border-r bg-card flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">R2 Manager</span>
          </div>
        </div>

        {/* 桶列表 */}
        <div className="flex-1 overflow-auto p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              存储桶
            </p>
            {onCreateBucket && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onCreateBucket}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="创建存储桶"
              >
                <Plus className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </div>
          <nav className="space-y-1">
            {buckets.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">
                暂无存储桶
              </p>
            ) : (
              buckets.map((bucket) => (
                <div
                  key={bucket}
                  className={cn(
                    'group flex items-center rounded-md transition-colors',
                    selectedBucket === bucket
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  <motion.button
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectBucket(bucket)}
                    className="flex-1 text-left px-3 py-2 text-sm truncate"
                  >
                    {bucket}
                  </motion.button>
                  {onDeleteBucket && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            'p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                            selectedBucket === bucket
                              ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                              : 'hover:bg-accent text-muted-foreground'
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteBucketName(bucket)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除存储桶
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))
            )}
          </nav>

          {/* 传输入口 */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectBucket(TRANSFER_PAGE_ID)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                selectedBucket === TRANSFER_PAGE_ID
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              <Radio className="h-4 w-4" />
              <span className="flex-1 text-left">传输</span>
              {activeTransferCount > 0 && (
                <span
                  className={cn(
                    'min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-medium px-1.5',
                    selectedBucket === TRANSFER_PAGE_ID
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {activeTransferCount}
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="p-2 border-t space-y-1">
          {/* 主题切换器 - 三段式 */}
          <div className="px-1">
            <div className="relative h-8 rounded-sm overflow-hidden border border-border flex">
              {/* 浅色模式 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme('light')}
                className={cn(
                  'flex-1 flex items-center justify-center transition-colors',
                  theme === 'light'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
                title="浅色模式"
              >
                <Sun className="h-4 w-4" />
              </motion.button>

              {/* 跟随系统 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme('system')}
                className={cn(
                  'flex-1 flex items-center justify-center transition-colors border-x border-border',
                  theme === 'system'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
                title="跟随系统"
              >
                <Monitor className="h-4 w-4" />
              </motion.button>

              {/* 深色模式 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex-1 flex items-center justify-center transition-colors',
                  theme === 'dark'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
                title="深色模式"
              >
                <Moon className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              设置
            </button>
          )}
        </div>
      </aside>

      {/* 删除存储桶确认对话框 */}
      <DeleteBucketDialog
        open={deleteBucketName !== null}
        onOpenChange={(open) => !open && setDeleteBucketName(null)}
        bucketName={deleteBucketName || ''}
        onDelete={handleDeleteBucket}
      />
    </>
  )
}
