@echo off
chcp 65001 >nul
echo 正在关闭 Node.js 进程...

:: 查找占用 3001 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo 发现端口 3001 被进程 %%a 占用，正在终止...
    taskkill /F /PID %%a 2>nul
)

:: 查找占用 5173 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo 发现端口 5173 被进程 %%a 占用，正在终止...
    taskkill /F /PID %%a 2>nul
)

echo 清理完成！
pause
