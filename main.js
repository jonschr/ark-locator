const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
	createWindow();

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
