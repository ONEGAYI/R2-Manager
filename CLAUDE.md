# Cloudflare R2 Manager

> 一个现代化的 Cloudflare R2 存储桶管理工具，提供可视化操作界面。

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Express.js 代理服务器 (CommonJS，用于 pkg 打包)
- **桌面端**: Tauri v2 (使用系统 WebView2)
- **样式**: Tailwind CSS + shadcn/ui
- **动效**: Framer Motion
- **状态**: Zustand (浏览器端 localStorage / 桌面端文件系统持久化)
- **API**: AWS S3 SDK (兼容 R2)

## 架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React 前端    │────▶│  Express 代理   │────▶│  Cloudflare R2  │
│  localhost:5173 │     │  localhost:3001 │     │      API        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 快速开始

```bash
# 安装依赖
npm install
cd server && npm install && cd ..

# 启动开发服务器（同时启动前后端）
npm run dev

# 或分别启动
npm run dev:client  # 仅前端
npm run dev:server  # 仅后端
```

### 获取 R2 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 R2 页面
3. 点击 "Manage R2 API Tokens"
4. 创建 API Token，获取：
   - Account ID
   - Access Key ID
   - Secret Access Key

## 项目文件树

```
cloudflare-r2-manager/
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 ui/                    # shadcn/ui 基础组件
│   │   ├── 📁 layout/                # 布局组件 (Sidebar, Header, MainLayout)
│   │   ├── 📁 config/                # 配置组件 (ConfigPage, SettingsDialog)
│   │   ├── 📁 bucket/                # 桶操作组件 (CreateBucket, DeleteBucketDialog)
│   │   ├── 📁 file/                  # 文件操作组件 (FileList, FileGrid, FileUploader, FilePreview)
│   │   ├── 📁 transfer/              # 传输中心组件 (TransferPage, TaskList, HistoryList)
│   │   └── 📁 common/                # 通用组件 (Loading, Empty, ThemeProvider, ThemeToggle)
│   ├── 📁 hooks/                     # 自定义 Hooks (useConfig, useBuckets, useFiles, useUpload)
│   ├── 📁 services/                  # API 服务层 (api, bucketService, fileService)
│   ├── 📁 stores/                    # Zustand 状态 (configStore, bucketStore, fileStore, transferStore)
│   ├── 📁 types/                     # TypeScript 类型 (config, bucket, file, transfer)
│   ├── 📁 lib/                       # 工具库 (cn, utils, isTauri, logger, tauriStorage)
│   ├── 📁 styles/                    # 全局样式
│   ├── App.tsx                       # 主应用
│   └── main.tsx                      # 入口文件
│
├── 📁 server/                        # 后端代理服务器 (CommonJS 格式，用于 pkg 打包)
│   ├── index.js                      # Express 服务器
│   └── package.json                  # 服务端依赖
│
├── 📁 src-tauri/                     # Tauri 桌面端配置
│   ├── 📁 src/main.rs                # Rust 入口文件（v2 API）
│   ├── 📁 capabilities/              # Tauri v2 权限配置
│   │   └── default.json              # 文件系统、Shell 等权限
│   ├── 📁 binaries/                  # Sidecar 可执行文件
│   │   └── r2-proxy-server-x86_64-pc-windows-msvc.exe  # Express 代理服务端
│   ├── 📁 icons/                     # 应用图标
│   ├── tauri.conf.json               # Tauri v2 配置
│   ├── Cargo.toml                    # Rust 依赖（独立插件）
│   └── build.rs                      # Tauri 构建脚本
│
├── CLAUDE.md                         # 本文档
├── CHANGELOG.md                      # 变更日志
├── Build.md                          # 桌面端打包指南
├── build.bat                         # 一键打包脚本
├── clean.bat                         # 清理构建产物脚本
└── package.json                      # 前端依赖配置
```

## 重要功能

### 配置存储

应用配置会根据运行环境自动选择存储方式：

| 环境 | 存储位置 | 说明 |
|------|----------|------|
| 浏览器 | localStorage | 随浏览器缓存 |
| 桌面端 | `{Documents}/CloudFlareR2-Manager/config.json` | 持久化存储，更新不丢失 |

- **自动迁移**: 首次在桌面端运行时，会自动将 localStorage 数据迁移到文件系统
- **备份**: 用户可手动备份 Documents 目录下的配置文件

### 重启服务

在设置菜单中点击"系统"标签，然后点击"重启"按钮可以一键重启前后端服务。

- **API 端点**: `POST /api/system/restart`
- **前端调用**: `api.restartServer()`
- **位置**: 设置对话框 → 系统 → 重启

### 设置对话框

设置对话框采用标签分页布局，顶部四个标签按钮：

| 标签 | 功能 |
|------|------|
| 凭证 | R2 API 凭证配置（Account ID、Access Key、Secret Key） |
| 并发 | 上传/下载并发线程数设置（1-10） |
| 系统 | 重启前后端服务 |
| 危险 | 清除所有配置（红色警告样式） |

### 批量操作

- **全选**: 表头复选框支持全选/取消全选当前层级
- **批量删除**: 支持递归删除文件夹内容
- **批量下载**: 获取所有选中项的预签名 URL 并触发下载

### 文件操作菜单

每行右侧的三个点菜单支持：
- **删除**: 单个文件/文件夹删除（文件夹递归删除）
- **下载**: 单个文件下载

### 存储桶管理

- **创建桶**: 左侧边栏"存储桶"标题旁的 + 按钮
- **删除桶**: 每个桶项右侧的三个点菜单 → 删除存储桶
  - 需要输入桶名确认（类似 GitHub/CloudFlare 的安全确认方式）

## 开发计划

### Phase 1: 核心功能 ✅
- [x] 项目架构
- [x] 基础 UI 组件
- [x] 桶列表展示
- [x] 文件列表展示
- [x] GUI 配置页面
- [x] 凭证持久化
- [x] 后端代理解决 CORS

### Phase 2: 交互完善
- [x] 文件/文件夹操作菜单
- [x] 批量操作（删除、下载）
- [x] 全选功能
- [x] 文件上传进度（XHR 实现）
- [x] 文件下载进度（传输中心页面）
- [x] 新建文件夹
- [x] 创建存储桶
- [x] 删除存储桶（输入桶名确认）
- [ ] 文件预览功能
- [x] **传输中心** - 类似百度网盘的传输管理页面
  - [x] 上传/下载任务实时进度追踪
  - [x] 传输速度显示
  - [x] 历史记录管理
  - [x] 任务标签分类（上传中/下载中/已完成）

### Phase 3: 体验优化
- [x] 深色模式（浅色/深色/跟随系统三种模式）
- [x] 传输中心进度反馈（实时进度条、速度显示）
- [x] 大文件上传支持（流式转发、真实进度、超时保护）
- [ ] 暂停/恢复传输
- [x] **多线程分块传输** - Phase 1 完成
  - [x] 分块下载（Range 请求、4/8 线程并发、Blob 合并）
  - [x] 分块上传（S3 Multipart Upload、真取消机制）
  - [x] 进度报告节流（200ms，减少 CPU 占用）
  - [ ] 断点续传（Phase 2）
- [ ] 响应式布局、面包屑导航布局优化
- [ ] 键盘快捷键
- [ ] 拖拽上传
- [ ] 性能优化
- [ ] 文件、文件夹图标添加

### Phase 4: 高级功能
- [x] Tauri v2 桌面端打包（Windows MSI/NSIS）
- [x] 桌面端配置文件持久化（Documents 目录存储，浏览器端 localStorage）
- [ ] 多账户管理
- [ ] 文件搜索
- [ ] 访问统计
- [ ] CDN 配置

### Phase 5: 待修复
- [ ] 批量删除多层级时出错（需进一步验证）
- [ ] 速度显示不准:发生在最后一段的时候，速度是非常缓慢的下降，不符合实际

---

*详细变更记录请查看 [CHANGELOG.md](./CHANGELOG.md)*
