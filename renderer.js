const { ipcRenderer } = require('electron');

// ===========================================
// STATE
// ===========================================
let currentMap = 'island';
let userMarkers = {}; // { mapName: [marker, marker, ...] } - User-created markers only
let categories = [
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
		icon: 'https://r2.wikily.gg/images/ark/icons/ThatchFoundation_Icon.webp',
		visible: true,
	},
	{
		id: 'caves',
		name: 'Caves',
		color: '#9c27b0',
		icon: 'https://r2.wikily.gg/images/ark/icons/Artifact_Icon.webp',
		visible: true,
	},
	{
		id: 'obelisks',
		name: 'Obelisks',
		color: '#00bcd4',
		icon: 'https://r2.wikily.gg/images/ark/icons/Tribute_Icon.webp',
		visible: true,
	},
	{
		id: 'metal',
		name: 'Metal',
		color: '#78909c',
		icon: 'https://r2.wikily.gg/images/ark/icons/MetalOre_Icon.webp',
		visible: true,
	},
	{
		id: 'crystal',
		name: 'Crystal',
		color: '#e1bee7',
		icon: 'https://r2.wikily.gg/images/ark/icons/Crystal_Icon.webp',
		visible: true,
	},
	{
		id: 'obsidian',
		name: 'Obsidian',
		color: '#37474f',
		icon: 'https://r2.wikily.gg/images/ark/icons/Obsidian_Icon.webp',
		visible: true,
	},
	{
		id: 'oil',
		name: 'Oil',
		color: '#212121',
		icon: 'https://r2.wikily.gg/images/ark/icons/OilFuel_Icon.webp',
		visible: true,
	},
	{
		id: 'pearls',
		name: 'Silica Pearls',
		color: '#fff59d',
		icon: 'https://r2.wikily.gg/images/ark/icons/Pearl_Icon.webp',
		visible: true,
	},
	{
		id: 'notes',
		name: 'Explorer Notes',
		color: '#ffcc80',
		icon: 'https://r2.wikily.gg/images/ark/icons/NoteIcon.webp',
		visible: true,
	},
	{
		id: 'loot-crates',
		name: 'Loot Crates',
		color: '#2196f3',
		icon: 'https://r2.wikily.gg/images/ark/icons/SupplyCrate_Icon.webp',
		visible: true,
	},
	{
		id: 'drops-veins',
		name: 'Drops & Veins',
		color: '#9c27b0',
		icon: null,
		visible: true,
	},
	{
		id: 'wyvern-eggs',
		name: 'Wyvern Eggs',
		color: '#e91e63',
		icon: 'https://r2.wikily.gg/images/ark/icons/WyvernEgg_Icon.webp',
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
let selectedCategory = 'default';
let pendingMarker = null;
let editingMarkerIndex = null; // Track if we're editing an existing marker (user markers only)

// Map zoom/pan state
let mapScale = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
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
	'genesis-2': `${WIKILY_CDN}/maps/Genesis.webp`,
	'lost-island': `${WIKILY_CDN}/maps/LostIsland.webp`,
	fjordur: `${WIKILY_CDN}/maps/Fjordur.webp`,
	astraeos: 'assets/maps/astraeos.jpg', // Not available on wikily.gg
};

// Preset locations for The Island (can be loaded as starting data)
const presetLocations = {
	island: {
		obelisks: [
			{ name: 'Red Obelisk', lat: 20.5, lon: 82.0, category: 'obelisks' },
			{
				name: 'Blue Obelisk',
				lat: 25.0,
				lon: 25.3,
				category: 'obelisks',
			},
			{
				name: 'Green Obelisk',
				lat: 59.0,
				lon: 72.3,
				category: 'obelisks',
			},
		],
		caves: [
			{
				name: 'Central Cave (Chitin)',
				lat: 41.5,
				lon: 46.9,
				category: 'caves',
			},
			{
				name: 'South Cave 1 (Hunter)',
				lat: 80.3,
				lon: 53.5,
				category: 'caves',
			},
			{
				name: 'South Cave 2 (Clever)',
				lat: 68.2,
				lon: 56.2,
				category: 'caves',
			},
			{
				name: 'Lava Cave (Massive)',
				lat: 70.6,
				lon: 86.1,
				category: 'caves',
			},
			{
				name: 'Swamp Cave (Immune)',
				lat: 62.7,
				lon: 37.3,
				category: 'caves',
			},
			{
				name: 'Snow Cave (Strong)',
				lat: 29.1,
				lon: 31.8,
				category: 'caves',
			},
			{
				name: 'North East Cave (Devourer)',
				lat: 14.7,
				lon: 85.4,
				category: 'caves',
			},
			{
				name: 'North West Cave (Skylord)',
				lat: 18.8,
				lon: 19.3,
				category: 'caves',
			},
			{
				name: 'Upper South Cave (Pack)',
				lat: 68.6,
				lon: 43.5,
				category: 'caves',
			},
			{
				name: 'Tek Cave (Overseer)',
				lat: 43.1,
				lon: 39.2,
				category: 'caves',
			},
		],
		'loot-crates': [
			{
				name: 'Deep sea loot crate',
				lat: 52.3,
				lon: 2.0,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 93.1,
				lon: 2.5,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 32.5,
				lon: 0.9,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 4.4,
				lon: 0.3,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 4.0,
				lon: 27.1,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 5.1,
				lon: 38.0,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 2.5,
				lon: 63.5,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 0.8,
				lon: 85.3,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 3.4,
				lon: 98.0,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 17.5,
				lon: 95.8,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 43.2,
				lon: 99.2,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 60.7,
				lon: 99.0,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 96.4,
				lon: 98.0,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 99.3,
				lon: 70.6,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 99.0,
				lon: 32.0,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 17.3,
				lon: 84.9,
				category: 'loot-crates',
			},
			{
				name: 'Deep sea loot crate',
				lat: 60.4,
				lon: 0.3,
				category: 'loot-crates',
			},
		],
		danger: [
			{ name: 'Redwood Forest', lat: 55, lon: 55, category: 'danger' },
			{ name: 'Carnivore Island', lat: 42, lon: 90, category: 'danger' },
			{ name: 'The Maw', lat: 87, lon: 90, category: 'danger' },
		],
	},
	'scorched-earth': {
		obelisks: [
			{ name: 'Red Obelisk', lat: 22.0, lon: 68.0, category: 'obelisks' },
			{
				name: 'Blue Obelisk',
				lat: 77.0,
				lon: 75.0,
				category: 'obelisks',
			},
			{
				name: 'Green Obelisk',
				lat: 27.0,
				lon: 22.0,
				category: 'obelisks',
			},
		],
	},
	aberration: {
		obelisks: [
			{
				name: 'Surface Terminal 1',
				lat: 15.0,
				lon: 26.0,
				category: 'obelisks',
			},
			{
				name: 'Surface Terminal 2',
				lat: 21.0,
				lon: 56.0,
				category: 'obelisks',
			},
			{
				name: 'Surface Terminal 3',
				lat: 5.0,
				lon: 85.0,
				category: 'obelisks',
			},
		],
	},
	extinction: {
		obelisks: [
			{
				name: 'King Titan Terminal',
				lat: 9.5,
				lon: 40.0,
				category: 'obelisks',
			},
			{
				name: 'Desert Titan Terminal',
				lat: 87.0,
				lon: 71.0,
				category: 'obelisks',
			},
			{
				name: 'Ice Titan Terminal',
				lat: 9.0,
				lon: 64.0,
				category: 'obelisks',
			},
			{
				name: 'Forest Titan Terminal',
				lat: 18.0,
				lon: 62.0,
				category: 'obelisks',
			},
		],
		notes: [
			{ name: 'Bob note', lat: 44.1, lon: 63.1, category: 'notes' },
			{ name: 'Bob note', lat: 61.4, lon: 53.4, category: 'notes' },
			{ name: 'Bob note', lat: 47.1, lon: 36.8, category: 'notes' },
			{ name: 'Bob note', lat: 23.4, lon: 40.6, category: 'notes' },
			{ name: 'Bob note', lat: 4.5, lon: 28.9, category: 'notes' },
			{ name: 'Bob note', lat: 36.5, lon: 8.2, category: 'notes' },
			{ name: 'Bob note', lat: 69.1, lon: 5.3, category: 'notes' },
			{ name: 'Bob note', lat: 97, lon: 29.2, category: 'notes' },
			{ name: 'Bob note', lat: 92, lon: 64.9, category: 'notes' },
			{ name: 'Bob note', lat: 77.6, lon: 89.2, category: 'notes' },
		],
		'drops-veins': [
			{ name: 'Purple', lat: 33.6, lon: 59.2, category: 'drops-veins' },
			{ name: 'Purple', lat: 25.5, lon: 59.3, category: 'drops-veins' },
			{
				name: 'Red/25k/50k',
				lat: 18.3,
				lon: 56.1,
				category: 'drops-veins',
			},
			{
				name: 'Purple/Red/25k/50k',
				lat: 22.2,
				lon: 46,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/25k/50k',
				lat: 26.8,
				lon: 53.1,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/25k/50k',
				lat: 30.8,
				lon: 52.7,
				category: 'drops-veins',
			},
			{
				name: 'Yellow/Blue/10k',
				lat: 33,
				lon: 46.8,
				category: 'drops-veins',
			},
			{
				name: 'Yellow/Blue/10k/25k',
				lat: 31.7,
				lon: 38.7,
				category: 'drops-veins',
			},
			{
				name: 'Yellow/Blue/10k/25k',
				lat: 26.1,
				lon: 38.1,
				category: 'drops-veins',
			},
			{
				name: 'Yellow/Blue/10k/25k',
				lat: 23.1,
				lon: 40,
				category: 'drops-veins',
			},
			{ name: '50k', lat: 32.1, lon: 33.9, category: 'drops-veins' },
			{
				name: 'Yellow/Blue/10k/25k',
				lat: 38.6,
				lon: 29.8,
				category: 'drops-veins',
			},
			{
				name: 'Purple/Red/50k',
				lat: 33.8,
				lon: 7.4,
				category: 'drops-veins',
			},
			{
				name: 'Purple/Red/25k/50k',
				lat: 18,
				lon: 6.1,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow',
				lat: 10.6,
				lon: 13.2,
				category: 'drops-veins',
			},
			{ name: 'Purple', lat: 42.4, lon: 7.2, category: 'drops-veins' },
			{
				name: 'Purple/Red/50k',
				lat: 51.2,
				lon: 13.6,
				category: 'drops-veins',
			},
			{
				name: 'Purple/Red/50k',
				lat: 53.2,
				lon: 9.2,
				category: 'drops-veins',
			},
			{ name: 'Purple', lat: 37.6, lon: 72.9, category: 'drops-veins' },
			{ name: '10k/25k', lat: 73.7, lon: 12.1, category: 'drops-veins' },
			{
				name: 'Purple/Red/50k',
				lat: 70.9,
				lon: 27.8,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow',
				lat: 91.3,
				lon: 24.6,
				category: 'drops-veins',
			},
			{ name: 'Purple', lat: 87, lon: 39.7, category: 'drops-veins' },
			{
				name: 'Red/Yellow/25k/50k',
				lat: 74.4,
				lon: 35.9,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/25k/50k',
				lat: 68.1,
				lon: 35.7,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/10k/25k',
				lat: 75.8,
				lon: 42.3,
				category: 'drops-veins',
			},
			{
				name: 'Yellow/Blue',
				lat: 69.5,
				lon: 48.9,
				category: 'drops-veins',
			},
			{
				name: 'Yellow/Blue',
				lat: 83.1,
				lon: 58.6,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/25k/50k',
				lat: 71.8,
				lon: 57.3,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/25k/50k',
				lat: 68.3,
				lon: 61.4,
				category: 'drops-veins',
			},
			{
				name: 'Purple/Red/50k',
				lat: 62.7,
				lon: 75.1,
				category: 'drops-veins',
			},
			{
				name: 'Red/Yellow/25k/50k',
				lat: 54.2,
				lon: 88.8,
				category: 'drops-veins',
			},
			{ name: 'Blue/10k', lat: 59.8, lon: 97.2, category: 'drops-veins' },
			{ name: 'Purple', lat: 45.3, lon: 91.5, category: 'drops-veins' },
			{ name: 'Blue/10k', lat: 42.2, lon: 82.3, category: 'drops-veins' },
		],
	},
	ragnarok: {
		obelisks: [
			{ name: 'Red Obelisk', lat: 17.3, lon: 78.5, category: 'obelisks' },
			{
				name: 'Blue Obelisk',
				lat: 58.0,
				lon: 45.0,
				category: 'obelisks',
			},
			{
				name: 'Green Obelisk',
				lat: 24.0,
				lon: 24.0,
				category: 'obelisks',
			},
		],
		caves: [
			{ name: 'Jungle Dungeon', lat: 18.0, lon: 28.5, category: 'caves' },
			{
				name: 'Carnivorous Caverns',
				lat: 30.0,
				lon: 30.0,
				category: 'caves',
			},
			{
				name: "Life's Labyrinth",
				lat: 54.5,
				lon: 68.0,
				category: 'caves',
			},
		],
		'wyvern-eggs': [
			{
				name: 'Ice Wyvern - In a circle of trees',
				lat: 37.7,
				lon: 65.0,
				category: 'wyvern-eggs',
			},
			{
				name: 'Ice Wyvern - Open ground',
				lat: 44.4,
				lon: 58.9,
				category: 'wyvern-eggs',
			},
			{
				name: 'Ice Wyvern - Edge of a cliff',
				lat: 47.0,
				lon: 51.7,
				category: 'wyvern-eggs',
			},
			{
				name: 'Ice Wyvern - Hidden ledge',
				lat: 33.5,
				lon: 68.8,
				category: 'wyvern-eggs',
			},
			{
				name: 'Ice Wyvern - Rocky ledge',
				lat: 42.8,
				lon: 55.2,
				category: 'wyvern-eggs',
			},
		],
	},
};

// ===========================================
// DOM ELEMENTS
// ===========================================
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const mapSelect = document.getElementById('map-select');
const categoryList = document.getElementById('category-list');
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
const markerLatInput = document.getElementById('marker-lat');
const markerLonInput = document.getElementById('marker-lon');
const cancelMarkerBtn = document.getElementById('cancel-marker');
const saveMarkerBtn = document.getElementById('save-marker');
const deleteMarkerBtn = document.getElementById('delete-marker-btn');

const categoryModal = document.getElementById('category-modal');
const categoryNameInput = document.getElementById('category-name');
const categoryColorInput = document.getElementById('category-color');
const cancelCategoryBtn = document.getElementById('cancel-category');
const saveCategoryBtn = document.getElementById('save-category');

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
	renderCategories();
	renderWaypoints();
});

function setupEventListeners() {
	// Sidebar toggle
	toggleSidebarBtn.addEventListener('click', () => {
		sidebar.classList.toggle('collapsed');
	});

	// Map selection
	mapSelect.addEventListener('change', (e) => {
		currentMap = e.target.value;
		loadMap(currentMap);
		renderWaypoints();
		saveState();
	});

	// Category management
	addCategoryBtn.addEventListener('click', openCategoryModal);
	cancelCategoryBtn.addEventListener('click', closeCategoryModal);
	saveCategoryBtn.addEventListener('click', saveCategory);

	// Marker management
	cancelMarkerBtn.addEventListener('click', closeMarkerModal);
	saveMarkerBtn.addEventListener('click', saveMarker);
	deleteMarkerBtn.addEventListener('click', deleteCurrentMarker);

	// Map interactions
	mapViewport.addEventListener('click', handleMapClick);
	mapViewport.addEventListener('mousemove', handleMapMouseMove);
	mapViewport.addEventListener('mousedown', handleMapMouseDown);
	mapViewport.addEventListener('mouseup', handleMapMouseUp);
	mapViewport.addEventListener('mouseleave', handleMapMouseUp);
	mapViewport.addEventListener('wheel', handleMapWheel);
	mapViewport.addEventListener('contextmenu', (e) => e.preventDefault());

	// Keyboard events for panning
	document.addEventListener('keydown', handleKeyDown);
	document.addEventListener('keyup', handleKeyUp);

	// Zoom controls
	zoomInBtn.addEventListener('click', () => zoomMap(1.2));
	zoomOutBtn.addEventListener('click', () => zoomMap(0.8));
	zoomResetBtn.addEventListener('click', resetMapView);

	// Refresh button
	refreshBtn.addEventListener('click', () => location.reload());

	// Import/Export
	browseBtn.addEventListener('click', browseForFile);
	importBtn.addEventListener('click', importWaypoints);
	exportBtn.addEventListener('click', exportWaypoints);

	// Load Presets
	document
		.getElementById('load-presets-btn')
		.addEventListener('click', loadMapPresets);
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
}

function zoomMap(factor) {
	const newScale = mapScale * factor;
	if (newScale >= 0.5 && newScale <= 5) {
		mapScale = newScale;
		updateMapTransform();
		renderMapMarkers();
	}
}

function updateMapTransform() {
	mapImage.style.transform = `translate(calc(-50% + ${mapOffsetX}px), calc(-50% + ${mapOffsetY}px)) scale(${mapScale})`;
}

function handleMapWheel(e) {
	e.preventDefault();
	const factor = e.deltaY > 0 ? 0.9 : 1.1;
	zoomMap(factor);
}

function handleKeyDown(e) {
	if (e.code === 'Space' && !spacePressed) {
		spacePressed = true;
		mapViewport.style.cursor = 'grab';
	}
}

function handleKeyUp(e) {
	if (e.code === 'Space') {
		spacePressed = false;
		if (!isPanning) {
			mapViewport.style.cursor = 'crosshair';
		}
	}
}

function handleMapMouseDown(e) {
	// Pan with middle mouse button, right mouse button, or space+left click
	if (e.button === 1 || e.button === 2 || (e.button === 0 && spacePressed)) {
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
		mapViewport.style.cursor = spacePressed ? 'grab' : 'crosshair';
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
		renderMapMarkers();
	}
}

function handleMapClick(e) {
	// Don't add marker if we were panning or space is held
	if (isPanning || spacePressed) return;
	// Only handle left click
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
// MARKERS
// ===========================================
function renderMapMarkers() {
	markersLayer.innerHTML = '';

	const mapMarkers = markers[currentMap] || [];

	mapMarkers.forEach((marker, index) => {
		const category = categories.find((c) => c.id === marker.category);
		if (!category || !category.visible) return;

		const pos = coordsToPixel(marker.lat, marker.lon);
		if (!pos) return;

		const markerEl = document.createElement('div');
		markerEl.className = 'map-marker';
		markerEl.style.left = `${pos.x}px`;
		markerEl.style.top = `${pos.y}px`;
		markerEl.dataset.index = index;

		// Use icon if category has one, otherwise use colored pin
		const markerInner = category.icon
			? `<img src="${category.icon}" class="marker-icon" alt="" onerror="this.outerHTML='<div class=\\'marker-pin\\' style=\\'background-color: ${category.color}\\'></div>'">`
			: `<div class="marker-pin" style="background-color: ${category.color}"></div>`;

		markerEl.innerHTML = `
			${markerInner}
			<div class="marker-label">${escapeHtml(marker.name)}</div>
		`;

		// Click to edit marker
		markerEl.addEventListener('click', (e) => {
			e.stopPropagation();
			openEditMarkerModal(index);
		});

		markersLayer.appendChild(markerEl);
	});
}

function addMarker(marker) {
	if (!markers[currentMap]) {
		markers[currentMap] = [];
	}
	markers[currentMap].push(marker);
	renderMapMarkers();
	renderWaypoints();
	saveState();
}

function deleteMarker(index) {
	if (markers[currentMap]) {
		markers[currentMap].splice(index, 1);
		renderMapMarkers();
		renderWaypoints();
		saveState();
	}
}

function highlightWaypoint(index) {
	const items = waypointList.querySelectorAll('.waypoint-item');
	items.forEach((item, i) => {
		item.style.background = i === index ? 'rgba(0, 217, 255, 0.2)' : '';
	});
}

// ===========================================
// CATEGORIES
// ===========================================
function renderCategories() {
	categoryList.innerHTML = categories
		.map((cat) => {
			const iconHtml = cat.icon
				? `<img src="${cat.icon}" class="category-icon" alt="" onerror="this.style.display='none'">`
				: `<div class="category-color" style="background-color: ${cat.color}"></div>`;
			return `
			<div class="category-item ${
				cat.id === selectedCategory ? 'active' : ''
			}" data-id="${cat.id}">
				${iconHtml}
				<span class="category-name">${escapeHtml(cat.name)}</span>
				<span class="category-count">${getMarkerCountForCategory(cat.id)}</span>
				<button class="category-visibility ${
					cat.visible ? '' : 'hidden-cat'
				}" data-id="${cat.id}">
					${cat.visible ? '👁' : '👁‍🗨'}
				</button>
			</div>
		`;
		})
		.join('');

	// Add click handlers
	categoryList.querySelectorAll('.category-item').forEach((item) => {
		item.addEventListener('click', (e) => {
			if (e.target.classList.contains('category-visibility')) return;
			selectedCategory = item.dataset.id;
			renderCategories();
		});
	});

	categoryList.querySelectorAll('.category-visibility').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const catId = btn.dataset.id;
			const cat = categories.find((c) => c.id === catId);
			if (cat) {
				cat.visible = !cat.visible;
				renderCategories();
				renderMapMarkers();
				saveState();
			}
		});
	});

	// Update marker category select
	markerCategorySelect.innerHTML = categories
		.map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
		.join('');
}

function getMarkerCountForCategory(categoryId) {
	const mapMarkers = markers[currentMap] || [];
	return mapMarkers.filter((m) => m.category === categoryId).length;
}

function openCategoryModal() {
	categoryNameInput.value = '';
	categoryColorInput.value = '#00d9ff';
	categoryModal.classList.remove('hidden');
}

function closeCategoryModal() {
	categoryModal.classList.add('hidden');
}

function saveCategory() {
	const name = categoryNameInput.value.trim();
	const color = categoryColorInput.value;

	if (!name) return;

	const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
	categories.push({ id, name, color, icon: null, visible: true });

	renderCategories();
	closeCategoryModal();
	saveState();
}

// ===========================================
// WAYPOINTS LIST
// ===========================================
function renderWaypoints() {
	const mapMarkers = markers[currentMap] || [];
	waypointCount.textContent = `${mapMarkers.length} marker${
		mapMarkers.length !== 1 ? 's' : ''
	}`;

	if (mapMarkers.length === 0) {
		waypointList.innerHTML =
			'<p class="empty-state">Click on the map to add markers</p>';
		return;
	}

	waypointList.innerHTML = mapMarkers
		.map((marker, index) => {
			const category =
				categories.find((c) => c.id === marker.category) ||
				categories[0];
			return `
			<div class="waypoint-item" data-index="${index}">
				<div class="marker-dot" style="background-color: ${category.color}"></div>
				<span class="name">${escapeHtml(marker.name)}</span>
				<span class="coords">${marker.lat.toFixed(1)}, ${marker.lon.toFixed(1)}</span>
				<div class="waypoint-actions">
					<button class="edit-btn" data-index="${index}" title="Edit">✎</button>
					<button class="delete-btn" data-index="${index}" title="Delete">✕</button>
				</div>
			</div>
		`;
		})
		.join('');

	// Add click handlers for waypoint items (pan to marker)
	waypointList.querySelectorAll('.waypoint-item').forEach((item) => {
		item.addEventListener('click', (e) => {
			if (e.target.closest('.waypoint-actions')) return;
			const index = parseInt(item.dataset.index);
			const marker = mapMarkers[index];
			if (marker) {
				panToMarker(marker.lat, marker.lon);
				highlightWaypoint(index);
			}
		});
	});

	// Edit button handlers
	waypointList.querySelectorAll('.edit-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			openEditMarkerModal(parseInt(btn.dataset.index));
		});
	});

	// Delete button handlers
	waypointList.querySelectorAll('.delete-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			deleteMarker(parseInt(btn.dataset.index));
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

	markerModal.classList.remove('hidden');
	markerNameInput.focus();
}

function openEditMarkerModal(index) {
	const mapMarkers = markers[currentMap] || [];
	const marker = mapMarkers[index];
	if (!marker) return;

	editingMarkerIndex = index;
	pendingMarker = { lat: marker.lat, lon: marker.lon };

	markerModalTitle.textContent = 'Edit Marker';
	markerNameInput.value = marker.name;
	markerLatInput.value = marker.lat.toFixed(1);
	markerLonInput.value = marker.lon.toFixed(1);
	markerCategorySelect.value = marker.category;
	deleteMarkerBtn.classList.remove('hidden');

	markerModal.classList.remove('hidden');
	markerNameInput.focus();
	markerNameInput.select();
}

function closeMarkerModal() {
	markerModal.classList.add('hidden');
	pendingMarker = null;
	editingMarkerIndex = null;
}

function saveMarker() {
	const name = markerNameInput.value.trim() || 'Unnamed Marker';
	const category = markerCategorySelect.value;
	const lat = parseFloat(markerLatInput.value);
	const lon = parseFloat(markerLonInput.value);

	if (isNaN(lat) || isNaN(lon)) return;

	if (editingMarkerIndex !== null) {
		// Update existing marker
		const mapMarkers = markers[currentMap] || [];
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
	renderCategories();
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
				markers[data.mapName] = data.waypoints;
			} else if (Array.isArray(data.waypoints)) {
				markers[currentMap] = data.waypoints;
			}
		} else if (Array.isArray(data)) {
			markers[currentMap] = data;
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
	const mapMarkers = markers[currentMap] || [];

	if (mapMarkers.length === 0) {
		showStatus(ioStatus, 'No markers to export', 'error');
		return;
	}

	const exportData = {
		exportDate: new Date().toISOString(),
		mapName: currentMap,
		mapDisplayName: mapSelect.options[mapSelect.selectedIndex].text,
		waypointCount: mapMarkers.length,
		categories: categories,
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

function loadMapPresets() {
	const presets = presetLocations[currentMap];

	if (!presets) {
		showStatus(ioStatus, `No presets available for this map`, 'info');
		return;
	}

	// Initialize markers array for current map if needed
	if (!markers[currentMap]) {
		markers[currentMap] = [];
	}

	let addedCount = 0;

	// Add all preset categories
	Object.values(presets).forEach((categoryMarkers) => {
		categoryMarkers.forEach((preset) => {
			// Check if marker already exists at this location
			const exists = markers[currentMap].some(
				(m) =>
					Math.abs(m.lat - preset.lat) < 1 &&
					Math.abs(m.lon - preset.lon) < 1 &&
					m.name === preset.name
			);

			if (!exists) {
				markers[currentMap].push({
					name: preset.name,
					category: preset.category,
					lat: preset.lat,
					lon: preset.lon,
					createdAt: new Date().toISOString(),
					isPreset: true,
				});
				addedCount++;
			}
		});
	});

	renderMapMarkers();
	renderWaypoints();
	renderCategories();
	saveState();

	showStatus(ioStatus, `Added ${addedCount} preset markers`, 'success');
}

// ===========================================
// STATE PERSISTENCE
// ===========================================
function saveState() {
	const state = {
		currentMap,
		markers,
		categories,
	};
	localStorage.setItem('arkLocatorState', JSON.stringify(state));
}

function loadState() {
	try {
		const saved = localStorage.getItem('arkLocatorState');
		if (saved) {
			const state = JSON.parse(saved);
			currentMap = state.currentMap || 'island';
			markers = state.markers || {};
			if (state.categories && state.categories.length > 0) {
				categories = state.categories;
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
