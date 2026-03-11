import { isTauri } from './isTauri'

// 动态导入 Tauri API（仅在 Tauri 环境中）
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null
let tauriPath: typeof import('@tauri-apps/api/path') | null = null
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null

async function loadTauriModules(): Promise<boolean> {
  if (!isTauri()) return false

  try {
    tauriFs = await import('@tauri-apps/plugin-fs')
    tauriPath = await import('@tauri-apps/api/path')
    tauriInvoke = (await import('@tauri-apps/api/core')).invoke
    return true
  } catch (error) {
    console.warn('[TauriStorage] Failed to load Tauri modules:', error)
    return false
  }
}

/**
 * 日志输出（写入到 Tauri 日志文件）
 */
async function log(level: 'info' | 'warn' | 'error', message: string): Promise<void> {
  // 控制台输出
  const timestamp = new Date().toISOString()
  const formattedMessage = `[${timestamp}] [TauriStorage] ${message}`
  console.log(formattedMessage)

  // Tauri 日志输出（通过 invoke 调用 Rust 端）
  if (tauriInvoke) {
    try {
      await tauriInvoke('log_from_frontend', { message, level })
    } catch {
      // 忽略日志错误
    }
  }
}

// 配置文件存储路径
const CONFIG_DIR = 'CloudFlareR2-Manager'
const CONFIG_FILE = 'config.json'

/**
 * 获取配置文件的完整路径
 */
async function getConfigPath(): Promise<string> {
  if (!tauriPath) {
    throw new Error('Tauri path module not loaded')
  }
  const docDir = await tauriPath.documentDir()
  if (!docDir) {
    throw new Error('Failed to get document directory')
  }
  // 确保路径分隔符正确
  const separator = docDir.endsWith('/') || docDir.endsWith('\\') ? '' : '/'
  return `${docDir}${separator}${CONFIG_DIR}/${CONFIG_FILE}`
}

/**
 * 获取配置目录路径
 */
async function getConfigDir(): Promise<string> {
  if (!tauriPath) {
    throw new Error('Tauri path module not loaded')
  }
  const docDir = await tauriPath.documentDir()
  if (!docDir) {
    throw new Error('Failed to get document directory')
  }
  // 确保路径分隔符正确
  const separator = docDir.endsWith('/') || docDir.endsWith('\\') ? '' : '/'
  return `${docDir}${separator}${CONFIG_DIR}`
}

/**
 * 确保配置目录存在
 */
async function ensureConfigDir(): Promise<void> {
  if (!tauriFs) {
    throw new Error('Tauri fs module not loaded')
  }

  const configDir = await getConfigDir()

  try {
    const dirExists = await tauriFs.exists(configDir)
    if (!dirExists) {
      await tauriFs.mkdir(configDir, { recursive: true })
      await log('info', `Created config directory: ${configDir}`)
    }
  } catch (error) {
    await log('error', `Failed to ensure config directory: ${error}`)
    throw error
  }
}

/**
 * 从 localStorage 迁移数据到文件系统
 * 仅在 Tauri 环境中且文件不存在时执行
 */
async function migrateFromLocalStorage(storageKey: string): Promise<string | null> {
  if (!isTauri() || !tauriFs) return null

  try {
    const configPath = await getConfigPath()

    // 检查文件是否已存在
    const fileExists = await tauriFs.exists(configPath)
    if (fileExists) {
      await log('info', 'Config file already exists, skip migration')
      return null
    }

    // 从 localStorage 读取旧数据
    const oldData = localStorage.getItem(storageKey)
    if (!oldData) {
      await log('info', 'No data in localStorage to migrate')
      return null
    }

    // 确保目录存在
    await ensureConfigDir()

    // 写入文件
    await tauriFs.writeTextFile(configPath, oldData)
    await log('info', `Migrated data from localStorage to file: ${configPath}`)

    // 清理 localStorage 中的旧数据
    localStorage.removeItem(storageKey)
    await log('info', 'Cleaned up localStorage data')

    return oldData
  } catch (error) {
    await log('error', `Migration failed: ${error}`)
    return null
  }
}

// 缓存初始化状态
let initialized = false
let initPromise: Promise<void> | null = null

/**
 * 初始化 Tauri 模块（仅执行一次）
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (isTauri()) {
      const loaded = await loadTauriModules()
      if (loaded) {
        await log('info', 'Tauri modules loaded successfully')
      } else {
        console.warn('[TauriStorage] Failed to load Tauri modules')
      }
    }
    initialized = true
  })()

  return initPromise
}

/**
 * 创建混合存储适配器
 * 根据运行环境自动选择存储后端
 *
 * Zustand v4 persist 中间件兼容版本
 */
export function createHybridStorage() {
  return {
    getItem: async (name: string): Promise<string | null> => {
      await ensureInitialized()

      // 浏览器环境：直接使用 localStorage
      if (!isTauri()) {
        return localStorage.getItem(name)
      }

      // Tauri 环境：使用文件系统
      if (!tauriFs) {
        await log('warn', 'Tauri fs module not available, fallback to localStorage')
        return localStorage.getItem(name)
      }

      try {
        // 尝试迁移旧数据
        const migratedData = await migrateFromLocalStorage(name)
        if (migratedData !== null) {
          return migratedData
        }

        const configPath = await getConfigPath()
        const fileExists = await tauriFs.exists(configPath)

        if (!fileExists) {
          await log('info', `Config file not found: ${configPath}`)
          return null
        }

        const content = await tauriFs.readTextFile(configPath)
        await log('info', `Read config from: ${configPath}`)
        return content
      } catch (error) {
        await log('error', `Failed to read config file: ${error}`)
        // 降级到 localStorage
        return localStorage.getItem(name)
      }
    },

    setItem: async (name: string, value: string): Promise<void> => {
      await ensureInitialized()

      // 浏览器环境：直接使用 localStorage
      if (!isTauri()) {
        localStorage.setItem(name, value)
        return
      }

      // Tauri 环境：使用文件系统
      if (!tauriFs) {
        await log('warn', 'Tauri fs module not available, fallback to localStorage')
        localStorage.setItem(name, value)
        return
      }

      try {
        await ensureConfigDir()
        const configPath = await getConfigPath()
        await tauriFs.writeTextFile(configPath, value)
        await log('info', `Wrote config to: ${configPath}`)
      } catch (error) {
        await log('error', `Failed to write config file: ${error}`)
        // 降级到 localStorage
        localStorage.setItem(name, value)
      }
    },

    removeItem: async (name: string): Promise<void> => {
      await ensureInitialized()

      // 浏览器环境：直接使用 localStorage
      if (!isTauri()) {
        localStorage.removeItem(name)
        return
      }

      // Tauri 环境：使用文件系统
      if (!tauriFs) {
        localStorage.removeItem(name)
        return
      }

      try {
        const configPath = await getConfigPath()
        const fileExists = await tauriFs.exists(configPath)

        if (fileExists) {
          // 删除文件内容而不是删除文件本身
          await tauriFs.writeTextFile(configPath, '{}')
          await log('info', `Cleared config file: ${configPath}`)
        }
      } catch (error) {
        await log('error', `Failed to remove config file: ${error}`)
        localStorage.removeItem(name)
      }
    }
  }
}
