const { ipcRenderer } = require('electron');

// ===========================================
// STATE
// ===========================================
let currentMap = 'lost-colony';
let userMarkers = {}; // { mapName: [marker, marker, ...] } - User-created markers only
let hiddenMarkers = {}; // { mapName: Set of marker IDs that are hidden }
// Default categories template - shared across all maps initially
const DEFAULT_CATEGORIES = [
	{
		id: 'default',
		name: 'General',
		color: '#00d9ff',
		icon: null,
		visible: true,
	},
	{
		id: 'bases',
		name: 'Base Locations',
		color: '#ff9800',
		icon: null,
		visible: true,
	},
	{
		id: 'caves',
		name: 'Caves',
		color: '#9c27b0',
		icon: null,
		visible: true,
	},
	{
		id: 'obelisks',
		name: 'Obelisks',
		color: '#00bcd4',
		icon: null,
		visible: true,
	},
	{
		id: 'loot-crates',
		name: 'Loot Crates',
		color: '#2196f3',
		icon: null,
		visible: true,
	},
	{
		id: 'drops-veins',
		name: 'Drops & Veins',
		color: '#9c27b0',
		icon: null,
		visible: true,
	},
	// Lost Colony locations
	{
		id: 'outpost',
		name: 'Outposts',
		color: '#ff6f00',
		icon: null,
		visible: true,
	},
	{
		id: 'danger',
		name: 'Danger Zones',
		color: '#ff5252',
		icon: null,
		visible: true,
	},
];

// Per-map category overrides { mapName: { categoryId: { name?, color?, visible? }, ... }, mapName: { _custom: [custom categories] } }
let mapCategories = {};

// Virtual category for uncategorized markers (not stored, just for display)
const UNCATEGORIZED_DISPLAY = {
	id: null,
	name: 'Uncategorized',
	color: '#888888',
	icon: null,
	visible: true,
};

// Get ALL categories for the current map (presets + user categories)
// Used for rendering the sidebar waypoint list
function getCategories() {
	const mapOverrides = mapCategories[currentMap] || {};
	const customCats = mapOverrides._custom || [];

	// Merge default categories with any per-map overrides
	const merged = DEFAULT_CATEGORIES.map((cat) => {
		const override = mapOverrides[cat.id];
		if (override) {
			return { ...cat, ...override };
		}
		return { ...cat };
	});

	// Custom categories first, then default categories
	return [...customCats, ...merged];
}

// Get only USER categories for the marker dropdown (excludes preset categories)
// Used when adding/editing custom markers
function getUserCategories() {
	const mapOverrides = mapCategories[currentMap] || {};
	const customCats = mapOverrides._custom || [];

	// Always include Uncategorized as the first option (represents null category)
	return [UNCATEGORIZED_DISPLAY, ...customCats];
}

// Update a category for the current map
function updateCategory(categoryId, updates) {
	if (!mapCategories[currentMap]) {
		mapCategories[currentMap] = {};
	}

	// Check if it's a custom category
	const customCats = mapCategories[currentMap]._custom || [];
	const customIndex = customCats.findIndex((c) => c.id === categoryId);

	if (customIndex >= 0) {
		// Update custom category
		customCats[customIndex] = { ...customCats[customIndex], ...updates };
	} else {
		// It's a default category - store override
		mapCategories[currentMap][categoryId] = {
			...(mapCategories[currentMap][categoryId] || {}),
			...updates,
		};
	}

	saveState();
}

// Check if a category is a user/custom category (not a preset category)
function isUserCategory(categoryId) {
	// Uncategorized (null) is a user category
	if (!categoryId) return true;

	// Check if it's in the _custom array
	const mapOverrides = mapCategories[currentMap] || {};
	const customCats = mapOverrides._custom || [];
	return customCats.some((c) => c.id === categoryId);
}

// Add a custom category for the current map
function addCustomCategory(category) {
	if (!mapCategories[currentMap]) {
		mapCategories[currentMap] = {};
	}
	if (!mapCategories[currentMap]._custom) {
		mapCategories[currentMap]._custom = [];
	}
	mapCategories[currentMap]._custom.push(category);
	saveState();
}

let selectedCategory = ''; // Empty string for uncategorized
let pendingMarker = null;
let editingMarkerIndex = null; // Track if we're editing an existing marker (user markers only)
let editingPresetIndex = null; // Track if we're editing a preset marker

// Per-map preset overrides { mapName: { presetIndex: { name?, category? } } }
let presetOverrides = {};

// Map zoom/pan state
let mapScale = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let highlightedMarkerEl = null; // Track currently highlighted marker
let spacePressed = false;

// Wikily.gg CDN base URL for maps
const WIKILY_CDN = 'https://r2.wikily.gg/images/ark';

// Map image files - using wikily.gg CDN where available
const mapImages = {
	island: `${WIKILY_CDN}/maps/TheIsland.webp`,
	'scorched-earth': `${WIKILY_CDN}/maps/ScorchedEarth.webp`,
	aberration: `${WIKILY_CDN}/maps/Aberration.webp`,
	extinction: `${WIKILY_CDN}/maps/Extinction.webp`,
	'the-center': `${WIKILY_CDN}/maps/TheCenter.webp`,
	ragnarok: `${WIKILY_CDN}/maps/Ragnarok.webp`,
	valguero: `${WIKILY_CDN}/maps/Valguero.webp`,
	'genesis-1': `${WIKILY_CDN}/maps/Genesis.webp`,
	'crystal-isles': `${WIKILY_CDN}/maps/CrystalIsles.webp`,
	'genesis-2': `${WIKILY_CDN}/maps/Genesis2.webp`,
	'lost-island': `${WIKILY_CDN}/maps/LostIsland.webp`,
	fjordur: `${WIKILY_CDN}/maps/Fjordur.webp`,
	'lost-colony': `${WIKILY_CDN}/maps/LostColony.webp`,
	astraeos: 'https://ark.wiki.gg/images/Astraeos_spawn_map.png',
};

// Preset locations - loaded from JSON files
const presetLocations = {};

// Load preset data from JSON files
const path = require('path');
const fs = require('fs');

function loadPresetData() {
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
}

// Load presets immediately
loadPresetData();

// ===========================================
// DOM ELEMENTS
// ===========================================
const sidebar = document.getElementById('sidebar');
const sidebarResize = document.getElementById('sidebar-resize');
const mapSelect = document.getElementById('map-select');
const addCategoryBtn = document.getElementById('add-category-btn');
const waypointCount = document.getElementById('waypoint-count');
const waypointList = document.getElementById('waypoint-list');
const filePathInput = document.getElementById('file-path');
const browseBtn = document.getElementById('browse-btn');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const ioStatus = document.getElementById('io-status');

const mapViewport = document.getElementById('map-viewport');
const mapImage = document.getElementById('map-image');
const markersLayer = document.getElementById('markers-layer');
const coordsDisplay = document.getElementById('coords-display');
const noMapMessage = document.getElementById('no-map-message');

const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');
const refreshBtn = document.getElementById('refresh-btn');

const markerModal = document.getElementById('marker-modal');
const markerModalTitle = document.getElementById('marker-modal-title');
const markerNameInput = document.getElementById('marker-name');
const markerCategorySelect = document.getElementById('marker-category');
const newCategoryInput = document.getElementById('new-category-input');
const toggleNewCategoryBtn = document.getElementById('toggle-new-category');
const markerLatInput = document.getElementById('marker-lat');
const markerLonInput = document.getElementById('marker-lon');
const cancelMarkerBtn = document.getElementById('cancel-marker');
const saveMarkerBtn = document.getElementById('save-marker');
const deleteMarkerBtn = document.getElementById('delete-marker-btn');

const categoryModal = document.getElementById('category-modal');
const categoryModalTitle = document.getElementById('category-modal-title');
const categoryNameInput = document.getElementById('category-name');
const categoryColorInput = document.getElementById('category-color');
const cancelCategoryBtn = document.getElementById('cancel-category');
const saveCategoryBtn = document.getElementById('save-category');
const deleteCategoryBtn = document.getElementById('delete-category');
let editingCategoryId = null; // Track if editing an existing category

const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const closeHelpBtn = document.getElementById('close-help');

// INI modal elements
const iniModal = document.getElementById('ini-modal');
const iniModalTitle = document.getElementById('ini-modal-title');
const iniModalMessage = document.getElementById('ini-modal-message');
const closeIniModalBtn = document.getElementById('close-ini-modal');

// Import from ARK button
const importArkBtn = document.getElementById('import-ark-btn');

// Collapsible sections
document.querySelectorAll('.collapsible-header').forEach((header) => {
	header.addEventListener('click', () => {
		header.closest('.collapsible').classList.toggle('collapsed');
	});
});

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
	loadState();
	setupEventListeners();
	loadMap(currentMap);
	updateCategorySelect();
	renderWaypoints();
});

function setupEventListeners() {
	// Sidebar resize
	let isResizing = false;
	sidebarResize.addEventListener('mousedown', (e) => {
		isResizing = true;
		sidebarResize.classList.add('resizing');
		document.body.style.cursor = 'ew-resize';
		document.body.style.userSelect = 'none';
	});

	document.addEventListener('mousemove', (e) => {
		if (!isResizing) return;
		const newWidth = e.clientX;
		if (newWidth >= 250 && newWidth <= 800) {
			sidebar.style.width = newWidth + 'px';
		}
	});

	document.addEventListener('mouseup', () => {
		if (isResizing) {
			isResizing = false;
			sidebarResize.classList.remove('resizing');
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
	});

	// Map selection
	mapSelect.addEventListener('change', (e) => {
		currentMap = e.target.value;
		loadMap(currentMap);
		updateCategorySelect();
		renderWaypoints();
		saveState();
	});

	// Category management
	addCategoryBtn.addEventListener('click', openCategoryModal);
	cancelCategoryBtn.addEventListener('click', closeCategoryModal);
	saveCategoryBtn.addEventListener('click', saveCategory);
	deleteCategoryBtn.addEventListener('click', deleteCurrentCategory);

	// Show all / Hide all category visibility
	document.getElementById('show-all-btn').addEventListener('click', () => {
		toggleAllCategoriesVisibility(true);
	});
	document.getElementById('hide-all-btn').addEventListener('click', () => {
		toggleAllCategoriesVisibility(false);
	});

	// Marker management
	cancelMarkerBtn.addEventListener('click', closeMarkerModal);
	saveMarkerBtn.addEventListener('click', saveMarker);
	deleteMarkerBtn.addEventListener('click', deleteCurrentMarker);

	// Toggle new category input in marker modal
	toggleNewCategoryBtn.addEventListener('click', () => {
		const showingInput = newCategoryInput.style.display !== 'none';
		if (showingInput) {
			// Switch back to select
			newCategoryInput.style.display = 'none';
			markerCategorySelect.style.display = '';
			toggleNewCategoryBtn.textContent = '+';
			toggleNewCategoryBtn.title = 'Create new category';
			newCategoryInput.value = '';
		} else {
			// Switch to input for new category
			markerCategorySelect.style.display = 'none';
			newCategoryInput.style.display = '';
			toggleNewCategoryBtn.textContent = '×';
			toggleNewCategoryBtn.title = 'Cancel new category';
			newCategoryInput.focus();
		}
	});

	// Help modal
	helpBtn.addEventListener('click', () =>
		helpModal.classList.remove('hidden')
	);
	closeHelpBtn.addEventListener('click', () =>
		helpModal.classList.add('hidden')
	);
	helpModal.addEventListener('click', (e) => {
		if (e.target === helpModal) helpModal.classList.add('hidden');
	});

	// INI modal
	closeIniModalBtn.addEventListener('click', closeIniModal);
	iniModal.addEventListener('click', (e) => {
		if (e.target === iniModal) closeIniModal();
	});

	// Import from ARK button
	importArkBtn.addEventListener('click', () => {
		showIniModal(
			'Import All Markers from ARK',
			'This will read your ARK game .ini file and import all waypoints/map markers into this app.'
		);
	});

	// Clear data button
	document.getElementById('clear-data-btn').addEventListener('click', () => {
		if (
			confirm(
				'This will delete all your custom markers, categories, and settings. Are you sure?'
			)
		) {
			localStorage.removeItem('arkLocatorState');
			// Reset state
			userMarkers = {};
			mapCategories = {};
			presetOverrides = {};
			hiddenMarkers = {};
			currentMap = 'lost-colony';
			mapSelect.value = currentMap;
			loadMap(currentMap);
			updateCategorySelect();
			renderWaypoints();
			helpModal.classList.add('hidden');
			alert('All data has been cleared.');
		}
	});

	// Map interactions
	mapViewport.addEventListener('dblclick', handleMapDblClick);
	mapViewport.addEventListener('mousemove', handleMapMouseMove);
	mapViewport.addEventListener('mousedown', handleMapMouseDown);
	mapViewport.addEventListener('mouseup', handleMapMouseUp);
	mapViewport.addEventListener('mouseleave', handleMapMouseUp);
	mapViewport.addEventListener('wheel', handleMapWheel, { passive: false });
	mapViewport.addEventListener('contextmenu', (e) => e.preventDefault());

	// Clear marker highlight on click anywhere on map (not on a marker)
	mapViewport.addEventListener('click', (e) => {
		if (!e.target.closest('.map-marker') && highlightedMarkerEl) {
			highlightedMarkerEl.classList.remove('highlighted');
			highlightedMarkerEl = null;
		}
	});

	// Keyboard events for panning
	document.addEventListener('keydown', handleKeyDown);
	document.addEventListener('keyup', handleKeyUp);

	// Zoom controls - smaller steps for smoother zooming
	zoomInBtn.addEventListener('click', () => zoomMap(1.15));
	zoomOutBtn.addEventListener('click', () => zoomMap(0.87));
	zoomResetBtn.addEventListener('click', resetMapView);

	// Refresh button - full app restart
	refreshBtn.addEventListener('click', () => {
		// Send restart signal to main process
		ipcRenderer.send('restart-app');
	});

	// Import/Export
	browseBtn.addEventListener('click', browseForFile);
	importBtn.addEventListener('click', importWaypoints);
	exportBtn.addEventListener('click', exportWaypoints);
}

// ===========================================
// MAP HANDLING
// ===========================================
function loadMap(mapName) {
	const imagePath = mapImages[mapName];

	if (imagePath) {
		mapImage.src = imagePath;
		mapImage.classList.remove('hidden');
		noMapMessage.classList.add('hidden');

		mapImage.onload = () => {
			resetMapView();
			renderMapMarkers();
		};

		mapImage.onerror = () => {
			mapImage.classList.add('hidden');
			noMapMessage.classList.remove('hidden');
		};
	} else {
		mapImage.src = '';
		mapImage.classList.add('hidden');
		noMapMessage.classList.remove('hidden');
	}
}

function resetMapView() {
	mapScale = 1;
	mapOffsetX = 0;
	mapOffsetY = 0;
	updateMapTransform();
	renderMapMarkers();
}

function getMinScale() {
	// Calculate minimum scale so image edges touch viewport edges (like background-size: contain)
	if (!mapImage.naturalWidth || !mapImage.naturalHeight) return 0.1;

	const rect = mapViewport.getBoundingClientRect();
	const scaleX = rect.width / mapImage.naturalWidth;
	const scaleY = rect.height / mapImage.naturalHeight;

	// Use the larger of the two to ensure both edges are covered
	return Math.max(scaleX, scaleY);
}

function zoomMap(factor) {
	const newScale = mapScale * factor;
	const minScale = getMinScale();

	if (newScale >= minScale && newScale <= 10) {
		mapScale = newScale;
		updateMapTransform();
		// Use requestAnimationFrame to sync marker updates with transform
		requestAnimationFrame(() => {
			renderMapMarkers();
		});
	}
}

function updateMapTransform() {
	mapImage.style.transform = `translate(calc(-50% + ${mapOffsetX}px), calc(-50% + ${mapOffsetY}px)) scale(${mapScale})`;
}

function handleMapWheel(e) {
	e.preventDefault();
	// Smaller zoom steps for smoother zooming
	const factor = e.deltaY > 0 ? 0.95 : 1.05;
	zoomMap(factor);
}

function handleKeyDown(e) {
	if (e.code === 'Space' && !spacePressed) {
		spacePressed = true;
		// Space still works for panning (grab cursor indicates ready to pan)
		if (!isPanning) {
			mapViewport.style.cursor = 'grab';
		}
	}
}

function handleKeyUp(e) {
	if (e.code === 'Space') {
		spacePressed = false;
		if (!isPanning) {
			mapViewport.style.cursor = 'grab';
		}
	}
}

function handleMapMouseDown(e) {
	// Left click, middle mouse button, or right mouse button to pan
	if (e.button === 0 || e.button === 1 || e.button === 2) {
		e.preventDefault();
		isPanning = true;
		panStartX = e.clientX - mapOffsetX;
		panStartY = e.clientY - mapOffsetY;
		mapViewport.style.cursor = 'grabbing';
	}
}

function handleMapMouseUp(e) {
	if (isPanning) {
		isPanning = false;
		mapViewport.style.cursor = 'grab';
	}
}

function handleMapMouseMove(e) {
	// Update coordinates display
	const coords = pixelToCoords(e.clientX, e.clientY);
	if (coords) {
		coordsDisplay.textContent = `Lat: ${coords.lat.toFixed(
			1
		)}, Lon: ${coords.lon.toFixed(1)}`;
	}

	// Handle panning
	if (isPanning) {
		mapOffsetX = e.clientX - panStartX;
		mapOffsetY = e.clientY - panStartY;
		updateMapTransform();
		// Use requestAnimationFrame for smoother marker updates during pan
		requestAnimationFrame(() => {
			renderMapMarkers();
		});
	}
}

function handleMapDblClick(e) {
	// Only handle left double-click
	if (e.button !== 0) return;

	const coords = pixelToCoords(e.clientX, e.clientY);
	if (
		coords &&
		coords.lat >= 0 &&
		coords.lat <= 100 &&
		coords.lon >= 0 &&
		coords.lon <= 100
	) {
		openMarkerModal(coords.lat, coords.lon);
	}
}

// Convert pixel position to ARK coordinates (0-100 lat/lon)
function pixelToCoords(clientX, clientY) {
	if (!mapImage.naturalWidth) return null;

	const rect = mapViewport.getBoundingClientRect();
	const centerX = rect.width / 2;
	const centerY = rect.height / 2;

	// Position relative to map center
	const relX = (clientX - rect.left - centerX - mapOffsetX) / mapScale;
	const relY = (clientY - rect.top - centerY - mapOffsetY) / mapScale;

	// Convert to percentage of image
	const imgWidth = mapImage.naturalWidth;
	const imgHeight = mapImage.naturalHeight;

	const percentX = (relX + imgWidth / 2) / imgWidth;
	const percentY = (relY + imgHeight / 2) / imgHeight;

	return {
		lat: percentY * 100,
		lon: percentX * 100,
	};
}

// Convert ARK coordinates to pixel position
function coordsToPixel(lat, lon) {
	if (!mapImage.naturalWidth) return null;

	const rect = mapViewport.getBoundingClientRect();
	const centerX = rect.width / 2;
	const centerY = rect.height / 2;

	const imgWidth = mapImage.naturalWidth;
	const imgHeight = mapImage.naturalHeight;

	const relX = (lon / 100) * imgWidth - imgWidth / 2;
	const relY = (lat / 100) * imgHeight - imgHeight / 2;

	return {
		x: centerX + relX * mapScale + mapOffsetX,
		y: centerY + relY * mapScale + mapOffsetY,
	};
}

// ===========================================
// MARKERS - Helper functions
// ===========================================

// Generate unique ID for a marker
function getMarkerId(marker, index, isPreset) {
	if (isPreset) {
		// For presets, use category + coords as stable ID
		return `preset-${marker.category}-${marker.lat}-${marker.lon}`;
	} else {
		// For user markers, use createdAt or index
		return marker.id || `user-${marker.createdAt || index}`;
	}
}

// Check if a marker is hidden
function isMarkerHidden(markerId) {
	const hidden = hiddenMarkers[currentMap];
	return hidden && hidden.has(markerId);
}

// Toggle marker visibility
function toggleMarkerVisibility(markerId) {
	if (!hiddenMarkers[currentMap]) {
		hiddenMarkers[currentMap] = new Set();
	}

	if (hiddenMarkers[currentMap].has(markerId)) {
		hiddenMarkers[currentMap].delete(markerId);
	} else {
		hiddenMarkers[currentMap].add(markerId);
	}

	renderMapMarkers();
	renderWaypoints();
	saveState();
}

// Get preset markers for current map (read-only, built-in)
function getPresetMarkers(mapName) {
	const presets = presetLocations[mapName];
	if (!presets) return [];

	const mapOverrides = presetOverrides[mapName] || {};
	const markers = [];

	Object.entries(presets).forEach(([categoryKey, categoryMarkers]) => {
		categoryMarkers.forEach((preset, idx) => {
			const markerId = `preset-${preset.category}-${preset.lat}-${preset.lon}`;
			const override = mapOverrides[markerId] || {};
			markers.push({
				...preset,
				...override, // Apply any user overrides
				isPreset: true,
				id: markerId,
				originalCategory: preset.category, // Keep original for reference
			});
		});
	});
	return markers;
}

// Get all markers (presets + user) for current map
function getAllMarkers(mapName) {
	const presets = getPresetMarkers(mapName);
	const user = (userMarkers[mapName] || []).map((m, idx) => ({
		...m,
		id: m.id || `user-${m.createdAt || idx}`,
		isPreset: false,
	}));
	return [...presets, ...user];
}

// Get user marker index from combined index
function getUserMarkerIndex(combinedIndex) {
	const presetCount = getPresetMarkers(currentMap).length;
	if (combinedIndex < presetCount) return null; // It's a preset
	return combinedIndex - presetCount;
}

// ===========================================
// MARKERS - Rendering
// ===========================================
function renderMapMarkers() {
	markersLayer.innerHTML = '';

	const allMarkers = getAllMarkers(currentMap);
	const categories = getCategories();

	allMarkers.forEach((marker, index) => {
		// Handle uncategorized markers (no category)
		let category;
		let markerColor = '#888888'; // Default gray for uncategorized
		
		if (!marker.category) {
			// Uncategorized marker - always visible unless individually hidden
			category = UNCATEGORIZED_DISPLAY;
		} else {
			category = categories.find((c) => c.id === marker.category);
			// Skip if category is hidden
			if (!category || !category.visible) return;
		}
		
		// Skip if individual marker is hidden
		if (isMarkerHidden(marker.id)) return;

		const pos = coordsToPixel(marker.lat, marker.lon);
		if (!pos) return;

		const markerEl = document.createElement('div');
		markerEl.className = `map-marker${marker.isPreset ? ' preset' : ''}`;
		markerEl.style.left = `${pos.x}px`;
		markerEl.style.top = `${pos.y}px`;
		markerEl.dataset.index = index;
		markerEl.dataset.isPreset = marker.isPreset ? 'true' : 'false';
		markerEl.dataset.markerId = marker.id;

		// Use icon if category has one, otherwise use colored pin
		const markerInner = category.icon
			? `<img src="${category.icon}" class="marker-icon" alt="" onerror="this.outerHTML='<div class=\\'marker-pin\\' style=\\'background-color: ${category.color}\\'></div>'">`
			: `<div class="marker-pin" style="background-color: ${category.color}"></div>`;

		// Include coords in label for all markers (shown on hover via CSS)
		const labelText = `${escapeHtml(
			marker.name
		)}<span class="marker-coords">${marker.lat.toFixed(
			1
		)}, ${marker.lon.toFixed(1)}</span>`;

		markerEl.innerHTML = `
			${markerInner}
			<div class="marker-label">${labelText}</div>
		`;

		// Hover handler for all markers - persistent highlight with coords
		markerEl.addEventListener('mouseenter', () => {
			// Clear previous highlight
			if (highlightedMarkerEl && highlightedMarkerEl !== markerEl) {
				highlightedMarkerEl.classList.remove('highlighted');
			}
			// Set new highlight
			markerEl.classList.add('highlighted');
			highlightedMarkerEl = markerEl;
		});

		// Click handler - edit marker (user markers only, presets just pan)
		markerEl.addEventListener('click', (e) => {
			e.stopPropagation();
			// Clear highlight on click
			if (highlightedMarkerEl) {
				highlightedMarkerEl.classList.remove('highlighted');
				highlightedMarkerEl = null;
			}
			if (marker.isPreset) {
				// Just pan to the marker for presets (not editable)
				panToMarker(marker.lat, marker.lon);
			} else {
				const userIndex = getUserMarkerIndex(index);
				if (userIndex !== null) {
					openEditMarkerModal(userIndex);
				}
			}
		});

		markersLayer.appendChild(markerEl);
	});
}

function showPresetInfo(marker) {
	const categories = getCategories();
	const category =
		categories.find((c) => c.id === marker.category) || categories[0];
	// Just highlight and pan to the marker
	panToMarker(marker.lat, marker.lon);
}

function addMarker(marker) {
	if (!userMarkers[currentMap]) {
		userMarkers[currentMap] = [];
	}
	userMarkers[currentMap].push(marker);
	renderMapMarkers();
	renderWaypoints();
	saveState();
}

function deleteMarker(userIndex) {
	if (userMarkers[currentMap] && userMarkers[currentMap][userIndex]) {
		userMarkers[currentMap].splice(userIndex, 1);
		renderMapMarkers();
		renderWaypoints();
		saveState();
	}
}

function highlightWaypoint(markerId) {
	const items = waypointList.querySelectorAll('.waypoint-item');
	items.forEach((item) => {
		item.style.background =
			item.dataset.markerId === markerId ? 'rgba(0, 217, 255, 0.2)' : '';
	});

	// Also expand the category if collapsed
	const targetItem = waypointList.querySelector(
		`.waypoint-item[data-marker-id="${markerId}"]`
	);
	if (targetItem) {
		const category = targetItem.closest('.waypoint-category');
		if (category && category.classList.contains('collapsed')) {
			category.classList.remove('collapsed');
		}
		targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
}

// ===========================================
// CATEGORIES
// ===========================================
function updateCategorySelect() {
	// Update marker category select dropdown - only show user categories, not presets
	const categories = getUserCategories();
	markerCategorySelect.innerHTML = categories
		.map((cat) => `<option value="${cat.id || ''}">${cat.name}</option>`)
		.join('');
}

function getMarkerCountForCategory(categoryId) {
	const allMarkers = getAllMarkers(currentMap);
	// Handle null/undefined category matching
	return allMarkers.filter((m) => (m.category || null) === (categoryId || null)).length;
}

function toggleAllCategoriesVisibility(visible) {
	const categories = getCategories();
	categories.forEach((cat) => {
		updateCategory(cat.id, { visible });
	});
	renderMapMarkers();
	renderWaypoints();
}

function openCategoryModal() {
	editingCategoryId = null;
	categoryModalTitle.textContent = 'Add Category';
	categoryNameInput.value = '';
	categoryColorInput.value = '#00d9ff';
	deleteCategoryBtn.classList.add('hidden');
	categoryModal.classList.remove('hidden');
}

function openEditCategoryModal(categoryId) {
	const categories = getCategories();
	const cat = categories.find((c) => c.id === categoryId);
	if (!cat) return;

	editingCategoryId = categoryId;
	categoryModalTitle.textContent = 'Edit Category';
	categoryNameInput.value = cat.name;
	categoryColorInput.value = cat.color;
	
	// Only show delete button for user categories (not preset categories)
	if (isUserCategory(categoryId)) {
		deleteCategoryBtn.classList.remove('hidden');
	} else {
		deleteCategoryBtn.classList.add('hidden');
	}
	
	categoryModal.classList.remove('hidden');
}

function closeCategoryModal() {
	categoryModal.classList.add('hidden');
	editingCategoryId = null;
	categoryModalTitle.textContent = 'Add Category';
	deleteCategoryBtn.classList.add('hidden');
}

// Delete the currently editing category
function deleteCurrentCategory() {
	if (!editingCategoryId) return;
	
	const categories = getCategories();
	const cat = categories.find((c) => c.id === editingCategoryId);
	const markerCount = getMarkerCountForCategory(editingCategoryId);
	
	let confirmMsg = `Are you sure you want to delete the "${cat?.name || editingCategoryId}" category?`;
	if (markerCount > 0) {
		confirmMsg += `\n\nThis category has ${markerCount} marker(s). They will be moved to "Uncategorized".`;
	}
	
	if (!confirm(confirmMsg)) return;
	
	// Move markers to uncategorized
	if (markerCount > 0) {
		const mapMarkers = userMarkers[currentMap] || [];
		mapMarkers.forEach((marker) => {
			if (marker.category === editingCategoryId) {
				marker.category = 'uncategorized';
			}
		});
	}
	
	// Remove from custom categories
	const mapOverrides = mapCategories[currentMap] || {};
	const customCats = mapOverrides._custom || [];
	const customIndex = customCats.findIndex((c) => c.id === editingCategoryId);
	if (customIndex >= 0) {
		customCats.splice(customIndex, 1);
	}
	
	saveState();
	updateCategorySelect();
	renderMapMarkers();
	renderWaypoints();
	closeCategoryModal();
}

// INI Modal functions
function showIniModal(title, message) {
	iniModalTitle.textContent = title;
	iniModalMessage.textContent = message;
	iniModal.classList.remove('hidden');
}

function closeIniModal() {
	iniModal.classList.add('hidden');
}

function saveCategory() {
	const name = categoryNameInput.value.trim();
	const color = categoryColorInput.value;

	if (!name) return;

	if (editingCategoryId) {
		// Editing existing category
		updateCategory(editingCategoryId, { name, color });
	} else {
		// Adding new category
		const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
		addCustomCategory({ id, name, color, icon: null, visible: true });
	}

	updateCategorySelect();
	renderMapMarkers();
	renderWaypoints();
	closeCategoryModal();
}

// ===========================================
// WAYPOINTS LIST
// ===========================================
function renderWaypoints() {
	const allMarkers = getAllMarkers(currentMap);
	const categories = getCategories();

	// Count only visible markers (category visible AND marker not individually hidden)
	const visibleMarkers = allMarkers.filter((marker) => {
		// Uncategorized markers are always visible (if not individually hidden)
		if (!marker.category) {
			return !isMarkerHidden(marker.id);
		}
		const category = categories.find((c) => c.id === marker.category);
		if (!category || !category.visible) return false;
		if (isMarkerHidden(marker.id)) return false;
		return true;
	});

	waypointCount.textContent = `${visibleMarkers.length} marker${
		visibleMarkers.length !== 1 ? 's' : ''
	} visible`;

	if (allMarkers.length === 0) {
		waypointList.innerHTML =
			'<p class="empty-state">Double-click on the map to add markers</p>';
		return;
	}

	// Group markers by category
	const markersByCategory = {};
	const uncategorizedMarkers = [];
	allMarkers.forEach((marker, index) => {
		if (!marker.category) {
			// Only show uncategorized user markers (not presets)
			if (!marker.isPreset) {
				uncategorizedMarkers.push({ marker, index });
			}
		} else {
			const catId = marker.category;
			if (!markersByCategory[catId]) {
				markersByCategory[catId] = [];
			}
			markersByCategory[catId].push({ marker, index });
		}
	});

	// Build HTML
	let html = '';

	// Render uncategorized markers at the top (if any)
	if (uncategorizedMarkers.length > 0) {
		const visibleCount = uncategorizedMarkers.filter(
			({ marker }) => !isMarkerHidden(marker.id)
		).length;

		html += `
			<div class="waypoint-category uncategorized-section" data-category="">
				<div class="waypoint-category-header uncategorized-header" data-category="">
					<div class="category-dot" style="background-color: #888888"></div>
					<span class="category-title">Uncategorized</span>
					<div class="category-ini-btns">
						<button class="category-ini-btn add-ini" data-category="" title="Add to ARK .ini file">+</button>
						<button class="category-ini-btn remove-ini" data-category="" title="Remove from ARK .ini file">−</button>
					</div>
					<span class="category-marker-count">${visibleCount}/${uncategorizedMarkers.length}</span>
					<span class="category-expand-icon">▼</span>
				</div>
				<div class="waypoint-category-items drop-zone" data-category="">
		`;

		uncategorizedMarkers.forEach(({ marker, index }) => {
			const userIndex = getUserMarkerIndex(index);
			const isHidden = isMarkerHidden(marker.id);

			html += `
				<div class="waypoint-item${isHidden ? ' hidden-marker' : ''}" 
					 draggable="true"
					 data-index="${index}" 
					 data-user-index="${userIndex}" 
					 data-is-preset="false"
					 data-marker-id="${marker.id}">
					<span class="drag-handle">⋮⋮</span>
					<button class="marker-visibility-btn${isHidden ? ' hidden-marker' : ''}" 
							data-marker-id="${marker.id}" 
							title="${isHidden ? 'Show marker' : 'Hide marker'}">
						${isHidden ? '○' : '●'}
					</button>
					<span class="name">${escapeHtml(marker.name)}</span>
					<span class="coords">${marker.lat.toFixed(1)}, ${marker.lon.toFixed(1)}</span>
					<div class="waypoint-actions">
						<button class="edit-btn" data-user-index="${userIndex}" title="Edit">✎</button>
						<button class="delete-btn" data-user-index="${userIndex}" title="Delete">✕</button>
					</div>
				</div>
			`;
		});

		html += `
				</div>
			</div>
		`;
	}

	// Render categorized markers
	categories.forEach((cat) => {
		const categoryMarkers = markersByCategory[cat.id] || [];
		if (categoryMarkers.length === 0) return;

		const visibleCount = categoryMarkers.filter(
			({ marker }) => !isMarkerHidden(marker.id)
		).length;

		const iconHtml = cat.icon
			? `<img src="${
					cat.icon
			  }" class="category-icon-small category-visibility-toggle ${
					cat.visible ? '' : 'hidden-cat'
			  }" data-category="${cat.id}" title="${
					cat.visible ? 'Hide category' : 'Show category'
			  }" alt="" onerror="this.style.display='none'">`
			: `<div class="category-dot category-visibility-toggle ${
					cat.visible ? '' : 'hidden-cat'
			  }" style="background-color: ${cat.color}" data-category="${
					cat.id
			  }" title="${
					cat.visible ? 'Hide category' : 'Show category'
			  }"></div>`;

		// Add INI buttons for user categories only
		const isCustomCat = isUserCategory(cat.id);
		const iniBtnsHtml = isCustomCat
			? `<div class="category-ini-btns">
					<button class="category-ini-btn add-ini" data-category="${cat.id}" title="Add to ARK .ini file">+</button>
					<button class="category-ini-btn remove-ini" data-category="${cat.id}" title="Remove from ARK .ini file">−</button>
			   </div>`
			: '';

		html += `
			<div class="waypoint-category collapsed" data-category="${cat.id}">
				<div class="waypoint-category-header" data-category="${cat.id}">
					${iconHtml}
					<span class="category-title">${escapeHtml(cat.name)}</span>
					<button class="category-edit-btn" data-category="${
						cat.id
					}" title="Edit category">✎</button>
					${iniBtnsHtml}
					<span class="category-marker-count">${visibleCount}/${
			categoryMarkers.length
		}</span>
					<span class="category-expand-icon">▼</span>
				</div>
				<div class="waypoint-category-items${isCustomCat ? ' drop-zone' : ''}" data-category="${cat.id}">
		`;

		categoryMarkers.forEach(({ marker, index }) => {
			const isPreset = marker.isPreset;
			const userIndex = isPreset ? null : getUserMarkerIndex(index);
			const isHidden = isMarkerHidden(marker.id);
			const canDrag = !isPreset;

			html += `
				<div class="waypoint-item${isPreset ? ' preset' : ''}${
				isHidden ? ' hidden-marker' : ''
			}" 
					 ${canDrag ? 'draggable="true"' : ''}
					 data-index="${index}" 
					 data-user-index="${userIndex}" 
					 data-is-preset="${isPreset}"
					 data-marker-id="${marker.id}">
					${canDrag ? '<span class="drag-handle">⋮⋮</span>' : ''}
					<button class="marker-visibility-btn${isHidden ? ' hidden-marker' : ''}" 
							data-marker-id="${marker.id}" 
							title="${isHidden ? 'Show marker' : 'Hide marker'}">
						${isHidden ? '○' : '●'}
					</button>
					<span class="name">${escapeHtml(marker.name)}${
				isPreset ? ' <span class="preset-badge">preset</span>' : ''
			}</span>
					<span class="coords">${marker.lat.toFixed(1)}, ${marker.lon.toFixed(1)}</span>
					${
						!isPreset
							? `
					<div class="waypoint-actions">
						<button class="edit-btn" data-user-index="${userIndex}" title="Edit">✎</button>
						<button class="delete-btn" data-user-index="${userIndex}" title="Delete">✕</button>
					</div>
					`
							: ''
					}
				</div>
			`;
		});

		html += `
				</div>
			</div>
		`;
	});

	waypointList.innerHTML = html;

	// Setup drag and drop
	setupDragAndDrop();

	// Category header click - expand/collapse
	waypointList
		.querySelectorAll('.waypoint-category-header')
		.forEach((header) => {
			header.addEventListener('click', (e) => {
				if (e.target.closest('.category-visibility-toggle')) return;
				if (e.target.closest('.category-edit-btn')) return;
				if (e.target.closest('.category-ini-btn')) return;
				const category = header.closest('.waypoint-category');
				category.classList.toggle('collapsed');
			});
		});

	// Category edit button
	waypointList.querySelectorAll('.category-edit-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const catId = btn.dataset.category;
			openEditCategoryModal(catId);
		});
	});

	// Category INI add button
	waypointList
		.querySelectorAll('.category-ini-btn.add-ini')
		.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const catId = btn.dataset.category || null;
				const catName = catId ? categories.find((c) => c.id === catId)?.name : 'Uncategorized';
				showIniModal(
					'Add to ARK .ini',
					`This will add all markers in the "${catName}" category to your ARK game .ini file, making them appear as waypoints in-game.`
				);
			});
		});

	// Category INI remove button
	waypointList
		.querySelectorAll('.category-ini-btn.remove-ini')
		.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const catId = btn.dataset.category || null;
				const catName = catId ? categories.find((c) => c.id === catId)?.name : 'Uncategorized';
				showIniModal(
					'Remove from ARK .ini',
					`This will remove all markers in the "${catName}" category from your ARK game .ini file.`
				);
			});
		});

	// Category visibility toggle (clicking the dot/icon)
	waypointList
		.querySelectorAll('.category-visibility-toggle')
		.forEach((el) => {
			el.addEventListener('click', (e) => {
				e.stopPropagation();
				const catId = el.dataset.category;
				const cat = categories.find((c) => c.id === catId);
				if (cat) {
					updateCategory(catId, { visible: !cat.visible });
					renderMapMarkers();
					renderWaypoints();
				}
			});
		});

	// Individual marker visibility toggle
	waypointList.querySelectorAll('.marker-visibility-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const markerId = btn.dataset.markerId;
			toggleMarkerVisibility(markerId);
		});
	});

	// Waypoint item click - pan to marker
	waypointList.querySelectorAll('.waypoint-item').forEach((item) => {
		item.addEventListener('click', (e) => {
			if (
				e.target.closest('.waypoint-actions') ||
				e.target.closest('.marker-visibility-btn') ||
				e.target.closest('.drag-handle')
			)
				return;
			const index = parseInt(item.dataset.index);
			const marker = allMarkers[index];
			if (marker && !isMarkerHidden(marker.id)) {
				panToMarker(marker.lat, marker.lon);
				highlightWaypoint(item.dataset.markerId);
			}
		});
	});

	// Edit button handlers (user markers only)
	waypointList.querySelectorAll('.edit-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const userIndex = parseInt(btn.dataset.userIndex);
			if (!isNaN(userIndex)) {
				openEditMarkerModal(userIndex);
			}
		});
	});

	// Delete button handlers (user markers only)
	waypointList.querySelectorAll('.delete-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const userIndex = parseInt(btn.dataset.userIndex);
			if (!isNaN(userIndex)) {
				deleteMarker(userIndex);
			}
		});
	});
}

// Drag and drop functionality for markers
function setupDragAndDrop() {
	let draggedItem = null;

	// Setup draggable items
	waypointList.querySelectorAll('.waypoint-item[draggable="true"]').forEach((item) => {
		item.addEventListener('dragstart', (e) => {
			draggedItem = item;
			item.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', item.dataset.userIndex);
		});

		item.addEventListener('dragend', () => {
			item.classList.remove('dragging');
			draggedItem = null;
			// Remove all drag-over classes
			waypointList.querySelectorAll('.drag-over').forEach((el) => {
				el.classList.remove('drag-over');
			});
		});
	});

	// Setup drop zones (category items containers)
	waypointList.querySelectorAll('.drop-zone').forEach((zone) => {
		zone.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			zone.classList.add('drag-over');
		});

		zone.addEventListener('dragleave', (e) => {
			// Only remove if we're actually leaving the zone
			if (!zone.contains(e.relatedTarget)) {
				zone.classList.remove('drag-over');
			}
		});

		zone.addEventListener('drop', (e) => {
			e.preventDefault();
			zone.classList.remove('drag-over');

			if (!draggedItem) return;

			const userIndex = parseInt(draggedItem.dataset.userIndex);
			const targetCategory = zone.dataset.category || null; // empty string becomes null

			if (isNaN(userIndex)) return;

			// Update the marker's category
			const mapMarkers = userMarkers[currentMap] || [];
			if (mapMarkers[userIndex]) {
				mapMarkers[userIndex].category = targetCategory;
				saveState();
				renderMapMarkers();
				renderWaypoints();
			}
		});
	});
}

function panToMarker(lat, lon) {
	// Center the map on the marker
	const imgWidth = mapImage.naturalWidth;
	const imgHeight = mapImage.naturalHeight;

	const relX = (lon / 100) * imgWidth - imgWidth / 2;
	const relY = (lat / 100) * imgHeight - imgHeight / 2;

	mapOffsetX = -relX * mapScale;
	mapOffsetY = -relY * mapScale;

	updateMapTransform();
	renderMapMarkers();
}

// ===========================================
// MARKER MODAL
// ===========================================
function openMarkerModal(lat, lon) {
	editingMarkerIndex = null;
	pendingMarker = { lat, lon };

	markerModalTitle.textContent = 'Add Marker';
	markerNameInput.value = '';
	markerLatInput.value = lat.toFixed(1);
	markerLonInput.value = lon.toFixed(1);
	markerCategorySelect.value = selectedCategory;
	deleteMarkerBtn.classList.add('hidden');

	// Reset new category toggle state
	newCategoryInput.style.display = 'none';
	newCategoryInput.value = '';
	markerCategorySelect.style.display = '';
	toggleNewCategoryBtn.textContent = '+';
	toggleNewCategoryBtn.title = 'Create new category';

	markerModal.classList.remove('hidden');
	markerNameInput.focus();
}

function openEditMarkerModal(index) {
	const mapMarkers = userMarkers[currentMap] || [];
	const marker = mapMarkers[index];
	if (!marker) return;

	editingMarkerIndex = index;
	editingPresetIndex = null;
	pendingMarker = { lat: marker.lat, lon: marker.lon };

	markerModalTitle.textContent = 'Edit Marker';
	markerNameInput.value = marker.name;
	markerLatInput.value = marker.lat.toFixed(1);
	markerLonInput.value = marker.lon.toFixed(1);
	markerCategorySelect.value = marker.category || ''; // null becomes empty string
	deleteMarkerBtn.classList.remove('hidden');

	// Reset new category toggle state
	newCategoryInput.style.display = 'none';
	newCategoryInput.value = '';
	markerCategorySelect.style.display = '';
	toggleNewCategoryBtn.textContent = '+';
	toggleNewCategoryBtn.title = 'Create new category';

	markerModal.classList.remove('hidden');
	markerNameInput.focus();
	markerNameInput.select();
}

function openEditPresetMarkerModal(marker, combinedIndex) {
	editingMarkerIndex = null;
	editingPresetIndex = marker.id; // Store the marker ID for preset overrides
	pendingMarker = { lat: marker.lat, lon: marker.lon };

	markerModalTitle.textContent = 'Edit Preset Marker';
	markerNameInput.value = marker.name;
	markerLatInput.value = marker.lat.toFixed(1);
	markerLonInput.value = marker.lon.toFixed(1);
	markerCategorySelect.value = marker.category;
	// Disable lat/lon editing for presets, hide delete button
	markerLatInput.disabled = true;
	markerLonInput.disabled = true;
	deleteMarkerBtn.classList.add('hidden');

	markerModal.classList.remove('hidden');
	markerNameInput.focus();
	markerNameInput.select();
}

function closeMarkerModal() {
	markerModal.classList.add('hidden');
	pendingMarker = null;
	editingMarkerIndex = null;
	editingPresetIndex = null;
	// Re-enable lat/lon inputs
	markerLatInput.disabled = false;
	markerLonInput.disabled = false;
}

function saveMarker() {
	const name = markerNameInput.value.trim() || 'Unnamed Marker';
	const lat = parseFloat(markerLatInput.value);
	const lon = parseFloat(markerLonInput.value);

	if (isNaN(lat) || isNaN(lon)) return;

	// Determine category - either from new category input or select
	let category;
	if (newCategoryInput.style.display !== 'none' && newCategoryInput.value.trim()) {
		// Creating a new category inline
		const newCatName = newCategoryInput.value.trim();
		const newCatId = 'cat_' + Date.now();
		// Create the category
		if (!mapCategories[currentMap]) {
			mapCategories[currentMap] = [];
		}
		const newCategory = {
			id: newCatId,
			name: newCatName,
			color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'), // Random color
			visible: true
		};
		mapCategories[currentMap].push(newCategory);
		category = newCatId;
	} else {
		// Empty string becomes null for uncategorized
		category = markerCategorySelect.value || null;
	}

	// Remember the last used category for new markers
	selectedCategory = category || '';

	if (editingPresetIndex !== null) {
		// Update preset marker override
		if (!presetOverrides[currentMap]) {
			presetOverrides[currentMap] = {};
		}
		presetOverrides[currentMap][editingPresetIndex] = { name, category };
	} else if (editingMarkerIndex !== null) {
		// Update existing user marker
		const mapMarkers = userMarkers[currentMap] || [];
		if (mapMarkers[editingMarkerIndex]) {
			mapMarkers[editingMarkerIndex].name = name;
			mapMarkers[editingMarkerIndex].category = category;
			mapMarkers[editingMarkerIndex].lat = lat;
			mapMarkers[editingMarkerIndex].lon = lon;
			mapMarkers[editingMarkerIndex].updatedAt = new Date().toISOString();
		}
	} else {
		// Add new marker
		addMarker({
			name,
			category,
			lat,
			lon,
			createdAt: new Date().toISOString(),
		});
	}

	renderMapMarkers();
	renderWaypoints();
	updateCategorySelect();
	saveState();
	closeMarkerModal();
}

function deleteCurrentMarker() {
	if (editingMarkerIndex !== null) {
		deleteMarker(editingMarkerIndex);
		closeMarkerModal();
	}
}

// ===========================================
// IMPORT / EXPORT
// ===========================================
async function browseForFile() {
	const result = await ipcRenderer.invoke('open-file-dialog');
	if (!result.canceled && result.filePaths.length > 0) {
		filePathInput.value = result.filePaths[0];
		importBtn.disabled = false;
		showStatus(ioStatus, 'File selected', 'info');
	}
}

async function importWaypoints() {
	if (!filePathInput.value) return;

	showStatus(ioStatus, 'Importing...', 'info');
	const result = await ipcRenderer.invoke('read-file', filePathInput.value);

	if (!result.success) {
		showStatus(ioStatus, `Error: ${result.error}`, 'error');
		return;
	}

	try {
		// Try to parse as JSON first
		const data = JSON.parse(result.content);
		if (data.waypoints) {
			// Our export format
			if (data.mapName && data.waypoints) {
				userMarkers[data.mapName] = data.waypoints;
			} else if (Array.isArray(data.waypoints)) {
				userMarkers[currentMap] = data.waypoints;
			}
		} else if (Array.isArray(data)) {
			userMarkers[currentMap] = data;
		}

		renderMapMarkers();
		renderWaypoints();
		saveState();
		showStatus(ioStatus, 'Import successful!', 'success');
	} catch (e) {
		showStatus(
			ioStatus,
			'Could not parse file. Expected JSON format.',
			'error'
		);
	}
}

async function exportWaypoints() {
	const mapMarkers = userMarkers[currentMap] || [];

	if (mapMarkers.length === 0) {
		showStatus(
			ioStatus,
			'No custom markers to export (presets are built-in)',
			'error'
		);
		return;
	}

	const exportData = {
		exportDate: new Date().toISOString(),
		mapName: currentMap,
		mapDisplayName: mapSelect.options[mapSelect.selectedIndex].text,
		waypointCount: mapMarkers.length,
		categories: getCategories(),
		waypoints: mapMarkers,
	};

	const filename = `ark-waypoints-${currentMap}-${Date.now()}.json`;
	const result = await ipcRenderer.invoke(
		'export-to-desktop',
		exportData,
		filename
	);

	if (result.success) {
		showStatus(ioStatus, `Exported to Desktop: ${filename}`, 'success');
	} else {
		showStatus(ioStatus, `Export failed: ${result.error}`, 'error');
	}
}

// ===========================================
// STATE PERSISTENCE
// ===========================================
function saveState() {
	// Convert Sets to arrays for JSON serialization
	const hiddenMarkersForSave = {};
	Object.keys(hiddenMarkers).forEach((mapName) => {
		hiddenMarkersForSave[mapName] = Array.from(hiddenMarkers[mapName]);
	});

	const state = {
		currentMap,
		userMarkers,
		mapCategories,
		presetOverrides,
		hiddenMarkers: hiddenMarkersForSave,
	};
	localStorage.setItem('arkLocatorState', JSON.stringify(state));
}

function loadState() {
	try {
		const saved = localStorage.getItem('arkLocatorState');
		if (saved) {
			const state = JSON.parse(saved);
			currentMap = state.currentMap || 'lost-colony';
			// Support both old 'markers' key and new 'userMarkers' key for backward compatibility
			userMarkers = state.userMarkers || state.markers || {};
			// Load per-map category overrides
			if (state.mapCategories) {
				mapCategories = state.mapCategories;
			}
			// Load preset marker overrides
			if (state.presetOverrides) {
				presetOverrides = state.presetOverrides;
			}
			// Load hidden markers and convert arrays back to Sets
			if (state.hiddenMarkers) {
				Object.keys(state.hiddenMarkers).forEach((mapName) => {
					hiddenMarkers[mapName] = new Set(
						state.hiddenMarkers[mapName]
					);
				});
			}
			mapSelect.value = currentMap;
		}
	} catch (e) {
		console.error('Failed to load state:', e);
	}
}

// ===========================================
// UTILITIES
// ===========================================
function showStatus(element, message, type) {
	element.textContent = message;
	element.className = 'status-message';
	if (type) {
		element.classList.add(type);
	}

	if (type === 'success' || type === 'info') {
		setTimeout(() => {
			element.className = 'status-message';
		}, 3000);
	}
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}
