# Changelog

All notable changes to this project will be documented in this file.

## [0.8.0] - 2026-03-12

### Fixed
- **大文件上传限制** - 修复上传超过 100MB 文件时报 `413 PayloadTooLargeError`
  - Express `express.raw()` 中间件限制从 100MB 提升到 5GB
  - 现在支持上传最大 5GB 的文件（R2 单文件限制）
- **上传进度显示** - 修复上传进度秒变 100% 的问题
  - 后端改为流式转发，前端 XHR 进度反映真实上传进度
  - 现在显示已传大小和实时速度
- **上传错误状态显示** - 修复上传失败时 UI 不显示错误的问题
  - 错误任务显示红色背景和错误信息
  - 添加关闭按钮移除错误任务
- **传输中心 UI 布局** - 修复大小/速度文字换行问题
  - 添加 `whitespace-nowrap` 防止文字挤到第二行

### Added
- **上传超时保护**
  - XHR 超时设置为 60 分钟（适应大文件慢速上传）
  - 速度过低自动取消：连续 2 分钟速度低于 10 KB/s 时自动取消上传
- **多线程分块下载功能** - Phase 1 基础实现
  - `src/types/chunk.ts` - 分块类型定义（ChunkInfo、ChunkDownloadResult）
  - `src/lib/chunkManager.ts` - 分块计算逻辑（根据文件大小自动分块）
  - `src/lib/transferLogger.ts` - 传输日志模块（任务/分块日志、进度节流）
  - `src/services/chunkedDownload.ts` - 分块下载核心实现
    - ChunkedDownloader 类：多线程并发下载
    - 支持 Range 请求分块获取
    - 自动合并分块为完整文件
  - 后端 `server/index.js` 支持 Range 请求（206 Partial Content）

### Technical
- **分块策略**：
  - < 10MB: 不分块（单线程）
  - 10-50MB: 2 分块
  - 50-200MB: 4 分块
  - \> 200MB: 8 分块
- **并发控制**：使用用户配置的 `maxDownloadThreads` 限制并发
- **进度计算**：基于已下载总字节数，实时更新进度条

---

## [0.7.0] - 2026-03-11

### Added
- **传输中心功能** - 类似百度网盘的传输管理页面
  - `src/types/transfer.ts` - 传输任务类型定义
  - `src/stores/transferStore.ts` - 传输状态管理（任务、历史记录）
  - `src/components/transfer/` - 传输中心UI组件
    - `TransferPage.tsx` - 传输页面主组件
    - `TransferTabs.tsx` - 标签页切换（上传中/下载中/已完成）
    - `TaskList.tsx` / `TaskItem.tsx` - 进行中任务列表
    - `HistoryList.tsx` / `HistoryItem.tsx` - 历史记录列表
  - Sidebar 添加"传输"入口，显示活跃任务数量徽章
  - 历史记录持久化（最近100条）

- **下载进度追踪**
  - `api.downloadFileWithProgress()` - XHR 实现带进度回调的下载
  - 单文件下载和批量下载均支持实时进度显示
  - 下载速度计算和显示

- **上传进度优化**
  - 重构 `handleUpload` 使用 transferStore
  - 重构 `handleDownload` 和 `handleBatchDownload` 使用 transferStore
  - 统一的上传/下载任务管理

### Changed
- `runWithConcurrency` 函数新增 `index` 参数支持任务索引追踪
- 设置对话框"并发"标签改为"传输"标签

### Technical
- 传输任务状态：pending / running / paused / completed / error
- 任务完成后自动移动到历史记录
- 支持并发控制的上传/下载

### Fixed
- **修复桌面端多个 Store 数据互相覆盖问题** - 每个 store 使用独立文件存储
  - `r2-manager-config` → `config.json`
  - `r2-manager-transfer` → `transfer.json`
  - 支持从旧格式 `config.json` 自动拆分迁移

---

## [0.6.2] - 2026-03-11

### Added
- **桌面端配置文件持久化** - 区分桌面端和浏览器端的配置存储方式
  - 桌面端：配置存储到用户文档文件夹 `{Documents}/CloudFlareR2-Manager/config.json`
  - 浏览器端：继续使用 localStorage
  - 自动迁移：首次运行时自动将 localStorage 数据迁移到文件系统
- `src-tauri/capabilities/default.json` - Tauri v2 文件系统权限配置
- `src/lib/isTauri.ts` - Tauri 环境检测工具
- `src/lib/tauriStorage.ts` - 混合存储适配器（智能选择存储后端）

### Changed
- `src/stores/configStore.ts` - 使用 `createHybridStorage()` 替代 `localStorage`
- Sidecar 可执行文件重命名：`server.exe` → `r2-proxy-server.exe`（提高辨识度）

### Fixed
- 安装时自动关闭旧版本应用进程（解决"文件被占用"安装失败问题）
- **修复 Documents 文件夹路径拼接错误** - `documentDir()` 返回路径无尾部斜杠导致 `DocumentsCloudFlareR2-Manager` 变成无效路径
- 修复 `fs:scope` 权限配置，允许访问 `$DOCUMENT` 目录

### Changed
- 日志文件改为覆写模式（每次启动清空，避免日志爆炸）
- 配置读写操作添加 Tauri log 输出，便于调试

### Benefits
- 桌面应用更新不会丢失配置
- 用户可以手动备份配置文件
- 跨版本配置持久化

---

## [0.6.1] - 2026-03-11

### Changed
- **Tauri v2 迁移**
  - `tauri.conf.json` - 更新为 v2 配置格式（schema、identifier、bundle 结构）
  - `Cargo.toml` - 使用独立的 Tauri v2 插件包（shell、clipboard-manager、dialog、fs、http）
  - `main.rs` - 使用 v2 API（`generate_context!()` 宏、`app.shell()` 方法）
  - Sidecar 命名简化：`binaries/server-x86_64-pc-windows-msvc` → `binaries/server`
- **服务端 CommonJS 转换** - 将 server 代码从 ES Module 转换为 CommonJS 格式
  - `server/index.js` - `import` 改为 `require`，`export` 改为 `module.exports`
  - `server/package.json` - 移除 `"type": "module"`，添加 `pkg` 配置

### Fixed
- 修复 TypeScript 未使用变量/导入错误（ConfigPage、FileGrid、useBuckets、useFiles）
- 修复 `generate_context()` 应为宏调用 `generate_context!()`
- 修复 `app_handle()` 方法需要 `use tauri::Manager` 导入
- 修复 server/package.json 缺少 `bin` 字段导致 pkg 打包失败
- **修复 pkg 打包 ES Module 失败** - `pkg` 工具对 ES Module 支持有限，导致打包后 `Cannot find module` 错误

### Documentation
- `.gitignore` - 添加 Tauri/Rust 相关忽略规则（target/、WixTools/、binaries/*.exe、.pkg-cache/）

---

## [0.6.0] - 2026-03-11

### Added
- **Tauri 桌面端打包支持**
  - 完整的 Tauri 配置 (`src-tauri/`)
  - Sidecar 方式打包 Express 服务端
  - 支持 MSI 和 NSIS 两种安装包格式
  - 中文语言安装界面

### Documentation
- `Build.md` - 详细的桌面端打包指南
- `build.bat` - 一键打包脚本（自动检查依赖）
- `src-tauri/icons/README.md` - 图标文件说明

### Scripts
- `npm run dev:tauri` - Tauri 开发模式
- `npm run build:server` - 打包服务端为可执行文件
- `npm run build:tauri` - 仅打包 Tauri
- `npm run release` - 完整打包流程（前端 + 服务端 + Tauri）

### Technical
- 使用系统 WebView2（Windows 10/11 内置）
- 打包后体积约 5-15 MB（不含 WebView2 运行时）
- Rust 后端管理 sidecar 生命周期

---

## [0.5.0] - 2026-03-11

### Added
- **深色模式支持**
  - 主题状态管理 (`themeStore.ts`) - 支持浅色/深色/跟随系统三种模式
  - 主题提供者 (`ThemeProvider.tsx`) - 统一管理主题应用到 DOM
  - Header 主题切换下拉菜单 (`ThemeToggle.tsx`) - 太阳/月亮图标切换
  - Sidebar 三段式主题切换器 - 长矩形三等分布局（浅色/跟随/深色）
  - localStorage 持久化主题设置
  - 监听系统主题变化自动切换

### Changed
- `main.tsx` - 使用 ThemeProvider 包装 App 组件
- `Sidebar.tsx` - 底部主题按钮改为三段式切换器，使用 useThemeStore
- `Header.tsx` - 添加主题切换下拉菜单
- `App.tsx` - 移除重复的主题逻辑（统一由 ThemeProvider 管理）

### Technical
- 使用 Tailwind CSS `darkMode: ['class']` 配置
- shadcn/ui CSS 变量已预定义浅色/深色两套主题
- 主题状态与 UI 组件完全解耦

---

## [0.4.0] - 2026-03-11

### Added
- **存储桶管理功能**
  - 左侧边栏"存储桶"标题旁添加创建桶按钮（+ 图标）
  - 每个桶项右侧添加三个点菜单（鼠标悬停显示）
  - 删除存储桶确认对话框（需输入桶名确认，类似 GitHub/CloudFlare 风格）
  - `DeleteBucketDialog.tsx` 组件
- **创建存储桶对话框** (`CreateBucket.tsx`)
  - 桶名称格式校验（小写字母、数字、连字符）
  - 创建成功后自动选中新桶

### Changed
- `Sidebar.tsx` - 添加桶操作下拉菜单和删除对话框
- `MainLayout.tsx` - 添加 `onDeleteBucket` prop
- `App.tsx` - 添加 `handleCreateBucket` 和 `handleDeleteBucket` 处理函数
- `bucketStore.ts` - `selectBucket` 支持 null 类型

---

## [0.3.0] - 2026-03-10

### Added
- **新建文件夹功能**
  - Header 新建文件夹按钮
  - 创建文件夹对话框 UI
  - 后端 `/api/buckets/:bucketName/folders` 端点
  - 通过上传空对象模拟文件夹（S3/R2 机制）
- 文件/文件夹行操作菜单（三个点），支持删除和下载
- 批量操作菜单（Header），支持批量删除和下载
- 全选复选框，支持全选/取消全选当前层级
- 递归删除文件夹内容
- 设置菜单中添加重启服务按钮
- **并发控制功能**
  - 设置中添加并发配置（上传/下载线程数）
  - `runWithConcurrency` 工具函数实现并发限制
  - 批量下载使用并发控制避免浏览器连接耗尽
  - 批量上传使用并发控制避免请求超时
- **设置页面标签化布局**
  - 顶部标签导航：凭证、并发、系统、危险
  - 标签按钮带图标，小屏幕自动隐藏文字
  - 选中标签高亮效果
  - 危险操作页面使用红色警告样式

### Changed
- **设置对话框重构** - 从单页滚动布局改为标签分页布局
  - 凭证配置独立页面
  - 并发设置独立页面
  - 系统操作独立页面
  - 危险操作独立页面（红色警告风格）

### Fixed
- 修复新建文件夹后显示空名字文件的问题（过滤以 `/` 结尾的对象）
- 文件夹复选框从静态图标改为真正的复选框
- 修复批量删除文件夹时无法删除的问题
- 修复 lucide-react Bucket 图标不存在的问题
- 修复 `useConfigStore()` 在 `useCallback` 内调用导致页面崩溃的问题
- 修复批量下载中 `bucket` 变量未定义的错误
- 修复 `runWithConcurrency` 工具函数清空数组导致任务丢失的 bug

---

## [0.2.0] - 2026-03-10

### Added
- **后端代理服务器** - Express.js 代理服务器解决 CORS 跨域问题
  - `server/index.js`: Express 服务器，代理所有 R2 API 请求
  - `server/package.json`: 服务端依赖配置
  - 支持操作: 配置凭证、测试连接、桶CRUD、文件CRUD、预签名URL
- **前端 API 服务** (`src/services/api.ts`)
  - 封装所有后端 API 调用
  - 统一错误处理
  - 类型安全
- **Header 组件增强**
  - 返回上一级按钮
  - 路径面包屑导航 (点击跳转)
  - 复制路径按钮 (带成功提示)
  - 半透明椭圆样式 + hover 动效
- **启动脚本更新**
  - `npm run dev`: 同时启动前后端
  - `npm run dev:client`: 仅启动前端
  - `npm run dev:server`: 仅启动后端

### Changed
- **服务层重构**
  - `bucketService.ts`: 改为调用后端代理
  - `fileService.ts`: 改为调用后端代理
  - `useFiles.ts`: 移除 S3Client 依赖
- 清理旧架构残留代码（SettingsDialog）

### Technical Decisions
1. **为什么使用后端代理?**
   - 绕过浏览器 CORS 限制
   - 凭证不暴露给浏览器 (更安全)
   - 便于后续扩展 (缓存、日志等)

2. **为什么用 Express?**
   - 轻量、简单
   - 与 AWS SDK 兼容性好
   - 开发体验优秀

---

## [0.1.0] - 2026-03-10

### Added
- **项目脚手架搭建**
  - 初始化 Vite + React + TypeScript 项目
  - 配置 Tailwind CSS 和 PostCSS
  - 配置路径别名 `@/` 指向 `src/`
- **GUI 配置功能**
  - GUI 配置页面 (`ConfigPage.tsx`) - 网页内直接配置 R2 凭证
  - 凭证持久化 (`configStore.ts`) - 使用 Zustand persist 中间件
  - 设置对话框 (`SettingsDialog.tsx`) - 查看和修改已保存的凭证
- **基础架构设计**
  - 服务层：`r2Client.ts`, `bucketService.ts`, `fileService.ts`
  - 状态层：Zustand stores (config, bucket, file)
  - 类型定义：完整的 TypeScript 类型
  - 工具函数：格式化、文件处理等
- **UI 组件库**
  - shadcn/ui 基础组件 (button, input, card, dialog 等)
  - 布局组件 (Sidebar, Header, MainLayout)
  - 业务组件 (BucketList, FileList, FileUploader 等)
  - 通用组件 (Loading, Empty, ConfirmDialog)
- **动效实现**
  - Framer Motion 动画
  - 列表项入场动画
  - 交互反馈动画

### Security
- `.gitignore` 更新，排除敏感文件
- 界面提示"凭证仅保存在本地"

### Technical Decisions
1. **为什么使用 S3 SDK？**
   - Cloudflare R2 完全兼容 S3 API
   - 官方支持，稳定可靠
   - 无需额外封装

2. **为什么使用 Zustand？**
   - 比 Redux 轻量，API 简洁
   - TypeScript 支持优秀
   - 内置 persist 中间件

3. **为什么使用 Framer Motion？**
   - 声明式动画，开发效率高
   - 性能优秀，支持手势
   - 与 React 完美集成

4. **为什么使用 localStorage？**
   - 浏览器原生支持，无需额外依赖
   - 数据持久化，关闭浏览器后仍存在
   - 不会随代码上传到 GitHub
