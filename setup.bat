@echo off
REM ARK Locator Setup Script for Windows
REM This script helps new users get the app running quickly

echo 🚀 ARK Locator Setup
echo ====================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed!
    echo.
    echo npm usually comes with Node.js. Please reinstall Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Check Node.js version (should be 16+)
for /f "tokens=1 delims=v." %%i in ('node --version') do set NODE_MAJOR=%%i
if %NODE_MAJOR% lss 16 (
    echo ⚠️  Node.js version %NODE_MAJOR% detected. Version 16 or higher is recommended.
    echo    You can continue, but some features might not work properly.
)

echo.
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies!
    echo    Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo ✅ Setup complete!
echo.
echo 🎮 To run the app:
echo    npm start
echo.
echo 💡 The app will open in a new window.
echo    You can also run 'npm run restart' to restart if needed.
echo.
echo 📖 For more information, see README.md

pause