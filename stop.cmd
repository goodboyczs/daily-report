@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo 🛑 正在关闭服务...

REM 查找所有node.exe进程
for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    echo 找到 Node.js 进程，ID: %%a
    taskkill /PID %%a /F
    if errorlevel 1 (
        echo ❌ 关闭进程 %%a 失败
    ) else (
        echo ✅ 进程 %%a 已关闭
    )
)

echo.
echo 完成！如果仍未关闭，请尝试以下方式：
echo 1. 用管理员身份运行此脚本
echo 2. 手动在任务管理器中关闭 node.exe 进程
pause
