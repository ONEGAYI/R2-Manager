/**
 * 浏览器端文件夹选择工具
 * 提供两种方式读取完整目录结构（包括空目录）：
 * 1. File System Access API (showDirectoryPicker) - 点击选择
 * 2. Drag & Drop API (webkitGetAsEntry) - 拖拽上传
 */

export interface BrowserFolderResult {
  folderName: string
  files: File[]
  emptyDirs: string[]
}

/**
 * 检测 File System Access API 是否可用
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window
}

/**
 * 方案 A: 使用 File System Access API 选择文件夹
 * 支持空目录检测，但仅在现代浏览器 (Chrome 86+, Edge 86+) 中可用
 */
export async function selectFolderWithFileSystemAccess(): Promise<BrowserFolderResult | null> {
  if (!isFileSystemAccessSupported()) {
    console.warn('[Browser Folder] File System Access API not supported')
    return null
  }

  try {
    // @ts-expect-error showDirectoryPicker is part of File System Access API
    const dirHandle = await window.showDirectoryPicker()
    return await readDirectoryHandle(dirHandle)
  } catch (err) {
    // 用户取消选择时会抛出 AbortError
    if (err instanceof Error && err.name === 'AbortError') {
      return null
    }
    console.error('[Browser Folder] Failed to select folder:', err)
    return null
  }
}

/**
 * 递归读取 FileSystemDirectoryHandle
 */
async function readDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  pathPrefix: string = '',
  rootFolderName: string = ''
): Promise<BrowserFolderResult> {
  const files: File[] = []
  const emptyDirs: string[] = []
  const folderName = rootFolderName || dirHandle.name

  // 收集所有子项
  const entries: { handle: FileSystemHandle; relativePath: string }[] = []

  // @ts-expect-error values() is part of File System Access API
  for await (const handle of dirHandle.values()) {
    const relativePath = pathPrefix ? `${pathPrefix}/${handle.name}` : handle.name
    entries.push({ handle, relativePath })
  }

  // 如果目录为空，记录为空目录（非根目录）
  if (entries.length === 0 && pathPrefix) {
    emptyDirs.push(`${folderName}/${pathPrefix}/`)
  }

  // 处理所有子项
  for (const { handle, relativePath } of entries) {
    if (handle.kind === 'directory') {
      const subResult = await readDirectoryHandle(
        handle as FileSystemDirectoryHandle,
        relativePath,
        folderName
      )
      files.push(...subResult.files)
      emptyDirs.push(...subResult.emptyDirs)
    } else if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      // 创建带有 webkitRelativePath 的新 File 对象
      const fileWithPath = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      })
      Object.defineProperty(fileWithPath, 'webkitRelativePath', {
        value: `${folderName}/${relativePath}`,
        writable: false,
      })
      files.push(fileWithPath)
    }
  }

  return { folderName, files, emptyDirs }
}

/**
 * 方案 B: 使用 Drag & Drop API (webkitGetAsEntry) 读取拖拽的文件夹
 * 支持空目录检测，兼容性更好
 */
export async function readDroppedItems(dataTransfer: DataTransfer): Promise<BrowserFolderResult | null> {
  const items = dataTransfer.items
  if (!items) {
    return null
  }

  const files: File[] = []
  const emptyDirs: string[] = []

  // 收集所有拖拽的项目
  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.()
      if (entry) {
        entries.push(entry)
      }
    }
  }

  if (entries.length === 0) {
    return null
  }

  // 如果只拖入了文件（没有文件夹），使用原有逻辑
  if (entries.every((e) => e.isFile)) {
    return null // 返回 null 让调用者使用原有的 files 处理逻辑
  }

  // 获取根文件夹名称（取第一个文件夹条目的名称）
  let rootFolderName = 'folder'
  const firstDirEntry = entries.find((e) => e.isDirectory)
  if (firstDirEntry) {
    rootFolderName = firstDirEntry.name
  }

  // 递归处理所有条目
  // 注意：当拖拽一个文件夹时，entry 是该文件夹本身，我们需要处理其内容
  // currentPath 传空字符串，processEntry 会从 entry.name 开始构建路径
  for (const entry of entries) {
    await processEntry(entry, rootFolderName, '', files, emptyDirs, true)
  }

  return { folderName: rootFolderName, files, emptyDirs }
}

/**
 * 递归处理 FileSystemEntry
 * @param entry 当前条目
 * @param rootFolderName 根文件夹名称（用于 webkitRelativePath 前缀）
 * @param currentPath 当前相对路径（不包含根文件夹名称）
 * @param files 文件收集数组
 * @param emptyDirs 空目录收集数组
 * @param isRootEntry 是否是根条目（拖拽的文件夹本身）
 */
async function processEntry(
  entry: FileSystemEntry,
  rootFolderName: string,
  currentPath: string,
  files: File[],
  emptyDirs: string[],
  isRootEntry: boolean = false
): Promise<void> {
  if (entry.isFile) {
    // 读取文件
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve) => {
      fileEntry.file(resolve)
    })
    // 创建带有 webkitRelativePath 的新 File 对象
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
    const fileWithPath = new File([file], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    })
    Object.defineProperty(fileWithPath, 'webkitRelativePath', {
      value: `${rootFolderName}/${relativePath}`,
      writable: false,
    })
    files.push(fileWithPath)
  } else if (entry.isDirectory) {
    // 读取目录
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const subEntries: FileSystemEntry[] = []

    // 读取目录内容（可能需要多次调用 readEntries）
    let batch: FileSystemEntry[] = []
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve)
      })
      subEntries.push(...batch)
    } while (batch.length > 0)

    // 根条目（拖拽的文件夹本身）不添加到路径中，因为 rootFolderName 已经是它的名称
    // 只有子目录才需要添加到 currentPath
    const newCurrentPath = isRootEntry ? currentPath : (currentPath ? `${currentPath}/${entry.name}` : entry.name)

    // 如果目录为空，记录为空目录
    if (subEntries.length === 0) {
      // 根目录为空时不记录（这种情况没有意义）
      if (!isRootEntry) {
        emptyDirs.push(`${rootFolderName}/${newCurrentPath}/`)
      }
    } else {
      // 递归处理子条目
      for (const subEntry of subEntries) {
        await processEntry(subEntry, rootFolderName, newCurrentPath, files, emptyDirs, false)
      }
    }
  }
}
