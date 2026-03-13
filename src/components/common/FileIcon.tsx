import { ComponentType, SVGProps, useMemo } from 'react'
import { getFileIcon, getFolderIcon } from '@/lib/fileIcons'
import { cn } from '@/lib/cn'

// SVG 组件类型
type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>

// 使用 import.meta.glob 预加载所有图标
// svgr 配置会自动将 icons 目录下的 SVG 转换为 React 组件
const fileIconsModule = import.meta.glob<{ default: SvgComponent }>(
  '/src/assets/icons/files/*.svg',
  { eager: true }
)

const folderIconsModule = import.meta.glob<{ default: SvgComponent }>(
  '/src/assets/icons/folders/*.svg',
  { eager: true }
)

// 图标尺寸映射
const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
}

// 默认文件图标
function DefaultFileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

// 默认文件夹图标
function DefaultFolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

interface FileIconProps {
  /** 文件名或文件夹名 */
  filename: string
  /** 是否为文件夹 */
  isFolder?: boolean
  /** 图标尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 文件夹是否展开（仅对文件夹有效） */
  opened?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 文件图标组件
 * 根据文件名自动识别并显示对应的图标
 */
export function FileIcon({
  filename,
  isFolder = false,
  size = 'md',
  opened = false,
  className,
}: FileIconProps) {
  // 获取图标名称
  const iconName = useMemo(() => {
    return isFolder ? getFolderIcon(filename, opened) : getFileIcon(filename)
  }, [filename, isFolder, opened])

  // 获取图标组件
  const Icon = useMemo(() => {
    const modules = isFolder ? folderIconsModule : fileIconsModule
    const key = `/src/assets/icons/${isFolder ? 'folders' : 'files'}/${iconName}.svg`
    const module = modules[key]

    if (module && 'default' in module) {
      return module.default
    }
    return null
  }, [iconName, isFolder])

  // 如果找不到图标，使用默认图标
  if (!Icon) {
    const DefaultIcon = isFolder ? DefaultFolderIcon : DefaultFileIcon
    return (
      <DefaultIcon
        className={cn(
          sizeClasses[size],
          'text-muted-foreground',
          className
        )}
      />
    )
  }

  return (
    <Icon
      className={cn(
        sizeClasses[size],
        'file-icon',
        className
      )}
    />
  )
}

export default FileIcon
