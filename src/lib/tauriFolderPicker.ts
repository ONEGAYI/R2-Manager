/**
 * Tauri 文件夹选择和读取工具
 * 用于在桌面端选择文件夹并获取完整的目录结构（包括空目录）
 */

import { isTauri } from './isTauri'

export interface FolderEntry {
  path: string // 相对于根目录的路径
  absolutePath: string // 绝对路径
  isDirectory: boolean
  size?: number
}

export interface FolderSelectionResult {
  folderName: string // 选择的文件夹名称
  entries: FolderEntry[] // 所有文件和目录（包括空目录）
  files: File[] // 可用于上传的 File 对象
  emptyDirs: string[] // 空目录路径列表
}

/**
 * 在 Tauri 环境中选择文件夹
 */
export async function tauriSelectFolder(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error('This function can only be used in Tauri environment')
  }

  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择要上传的文件夹',
  })

  return selected as string | null
}

/**
 * 递归读取目录结构（包括空目录）
 */
export async function tauriReadFolderRecursive(folderPath: string): Promise<FolderEntry[]> {
  if (!isTauri()) {
    throw new Error('This function can only be used in Tauri environment')
  }

  const { readDir } = await import('@tauri-apps/plugin-fs')
  const entries: FolderEntry[] = []

  async function readDirRecursive(path: string, relativePrefix: string) {
    let dirEntries
    try {
      dirEntries = await readDir(path)
    } catch (err) {
      console.warn('Failed to read directory:', path, err)
      return
    }

    for (const entry of dirEntries) {
      const entryRelativePath = relativePrefix + entry.name
      const entryAbsolutePath = path + '/' + entry.name

      if (entry.isDirectory) {
        entries.push({
          path: entryRelativePath + '/',
          absolutePath: entryAbsolutePath,
          isDirectory: true,
        })
        // 递归读取子目录
        await readDirRecursive(entryAbsolutePath, entryRelativePath + '/')
      } else {
        entries.push({
          path: entryRelativePath,
          absolutePath: entryAbsolutePath,
          isDirectory: false,
          // DirEntry in Tauri v2 doesn't have size property for files
          // size will be undefined, we'll read it later if needed
        })
      }
    }
  }

  await readDirRecursive(folderPath, '')
  return entries
}

/**
 * 选择文件夹并准备上传数据
 */
export async function tauriSelectFolderForUpload(): Promise<FolderSelectionResult | null> {
  if (!isTauri()) {
    throw new Error('This function can only be used in Tauri environment')
  }

  // 1. 选择文件夹
  const folderPath = await tauriSelectFolder()
  if (!folderPath) {
    return null
  }

  // 2. 获取文件夹名称
  const folderName = folderPath.split(/[/\\]/).pop() || 'folder'

  // 3. 递归读取目录结构
  const entries = await tauriReadFolderRecursive(folderPath)

  // 4. 分离文件和目录
  const fileEntries = entries.filter((e) => !e.isDirectory)
  const dirEntries = entries.filter((e) => e.isDirectory)

  // 5. 找出空目录（没有任何子项的目录）
  const dirsWithChildren = new Set<string>()
  for (const entry of entries) {
    // 如果是文件，标记其父目录为非空
    if (!entry.isDirectory) {
      const parts = entry.path.split('/')
      for (let i = 0; i < parts.length - 1; i++) {
        const parentDir = parts.slice(0, i + 1).join('/') + '/'
        dirsWithChildren.add(parentDir)
      }
    }
    // 如果是目录，标记其父目录为非空
    if (entry.isDirectory) {
      const parts = entry.path.split('/').filter(Boolean)
      for (let i = 0; i < parts.length - 1; i++) {
        const parentDir = parts.slice(0, i + 1).join('/') + '/'
        dirsWithChildren.add(parentDir)
      }
    }
  }

  const emptyDirs = dirEntries
    .filter((d) => !dirsWithChildren.has(d.path))
    .map((d) => d.path)

  // 6. 读取文件内容并创建 File 对象
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const files: File[] = []

  for (const fileEntry of fileEntries) {
    try {
      const content = await readFile(fileEntry.absolutePath)
      // 创建 File 对象，设置 webkitRelativePath 属性
      const file = new File([content], fileEntry.path.split('/').pop() || 'file', {
        type: 'application/octet-stream',
      })
      // 手动添加 webkitRelativePath 属性
      Object.defineProperty(file, 'webkitRelativePath', {
        value: folderName + '/' + fileEntry.path,
        writable: false,
      })
      files.push(file)
    } catch (err) {
      console.warn('Failed to read file:', fileEntry.absolutePath, err)
    }
  }

  return {
    folderName,
    entries,
    files,
    emptyDirs: emptyDirs.map((p) => folderName + '/' + p),
  }
}
