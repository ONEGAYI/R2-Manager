/**
 * 文件图标映射配置
 * 根据文件名或扩展名返回对应的图标名称
 */

// 文件图标映射：精确文件名匹配（优先级最高）
const exactFileMappings: Record<string, string> = {
  'package.json': 'npm',
  'package-lock.json': 'npm',
  'tsconfig.json': 'typescript',
  'jsconfig.json': 'js',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.env': 'config',
  '.env.local': 'config',
  '.env.development': 'config',
  '.env.production': 'config',
  '.env.test': 'config',
  'dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  '.dockerignore': 'docker',
  'license': 'license',
  'license.md': 'license',
  'license.txt': 'license',
  'readme.md': 'markdown',
  'readme.txt': 'text',
  'changelog.md': 'markdown',
  '.eslintrc': 'eslint',
  '.eslintrc.js': 'eslint',
  '.eslintrc.json': 'eslint',
  '.eslintrc.yml': 'eslint',
  '.prettierrc': 'prettier',
  '.prettierrc.js': 'prettier',
  '.prettierrc.json': 'prettier',
  '.prettierrc.yml': 'prettier',
  'babel.config.js': 'babel',
  'babel.config.json': 'babel',
  '.babelrc': 'babel',
  'webpack.config.js': 'webpack',
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'next.config.js': 'next',
  'next.config.mjs': 'next',
  'nuxt.config.ts': 'nuxt',
  'nuxt.config.js': 'nuxt',
  'schema.prisma': 'prisma',
}

// 扩展名到图标的映射（按优先级分组）
interface ExtensionMapping {
  icon: string
  extensions: string[]
}

const extensionMappings: ExtensionMapping[] = [
  // JavaScript/TypeScript 生态
  { icon: 'reactts', extensions: ['tsx'] },
  { icon: 'reactjs', extensions: ['jsx'] },
  { icon: 'typescript', extensions: ['ts', 'mts', 'cts'] },
  { icon: 'js', extensions: ['js', 'mjs', 'cjs'] },
  { icon: 'vue', extensions: ['vue'] },
  { icon: 'svelte', extensions: ['svelte'] },
  { icon: 'astro', extensions: ['astro'] },

  // 编程语言
  { icon: 'python', extensions: ['py', 'pyw', 'pyi'] },
  { icon: 'java', extensions: ['java', 'jar', 'class'] },
  { icon: 'rust', extensions: ['rs'] },
  { icon: 'go', extensions: ['go'] },
  { icon: 'c', extensions: ['c', 'h'] },
  { icon: 'cpp', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'] },
  { icon: 'csharp', extensions: ['cs'] },
  { icon: 'php', extensions: ['php', 'phtml', 'php3', 'php4', 'php5'] },
  { icon: 'ruby', extensions: ['rb', 'erb', 'rake'] },
  { icon: 'swift', extensions: ['swift'] },
  { icon: 'kotlin', extensions: ['kt', 'kts'] },
  { icon: 'shell', extensions: ['sh', 'bash', 'zsh'] },
  { icon: 'powershell', extensions: ['ps1', 'psm1', 'psd1'] },
  { icon: 'sql', extensions: ['sql'] },

  // 样式
  { icon: 'html', extensions: ['html', 'htm', 'xhtml'] },
  { icon: 'css', extensions: ['css'] },
  { icon: 'scss', extensions: ['scss', 'sass'] },
  { icon: 'less', extensions: ['less'] },

  // 配置/数据
  { icon: 'json', extensions: ['json', 'jsonc', 'json5'] },
  { icon: 'yaml', extensions: ['yml', 'yaml'] },
  { icon: 'xml', extensions: ['xml', 'xsl', 'xslt', 'svg'] },
  { icon: 'toml', extensions: ['toml'] },
  { icon: 'config', extensions: ['ini', 'conf', 'cfg', 'config'] },
  { icon: 'graphql', extensions: ['graphql', 'gql'] },

  // 文档
  { icon: 'markdown', extensions: ['md', 'mdx', 'markdown'] },
  { icon: 'text', extensions: ['txt', 'rtf'] },
  { icon: 'pdf', extensions: ['pdf'] },
  { icon: 'word', extensions: ['doc', 'docx'] },
  { icon: 'excel', extensions: ['xls', 'xlsx', 'csv'] },
  { icon: 'powerpoint', extensions: ['ppt', 'pptx'] },

  // 图片
  { icon: 'image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'] },
  { icon: 'svg', extensions: ['svg'] },

  // 音视频
  { icon: 'video', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] },
  { icon: 'audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'] },

  // 压缩包
  { icon: 'zip', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'] },

  // 数据库
  { icon: 'db', extensions: ['db', 'sqlite', 'sqlite3', 'mdb'] },

  // 其他
  { icon: 'docker', extensions: ['dockerfile'] },
  { icon: 'git', extensions: ['git'] },
  { icon: 'prisma', extensions: ['prisma'] },
  { icon: 'bun', extensions: ['bun'] },
  { icon: 'node', extensions: ['node'] },
]

// 文件夹名称到图标的映射
const folderMappings: Record<string, string> = {
  'node_modules': 'node',
  'src': 'src',
  'dist': 'dist',
  'build': 'dist',
  'out': 'dist',
  'public': 'public',
  'static': 'public',
  'assets': 'images',
  'images': 'images',
  'img': 'images',
  'fonts': 'fonts',
  'styles': 'config',
  'components': 'src',
  'pages': 'src',
  'views': 'src',
  'hooks': 'src',
  'utils': 'src',
  'lib': 'src',
  'services': 'services',
  'api': 'api',
  'config': 'config',
  'configs': 'config',
  'scripts': 'config',
  'docs': 'docs',
  'test': 'test',
  'tests': 'test',
  '__tests__': 'test',
  'spec': 'test',
  'mock': 'mock',
  'mocks': 'mock',
  'types': 'interfaces',
  'interfaces': 'interfaces',
  'models': 'interfaces',
  'log': 'log',
  'logs': 'log',
  'temp': 'temp',
  'tmp': 'temp',
  '.git': 'git',
  '.github': 'git',
  '.vscode': 'config',
  '.idea': 'config',
}

/**
 * 获取文件图标名称
 * @param filename 文件名（包含扩展名）
 * @returns 图标名称（不含 .svg 后缀）
 */
export function getFileIcon(filename: string): string {
  const lowerName = filename.toLowerCase()

  // 1. 先匹配精确文件名
  if (exactFileMappings[lowerName]) {
    return `file_type_${exactFileMappings[lowerName]}`
  }

  // 2. 获取扩展名并匹配
  const ext = lowerName.split('.').pop() || ''
  for (const mapping of extensionMappings) {
    if (mapping.extensions.includes(ext)) {
      return `file_type_${mapping.icon}`
    }
  }

  // 3. 返回默认图标
  return 'default_file'
}

/**
 * 获取文件夹图标名称
 * @param folderName 文件夹名称
 * @param isOpened 是否展开状态
 * @returns 图标名称（不含 .svg 后缀）
 */
export function getFolderIcon(folderName: string, isOpened: boolean = false): string {
  const lowerName = folderName.toLowerCase().replace(/\/$/, '')

  // 查找匹配的图标
  const iconName = folderMappings[lowerName]

  if (iconName) {
    return isOpened ? `folder_type_${iconName}_opened` : `folder_type_${iconName}`
  }

  // 返回默认图标
  return isOpened ? 'default_folder_opened' : 'default_folder'
}

/**
 * 获取图标路径
 */
export function getFileIconPath(iconName: string): string {
  return `@/assets/icons/files/${iconName}.svg`
}

export function getFolderIconPath(iconName: string): string {
  return `@/assets/icons/folders/${iconName}.svg`
}
