# 🎉 Cloudflare R2 Manager

> 一个现代化的 Cloudflare R2 存储桶可视化管理工具

[![Release](https://img.shields.io/github/v/release/ONEGAYI/R2-Manager?style=flat-square)](https://github.com/ONEGAYI/R2-Manager/releases)
[![License](https://img.shields.io/github/license/ONEGAYI/R2-Manager?style=flat-square)](LICENSE)

## 📖 项目简介

Cloudflare R2 Manager 是一个功能完善的 R2 存储桶管理工具，提供直观的可视化操作界面。支持 Web 浏览器和 Windows 桌面端两种使用方式。

### 技术栈
- **前端**: React 18 + TypeScript + Vite
- **后端**: Express.js 代理服务器
- **桌面端**: Tauri v2
- **样式**: Tailwind CSS + shadcn/ui
- **动效**: Framer Motion
- **状态**: Zustand
- **API**: AWS S3 SDK (兼容 R2)

---

## ✨ 核心功能

### 🪣 存储桶管理
- 创建存储桶（名称格式校验）
- 删除存储桶（安全确认，需输入桶名）
- 桶列表浏览与快速切换

### 📁 文件操作
- **上传**: 拖拽上传、按钮上传、文件夹上传
- **下载**: 单文件下载、批量下载
- **删除**: 单文件删除、批量删除、递归删除文件夹
- **重命名**: 文件/文件夹重命名
- **复制/移动**: 跨桶复制移动、文件夹递归操作、循环引用检测

### 📦 批量操作
- 全选/取消全选当前层级
- 批量删除（递归处理文件夹）
- 批量下载（并发获取预签名 URL）
- **批量复制/移动**
  - SSE 实时进度反馈
  - 冲突处理策略（跳过/覆盖/保留两者）
  - "应用到所有"一键批量处理
  - 操作结果详情（成功/重命名/跳过/失败统计）

---

## 🚀 传输中心

类似百度网盘的传输管理页面，提供完整的上传下载任务管理：

### 任务管理
- 进行中任务列表（上传/下载/批量操作）
- 历史记录（最近 100 条）
- 任务排队机制（全局线程池）

### 多线程分块传输
- **上传**: S3 Multipart Upload API，支持大文件
- **下载**: Range 请求分块下载
- 可配置分块大小（上传 5-16MB，下载 4-32MB）
- 可配置并发线程数（1-10）

### 暂停与恢复
- 上传暂停/恢复（断点续传）
- 下载暂停/恢复（Range 请求续传）
- 暂停状态持久化（应用重启后可恢复）
- IndexedDB 缓存已下载分块

### 错误重试
- 自动重试网络错误和服务器临时不可用
- 指数退避 + 随机抖动策略
- 可配置重试次数和延迟

### 进度反馈
- 实时进度条和百分比
- 传输速度计算与显示
- 进度气泡组件（批量操作时右下角显示）
- 子项级别状态追踪

---

## 🎨 用户界面

### 视觉设计
- 现代化 UI 设计
- 深色/浅色/跟随系统三种主题
- shadcn/ui 组件库
- Framer Motion 流畅动画

### 文件浏览
- 列表视图 / 网格视图切换
- 文件图标自动识别（vscode-icons 风格）
- 面包屑路径导航（Win11 风格折叠）
- 响应式布局适配

### 文件浏览器
- 移动/复制对话框集成文件夹浏览器
- 可折叠侧边栏
- 跨桶操作支持
- 手动输入路径

---

## 💻 桌面端

### Tauri v2
- 使用系统 WebView2（Windows 10/11 内置）
- 体积小巧（约 5-15 MB）
- Sidecar 方式打包 Express 服务端

### 配置持久化
- 桌面端：配置存储到 `{Documents}/CloudFlareR2-Manager/config.json`
- 浏览器端：配置存储到 localStorage
- 自动迁移旧配置

### 安装包
- MSI 安装包
- NSIS 安装包（中文界面）
- 升级时自动关闭旧版本进程

---

## ⚙️ 设置与配置

### 凭证配置
- Account ID
- Access Key ID
- Secret Access Key
- 连接测试

### 传输设置
- 上传并发线程数（1-10）
- 下载并发线程数（1-10）
- 批量操作并发数（1-8）
- 分块大小配置

### 错误重试配置
- 最大重试次数
- 基础延迟时间
- 最大延迟时间

### 系统功能
- 重启服务
- 清除所有配置（危险操作）

---

## 🔧 开发与构建

### 开发模式
```bash
# 安装依赖
npm install
cd server && npm install && cd ..

# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:client  # 仅前端
npm run dev:server  # 仅后端
```

### 桌面端打包
```bash
# 完整打包流程
npm run release
```

---

## 📥 下载安装

### Windows 桌面版
从 [Releases](https://github.com/ONEGAYI/R2-Manager/releases) 页面下载：

- **MSI 安装包**: 标准安装程序
- **NSIS 安装包**: 中文界面安装程序

### Web 版
```bash
# 克隆项目
git clone https://github.com/ONEGAYI/R2-Manager.git
cd R2-Manager

# 安装依赖并启动
npm install
cd server && npm install && cd ..
npm run dev
```

---

## 🔑 获取 R2 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 R2 页面
3. 点击 "Manage R2 API Tokens"
4. 创建 API Token，获取：
   - Account ID
   - Access Key ID
   - Secret Access Key

---

## 📋 系统要求

### Web 版
- 现代浏览器（Chrome、Firefox、Edge、Safari）
- Node.js 18+

### 桌面版
- Windows 10/11
- WebView2 运行时（系统内置）

---

## 🔐 安全说明

- 凭证仅保存在本地（不上传到任何服务器）
- 桌面端配置文件存储在用户文档目录
- 后端代理服务器仅监听 localhost

---

## 📜 License

MIT License

---

## 🙏 致谢

- [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tauri](https://tauri.app/)
- [vscode-icons](https://github.com/vscode-icons/vscode-icons)

---

**完整变更记录请查看 [CHANGELOG.md](./CHANGELOG.md)**
