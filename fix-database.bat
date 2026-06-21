@echo off
echo ========================================
echo    HISAB KITAB - Database Fix
echo ========================================
echo.

echo [1] Checking MySQL...
mysql --version 2>nul
if errorlevel 1 (
    echo ERROR: MySQL not found in PATH!
    echo Please check if MySQL is installed.
    goto :end
)

echo MySQL found! Setting up database...
echo.

echo [2] Creating database and user...
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS hisab_kitab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'hisab_app'@'localhost' IDENTIFIED BY 'hisab_dev_pass'; GRANT ALL PRIVILEGES ON hisab_kitab.* TO 'hisab_app'@'localhost'; FLUSH PRIVILEGES;"

echo.
echo [3] Creating tables from schema...
mysql -u root -p hisab_kitab < "%~dp0schema.sql"

echo.
echo Done! Now try registering again.

:end
echo.
pause
