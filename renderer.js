const { ipcRenderer } = require('electron');

// State
let currentFilePath = null;
let waypoints = [];

// DOM Elements
const filePathInput = document.getElementById('file-path');
const browseBtn = document.getElementById('browse-btn');
const autoDetectBtn = document.getElementById('auto-detect-btn');
const fileStatus = document.getElementById('file-status');
const importBtn = document.getElementById('import-btn');
const importStatus = document.getElementById('import-status');
const waypointCount = document.getElementById('waypoint-count');
const waypointsList = document.getElementById('waypoints-list');
const clearBtn = document.getElementById('clear-btn');
const exportFilename = document.getElementById('export-filename');
const exportBtn = document.getElementById('export-btn');
const exportStatus = document.getElementById('export-status');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	setupEventListeners();
	autoDetectFile();
});

function setupEventListeners() {
	browseBtn.addEventListener('click', browseForFile);
	autoDetectBtn.addEventListener('click', autoDetectFile);
	importBtn.addEventListener('click', importWaypoints);
	clearBtn.addEventListener('click', clearWaypoints);
	exportBtn.addEventListener('click', exportWaypoints);
}

// Browse for file
async function browseForFile() {
	const result = await ipcRenderer.invoke('open-file-dialog');
	if (!result.canceled && result.filePaths.length > 0) {
		setFilePath(result.filePaths[0]);
	}
}

// Auto-detect ARK waypoint files
async function autoDetectFile() {
	showStatus(fileStatus, 'Searching for ARK waypoint files...', 'info');
	
	const defaultPaths = await ipcRenderer.invoke('get-default-paths');
	
	for (const dirPath of defaultPaths) {
		const exists = await ipcRenderer.invoke('check-path-exists', dirPath);
		if (exists) {
			const result = await ipcRenderer.invoke('list-directory', dirPath);
			if (result.success) {
				// Look for .ini files that might contain waypoints
				const iniFiles = result.files.filter(f => f.endsWith('.ini'));
				if (iniFiles.length > 0) {
					// Try to find GameUserSettings.ini or similar
					const targetFile = iniFiles.find(f => 
						f.toLowerCase().includes('gameusersettings') || 
						f.toLowerCase().includes('waypoint') ||
						f.toLowerCase().includes('marker')
					) || iniFiles[0];
					
					const fullPath = `${dirPath}/${targetFile}`;
					setFilePath(fullPath);
					showStatus(fileStatus, `Found potential waypoint file: ${targetFile}`, 'success');
					return;
				}
			}
		}
	}
	
	showStatus(fileStatus, 'Could not auto-detect ARK files. Please browse manually.', 'error');
}

// Set the current file path
function setFilePath(path) {
	currentFilePath = path;
	filePathInput.value = path;
	importBtn.disabled = false;
	showStatus(fileStatus, 'File selected. Ready to import.', 'success');
}

// Import waypoints from file
async function importWaypoints() {
	if (!currentFilePath) {
		showStatus(importStatus, 'No file selected', 'error');
		return;
	}
	
	showStatus(importStatus, 'Reading file...', 'info');
	
	const result = await ipcRenderer.invoke('read-file', currentFilePath);
	
	if (!result.success) {
		showStatus(importStatus, `Error reading file: ${result.error}`, 'error');
		return;
	}
	
	// Parse the file content (INI format)
	const parsedWaypoints = parseWaypoints(result.content);
	
	if (parsedWaypoints.length === 0) {
		showStatus(importStatus, 'No waypoints found in file. The file format may be different than expected.', 'error');
		return;
	}
	
	waypoints = parsedWaypoints;
	updateWaypointsList();
	showStatus(importStatus, `Successfully imported ${waypoints.length} waypoints!`, 'success');
	exportBtn.disabled = false;
}

// Parse waypoints from INI file content
function parseWaypoints(content) {
	const parsed = [];
	const lines = content.split('\n');
	
	// Try multiple parsing strategies
	
	// Strategy 1: Look for POI/Waypoint entries in INI format
	// Common format: MapMarkerEntries=(X=...,Y=...,Z=...,Name="...",...)
	const markerRegex = /MapMarkerEntries=\(([^)]+)\)/gi;
	let match;
	
	while ((match = markerRegex.exec(content)) !== null) {
		const entry = match[1];
		const waypoint = parseMarkerEntry(entry);
		if (waypoint) {
			parsed.push(waypoint);
		}
	}
	
	// Strategy 2: Look for coordinate patterns
	// Format might be: Name,X,Y,Z or similar
	if (parsed.length === 0) {
		for (const line of lines) {
			// Skip comments and section headers
			if (line.startsWith(';') || line.startsWith('[') || line.trim() === '') {
				continue;
			}
			
			// Try to find coordinate patterns
			const coordMatch = line.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)?/);
			if (coordMatch) {
				parsed.push({
					label: `Waypoint ${parsed.length + 1}`,
					x: parseFloat(coordMatch[1]),
					y: parseFloat(coordMatch[2]),
					z: coordMatch[3] ? parseFloat(coordMatch[3]) : 0,
					raw: line.trim()
				});
			}
		}
	}
	
	// Strategy 3: Just store the raw content for analysis if nothing else works
	if (parsed.length === 0 && content.trim().length > 0) {
		// Store sections for debugging
		const sections = content.split(/\[([^\]]+)\]/);
		for (let i = 1; i < sections.length; i += 2) {
			const sectionName = sections[i];
			const sectionContent = sections[i + 1] || '';
			
			if (sectionContent.trim()) {
				parsed.push({
					label: `Section: ${sectionName}`,
					raw: sectionContent.trim().substring(0, 200) + '...',
					isSection: true
				});
			}
		}
	}
	
	return parsed;
}

// Parse a single marker entry from INI format
function parseMarkerEntry(entry) {
	const parts = {};
	
	// Parse key=value pairs
	const regex = /(\w+)=("([^"]*)"|([^,]+))/g;
	let match;
	
	while ((match = regex.exec(entry)) !== null) {
		const key = match[1].toLowerCase();
		const value = match[3] || match[4];
		parts[key] = value;
	}
	
	if (parts.x !== undefined && parts.y !== undefined) {
		return {
			label: parts.name || parts.label || 'Unnamed Waypoint',
			x: parseFloat(parts.x),
			y: parseFloat(parts.y),
			z: parts.z ? parseFloat(parts.z) : 0,
			color: parts.color || null
		};
	}
	
	return null;
}

// Update the waypoints list display
function updateWaypointsList() {
	waypointCount.textContent = `${waypoints.length} waypoint${waypoints.length !== 1 ? 's' : ''} loaded`;
	
	if (waypoints.length === 0) {
		waypointsList.innerHTML = '<p class="empty-state">No waypoints loaded. Import from file or add manually.</p>';
		exportBtn.disabled = true;
		return;
	}
	
	waypointsList.innerHTML = waypoints.map((wp, index) => `
		<div class="waypoint-item">
			<span class="name">${escapeHtml(wp.label)}</span>
			${wp.isSection ? 
				`<span class="coords">${escapeHtml(wp.raw.substring(0, 50))}...</span>` :
				`<span class="coords">X: ${wp.x?.toFixed(1) || '?'}, Y: ${wp.y?.toFixed(1) || '?'}${wp.z ? `, Z: ${wp.z.toFixed(1)}` : ''}</span>`
			}
		</div>
	`).join('');
	
	exportBtn.disabled = false;
}

// Clear all waypoints
function clearWaypoints() {
	waypoints = [];
	updateWaypointsList();
	showStatus(importStatus, '', '');
	showStatus(exportStatus, '', '');
}

// Export waypoints to JSON
async function exportWaypoints() {
	if (waypoints.length === 0) {
		showStatus(exportStatus, 'No waypoints to export', 'error');
		return;
	}
	
	const filename = (exportFilename.value.trim() || 'ark-waypoints') + '.json';
	
	const exportData = {
		exportDate: new Date().toISOString(),
		sourceFile: currentFilePath,
		waypointCount: waypoints.length,
		waypoints: waypoints
	};
	
	const result = await ipcRenderer.invoke('export-to-desktop', exportData, filename);
	
	if (result.success) {
		showStatus(exportStatus, `Exported to: ${result.path}`, 'success');
	} else {
		showStatus(exportStatus, `Export failed: ${result.error}`, 'error');
	}
}

// Utility: Show status message
function showStatus(element, message, type) {
	element.textContent = message;
	element.className = 'status-message';
	if (type) {
		element.classList.add(type);
	}
}

// Utility: Escape HTML
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}
