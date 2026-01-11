# Publishing ARK Locator

## Creating a GitHub Release

1. **Build the distributables:**

    ```bash
    npm run dist
    ```

2. **Go to GitHub Releases:**

    - Visit: https://github.com/jonschr/ark-locator/releases
    - Click "Create a new release"

3. **Fill in release details:**

    - **Tag version:** `v0.2.0` (or next version)
    - **Release title:** `ARK Locator v0.2.0`
    - **Description:** Copy from changelog or write release notes

4. **Upload the files:**

    - `dist/ARK Locator-0.2.0-arm64.dmg` (macOS)
    - `dist/ARK Locator-0.2.0-arm64-mac.zip` (macOS portable)
    - For Windows: `ARK Locator Setup 0.2.0.exe`
    - For Linux: `ARK Locator-0.2.0.AppImage`

5. **Publish the release**

## Auto-Updater

The app uses electron-updater for automatic updates. When you publish a new release on GitHub, users will be notified automatically.

Make sure the release tag follows semantic versioning (e.g., `v1.0.0`, `v1.1.0`, `v2.0.0`).
