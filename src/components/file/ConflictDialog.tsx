import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AlertTriangle, CheckCircle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileIcon } from '@/components/common/FileIcon'
import { cn } from '@/lib/cn'

export interface ConflictItem {
  sourceKey: string
  targetKey: string
  isFolder: boolean
  sourceInfo?: {
    size: number
    lastModified: string
  }
  targetInfo?: {
    size: number
    lastModified: string
  }
}

/**
 * 带层级信息的冲突项（前端计算）
 */
export interface ConflictItemWithHierarchy extends ConflictItem {
  id: number           // 唯一标识
  depth: number        // 层级深度 (0 = 顶层)
  parentId: number | null  // 父节点 ID
  childIds: number[]   // 子节点 ID 列表
}

export type ConflictResolution = 'overwrite' | 'skip' | 'rename'

/**
 * 选择框坐标
 */
interface SelectionBox {
  startX: number
  startY: number
  endX: number
  endY: number
}

/**
 * 构建层级数据
 * 根据文件路径分析父子关系
 */
function buildHierarchy(items: ConflictItem[]): ConflictItemWithHierarchy[] {
  if (items.length === 0) return []

  // 先创建带 id 的基础数据
  const result: ConflictItemWithHierarchy[] = items.map((item, index) => ({
    ...item,
    id: index,
    depth: 0,
    parentId: null as number | null,
    childIds: [] as number[],
  }))

  // 构建路径到 id 的映射（用于快速查找父节点）
  const pathToId = new Map<string, number>()
  result.forEach(item => {
    // 对于文件夹，路径本身作为 key
    // 对于文件，取其父目录路径
    const path = item.targetKey.endsWith('/')
      ? item.targetKey
      : item.targetKey.substring(0, item.targetKey.lastIndexOf('/') + 1)
    pathToId.set(path, item.id)
  })

  // 分析每个节点的层级关系
  result.forEach(item => {
    const path = item.targetKey
    const segments = path.split('/').filter(Boolean)

    // 计算深度（路径段数 - 1，因为最后一段是文件名/文件夹名）
    item.depth = Math.max(0, segments.length - 1)

    // 查找父节点
    if (segments.length > 1) {
      // 构建父路径
      const parentPath = segments.slice(0, -1).join('/') + '/'
      const parentId = pathToId.get(parentPath)
      if (parentId !== undefined) {
        item.parentId = parentId
        result[parentId].childIds.push(item.id)
      }
    }
  })

  return result
}

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictItem[]
  onConfirm: (resolutions: Array<{ item: ConflictItem; resolution: ConflictResolution }>) => void
  mode: 'copy' | 'move'
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  mode: _mode,
}: ConflictDialogProps) {
  // mode 参数保留供将来扩展使用（如根据模式显示不同提示）
  void _mode
  // 层级化的冲突项
  const [hierarchicalItems, setHierarchicalItems] = useState<ConflictItemWithHierarchy[]>([])
  // 选中项 ID 集合
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // 上一个选中的索引（用于 Shift 范围选择）
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null)
  // 每个冲突项的策略
  const [resolutions, setResolutions] = useState<Map<number, ConflictResolution>>(new Map())

  // 拖选框选状态
  const [isDragging, setIsDragging] = useState(false)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const itemRefsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  // 记录拖选开始时点击的项目（用于区分点击和拖选）
  const dragStartItemIdRef = useRef<number | null>(null)

  // 当冲突列表变化时，构建层级数据并初始化策略
  useEffect(() => {
    if (conflicts.length > 0) {
      const items = buildHierarchy(conflicts)
      setHierarchicalItems(items)

      // 初始化所有项的策略为 'skip'
      const initialResolutions = new Map<number, ConflictResolution>()
      items.forEach(item => initialResolutions.set(item.id, 'skip'))
      setResolutions(initialResolutions)

      // 清空选中状态
      setSelectedIds(new Set())
      setLastSelectedId(null)
    }
  }, [conflicts])

  // 获取节点及其所有子孙节点
  const getItemWithAllDescendants = useCallback((itemId: number): number[] => {
    const ids: number[] = []
    const collect = (id: number) => {
      ids.push(id)
      const item = hierarchicalItems.find(i => i.id === id)
      if (item) {
        item.childIds.forEach(collect)
      }
    }
    collect(itemId)
    return ids
  }, [hierarchicalItems])

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === hierarchicalItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(hierarchicalItems.map(i => i.id)))
    }
  }, [selectedIds.size, hierarchicalItems])

  // 点击选中/取消
  const handleItemClick = useCallback((itemId: number, event: React.MouseEvent) => {
    const item = hierarchicalItems.find(i => i.id === itemId)
    if (!item) return

    if (event.shiftKey && lastSelectedId !== null) {
      // Shift 范围选择 - 切换选中状态
      const lastIndex = hierarchicalItems.findIndex(i => i.id === lastSelectedId)
      const currentIndex = hierarchicalItems.findIndex(i => i.id === itemId)
      const [start, end] = [Math.min(lastIndex, currentIndex), Math.max(lastIndex, currentIndex)]

      // 收集范围内所有项目（包括子孙）
      const idsInRange = new Set<number>()
      for (let i = start; i <= end; i++) {
        const id = hierarchicalItems[i].id
        const idsToInclude = getItemWithAllDescendants(id)
        idsToInclude.forEach(id => idsInRange.add(id))
      }

      // 判断范围内大部分是否已选中，决定是选中还是取消
      let selectedCount = 0
      idsInRange.forEach(id => {
        if (selectedIds.has(id)) selectedCount++
      })
      const shouldSelect = selectedCount <= idsInRange.size / 2

      const newSelected = new Set(selectedIds)
      idsInRange.forEach(id => {
        if (shouldSelect) {
          newSelected.add(id)
        } else {
          newSelected.delete(id)
        }
      })
      setSelectedIds(newSelected)
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl 增选/取消
      const newSelected = new Set(selectedIds)
      const idsToToggle = getItemWithAllDescendants(itemId)

      if (newSelected.has(itemId)) {
        idsToToggle.forEach(id => newSelected.delete(id))
      } else {
        idsToToggle.forEach(id => newSelected.add(id))
      }
      setSelectedIds(newSelected)
      setLastSelectedId(itemId)
    } else {
      // 普通点击：切换选中状态
      const idsToToggle = getItemWithAllDescendants(itemId)
      const newSelected = new Set(selectedIds)

      if (newSelected.has(itemId)) {
        idsToToggle.forEach(id => newSelected.delete(id))
      } else {
        idsToToggle.forEach(id => newSelected.add(id))
      }
      setSelectedIds(newSelected)
      setLastSelectedId(itemId)
    }
  }, [hierarchicalItems, selectedIds, lastSelectedId, getItemWithAllDescendants])

  // 开始拖选
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 忽略右键
    if (e.button !== 0) return

    // 检查是否点击了项目行
    const itemRow = (e.target as HTMLElement).closest('[data-item-row]')
    if (itemRow) {
      const itemId = parseInt(itemRow.getAttribute('data-item-id') || '', 10)
      if (!isNaN(itemId)) {
        dragStartItemIdRef.current = itemId
      }
    } else {
      dragStartItemIdRef.current = null
    }

    const container = listContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop

    setIsDragging(true)
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y })
  }, [])

  // 更新拖选范围
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectionBox) return

    const container = listContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop

    setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null)
  }, [isDragging, selectionBox])

  // 结束拖选，计算选中的项目
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectionBox) {
      setIsDragging(false)
      setSelectionBox(null)
      dragStartItemIdRef.current = null
      return
    }

    const { startX, startY, endX, endY } = selectionBox
    const minX = Math.min(startX, endX)
    const maxX = Math.max(startX, endX)
    const minY = Math.min(startY, endY)
    const maxY = Math.max(startY, endY)

    const distanceX = maxX - minX
    const distanceY = maxY - minY

    // 选择框太小，视为点击操作
    if (distanceX < 5 && distanceY < 5) {
      const startItemId = dragStartItemIdRef.current
      if (startItemId !== null) {
        // 执行点击逻辑
        const syntheticEvent = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        } as React.MouseEvent
        handleItemClick(startItemId, syntheticEvent)
      }
      setIsDragging(false)
      setSelectionBox(null)
      dragStartItemIdRef.current = null
      return
    }

    // 执行框选逻辑
    const container = listContainerRef.current
    if (!container) {
      setIsDragging(false)
      setSelectionBox(null)
      dragStartItemIdRef.current = null
      return
    }

    const containerRect = container.getBoundingClientRect()

    // 收集框选范围内的所有项目（包括子孙）
    const idsInBox = new Set<number>()
    itemRefsRef.current.forEach((el, id) => {
      const itemRect = el.getBoundingClientRect()
      const itemLeft = itemRect.left - containerRect.left + container.scrollLeft
      const itemTop = itemRect.top - containerRect.top + container.scrollTop
      const itemRight = itemLeft + itemRect.width
      const itemBottom = itemTop + itemRect.height

      // 检测矩形相交
      const intersects = !(
        itemRight < minX ||
        itemLeft > maxX ||
        itemBottom < minY ||
        itemTop > maxY
      )

      if (intersects) {
        // 如果是文件夹，同时包含所有子孙
        const idsToInclude = getItemWithAllDescendants(id)
        idsToInclude.forEach(id => idsInBox.add(id))
      }
    })

    // 判断范围内大部分是否已选中，决定是选中还是取消
    let selectedCount = 0
    idsInBox.forEach(id => {
      if (selectedIds.has(id)) selectedCount++
    })
    const shouldSelect = selectedCount <= idsInBox.size / 2

    const newSelected = new Set(selectedIds)
    idsInBox.forEach(id => {
      if (shouldSelect) {
        newSelected.add(id)
      } else {
        newSelected.delete(id)
      }
    })

    setSelectedIds(newSelected)
    setIsDragging(false)
    setSelectionBox(null)
    dragStartItemIdRef.current = null
  }, [isDragging, selectionBox, selectedIds, getItemWithAllDescendants, handleItemClick])

  // 对选中项应用策略
  const applyResolutionToSelected = useCallback((resolution: ConflictResolution) => {
    if (selectedIds.size === 0) return

    setResolutions(prev => {
      const newMap = new Map(prev)
      selectedIds.forEach(id => newMap.set(id, resolution))
      return newMap
    })
  }, [selectedIds])

  // 统计各策略数量
  const stats = useMemo(() => {
    let skip = 0, rename = 0, overwrite = 0
    resolutions.forEach(res => {
      if (res === 'skip') skip++
      else if (res === 'rename') rename++
      else if (res === 'overwrite') overwrite++
    })
    return { skip, rename, overwrite }
  }, [resolutions])

  // 处理确认
  const handleConfirm = () => {
    const results = hierarchicalItems.map(item => ({
      item: {
        sourceKey: item.sourceKey,
        targetKey: item.targetKey,
        isFolder: item.isFolder,
        sourceInfo: item.sourceInfo,
        targetInfo: item.targetInfo,
      },
      resolution: resolutions.get(item.id) || 'skip',
    }))
    onConfirm(results)
    onOpenChange(false)
  }

  // 处理取消
  const handleCancel = () => {
    onOpenChange(false)
  }

  // 获取策略标签
  const getResolutionLabel = (resolution: ConflictResolution): string => {
    switch (resolution) {
      case 'skip': return '跳过'
      case 'rename': return '保留两者'
      case 'overwrite': return '覆盖'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            发现 {conflicts.length} 个冲突
          </DialogTitle>
          <DialogDescription>
            点击或拖选文件，然后设置策略
          </DialogDescription>
        </DialogHeader>

        {/* 操作栏 */}
        <div className="flex items-center justify-between gap-4 py-2 px-3 bg-muted/30 rounded-md">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className={cn(
                "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                selectedIds.size === hierarchicalItems.length
                  ? "bg-primary border-primary text-primary-foreground"
                  : selectedIds.size > 0
                    ? "bg-primary/50 border-primary"
                    : "border-input hover:border-primary"
              )}
            >
              {selectedIds.size === hierarchicalItems.length && (
                <Check className="h-3 w-3" />
              )}
              {selectedIds.size > 0 && selectedIds.size < hierarchicalItems.length && (
                <div className="w-2 h-0.5 bg-primary-foreground rounded" />
              )}
            </button>
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0 ? `已选中 ${selectedIds.size} 项` : '全选'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => applyResolutionToSelected('skip')}
              className="h-7"
            >
              跳过
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => applyResolutionToSelected('rename')}
              className="h-7"
            >
              保留两者
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => applyResolutionToSelected('overwrite')}
              className="h-7 text-destructive hover:bg-destructive/10"
            >
              覆盖
            </Button>
          </div>
        </div>

        {/* 冲突列表 */}
        <TooltipProvider>
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto border rounded-md relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ userSelect: 'none' }}
          >
            <div className="divide-y">
              {hierarchicalItems.map((item) => {
                const resolution = resolutions.get(item.id) || 'skip'
                const isSelected = selectedIds.has(item.id)
                const isAnchor = lastSelectedId === item.id  // Shift 范围选择的锚点
                const filename = item.targetKey.split('/').pop() || item.targetKey
                const isLastChild = item.parentId !== null &&
                  hierarchicalItems.find(i => i.id === item.parentId)?.childIds.slice(-1)[0] === item.id

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefsRef.current.set(item.id, el)
                    }}
                    data-item-row
                    data-item-id={item.id}
                    className={cn(
                      "relative flex items-center gap-2 py-2 px-3 cursor-pointer transition-colors select-none",
                      isSelected && "bg-primary/10",
                      isAnchor && !isSelected && "ring-2 ring-primary/50 ring-inset",  // 锚点高亮
                      !isSelected && !isAnchor && resolution === 'overwrite' && "hover:bg-destructive/5",
                      !isSelected && !isAnchor && resolution === 'skip' && "hover:bg-muted/50",
                      !isSelected && !isAnchor && resolution === 'rename' && "hover:bg-primary/5"
                    )}
                    style={{ paddingLeft: `${12 + item.depth * 20}px` }}
                  >
                    {/* 层级连接线 */}
                    {item.depth > 0 && (
                      <>
                        {/* 垂直线 */}
                        <div
                          className="absolute border-l border-border"
                          style={{
                            left: `${12 + (item.depth - 1) * 20 + 8}px`,
                            top: isLastChild ? 0 : 0,
                            height: isLastChild ? '50%' : '100%',
                          }}
                        />
                        {/* 水平连接线 */}
                        <div
                          className="absolute border-t border-border"
                          style={{
                            left: `${12 + (item.depth - 1) * 20 + 8}px`,
                            top: '50%',
                            width: '12px',
                          }}
                        />
                      </>
                    )}

                    {/* 选中复选框 */}
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>

                    {/* 文件图标 */}
                    <FileIcon
                      filename={filename}
                      isFolder={item.isFolder}
                      size="sm"
                    />

                    {/* 文件名（带 Tooltip） */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm truncate flex-1 cursor-default">
                          {filename}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <div className="font-medium text-foreground">{item.targetKey}</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground">源文件</div>
                              {item.sourceInfo ? (
                                <>
                                  <div>大小: {formatSize(item.sourceInfo.size)}</div>
                                  <div className="text-[10px] opacity-70">
                                    {formatDate(item.sourceInfo.lastModified)}
                                  </div>
                                </>
                              ) : (
                                <div>-</div>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground">目标文件</div>
                              {item.targetInfo ? (
                                <>
                                  <div>大小: {formatSize(item.targetInfo.size)}</div>
                                  <div className="text-[10px] opacity-70">
                                    {formatDate(item.targetInfo.lastModified)}
                                  </div>
                                </>
                              ) : (
                                <div>-</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* 文件夹标签 */}
                    {item.isFolder && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
                        文件夹
                      </span>
                    )}

                    {/* 策略标签 */}
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded shrink-0",
                        resolution === 'skip' && "bg-muted text-muted-foreground",
                        resolution === 'rename' && "bg-primary/20 text-primary",
                        resolution === 'overwrite' && "bg-destructive/20 text-destructive"
                      )}
                    >
                      {getResolutionLabel(resolution)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 拖选框 */}
            {isDragging && selectionBox && (
              <div
                className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
                style={{
                  left: Math.min(selectionBox.startX, selectionBox.endX),
                  top: Math.min(selectionBox.startY, selectionBox.endY),
                  width: Math.abs(selectionBox.endX - selectionBox.startX),
                  height: Math.abs(selectionBox.endY - selectionBox.startY),
                }}
              />
            )}
          </div>
        </TooltipProvider>

        {/* 统计信息 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-t">
          <div className="flex gap-4">
            {stats.skip > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {stats.skip} 项跳过
              </span>
            )}
            {stats.rename > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle className="h-3 w-3" />
                {stats.rename} 项保留
              </span>
            )}
            {stats.overwrite > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <CheckCircle className="h-3 w-3" />
                {stats.overwrite} 项覆盖
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            取消操作
          </Button>
          <Button
            onClick={handleConfirm}
          >
            确认执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
