# Changelog

All notable changes to this project will be documented in this file.

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
