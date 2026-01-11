#!/bin/bash

# ARK Locator Setup Script
# This script helps new users get the app running quickly

echo "🚀 ARK Locator Setup"
echo "===================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Then run this script again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    echo ""
    echo "npm usually comes with Node.js. Please reinstall Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Check Node.js version (should be 16+)
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️  Node.js version $NODE_VERSION detected. Version 16 or higher is recommended."
    echo "   You can continue, but some features might not work properly."
fi

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies!"
    echo "   Please check your internet connection and try again."
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎮 To run the app:"
echo "   npm start"
echo ""
echo "💡 The app will open in a new window."
echo "   You can also run 'npm run restart' to restart if needed."
echo ""
echo "📖 For more information, see README.md"