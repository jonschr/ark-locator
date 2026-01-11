# Build Guide for ARK Locator

This document covers all aspects of building, testing, and distributing the ARK Locator Electron application.

## Table of Contents

-   [Development Setup](#development-setup)
-   [Local Development](#local-development)
-   [Building Distributables](#building-distributables)
-   [Automated CI/CD](#automated-cicd)
-   [Publishing Releases](#publishing-releases)
-   [Build Configuration](#build-configuration)
-   [Troubleshooting](#troubleshooting)

## Development Setup

### Prerequisites

-   **Node.js**: v16 or higher (v18 recommended)
-   **Git**: For version control
-   **Code Editor**: VS Code recommended with Electron extensions

### Initial Setup

1. **Clone the repository:**

    ```bash
    git clone https://github.com/jonschr/ark-locator.git
    cd ark-locator
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Verify installation:**
    ```bash
    node --version
    npm --version
    ```

## Local Development

### Available Scripts

| Script            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `npm start`       | Start the development version of the app       |
| `npm run restart` | Kill existing instances and restart the app    |
| `npm run dist`    | Build distributable packages for all platforms |
| `npm run publish` | Build and publish to GitHub releases           |

### Development Workflow

1. **Start development:**

    ```bash
    npm start
    ```

2. **Make changes** to `renderer.js`, `main.js`, or other files

3. **Restart the app** (changes require restart):

    ```bash
    npm run restart
    ```

4. **Test functionality** - markers, zoom, map switching, etc.

### Project Structure

```
ark-locator/
├── main.js              # Electron main process
├── renderer.js          # Frontend logic and map interaction
├── index.html           # Main UI layout
├── styles.css           # Application styling
├── package.json         # Dependencies and build configuration
├── data/presets/        # JSON files with preset marker data
├── assets/              # Images, icons, and static assets
├── .github/workflows/   # CI/CD pipeline configuration
└── dist/                # Build output (generated)
```

## Building Distributables

### Manual Build Process

To create installable packages for distribution:

```bash
npm run dist
```

This command uses **electron-builder** to create platform-specific packages:

#### Windows

-   **Format**: NSIS installer (`.exe`)
-   **Output**: `ARK Locator Setup 0.2.1.exe`
-   **Size**: ~200MB
-   **Installation**: Standard Windows installer with uninstaller

#### macOS

-   **Format**: DMG disk image (`.dmg`)
-   **Output**: `ARK Locator-0.2.1-arm64.dmg`
-   **Size**: ~200MB
-   **Installation**: Drag to Applications folder

#### Linux

-   **Format**: Debian package (`.deb`)
-   **Output**: `ark-locator_0.2.3_amd64.deb`
-   **Size**: ~200MB
-   **Installation**: `sudo dpkg -i ark-locator_0.2.3_amd64.deb`

### Build Output Location

All build artifacts are placed in the `dist/` directory:

```
dist/
├── ARK Locator-0.2.3-arm64.dmg          # macOS installer
├── ARK Locator-0.2.3-arm64-mac.zip      # macOS portable
├── ARK Locator Setup 0.2.3.exe          # Windows installer
├── ark-locator_0.2.3_amd64.deb          # Linux package
├── builder-debug.yml                    # Build debug info
├── builder-effective-config.yaml        # Effective build config
└── latest-mac.yml                       # Auto-updater manifest
```

### Build Configuration

The build process is configured in `package.json` under the `"build"` section:

```json
{
	"build": {
		"appId": "com.jonschr.ark-locator",
		"productName": "ARK Locator",
		"directories": {
			"output": "dist"
		},
		"publish": {
			"provider": "github",
			"owner": "jonschr",
			"repo": "ark-locator"
		},
		"mac": {
			"category": "public.app-category.utilities"
		},
		"win": {
			"target": "nsis"
		},
		"linux": {
			"target": "AppImage"
		}
	}
}
```

## Automated CI/CD

### GitHub Actions Workflow

The project uses GitHub Actions for automated building and releasing. The workflow is defined in `.github/workflows/build.yml`.

#### Trigger Conditions

The CI/CD pipeline runs automatically when:

-   A version tag is pushed (e.g., `v0.2.1`, `v1.0.0`)
-   The tag follows semantic versioning format

#### Build Matrix

The workflow builds on three platforms simultaneously:

-   **macOS** (latest)
-   **Windows** (latest)
-   **Ubuntu Linux** (latest)

#### Workflow Steps

1. **Checkout code** from the tagged commit
2. **Setup Node.js** v18 with npm caching
3. **Install dependencies** using `npm ci`
4. **Build distributables** using `npm run dist`
5. **Upload artifacts** for each platform

#### Environment Variables

-   `GH_TOKEN`: Automatically provided by GitHub for authentication

### Release Process

1. **Make changes** and commit them
2. **Update version** in `package.json`
3. **Commit version bump:**
    ```bash
    git add package.json
    git commit -m "Bump version to 0.2.1"
    ```
4. **Create and push tag:**
    ```bash
    git tag v0.2.1
    git push origin v0.2.1
    ```
5. **Monitor build** at: https://github.com/jonschr/ark-locator/actions
6. **Download artifacts** from the workflow run

## Publishing Releases

### Manual Publishing

If you need to publish manually (not recommended for regular releases):

```bash
npm run publish
```

This builds and publishes directly to GitHub releases.

### GitHub Release Creation

1. **Go to Releases:** https://github.com/jonschr/ark-locator/releases

2. **Create new release:**

    - Click "Create a new release"
    - **Tag**: `v0.2.1` (must match package.json version)
    - **Title**: `ARK Locator v0.2.1`
    - **Description**: Release notes and changelog

3. **Upload build artifacts:**

    - `ARK Locator-0.2.1-arm64.dmg`
    - `ARK Locator Setup 0.2.1.exe`
    - `ARK Locator-0.2.1.AppImage`

4. **Publish release**

### Auto-Updater

The app uses **electron-updater** for automatic updates:

-   **Manifest**: `latest-mac.yml` (generated during build)
-   **Update Check**: Happens automatically on app startup
-   **Update Source**: GitHub releases
-   **Supported**: macOS and Windows (Linux users download manually)

## Build Configuration

### Electron Builder Options

| Option               | Description                     |
| -------------------- | ------------------------------- |
| `appId`              | Unique application identifier   |
| `productName`        | Display name of the application |
| `directories.output` | Build output directory          |
| `publish.provider`   | Publishing platform (GitHub)    |
| `mac.category`       | macOS app category              |
| `win.target`         | Windows installer type          |
| `linux.target`       | Linux package format            |

### Environment Variables

For advanced builds, you can set:

-   `GH_TOKEN`: GitHub personal access token for publishing
-   `CSC_LINK`: Code signing certificate (for signed releases)
-   `CSC_KEY_PASSWORD`: Certificate password

## Troubleshooting

### Build Issues

**"electron-builder command not found"**

```bash
npm install
# or specifically
npm install electron-builder --save-dev
```

**"Cannot create directory" errors**

```bash
# Clean previous builds
rm -rf dist/
npm run dist
```

**Large build sizes**

-   Expected size is ~200MB per platform
-   Includes Electron runtime + dependencies
-   Cannot be significantly reduced

### CI/CD Issues

**Workflow doesn't trigger**

-   Ensure tag format is `v{major}.{minor}.{patch}`
-   Push tag to remote: `git push origin v0.2.1`

**Build fails on Ubuntu/Linux**

-   **Cause**: Missing system dependencies for electron-builder
-   **Solution**: The workflow now installs required packages automatically
-   **Changed target**: Now builds `.deb` package instead of AppImage to avoid fuse issues
-   **Manual fix**: If building locally on Linux, install dependencies:
    ```bash
    sudo apt-get update
    sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2 libgtk-3-0 libx11-xcb1
    ```

**Build fails on specific platform**

-   Check GitHub Actions logs
-   Verify Node.js compatibility
-   Check for platform-specific dependencies

### Publishing Issues

**"Release already exists"**

-   Increment version number in package.json
-   Use unique tag for each release

**Auto-updater not working**

-   Verify `latest-mac.yml` is uploaded with release
-   Check that version numbers follow semantic versioning
-   Ensure release tag matches package.json version

### Development Issues

**App won't start**

```bash
# Kill existing processes
npm run restart
# or manually
pkill -f "electron.*ark-locator"
npm start
```

**Changes not reflecting**

-   Restart the app (Electron doesn't hot-reload)
-   Clear any cached files
-   Check for syntax errors with `node -c renderer.js`

---

For questions or issues, please check existing GitHub issues or create a new one.</content>
<parameter name="filePath">/Users/jonschroeder/Local Sites/ark-locator/BUILD.md
