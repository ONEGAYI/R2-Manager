# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-03-10

### Added
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

### Fixed
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
