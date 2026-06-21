@echo off
echo ========================================
echo    HISAB KITAB - SETUP CHECK
echo ========================================
echo.

echo [1] Checking Node.js...
node --version 2>nul && echo Node.js OK! || echo ERROR: Node.js not found!
echo.

echo [2] Checking MySQL Service...
sc query MySQL 2>nul | find "RUNNING" >nul && echo MySQL Service: RUNNING! || echo MySQL Service: NOT RUNNING or not installed!
sc query MySQL80 2>nul | find "RUNNING" >nul && echo MySQL80 Service: RUNNING!
echo.

echo [3] Checking npm in backend...
cd /d %~dp0backend
if exist node_modules (
    echo node_modules: EXISTS
) else (
    echo node_modules: MISSING - need to run npm install
)
echo.

echo [4] Trying to start backend...
echo --- Backend output below ---
node server.js
echo.
echo ========================================
echo Press any key to close...
pause
