import { Database, Settings, Moon, Sun, Plus, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useConfig } from '@/hooks/useConfig'

interface SidebarProps {
  buckets: string[]
  selectedBucket: string | null
  onSelectBucket: (name: string) => void
  onOpenSettings?: () => void
  onCreateBucket?: () => void
}

export function Sidebar({
  buckets,
  selectedBucket,
  onSelectBucket,
  onOpenSettings,
  onCreateBucket,
}: SidebarProps) {
  const { theme, setTheme } = useConfig()

  return (
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
              <motion.button
                key={bucket}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectBucket(bucket)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate',
                  selectedBucket === bucket
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                {bucket}
              </motion.button>
            ))
          )}
        </nav>
      </div>

      {/* 底部操作 */}
      <div className="p-2 border-t space-y-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === 'dark' ? '浅色模式' : '深色模式'}
        </button>
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
  )
}
