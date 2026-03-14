import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle, FileEdit } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ResultDetails } from '@/types/transfer'

interface OperationResultDetailsProps {
  resultDetails?: ResultDetails
  className?: string
}

/**
 * 格式化文件路径，只显示最后几级
 */
function formatPath(path: string, maxLevels: number = 3): string {
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= maxLevels) return path
  return '.../' + parts.slice(-maxLevels).join('/')
}

export function OperationResultDetails({ resultDetails, className }: OperationResultDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!resultDetails) return null

  const { totalSuccess, totalSkipped, totalErrors, totalRenamed = 0, items } = resultDetails

  // 按状态分组
  const successItems = items.filter(i => i.status === 'success')
  const skippedItems = items.filter(i => i.status === 'skipped')
  const renamedItems = items.filter(i => i.status === 'renamed')
  const errorItems = items.filter(i => i.status === 'error')

  const hasDetails = items.length > 0

  return (
    <div className={cn('space-y-2', className)}>
      {/* 统计标签 */}
      <div className="flex flex-wrap gap-2 text-xs">
        {totalSuccess > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            {totalSuccess} 成功
          </span>
        )}
        {totalRenamed > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <FileEdit className="h-3 w-3" />
            {totalRenamed} 重命名
          </span>
        )}
        {totalSkipped > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {totalSkipped} 跳过
          </span>
        )}
        {totalErrors > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            {totalErrors} 失败
          </span>
        )}
      </div>

      {/* 详情展开 */}
      {hasDetails && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">查看详情</span>
          </button>

          {isExpanded && (
            <div className="border-t divide-y max-h-[300px] overflow-y-auto">
              {/* 成功项 */}
              {successItems.length > 0 && (
                <div className="p-2 space-y-1">
                  <div className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    成功 ({successItems.length})
                  </div>
                  <div className="space-y-0.5 pl-4">
                    {successItems.slice(0, 10).map((item, index) => (
                      <div key={index} className="text-xs text-muted-foreground truncate" title={item.sourceKey}>
                        {formatPath(item.sourceKey)}
                      </div>
                    ))}
                    {successItems.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ...还有 {successItems.length - 10} 项
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 重命名项 */}
              {renamedItems.length > 0 && (
                <div className="p-2 space-y-1">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <FileEdit className="h-3 w-3" />
                    重命名 ({renamedItems.length})
                  </div>
                  <div className="space-y-0.5 pl-4">
                    {renamedItems.slice(0, 10).map((item, index) => (
                      <div key={index} className="text-xs">
                        <span className="text-muted-foreground truncate" title={item.sourceKey}>
                          {formatPath(item.sourceKey)}
                        </span>
                        <span className="text-blue-500 mx-1">→</span>
                        <span className="text-blue-600 dark:text-blue-400 truncate" title={item.renamedTo}>
                          {item.renamedTo ? formatPath(item.renamedTo) : '-'}
                        </span>
                      </div>
                    ))}
                    {renamedItems.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ...还有 {renamedItems.length - 10} 项
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 跳过项 */}
              {skippedItems.length > 0 && (
                <div className="p-2 space-y-1">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    跳过 ({skippedItems.length})
                  </div>
                  <div className="space-y-0.5 pl-4">
                    {skippedItems.slice(0, 10).map((item, index) => (
                      <div key={index} className="text-xs">
                        <span className="text-muted-foreground truncate" title={item.sourceKey}>
                          {formatPath(item.sourceKey)}
                        </span>
                        {item.skipReason && (
                          <span className="text-amber-500 ml-1">
                            - {item.skipReason}
                          </span>
                        )}
                      </div>
                    ))}
                    {skippedItems.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ...还有 {skippedItems.length - 10} 项
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 失败项 */}
              {errorItems.length > 0 && (
                <div className="p-2 space-y-1">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    失败 ({errorItems.length})
                  </div>
                  <div className="space-y-0.5 pl-4">
                    {errorItems.slice(0, 10).map((item, index) => (
                      <div key={index} className="text-xs">
                        <span className="text-muted-foreground truncate" title={item.sourceKey}>
                          {formatPath(item.sourceKey)}
                        </span>
                        {item.error && (
                          <span className="text-red-500 ml-1 truncate" title={item.error}>
                            - {item.error}
                          </span>
                        )}
                      </div>
                    ))}
                    {errorItems.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ...还有 {errorItems.length - 10} 项
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
