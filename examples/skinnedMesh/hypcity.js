// HypCity - Procedural City Generation with Editable Props

// Suppress PropertyBinding warnings for missing nodes
const originalConsoleWarn = console.warn
console.warn = function (...args) {
	const message = args.join(' ')
	if (message.includes('THREE.PropertyBinding: No target node found for track:')) {
		// Suppress PropertyBinding warnings
		return
	}
	originalConsoleWarn.apply(console, args)
}

app.configure([
	{ key: 'seed', type: 'number', label: 'Random Seed', initial: 420 },
	{ key: 'citySize', type: 'number', label: 'City Size (blocks)', initial: 24, min: 1, max: 100 },
	{ key: 'blockSize', type: 'number', label: 'Block Size', initial: 10, min: 1, max: 100 },
	{ key: 'districtSize', type: 'number', label: 'District Size', initial: 12, min: 1, max: 100 },
	{ key: 'roadWidth', type: 'number', label: 'Road Width', initial: 2, min: 1, max: 40 },
	{ key: 'globalScale', type: 'number', label: 'Global Scale', initial: 6, min: 0.1, max: 20, dp: 2 },
	{ key: 'tileSpacingMultiplier', type: 'range', label: 'Tile Spacing Multiplier', initial: 0.2, min: 0.1, max: 2, step: 0.01 },
	{ key: 'tileSizeMultiplier', type: 'range', label: 'Tile Size Multiplier', initial: 1, min: 0.1, max: 2, step: 0.01 },
	{ key: 'tileVisibilityRange', type: 'number', label: 'Tile Visibility Range', initial: 2, min: 1, max: 10 },
	{ key: 'buildingScaleMultiplier', type: 'range', label: 'Building Scale Multiplier', initial: 0.7, min: 0.1, max: 2, step: 0.01 },
	{ key: 'heightMultiplier', type: 'range', label: 'Building Height Multiplier', initial: 0.7, min: 0.1, max: 2, step: 0.01 },

	{ key: 'buildingDensity', type: 'range', label: 'Building Density', initial: 0.4, min: 0, max: 1, step: 0.01 },
	{ key: 'minBuildingDistance', type: 'range', label: 'Min Building Distance', initial: 2.0, min: 0.5, max: 5, step: 0.1 },
	{ key: 'residentialDensity', type: 'range', label: 'Residential Density', initial: 0.3, min: 0, max: 1, step: 0.01 },
	{ key: 'commercialDensity', type: 'range', label: 'Commercial Density', initial: 0.5, min: 0, max: 1, step: 0.01 },
	{ key: 'skyscraperDensity', type: 'range', label: 'Skyscraper Density', initial: 0.2, min: 0, max: 1, step: 0.01 },
	{ key: 'megaBuildingChance', type: 'range', label: 'Mega Building Chance', initial: 0.05, min: 0, max: 0.3, step: 0.01 },
	{ key: 'spinningSpeed', type: 'range', label: 'Spinning Speed', initial: 0.5, min: 0, max: 2, step: 0.1 },
	{ key: 'spinningAnimation1', type: 'text', label: 'Spinning Animation 1', initial: 'Spin1', hint: 'Name of the first spinning animation' },
	{ key: 'spinningAnimation2', type: 'text', label: 'Spinning Animation 2', initial: 'Spin2', hint: 'Name of the second spinning animation' },
	{ key: 'spinningAnimation3', type: 'text', label: 'Spinning Animation 3', initial: 'Spin3', hint: 'Name of the third spinning animation' },
])

const CONFIG = {
	SEED: props.seed,
	CITY_SIZE: props.citySize,
	BLOCK_SIZE: props.blockSize,
	DISTRICT_SIZE: props.districtSize,
	ROAD_WIDTH: props.roadWidth,
	GLOBAL_SCALE: props.globalScale,
	TILE_SPACING_MULTIPLIER: props.tileSpacingMultiplier,
	TILE_SIZE_MULTIPLIER: props.tileSizeMultiplier,
	TILE_VISIBILITY_RANGE: props.tileVisibilityRange,
	BUILDING_SCALE_MULTIPLIER: props.buildingScaleMultiplier,
	HEIGHT_MULTIPLIER: props.heightMultiplier,

	BUILDING_DENSITY: props.buildingDensity,
	minBuildingDistance: props.minBuildingDistance,
	residentialDensity: props.residentialDensity,
	commercialDensity: props.commercialDensity,
	skyscraperDensity: props.skyscraperDensity,
	megaBuildingChance: props.megaBuildingChance,
	spinningSpeed: props.spinningSpeed,
	spinningAnimation1: props.spinningAnimation1,
	spinningAnimation2: props.spinningAnimation2,
	spinningAnimation3: props.spinningAnimation3,
}

// Define TILE_SIZE as in the backup (after CONFIG is defined)
const TILE_SIZE = CONFIG.CITY_SIZE * CONFIG.BLOCK_SIZE * CONFIG.TILE_SIZE_MULTIPLIER

// City container and state
const city = app.create('group');
world.add(city);
const activeTiles = new Map();
const placedBuildings = new Set();
const spinningNodes = new Set(); // Track spinning nodes
const spinningAnimations = new Map(); // Track spinning animations
let lastPlayerTile = null;
let updateTimer = 0;

// Gather in-world templates (with warning for missing)
const buildingNodeIds = [
	'storefronts',
	's_01_01', 's_01_02', 's_01_03',
	's_02_01', 's_02_02', 's_02_03',
	's_03_01', 's_03_02', 's_03_03',
	'buildingl1', 'buildingl2', 'buildingl3', //groups containing spinning skinnedmeshes
	's_05_01', 's_05_02', 's_05_03',
	'mega_02', 'mega_03', 'mega_04', 'mega_05', 'mega_06', 'mega_01',
]

// Helper function to search for nodes recursively
function findNodeByName(name, parent = world) {
	if (!parent) return null

	// Check if this node matches
	if (parent.name === name) return parent

	// Search children recursively
	if (parent.children) {
		for (const child of parent.children) {
			const found = findNodeByName(name, child)
			if (found) return found
		}
	}

	return null
}

// Helper function to find spinning skinned meshes and their animations
function findSpinningSkinnedMeshes(node, foundNodes = []) {
	if (!node) return foundNodes

	// Check if this node is a spinning rig (SpinRig1, SpinRig2, SpinRig3)
	if (node.name && (node.name.includes('SpinRig') || node.name.includes('Spin'))) {
		// Check if it has animations
		if (node.anims) {
			foundNodes.push({
				node: node,
				animations: node.anims,
				name: node.name
			})
		}
	}

	// Recursively search children
	if (node.children) {
		for (const child of node.children) {
			findSpinningSkinnedMeshes(child, foundNodes)
		}
	}

	return foundNodes
}

// Helper function to validate animation tracks
function validateAnimationTracks(template) {
	const availableNodeNames = new Set()
	template.traverse(child => {
		if (child.name) {
			availableNodeNames.add(child.name)
		}
	})

	// Return a map of valid animations for each node
	const validAnimationsMap = new Map()

	template.traverse(node => {
		if (node.anims && node.anims.length > 0) {
			const validAnimations = []
			for (const animName of node.anims) {
				try {
					if (node.mixer && node.mixer._actions) {
						const action = node.mixer._actions.find(a => a._clip && a._clip.name === animName)
						if (action && action._clip && action._clip.tracks) {
							// Check if all tracks have valid target nodes
							const validTracks = action._clip.tracks.every(track => {
								const targetName = track.name.split('.')[0]
								return availableNodeNames.has(targetName)
							})

							if (validTracks) {
								validAnimations.push(animName)
							} else {
								console.log(`[HypCity] Skipping animation ${animName} - invalid tracks`)
							}
						} else {
							validAnimations.push(animName)
						}
					} else {
						validAnimations.push(animName)
					}
				} catch (error) {
					console.log(`[HypCity] Error validating animation ${animName}:`, error.message)
				}
			}

			if (validAnimations.length > 0) {
				validAnimationsMap.set(node, validAnimations)
			}
		}
	})

	return validAnimationsMap
}

// Helper function to discover and play animations
function discoverAndPlayAnimations(template) {
	// Get configurable animation names
	const animNames = [
		CONFIG.spinningAnimation1 || 'Spin1',
		CONFIG.spinningAnimation2 || 'Spin2',
		CONFIG.spinningAnimation3 || 'Spin3'
	]

	// Just play the animations directly
	template.traverse(node => {
		if (node.anims) {
			animNames.forEach(animName => {
				if (node.anims.includes(animName)) {
					try {
						node.play({
							name: animName,
							loop: true,
							fade: 0.5
						})
						console.log('[HypCity] Successfully played', animName, 'on:', node.name || 'unnamed')

						// Store the animation info
						spinningAnimations.set(node, {
							animationName: animName,
							animations: node.anims,
							node: node
						})
					} catch (error) {
						console.error('[HypCity] Error playing', animName, ':', error)
					}
				}
			})
		}
	})
}

// Helper function to directly try to play animations on specific skinned meshes
function tryPlaySpinningAnimations(building) {
	// Direct approach like the test - just play the animations
	const rig1 = app.get('SpinRig1')
	const rig2 = app.get('SpinRig2')
	const rig3 = app.get('SpinRig3')

	if (rig1) {
		rig1.play({
			name: 'Spin1',
			loop: true,
			fade: 0.5
		})
	} else {
		console.log('[HypCity] SpinRig1 not found')
	}

	if (rig2) {
		rig2.play({
			name: 'Spin2',
			loop: true,
			fade: 0.5
		})
	} else {
		console.log('[HypCity] SpinRig2 not found')
	}

	if (rig3) {
		rig3.play({
			name: 'Spin3',
			loop: true,
			fade: 0.5
		})
	} else {
		console.log('[HypCity] SpinRig3 not found')
	}
}

// Helper function to debug node structure
function debugNodeStructure(node, depth = 0) {
	if (!node) return

	const indent = '  '.repeat(depth)
	const nodeInfo = `${indent}${node.name || 'unnamed'} (type: ${node.type || 'unknown'})`

	if (node.children) {
		for (const child of node.children) {
			debugNodeStructure(child, depth + 1)
		}
	}
}

const inWorldTemplates = buildingNodeIds.map(id => {
	let node = app.get(id)
	if (!node) {
		// Try recursive search as fallback
		node = findNodeByName(id)
	}

	// Debug: log which templates are found
	if (node) {
		console.log('[HypCity] Found template:', id)
	} else {
		console.log('[HypCity] Missing template:', id)
	}

	// Debug the node structure for the first few templates
	if (node && (id === 's_01_01' || id === 's_02_01' || id === 's_03_01' || id === 'buildingl1' || id === 'buildingl2' || id === 'buildingl3')) {
		// Try to discover and play animations
		discoverAndPlayAnimations(node)
	}

	return node
}).filter(Boolean)

// Build the template list (only in-world templates)
const BUILDING_TEMPLATES = inWorldTemplates

// Building templates loaded

// Store original template nodes to hide them later
const originalTemplateNodes = []

// Function to immediately position original templates in the city
function positionOriginalTemplates() {
	console.log('[HypCity] Positioning original templates in city...')

	// Create a temporary city container for original templates
	const originalCity = app.create('group')
	world.add(originalCity)

	BUILDING_TEMPLATES.forEach((template, index) => {
		if (template) {
			// Only play animations on templates that have spinning rigs
			if (template.name && (template.name.includes('buildingl') || template.name.includes('SpinRig'))) {
				discoverAndPlayAnimations(template)
			}

			// Calculate a position in the city grid
			const gridX = (index % 5) * 20 // 5 columns, 20 units apart
			const gridZ = Math.floor(index / 5) * 20 // Rows, 20 units apart

			// Add some randomness to the positioning
			const offsetX = (noise(index, 0, 7000) - 0.5) * 5
			const offsetZ = (noise(0, index, 8000) - 0.5) * 5

			// Position the original template
			template.position.set(
				(gridX + offsetX) * CONFIG.GLOBAL_SCALE,
				0,
				(gridZ + offsetZ) * CONFIG.GLOBAL_SCALE
			)

			// Scale and rotate
			const scale = 1.0 * CONFIG.GLOBAL_SCALE
			template.scale.set(scale, scale, scale)

			const rotationIndex = Math.floor(noise(index, 0, 9000) * 4)
			const rotation = rotationIndex * Math.PI / 2
			template.rotation.y = rotation

			// Move to the city container
			world.remove(template)
			originalCity.add(template)

			originalTemplateNodes.push(template)
		}
	})

	// Original templates positioned
}

// PRNG Implementation
class PRNG {
	constructor(seed) {
		this.seed = seed
		this.state = seed
	}
	next() {
		this.state ^= this.state << 13
		this.state ^= this.state >>> 17
		this.state ^= this.state << 5
		return (this.state >>> 0) / 4294967295
	}
	range(min, max) {
		return min + this.next() * (max - min)
	}
	rangeInt(min, max) {
		return Math.floor(this.range(min, max + 1))
	}
	choice(array) {
		return array[this.rangeInt(0, array.length - 1)]
	}
	reset() {
		this.state = this.seed
	}
}
const prng = new PRNG(CONFIG.SEED)

// Utility: Deterministic noise
function noise(x, y, seedOffset = 0) {
	const combinedSeed = CONFIG.SEED + seedOffset
	const n = Math.sin(x * 12.9898 + y * 78.233 + combinedSeed) * 43758.5453
	return n - Math.floor(n)
}

// Utility: Get tile coordinates from world position
function getTileCoords(x, z) {
	return {
		x: Math.floor(x / (CONFIG.CITY_SIZE * CONFIG.BLOCK_SIZE * CONFIG.GLOBAL_SCALE)),
		z: Math.floor(z / (CONFIG.CITY_SIZE * CONFIG.BLOCK_SIZE * CONFIG.GLOBAL_SCALE))
	}
}

// Utility: Get a unique key for a tile
function getTileKey(tileX, tileZ) {
	return `${tileX},${tileZ}`
}

function selectBuildingTemplate(x, z) {
	if (BUILDING_TEMPLATES.length === 0) return null

	// Get zone type to influence building selection
	const zoneType = getZoneType(x, z)

	// Separate buildings by type
	const regularBuildings = BUILDING_TEMPLATES.filter(t => !t.name || (!t.name.includes('mega_') && !t.name.includes('store') && !t.name.includes('shop') && !t.name.includes('storefront')))
	const megaBuildings = BUILDING_TEMPLATES.filter(t => t.name && t.name.includes('mega_'))
	const storefrontBuildings = BUILDING_TEMPLATES.filter(t => t.name && (t.name.includes('store') || t.name.includes('shop') || t.name.includes('storefront')))

	// Use noise to determine building type
	const buildingTypeNoise = noise(x, z, 1000)

	// In commercial zones, favor storefronts
	if (zoneType === 'COMMERCIAL' && storefrontBuildings.length > 0) {
		const storefrontChance = 0.6 // 60% chance for storefronts in commercial zones
		if (buildingTypeNoise < storefrontChance) {
			const index = Math.floor(noise(x, z, 2000) * storefrontBuildings.length)
			return storefrontBuildings[index]
		}
	}

	// Use configurable chance for regular vs mega buildings
	if (buildingTypeNoise < (1 - CONFIG.megaBuildingChance)) {
		// Select from regular buildings
		if (regularBuildings.length > 0) {
			const index = Math.floor(noise(x, z, 2000) * regularBuildings.length)
			const selected = regularBuildings[index]
			return selected
		}
	} else {
		// Select from mega buildings (rare)
		if (megaBuildings.length > 0) {
			const index = Math.floor(noise(x, z, 3000) * megaBuildings.length)
			const selected = megaBuildings[index]
			return selected
		}
	}

	// Fallback to any available template
	const index = Math.floor(noise(x, z, 1000) * BUILDING_TEMPLATES.length)
	const selected = BUILDING_TEMPLATES[index]
	return selected
}

async function createBuilding(x, z, zoneType) {
	const source = selectBuildingTemplate(x, z)
	if (!source || !source.clone) return null

	// Clone the entire building structure
	const building = source.clone(true)

	const height = getBuildingHeight(zoneType, x, z)
	const scale = getBuildingScale(zoneType, x, z)
	const offsetX = (noise(x, z, 7000) - 0.5) * 0.3
	const offsetZ = (noise(z, x, 8000) - 0.5) * 0.3
	building.scale.set(
		scale * CONFIG.GLOBAL_SCALE,
		height * CONFIG.GLOBAL_SCALE,
		scale * CONFIG.GLOBAL_SCALE
	)
	building.position.set(
		(x + offsetX) * CONFIG.GLOBAL_SCALE,
		(height / 2) * CONFIG.GLOBAL_SCALE,
		(z + offsetZ) * CONFIG.GLOBAL_SCALE
	)
	// Use 90-degree increments only (0, 90, 180, 270 degrees)
	const rotationIndex = Math.floor(noise(x, z, 9000) * 4)
	const rotation = rotationIndex * Math.PI / 2
	building.rotation.y = rotation

	// Set up spinning skinned meshes for this cloned building
	setupSpinningSkinnedMeshes(building)

	return building
}

async function generateCityTile(tileX, tileZ) {
	try {
		const tileKey = getTileKey(tileX, tileZ)
		if (activeTiles.has(tileKey)) return

		const tile = app.create('group')
		tile.position.set(
			tileX * TILE_SIZE * CONFIG.GLOBAL_SCALE * CONFIG.TILE_SPACING_MULTIPLIER,
			0,
			tileZ * TILE_SIZE * CONFIG.GLOBAL_SCALE * CONFIG.TILE_SPACING_MULTIPLIER
		)
		city.add(tile)

		// Generate buildings with better spacing
		for (let localX = 0; localX < CONFIG.CITY_SIZE; localX++) {
			for (let localZ = 0; localZ < CONFIG.CITY_SIZE; localZ++) {
				const worldX = (tileX * TILE_SIZE) + (localX * CONFIG.BLOCK_SIZE)
				const worldZ = (tileZ * TILE_SIZE) + (localZ * CONFIG.BLOCK_SIZE)
				if (isRoad(localX, localZ)) continue

				if (shouldPlaceBuilding(worldX, worldZ)) {
					const zoneType = getZoneType(worldX, worldZ)
					const buildingKey = `${Math.floor(worldX)},${Math.floor(worldZ)}`
					placedBuildings.add(buildingKey)

					// Always clone templates since originals are already positioned
					const template = selectBuildingTemplate(worldX, worldZ)
					if (template && template.clone) {
						// Clone the entire building structure
						const building = template.clone(true)

						const height = getBuildingHeight(zoneType, worldX, worldZ)
						const scale = getBuildingScale(zoneType, worldX, worldZ)
						const offsetX = (noise(worldX, worldZ, 7000) - 0.5) * 0.3
						const offsetZ = (noise(worldZ, worldX, 8000) - 0.5) * 0.3
						building.scale.set(
							scale * CONFIG.GLOBAL_SCALE,
							height * CONFIG.GLOBAL_SCALE,
							scale * CONFIG.GLOBAL_SCALE
						)
						building.position.set(
							(worldX + offsetX) * CONFIG.GLOBAL_SCALE,
							(height / 2) * CONFIG.GLOBAL_SCALE,
							(worldZ + offsetZ) * CONFIG.GLOBAL_SCALE
						)
						// Use 90-degree increments only (0, 90, 180, 270 degrees)
						const rotationIndex = Math.floor(noise(worldX, worldZ, 9000) * 4)
						const rotation = rotationIndex * Math.PI / 2
						building.rotation.y = rotation

						// Add building to tile first so it's in the scene
						tile.add(building)

						// Set up spinning skinned meshes for this cloned building
						setupSpinningSkinnedMeshes(building)
					} else {
						const building = await createBuilding(worldX, worldZ, zoneType)
						if (building) {
							tile.add(building)
						}
					}
				}
			}
		}

		activeTiles.set(tileKey, tile)
	} catch (error) {
		console.error(`[HypCity] Error generating tile (${tileX}, ${tileZ}):`, error)
	}
}

function removeTile(tileX, tileZ) {
	const key = getTileKey(tileX, tileZ)
	const tile = activeTiles.get(key)
	if (tile) {
		city.remove(tile)
		activeTiles.delete(key)
	}
}

async function updateTiles() {
	const player = world.getPlayer()
	if (!player || !player.position) return
	const playerPos = player.position
	const playerTile = getTileCoords(playerPos.x, playerPos.z)
	if (!lastPlayerTile || lastPlayerTile.x !== playerTile.x || lastPlayerTile.z !== playerTile.z) {
		for (let x = playerTile.x - CONFIG.TILE_VISIBILITY_RANGE; x <= playerTile.x + CONFIG.TILE_VISIBILITY_RANGE; x++) {
			for (let z = playerTile.z - CONFIG.TILE_VISIBILITY_RANGE; z <= playerTile.z + CONFIG.TILE_VISIBILITY_RANGE; z++) {
				await generateCityTile(x, z)
			}
		}
		const tilesToRemove = []
		for (const [key, tile] of activeTiles) {
			const [tileX, tileZ] = key.split(',').map(Number)
			const distance = Math.max(Math.abs(tileX - playerTile.x), Math.abs(tileZ - playerTile.z))
			if (distance > CONFIG.TILE_VISIBILITY_RANGE + 1) tilesToRemove.push([tileX, tileZ])
		}
		for (const [tileX, tileZ] of tilesToRemove) removeTile(tileX, tileZ)
		lastPlayerTile = playerTile
	}
}

async function generateCity() {
	try {
		const player = world.getPlayer()
		let startTile = { x: 0, z: 0 }

		if (player && player.position) {
			startTile = getTileCoords(player.position.x, player.position.z)
		} else {
			// No player found, use origin for city generation
		}

		// Generate city tiles
		for (let x = startTile.x - 1; x <= startTile.x + 1; x++) {
			for (let z = startTile.z - 1; z <= startTile.z + 1; z++) {
				try {
					await generateCityTile(x, z)
				} catch (error) {
					console.warn(`[HypCity] Error generating tile (${x}, ${z}):`, error)
				}
			}
		}

		lastPlayerTile = startTile
	} catch (error) {
		console.error('[HypCity] Error in generateCity:', error)
	}
}

// Wait for world to be ready and try multiple times
let cityGenerationAttempts = 0
const maxAttempts = 10

function tryGenerateCity() {
	cityGenerationAttempts++
	const player = world.getPlayer()

	if (player && player.position) {
		positionOriginalTemplates() // Position original templates first
		generateCity()
	} else if (cityGenerationAttempts < maxAttempts) {
		setTimeout(tryGenerateCity, 1000)
	} else {
		positionOriginalTemplates() // Position original templates first
		generateCity()
	}
}

setTimeout(tryGenerateCity, 1000)

// Combined update handler for tile updates
app.on('update', delta => {
	// Handle tile updates
	updateTimer += delta
	if (updateTimer >= 1) {
		updateTiles()
		updateTimer = 0
	}

	// Update spinning animations
	updateSpinningAnimations(delta)
})

function isRoad(x, z) {
	const districtX = Math.floor(x / CONFIG.DISTRICT_SIZE);
	const districtZ = Math.floor(z / CONFIG.DISTRICT_SIZE);
	const localX = x % CONFIG.DISTRICT_SIZE;
	const localZ = z % CONFIG.DISTRICT_SIZE;

	if (localX < CONFIG.ROAD_WIDTH || localZ < CONFIG.ROAD_WIDTH) return true;

	if ((localX - CONFIG.ROAD_WIDTH) % 4 === 0 || (localZ - CONFIG.ROAD_WIDTH) % 4 === 0) {
		if (
			localX > CONFIG.ROAD_WIDTH + 1 &&
			localX < CONFIG.DISTRICT_SIZE - CONFIG.ROAD_WIDTH - 1 &&
			localZ > CONFIG.ROAD_WIDTH + 1 &&
			localZ < CONFIG.DISTRICT_SIZE - CONFIG.ROAD_WIDTH - 1
		) {
			return true;
		}
	}

	const seed = districtX * 1000 + districtZ;
	const hasInternalXRoad = seed % 3 === 0;
	const hasInternalZRoad = (seed + 1) % 3 === 0;

	if (
		hasInternalXRoad &&
		localX >= CONFIG.DISTRICT_SIZE / 2 - CONFIG.ROAD_WIDTH / 2 &&
		localX < CONFIG.DISTRICT_SIZE / 2 + CONFIG.ROAD_WIDTH / 2
	) {
		return true;
	}

	if (
		hasInternalZRoad &&
		localZ >= CONFIG.DISTRICT_SIZE / 2 - CONFIG.ROAD_WIDTH / 2 &&
		localZ < CONFIG.DISTRICT_SIZE / 2 + CONFIG.ROAD_WIDTH / 2
	) {
		return true;
	}

	return false;
}

function isTooCloseToExisting(x, z, minDistance = CONFIG.minBuildingDistance) {
	const key = `${Math.floor(x)},${Math.floor(z)}`;
	if (placedBuildings.has(key)) return true;
	for (let dx = -minDistance; dx <= minDistance; dx++) {
		for (let dz = -minDistance; dz <= minDistance; dz++) {
			const checkKey = `${Math.floor(x + dx)},${Math.floor(z + dz)}`;
			if (placedBuildings.has(checkKey)) {
				const distance = Math.sqrt(dx * dx + dz * dz);
				if (distance < minDistance) return true;
			}
		}
	}
	return false;
}

function shouldPlaceBuilding(x, z) {
	if (isTooCloseToExisting(x, z, CONFIG.minBuildingDistance)) return false;
	const placementNoise = noise(x * 0.2, z * 0.2, 10000);
	const gridX = Math.floor(x / 4);
	const gridZ = Math.floor(z / 4);
	const gridInfluence = noise(gridX, gridZ, 11000) * 0.3;
	const placementChance = CONFIG.residentialDensity + gridInfluence; // Default to residential density

	if (getZoneType(x, z) === 'COMMERCIAL') {
		return placementNoise < CONFIG.commercialDensity + gridInfluence;
	} else if (getZoneType(x, z) === 'SKYSCRAPER') {
		return placementNoise < CONFIG.skyscraperDensity + gridInfluence;
	} else { // RESIDENTIAL
		return placementNoise < placementChance;
	}
}

function getZoneType(x, z) {
	const centerNoise = noise(x * 0.1, z * 0.1, 2000);
	const distanceFromCenter = Math.sqrt(x * x + z * z);
	if (distanceFromCenter < 20) {
		return centerNoise > 0.7 ? 'SKYSCRAPER' : 'COMMERCIAL';
	} else if (distanceFromCenter < 50) {
		return 'COMMERCIAL';
	} else {
		return 'RESIDENTIAL';
	}
}

function getBuildingHeight(type, x, z) {
	let baseHeight;
	switch (type) {
		case 'RESIDENTIAL':
			baseHeight = 0.2 + noise(x, z, 3000) * 0.2;
			break;
		case 'COMMERCIAL':
			baseHeight = 0.8 + noise(x, z, 4000) * 0.8;
			break;
		case 'SKYSCRAPER':
			baseHeight = 3 + noise(x, z, 5000) * 2;
			break;
		default:
			baseHeight = 0.3 + noise(x, z, 6000) * 0.2;
	}
	return baseHeight * CONFIG.HEIGHT_MULTIPLIER;
}

function getBuildingScale(type, x, z) {
	let baseScale;
	switch (type) {
		case 'RESIDENTIAL':
			baseScale = 0.5;
			break;
		case 'COMMERCIAL':
			baseScale = 1.0;
			break;
		case 'SKYSCRAPER':
			baseScale = 0.8;
			break;
		default:
			baseScale = 0.6;
	}
	return baseScale * CONFIG.BUILDING_SCALE_MULTIPLIER;
}

// Helper function to find and set up spinning skinned meshes
function setupSpinningSkinnedMeshes(building) {
	// Search for spinning skinned meshes in the cloned building
	const spinningSkinnedMeshes = findSpinningSkinnedMeshes(building)

	// Get configurable animation names
	const animNames = [
		CONFIG.spinningAnimation1 || 'Spin1',
		CONFIG.spinningAnimation2 || 'Spin2',
		CONFIG.spinningAnimation3 || 'Spin3'
	]

	// Set up animations for each spinning skinned mesh
	spinningSkinnedMeshes.forEach(({ node, animations, name }) => {
		// Safety checks
		if (!node || !animations || typeof animations !== 'object') {
			console.log('[HypCity] Invalid node or animations object:', { node: !!node, animations: !!animations, name })
			return
		}

		// Map the rig name to the appropriate animation
		let animationName = null
		if (name.includes('SpinRig1') || name.includes('Spin1')) {
			animationName = animNames[0]
		} else if (name.includes('SpinRig2') || name.includes('Spin2')) {
			animationName = animNames[1]
		} else if (name.includes('SpinRig3') || name.includes('Spin3')) {
			animationName = animNames[2]
		}

		// Try to find the animation in the node's anims array or animations object
		const availableAnims = node.anims || (animations && Object.keys(animations)) || []

		// Check if animation exists in available animations
		const hasAnimation = availableAnims.includes(animationName) ||
			(animations && animations[animationName]) ||
			(node.anims && node.anims.includes(animationName))

		if (animationName && hasAnimation) {
			// Play the animation with loop
			try {
				node.play({
					name: animationName,
					loop: true,
					fade: 0.5
				})

				// Store the animation info for potential updates
				spinningAnimations.set(node, {
					animationName: animationName,
					animations: animations,
					node: node
				})
				console.log('[HypCity] Successfully set up animation', animationName, 'for node:', name)
			} catch (error) {
				console.error('[HypCity] Error playing animation', animationName, 'on node:', name, ':', error)
			}
		} else {
			// Try to discover and play any available spinning animations
			discoverAndPlayAnimations(node)
		}
	})

	// Also try the direct discovery approach as fallback
	if (spinningSkinnedMeshes.length === 0) {
		discoverAndPlayAnimations(building)
	}
}

// Helper function to update spinning animations
function updateSpinningAnimations(deltaTime) {
	// The animations should be playing automatically since we set loop: true
	// But we can add additional logic here if needed
	spinningAnimations.forEach((animationInfo, node) => {
		// Animation is already playing with loop: true
		// Add any additional animation logic here if needed
	})
}
