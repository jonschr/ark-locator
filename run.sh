#!/bin/bash

# ARK Locator Run Script
# Simple script to start the app

echo "🎮 Starting ARK Locator..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed!"
    echo "   Please run './setup.sh' first."
    exit 1
fi

# Start the app
npm start