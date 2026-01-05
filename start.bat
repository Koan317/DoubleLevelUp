@echo off
set PORT=7999

start "" /B python -m http.server %PORT%
start http://localhost:%PORT%/

echo 按下任意键关闭网络端口
pause >nul

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
  taskkill /PID %%a /F >nul 2>nul
)
