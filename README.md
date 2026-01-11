# ARK Locator

An Electron-based application for managing ARK: Survival Evolved waypoints and markers across different maps.

## 🚀 Quick Start (Easiest Way)

### Option 1: One-Click Setup (Recommended)

1. **Download the app:**

    - Go to [Releases](https://github.com/jonschr/ark-locator/releases)
    - Download the installer for your platform (.exe for Windows, .dmg for macOS)
    - Run the installer and follow the setup wizard

2. **Launch the app:**
    - Find "ARK Locator" in your applications menu
    - Click to open - that's it!

### Option 2: From Source Code

#### Windows Users:

1. Download and extract the ZIP from [GitHub](https://github.com/jonschr/ark-locator)
2. Double-click `setup.bat` and wait for it to complete
3. Double-click `run.bat` to start the app

#### macOS Users:

1. Download and extract the ZIP from [GitHub](https://github.com/jonschr/ark-locator)
2. Open Terminal in the extracted folder
3. Run: `./setup.sh`
4. Run: `./run.sh` or `npm start`

## 📋 Manual Setup (Advanced)

If the automated scripts don't work:

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or higher)

### Installation Steps

```bash
# Clone or download the repository
git clone https://github.com/jonschr/ark-locator.git
cd ark-locator

# Install dependencies
npm install

# Start the app
npm start
```

## 🎮 How to Use

-   **Select Map:** Use the dropdown to switch between different ARK maps
-   **Add Markers:** Double-click on the map to add custom markers
-   **Manage Categories:** Create and organize marker categories with custom colors and icons
-   **Preset Data:** The app loads preset locations for common resources and points of interest
-   **Resize Interface:** Drag the sidebar edge to adjust the panel width
-   **Auto-Updates:** The app automatically checks for updates on startup

## 🛠️ Development

### Available Scripts

-   `npm start` - Start the development version
-   `npm run restart` - Kill existing instances and restart
-   `npm run dist` - Build distributable packages for all platforms
-   `npm run publish` - Build and publish to GitHub releases

### Project Structure

-   `main.js` - Electron main process (window management, IPC, file operations)
-   `renderer.js` - Frontend logic (map interaction, marker management)
-   `index.html` - Main UI layout
-   `styles.css` - Application styling
-   `data/presets/` - JSON files containing preset marker data for each map
-   `assets/` - Images, icons, and other static assets

📖 **Detailed Build Guide:** See [BUILD.md](BUILD.md) for comprehensive documentation on building, CI/CD, and distribution.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License

## 🆘 Troubleshooting

**App won't start?**

-   Make sure Node.js v16+ is installed
-   Try running `npm install` again
-   Check that no other instances are running

**Markers not showing?**

-   Try resizing the window - markers reposition automatically
-   Check that the map loaded properly
-   Verify preset data files exist in `data/presets/`

**Performance issues?**

-   Close other applications
-   Make sure you have enough RAM (2GB recommended)
-   Try restarting the app
