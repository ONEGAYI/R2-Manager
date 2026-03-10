# Cloudflare R2 Manager - 开发日志

> 本文档记录项目的完整开发过程，包括文件状态、开发进度和技术决策。

## 项目概述

一个现代化的 Cloudflare R2 存储桶管理工具，提供可视化操作界面，支持桶管理、文件上传/下载/删除/预览等功能。

### 技术栈
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS + shadcn/ui
- **动效**: Framer Motion
- **状态**: Zustand (带 localStorage 持久化)
- **API**: AWS S3 SDK (兼容 R2)

---

## 📁 项目文件树

### 图例
- ✅ 已完成（功能完整）
- 🚧 进行中（部分完成）
- ⏳ 待开发（仅占位）
- ❌ 有问题（需要修复）

```
cloudflare-r2-manager/
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 ui/                    # shadcn/ui 基础组件
│   │   │   ├── button.tsx            ✅ 按钮组件
│   │   │   ├── input.tsx             ✅ 输入框组件
│   │   │   ├── card.tsx              ✅ 卡片组件
│   │   │   ├── dialog.tsx            ✅ 对话框组件
│   │   │   ├── alert-dialog.tsx      ✅ 警告对话框
│   │   │   ├── toast.tsx             ✅ 提示组件
│   │   │   ├── dropdown-menu.tsx     ✅ 下拉菜单
│   │   │   └── table.tsx             ✅ 表格组件
│   │   │
│   │   ├── 📁 layout/                # 布局组件
│   │   │   ├── Sidebar.tsx           ✅ 侧边栏（含设置入口）
│   │   │   ├── Header.tsx            ✅ 顶部栏
│   │   │   └── MainLayout.tsx        ✅ 主布局
│   │   │
│   │   ├── 📁 config/                # 配置组件 [新增]
│   │   │   ├── ConfigPage.tsx        ✅ GUI 配置页面
│   │   │   └── SettingsDialog.tsx    ✅ 设置对话框
│   │   │
│   │   ├── 📁 bucket/                # 桶操作组件
│   │   │   ├── BucketList.tsx        ✅ 桶列表
│   │   │   ├── BucketCard.tsx        ✅ 桶卡片
│   │   │   └── CreateBucket.tsx      ✅ 创建桶
│   │   │
│   │   ├── 📁 file/                  # 文件操作组件
│   │   │   ├── FileList.tsx          ✅ 文件列表视图
│   │   │   ├── FileGrid.tsx          ✅ 文件网格视图
│   │   │   ├── FileUploader.tsx      ✅ 上传组件
│   │   │   └── FilePreview.tsx       ✅ 预览组件
│   │   │
│   │   └── 📁 common/                # 通用组件
│   │       ├── Loading.tsx           ✅ 加载动画
│   │       ├── Empty.tsx             ✅ 空状态
│   │       └── ConfirmDialog.tsx     ✅ 确认对话框
│   │
│   ├── 📁 hooks/                     # 自定义 Hooks
│   │   ├── useConfig.ts              ✅ 配置管理（含凭证）
│   │   ├── useBuckets.ts             ✅ 桶操作
│   │   ├── useFiles.ts               ✅ 文件操作
│   │   └── useUpload.ts              ✅ 上传逻辑
│   │
│   ├── 📁 services/                  # API 服务层
│   │   ├── r2Client.ts               ✅ R2 客户端
│   │   ├── bucketService.ts          ✅ 桶 CRUD
│   │   └── fileService.ts            ✅ 文件 CRUD
│   │
│   ├── 📁 stores/                    # Zustand 状态
│   │   ├── configStore.ts            ✅ 配置状态（含凭证持久化）
│   │   ├── bucketStore.ts            ✅ 桶状态
│   │   └── fileStore.ts              ✅ 文件状态
│   │
│   ├── 📁 types/                     # TypeScript 类型
│   │   ├── config.ts                 ✅ 配置类型（含凭证）
│   │   ├── bucket.ts                 ✅ 桶类型
│   │   └── file.ts                   ✅ 文件类型
│   │
│   ├── 📁 lib/                       # 工具库
│   │   ├── cn.ts                     ✅ classnames
│   │   └── utils.ts                  ✅ 工具函数
│   │
│   ├── 📁 styles/
│   │   └── globals.css               ✅ 全局样式
│   │
│   ├── App.tsx                       ✅ 主应用
│   ├── main.tsx                      ✅ 入口文件
│   └── vite-env.d.ts                 ✅ 类型声明
│
├── 📁 public/
│   └── favicon.svg                   ✅ 图标
│
├── .env.example                      ✅ 环境变量示例
├── .gitignore                        ✅ Git 忽略（含敏感文件）
├── index.html                        ✅ HTML 入口
├── package.json                      ✅ 依赖配置
├── tsconfig.json                     ✅ TS 配置
├── tsconfig.node.json                ✅ Node TS 配置
├── tailwind.config.js                ✅ Tailwind 配置
├── postcss.config.js                 ✅ PostCSS 配置
├── vite.config.ts                    ✅ Vite 配置
├── components.json                   ✅ shadcn 配置
└── CLAUDE.md                         ✅ 本文档
```

---

## 📋 开发日志

### 2026-03-10 - 后端代理架构重构

#### 问题背景
原架构在浏览器中直接调用 R2 S3 API， 受到 CORS 跨域限制， 导致连接失败.

#### 解决方案
采用 **前后端分离架构**:
- **前端**: React + Vite (localhost:5173)
- **后端**: Express.js 代理服务器 (localhost:3001)

#### 完成内容

1. **后端代理服务器** (`server/`)
   - `index.js`: Express 服务器, 代理所有 R2 API 请求
   - `package.json`: 服务端依赖配置
   - 支持操作: 配置凭证、测试连接、桶CRUD、文件CRUD、预签名URL

2. **前端 API 服务** (`src/services/api.ts`)
   - 封装所有后端 API 调用
   - 统一错误处理
   - 类型安全

3. **服务层重构**
   - `bucketService.ts`: 改为调用后端代理
   - `fileService.ts`: 改为调用后端代理
   - `useFiles.ts`: 移除 S3Client 依赖

4. **Header 组件增强**
   - 返回上一级按钮
   - 路径面包屑导航 (点击跳转)
   - 复制路径按钮 (带成功提示)
   - 半透明椭圆样式 + hover 动效

5. **启动脚本更新**
   - `npm run dev`: 同时启动前后端
   - `npm run dev:client`: 仅启动前端
   - `npm run dev:server`: 仅启动后端

#### 技术决策

1. **为什么使用后端代理?**
   - 绕过浏览器 CORS 限制
   - 凭证不暴露给浏览器 (更安全)
   - 便于后续扩展 (缓存、日志等)

2. **为什么用 Express?**
   - 轻量、简单
   - 与 AWS SDK 兼容性好
   - 开发体验优秀

---

### 2026-03-10 - GUI 配置功能

#### 完成内容
1. **GUI 配置页面** (`ConfigPage.tsx`)
   - 网页内直接配置 R2 凭证（Account ID、Access Key、Secret Key）
   - 连接测试功能
   - 保存后自动初始化客户端

2. **凭证持久化** (`configStore.ts`)
   - 使用 Zustand persist 中间件
   - 自动保存到 localStorage
   - 页面刷新后自动恢复

3. **设置对话框** (`SettingsDialog.tsx`)
   - 侧边栏设置按钮入口
   - 查看和修改已保存的凭证
   - 清除凭证功能（退出登录）

4. **安全措施**
   - `.gitignore` 更新，排除敏感文件
   - 界面提示"凭证仅保存在本地"

#### 技术决策
1. **为什么使用 localStorage？**
   - 浏览器原生支持，无需额外依赖
   - 数据持久化，关闭浏览器后仍存在
   - 不会随代码上传到 GitHub

2. **凭证安全性**
   - 前端存储本身不加密（明文）
   - 适合个人开发/本地使用
   - 如需更高安全性，考虑使用 Tauri 打包为桌面应用

---

### 2026-03-10 - 项目初始化

#### 完成内容
1. **项目脚手架搭建**
   - 初始化 Vite + React + TypeScript 项目
   - 配置 Tailwind CSS 和 PostCSS
   - 配置路径别名 `@/` 指向 `src/`

2. **基础架构设计**
   - 服务层：`r2Client.ts`, `bucketService.ts`, `fileService.ts`
   - 状态层：Zustand stores (config, bucket, file)
   - 类型定义：完整的 TypeScript 类型
   - 工具函数：格式化、文件处理等

3. **UI 组件库**
   - shadcn/ui 基础组件 (button, input, card, dialog 等)
   - 布局组件 (Sidebar, Header, MainLayout)
   - 业务组件 (BucketList, FileList, FileUploader 等)
   - 通用组件 (Loading, Empty, ConfirmDialog)

4. **动效实现**
   - Framer Motion 动画
   - 列表项入场动画
   - 交互反馈动画

#### 技术决策记录
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

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 在浏览器中打开，首次使用会显示配置页面
# 填入 R2 凭证后自动保存到本地

# 构建生产版本
npm run build
```

### 获取 R2 凭证
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 R2 页面
3. 点击 "Manage R2 API Tokens"
4. 创建 API Token，获取：
   - Access Key ID
   - Secret Access Key
   - Account ID（在 R2 概览页面）

---

## 📝 后续开发计划

### Phase 1: 核心功能 (大部分完成)
- [x] 项目架构
- [x] 基础 UI 组件
- [x] 桶列表展示
- [x] 文件列表展示
- [x] GUI 配置页面
- [x] 凭证持久化
- [ ] 实际 API 调用测试

### Phase 2: 交互完善
- [ ] 文件上传进度
- [ ] 文件下载功能
- [ ] 文件预览功能
- [ ] 批量操作

### Phase 3: 体验优化
- [ ] 深色模式完善
- [ ] 响应式布局
- [ ] 键盘快捷键
- [ ] 拖拽上传

### Phase 4: 高级功能
- [ ] 多账户管理
- [ ] 文件搜索
- [ ] 访问统计
- [ ] CDN 配置

---

*最后更新: 2026-03-10*
