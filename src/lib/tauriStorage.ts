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

/**
 * 根据 store name 获取对应的文件名
 * 例如: 'r2-manager-config' → 'config.json'
 *       'r2-manager-transfer' → 'transfer.json'
 */
function getFileName(storeName: string): string {
  // 移除 'r2-manager-' 前缀，添加 .json 后缀
  const suffix = storeName.replace(/^r2-manager-/, '')
  return `${suffix}.json`
}

/**
 * 获取指定 store 的配置文件完整路径
 */
async function getConfigPath(storeName?: string): Promise<string> {
  if (!tauriPath) {
    throw new Error('Tauri path module not loaded')
  }
  const docDir = await tauriPath.documentDir()
  if (!docDir) {
    throw new Error('Failed to get document directory')
  }
  // 确保路径分隔符正确
  const separator = docDir.endsWith('/') || docDir.endsWith('\\') ? '' : '/'
  const fileName = storeName ? getFileName(storeName) : 'config.json'
  return `${docDir}${separator}${CONFIG_DIR}/${fileName}`
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
 *
 * 支持两种迁移模式：
 * 1. 新格式文件不存在时，从 localStorage 迁移
 * 2. 旧格式 config.json 存在且包含该 store 的数据时，拆分迁移
 */
async function migrateFromLocalStorage(storeName: string): Promise<string | null> {
  if (!isTauri() || !tauriFs) return null

  try {
    const newConfigPath = await getConfigPath(storeName)

    // 检查新格式文件是否已存在
    const newFileExists = await tauriFs.exists(newConfigPath)
    if (newFileExists) {
      await log('info', `Config file already exists: ${newConfigPath}, skip migration`)
      return null
    }

    // 尝试从旧格式 config.json 迁移（如果存在且包含该 store 的数据）
    const oldConfigPath = await getConfigPath('config')
    const oldFileExists = await tauriFs.exists(oldConfigPath)

    if (oldFileExists) {
      try {
        const oldContent = await tauriFs.readTextFile(oldConfigPath)
        const oldData = JSON.parse(oldContent)

        // 检查旧文件是否包含当前 store 的数据
        // 旧格式可能是直接存储的数据（config）或带 state 包装的格式
        let storeData = null

        if (oldData.state && oldData.state.history && storeName === 'r2-manager-transfer') {
          // transfer store 数据
          storeData = JSON.stringify({ state: { history: oldData.state.history }, version: 0 })
        } else if (storeName === 'r2-manager-config') {
          // config store 数据 - 排除 history 字段
          const { history, ...configState } = oldData.state || oldData
          if (configState.accountId || configState.theme) {
            storeData = JSON.stringify({ state: configState, version: 0 })
          }
        }

        if (storeData) {
          await ensureConfigDir()
          await tauriFs.writeTextFile(newConfigPath, storeData)
          await log('info', `Migrated data from old config.json to ${newConfigPath}`)
          return storeData
        }
      } catch (parseError) {
        await log('warn', `Failed to parse old config.json: ${parseError}`)
      }
    }

    // 从 localStorage 迁移
    const oldData = localStorage.getItem(storeName)
    if (!oldData) {
      await log('info', `No data in localStorage for ${storeName} to migrate`)
      return null
    }

    // 确保目录存在
    await ensureConfigDir()

    // 写入文件
    await tauriFs.writeTextFile(newConfigPath, oldData)
    await log('info', `Migrated data from localStorage to file: ${newConfigPath}`)

    // 清理 localStorage 中的旧数据
    localStorage.removeItem(storeName)
    await log('info', `Cleaned up localStorage data for ${storeName}`)

    return oldData
  } catch (error) {
    await log('error', `Migration failed for ${storeName}: ${error}`)
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
 *
 * 重要：每个 store 使用独立的文件，避免数据覆盖
 * - r2-manager-config → config.json
 * - r2-manager-transfer → transfer.json
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

        const configPath = await getConfigPath(name)
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
        const configPath = await getConfigPath(name)
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
        const configPath = await getConfigPath(name)
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
