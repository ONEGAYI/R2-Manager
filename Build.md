# Tauri 桌面应用打包指南

> 本文档介绍如何将 Cloudflare R2 Manager 打包为 Windows 桌面应用程序。

## 目录

- [前置要求](#前置要求)
- [首次配置](#首次配置)
- [开发模式](#开发模式)
- [打包发布](#打包发布)
- [目录结构](#目录结构)
- [常见问题](#常见问题)

---

## 前置要求

### 1. 操作系统

- Windows 10 (1809+) 或 Windows 11
- 64 位系统 (x64)

### 2. 必需软件

| 软件 | 最低版本 | 用途 | 下载地址 |
|------|---------|------|---------|
| Node.js | 18.x | 前端构建 | https://nodejs.org/ |
| Rust | 1.70+ | Tauri 后端 | https://rustup.rs/ |
| Visual Studio Build Tools | 2022 | 编译原生模块 | https://visualstudio.microsoft.com/visual-cpp-build-tools/ |

### 3. 安装详细步骤

#### 3.1 Node.js

1. 下载 LTS 版本：https://nodejs.org/en/download/
2. 安装时勾选 "Add to PATH"
3. 验证安装：
   ```bash
   node --version   # 应显示 v18.x.x 或更高
   npm --version    # 应显示 9.x.x 或更高
   ```

#### 3.2 Rust

1. 下载 rustup-init.exe：https://rustup.rs/
2. 运行安装程序，选择默认选项 (1)
3. 重启终端使环境变量生效
4. 验证安装：
   ```bash
   rustc --version  # 应显示 rustc 1.70.0 或更高
   cargo --version  # 应显示 cargo 1.70.0 或更高
   ```

#### 3.3 Visual Studio Build Tools

1. 下载：https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. 运行安装程序
3. 在 "工作负载" 选项卡中勾选：
   - **"使用 C++ 的桌面开发"** (Desktop development with C++)
4. 点击安装（约 6-8 GB）

#### 3.4 WebView2 (Windows 11 已内置)

Windows 10 用户可能需要手动安装：
- 下载：https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## 首次配置

### 1. 克隆项目并安装依赖

```bash
# 进入项目目录
cd cloudflare-r2-manager

# 安装前端依赖
npm install

# 安装服务端依赖（自动执行 postinstall）
# 或手动安装：cd server && npm install && cd ..
```

### 2. 安装 Tauri CLI 和 pkg

```bash
# 安装 Tauri CLI（开发依赖）
npm install -D @tauri-apps/cli

# 安装 pkg（用于打包 Express 服务端）
npm install -D pkg
```

### 3. 初始化 Tauri

```bash
npx tauri init
```

按提示选择：
- App name: `CloudflareR2 Manager`
- Window title: `CloudflareR2 Manager`
- Web assets location: `../dist`
- Dev server URL: `http://localhost:5173`
- Frontend dev command: `npm run dev:client`
- Frontend build command: `npm run build`

---

## 开发模式

### 启动开发服务器

```bash
# 方式一：同时启动前后端（推荐用于 Web 开发）
npm run dev

# 方式二：启动 Tauri 开发模式（桌面应用预览）
npm run dev:tauri
```

开发模式下，Tauri 会：
1. 自动启动 Vite 开发服务器
2. 打开桌面应用窗口
3. 支持热重载（修改代码自动刷新）

---

## 打包发布

### 一键打包

```bash
npm run release
```

该命令会依次执行：
1. `npm run build` - 构建前端（Vite）
2. `npm run build:server` - 打包服务端为可执行文件
3. `tauri build` - 打包 Tauri 应用

### 打包产物

打包完成后，文件位于：

```
src-tauri/target/release/
├── cloudflare-r2-manager.exe     # 可执行文件（约 5-10 MB）
└── bundle/
    ├── msi/
    │   └── CloudflareR2 Manager_0.1.0_x64.msi  # MSI 安装包
    └── nsis/
        └── CloudflareR2 Manager_0.1.0_x64-setup.exe  # NSIS 安装包
```

### 分步打包（调试用）

如果需要分步执行：

```bash
# 1. 仅构建前端
npm run build

# 2. 仅打包服务端
npm run build:server

# 3. 仅打包 Tauri
npx tauri build

# 4. 打包 MSI 格式
npx tauri build --bundles msi

# 5. 打包 NSIS 格式
npx tauri build --bundles nsis
```

---

## 目录结构

打包后的项目结构：

```
cloudflare-r2-manager/
├── src/                          # React 前端源码
├── server/                       # Express 服务端源码 (CommonJS 格式，用于 pkg 打包)
├── src-tauri/                    # Tauri 配置（打包后生成）
│   ├── src/
│   │   └── main.rs              # Rust 入口文件
│   ├── binaries/                # Sidecar 可执行文件
│   │   └── server-x86_64-pc-windows-msvc.exe
│   ├── tauri.conf.json          # Tauri 配置文件
│   ├── Cargo.toml               # Rust 依赖配置
│   └── target/                  # 编译产物
│       └── release/
│           └── bundle/          # 最终安装包
├── dist/                         # 前端构建产物
├── package.json
├── Build.md                      # 本文档
└── CLAUDE.md
```

---

## 常见问题

### Q1: `tauri build` 报错 "linker 'link.exe' not found"

**原因**：未安装 Visual Studio Build Tools

**解决**：
1. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. 确保勾选 "使用 C++ 的桌面开发"
3. 重启终端后重试

### Q2: `pkg` 打包后运行报错 "Cannot find module"

**原因**：pkg 对 ES Module 支持有限，打包后的虚拟文件系统路径无法正确解析

**解决**：
- **服务端代码必须使用 CommonJS 格式**（`require`/`module.exports`）
- `server/package.json` 中**不要**设置 `"type": "module"`
- 使用 `require()` 替代 `import`
- 示例转换：
  ```javascript
  // ES Module (不兼容 pkg)
  import express from 'express'

  // CommonJS (兼容 pkg)
  const express = require('express')
  ```

**注意**：AWS SDK v3 等现代包同时支持 ESM 和 CJS，使用 `require()` 即可正常工作。

### Q3: 应用启动后白屏

**原因**：前端构建路径或服务端未启动

**解决**：
1. 检查 `src-tauri/tauri.conf.json` 中的 `distDir` 配置
2. 确认 `dist/` 目录存在且包含 `index.html`
3. 检查 Rust 代码中 sidecar 是否正确启动

### Q4: MSI 安装包太大

**原因**：包含了调试符号

**解决**：
在 `src-tauri/Cargo.toml` 中添加：
```toml
[profile.release]
strip = true        # 移除符号
lto = true          # 链接时优化
codegen-units = 1   # 更好的优化
```

### Q5: 如何更新版本号？

1. 修改 `package.json` 中的 `version`
2. 修改 `src-tauri/tauri.conf.json` 中的 `version`
3. 修改 `src-tauri/Cargo.toml` 中的 `version`
4. 重新运行 `npm run release`

### Q6: Windows Defender 报毒

**原因**：未签名的可执行文件可能被误报

**解决**：
1. 临时：添加排除项
2. 长期：购买代码签名证书并签名

---

## 版本要求快速检查

运行以下命令检查环境：

```bash
# 检查 Node.js
node --version    # 需要 >= 18.0.0

# 检查 Rust
rustc --version   # 需要 >= 1.70.0

# 检查 Visual Studio
# 打开 "Developer Command Prompt for VS 2022"
# 运行: cl
# 应显示 "Microsoft (R) C/C++ Optimizing Compiler"

# 检查 WebView2
# Windows 11 已内置
# Windows 10: 在控制面板 -> 程序中查找 "Microsoft Edge WebView2 Runtime"
```

---

## 相关链接

- [Tauri 官方文档](https://tauri.app/v1/guides/)
- [Tauri Sidecar 指南](https://tauri.app/v1/guides/building/sidecar/)
- [pkg 文档](https://github.com/vercel/pkg)
- [Rust 安装指南](https://www.rust-lang.org/tools/install)

---

*最后更新: 2026-03-11*
