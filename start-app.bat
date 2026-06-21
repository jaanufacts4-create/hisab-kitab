@echo off
echo ========================================
echo    HISAB KITAB - Starting App
echo ========================================
echo.

echo [1] Installing backend dependencies...
cd /d %~dp0backend
call npm install
if errorlevel 1 (
    echo ERROR: Backend install failed!
    pause
    exit /b 1
)

echo.
echo [2] Starting Backend on port 4000...
start "Hisab-Kitab Backend" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 3 /nobreak > nul

echo [3] Installing frontend dependencies...
cd /d %~dp0frontend
if not exist node_modules call npm install

echo [4] Starting Frontend...
start "Hisab-Kitab Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo App is starting!
echo Open browser: http://localhost:5173
echo ========================================
pause
