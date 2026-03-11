@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║       CloudflareR2 Manager - 清理构建产物                  ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

set /a total_saved=0

:: 清理 Tauri/Rust 编译产物
if exist "src-tauri\target" (
    echo [清理] src-tauri\target\ ...
    for /f %%A in ('dir /s "src-tauri\target" 2^>nul ^| findstr /C:"File(s)"') do set size_str=%%A
    echo         释放空间: !size_str! 字节
    rmdir /s /q "src-tauri\target" 2>nul
    if !errorlevel! equ 0 (
        echo         ✓ 已删除
    ) else (
        echo         ✗ 删除失败（可能有进程占用）
    )
) else (
    echo [跳过] src-tauri\target\ 不存在
)

:: 清理前端构建产物
if exist "dist" (
    echo [清理] dist\ ...
    rmdir /s /q "dist" 2>nul
    echo         ✓ 已删除
) else (
    echo [跳过] dist\ 不存在
)

:: 清理 node_modules 缓存
if exist "node_modules\.vite" (
    echo [清理] node_modules\.vite\ ...
    rmdir /s /q "node_modules\.vite" 2>nul
    echo         ✓ 已删除
)

:: 清理 pkg 缓存
if exist "%USERPROFILE%\.pkg-cache" (
    echo [清理] %USERPROFILE%\.pkg-cache\ ...
    rmdir /s /q "%USERPROFILE%\.pkg-cache" 2>nul
    echo         ✓ 已删除
) else (
    echo [跳过] .pkg-cache 不存在
)

:: 清理 sidecar 二进制文件（可选）
if exist "src-tauri\binaries\server-x86_64-pc-windows-msvc.exe" (
    echo.
    set /p clean_bin="是否清理 sidecar 二进制文件？下次打包需要重新生成 [y/N]: "
    if /i "!clean_bin!"=="y" (
        del /f /q "src-tauri\binaries\*.exe" 2>nul
        echo         ✓ 已删除
    )
)

echo.
echo ══════════════════════════════════════════════════════════════
echo 清理完成！
echo 提示: 运行 npm run build 或 build.bat 可重新生成构建产物
echo ══════════════════════════════════════════════════════════════
echo.

pause
