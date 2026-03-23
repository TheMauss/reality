@echo off
for /f "tokens=5" %%P in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000 :3001 :3002 "') do (
  echo Killing PID %%P
  taskkill /F /PID %%P
)
echo Done.
