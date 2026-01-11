@echo off
REM ARK Locator Run Script for Windows

echo 🎮 Starting ARK Locator...

REM Check if node_modules exists
if not exist "node_modules" (
    echo ❌ Dependencies not installed!
    echo    Please run 'setup.bat' first.
    pause
    exit /b 1
)

REM Start the app
npm start