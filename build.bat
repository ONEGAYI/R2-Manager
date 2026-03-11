@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║       CloudflareR2 Manager - Tauri Build Script           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: 设置代理（如果需要）
if defined HTTP_PROXY (
    echo [信息] 检测到代理设置: %HTTP_PROXY%
) else (
    echo [提示] 如需下载 Node.js 基础包，可设置代理:
    echo        PowerShell: $env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897"
    echo        CMD: set HTTP_PROXY=http://127.0.0.1:7897 ^& set HTTPS_PROXY=http://127.0.0.1:7897
    echo.
)

:: 检查 Node.js
echo [检查] Node.js 环境...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo        Node.js 已安装

:: 检查 Rust
echo [检查] Rust 环境...
where cargo >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Rust，请先安装 Rust
    echo 下载地址: https://rustup.rs/
    pause
    exit /b 1
)
echo        Rust 已安装
echo.

:: 步骤 1: 安装前端依赖
if not exist "node_modules" (
    echo [步骤 1/5] 安装前端依赖...
    call npm install
    if !errorlevel! neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [步骤 1/5] 前端依赖已存在，跳过安装
)

:: 步骤 2: 安装服务端依赖
if not exist "server\node_modules" (
    echo [步骤 2/5] 安装服务端依赖...
    cd server
    call npm install
    cd ..
    if !errorlevel! neq 0 (
        echo [错误] 服务端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [步骤 2/5] 服务端依赖已存在，跳过安装
)

:: 步骤 3: 确保 Tauri CLI 已安装
echo [步骤 3/5] 检查 Tauri CLI...
call npm list @tauri-apps/cli >nul 2>&1
if !errorlevel! neq 0 (
    echo        正在安装 Tauri CLI...
    call npm install -D @tauri-apps/cli
    if !errorlevel! neq 0 (
        echo [错误] Tauri CLI 安装失败
        pause
        exit /b 1
    )
) else (
    echo        Tauri CLI 已安装
)

:: 步骤 4: 构建前端
echo [步骤 4/5] 构建前端...
call npm run build
if !errorlevel! neq 0 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
echo        前端构建完成

:: 步骤 5: 打包 Sidecar（清理可能占用的缓存）
echo [步骤 5/5] 打包服务端 Sidecar...

:: 清理 pkg 缓存中的临时文件（避免 EBUSY 错误）
if exist "%USERPROFILE%\.pkg-cache\v18.5.0" (
    echo        清理 pkg 缓存中的临时文件...
    del /f /q "%USERPROFILE%\.pkg-cache\v18.5.0\*.tmp" 2>nul
)

:: 确保 binaries 目录存在
if not exist "src-tauri\binaries" mkdir src-tauri\binaries

call npm run build:server
if !errorlevel! neq 0 (
    echo [错误] 服务端打包失败
    pause
    exit /b 1
)
echo        Sidecar 打包完成

:: 打包 Tauri
echo.
echo ══════════════════════════════════════════════════════════════
echo 正在打包 Tauri 应用程序...
echo 这可能需要几分钟时间，请耐心等待...
echo ══════════════════════════════════════════════════════════════
echo.

call npm run build:tauri
if !errorlevel! neq 0 (
    echo [错误] Tauri 打包失败
    pause
    exit /b 1
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                    打包完成！                              ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║  安装包位置:                                               ║
echo ║  src-tauri\target\release\bundle\                          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: 打开输出目录
if exist "src-tauri\target\release\bundle" (
    explorer "src-tauri\target\release\bundle"
) else (
    echo [警告] 未找到打包输出目录
)

pause
