const {
	app,
	BrowserWindow,
	ipcMain,
	dialog,
	nativeImage,
	shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Default paths where ARK saves waypoints (ASA uses different paths than ASE)
const getDefaultArkPaths = () => {
	const home = os.homedir();
	if (process.platform === 'win32') {
		return [
			path.join(
				home,
				'AppData',
				'Local',
				'ARK Survival Ascended',
				'Saved',
				'Config',
				'Windows'
			),
			path.join(
				home,
				'AppData',
				'Local',
				'Ark Survival Ascended',
				'Saved',
				'LocalProfiles'
			),
		];
	} else if (process.platform === 'darwin') {
		return [
			path.join(
				home,
				'Library',
				'Application Support',
				'ARK Survival Ascended',
				'Saved',
				'Config'
			),
		];
	}
	return [];
};

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 900,
		minHeight: 600,
		title: 'ARK Locator',
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
		backgroundColor: '#0a0a0f',
		titleBarStyle: 'hiddenInset',
	});

	mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
	// Set dock icon on macOS
	if (process.platform === 'darwin') {
		const iconPath = path.join(__dirname, 'assets', 'icons', 'icon.png');
		if (fs.existsSync(iconPath)) {
			const icon = nativeImage.createFromPath(iconPath);
			app.dock.setIcon(icon);
		}
	}

	createWindow();

	// Setup auto-updater
	autoUpdater.checkForUpdatesAndNotify();

	autoUpdater.on('update-available', () => {
		mainWindow.webContents.send('update-available');
	});

	autoUpdater.on('update-downloaded', () => {
		mainWindow.webContents.send('update-downloaded');
	});

	autoUpdater.on('error', (error) => {
		console.error('Auto-updater error:', error);
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// IPC Handlers

// Get default ARK paths to check
ipcMain.handle('get-default-paths', () => {
	return getDefaultArkPaths();
});

// Check if a path exists
ipcMain.handle('check-path-exists', (event, filePath) => {
	return fs.existsSync(filePath);
});

// List files in a directory
ipcMain.handle('list-directory', (event, dirPath) => {
	try {
		if (fs.existsSync(dirPath)) {
			const files = fs.readdirSync(dirPath);
			return { success: true, files };
		}
		return { success: false, error: 'Directory not found' };
	} catch (err) {
		return { success: false, error: err.message };
	}
});

// Open file dialog
ipcMain.handle('open-file-dialog', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openFile'],
		filters: [
			{ name: 'INI Files', extensions: ['ini'] },
			{ name: 'All Files', extensions: ['*'] },
		],
	});
	return result;
});

// Open directory dialog
ipcMain.handle('open-directory-dialog', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory'],
	});
	return result;
});

// Read file contents
ipcMain.handle('read-file', (event, filePath) => {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		return { success: true, content };
	} catch (err) {
		return { success: false, error: err.message };
	}
});

// Export waypoints to JSON on desktop
ipcMain.handle('export-to-desktop', (event, data, filename) => {
	try {
		const desktopPath = path.join(os.homedir(), 'Desktop');
		const filePath = path.join(desktopPath, filename);
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
		return { success: true, path: filePath };
	} catch (err) {
		return { success: false, error: err.message };
	}
});

// Get desktop path
ipcMain.handle('get-desktop-path', () => {
	return path.join(os.homedir(), 'Desktop');
});

// Restart the app
ipcMain.on('restart-app', () => {
	app.relaunch();
	app.exit(0);
});

// Check for updates from GitHub
ipcMain.handle('check-for-updates', () => {
	return new Promise((resolve) => {
		const options = {
			hostname: 'api.github.com',
			path: '/repos/jonschr/ark-locator/tags',
			method: 'GET',
			headers: {
				'User-Agent': 'ARK-Locator-App',
				Accept: 'application/vnd.github.v3+json',
			},
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					if (res.statusCode === 404) {
						// No tags found
						resolve({
							success: true,
							version: null,
							url: null,
							body: null,
						});
						return;
					}

					const tags = JSON.parse(data);

					// Filter and sort version tags
					const versionTags = tags
						.map((tag) => tag.name)
						.filter(
							(name) =>
								/^\d+\.\d+/.test(name) ||
								/^v\d+\.\d+/.test(name)
						) // Match version patterns like 1.0, v1.0, 0.1, etc.
						.map((name) => ({
							name: name,
							version: name.replace(/^v/, ''), // Remove 'v' prefix for comparison
						}))
						.sort((a, b) => {
							// Sort by semantic version (newest first)
							const aParts = a.version.split('.').map(Number);
							const bParts = b.version.split('.').map(Number);

							for (
								let i = 0;
								i < Math.max(aParts.length, bParts.length);
								i++
							) {
								const aPart = aParts[i] || 0;
								const bPart = bParts[i] || 0;

								if (aPart > bPart) return -1;
								if (aPart < bPart) return 1;
							}

							return 0;
						});

					if (versionTags.length === 0) {
						// No version tags found
						resolve({
							success: true,
							version: null,
							url: null,
							body: null,
						});
						return;
					}

					const latestTag = versionTags[0];
					const releaseUrl = `https://github.com/jonschr/ark-locator/releases/tag/${latestTag.name}`;

					resolve({
						success: true,
						version: latestTag.name,
						url: releaseUrl,
						body: `Latest version: ${latestTag.name}`,
					});
				} catch (err) {
					resolve({
						success: false,
						error: 'Failed to parse response',
					});
				}
			});
		});

		req.on('error', (err) => {
			resolve({ success: false, error: err.message });
		});

		req.setTimeout(10000, () => {
			req.destroy();
			resolve({ success: false, error: 'Request timeout' });
		});

		req.end();
	});
});

// Open URL in default browser
ipcMain.handle('open-external-url', (event, url) => {
	shell.openExternal(url);
});

// Get app version
ipcMain.handle('get-app-version', () => {
	return app.getVersion();
});

// Quit and install update
ipcMain.handle('quit-and-install-update', () => {
	autoUpdater.quitAndInstall();
});

// Load preset data
ipcMain.handle('load-preset-data', () => {
	const presetsDir = path.join(__dirname, 'data', 'presets');
	const mapNames = [
		'island',
		'scorched-earth',
		'aberration',
		'extinction',
		'the-center',
		'ragnarok',
		'valguero',
		'genesis-1',
		'crystal-isles',
		'genesis-2',
		'lost-island',
		'fjordur',
		'lost-colony',
		'astraeos',
	];

	const presetLocations = {};

	mapNames.forEach((mapName) => {
		const filePath = path.join(presetsDir, `${mapName}.json`);
		try {
			if (fs.existsSync(filePath)) {
				const data = fs.readFileSync(filePath, 'utf8');
				presetLocations[mapName] = JSON.parse(data);
			}
		} catch (err) {
			console.warn(`Could not load presets for ${mapName}:`, err.message);
		}
	});

	return presetLocations;
});
