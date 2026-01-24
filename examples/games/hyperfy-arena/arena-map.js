// 🔥 Hyperfy Arena - Map & Spawn System
// Creates the basic arena environment with player spawning

app.configure({
  name: 'Hyperfy Arena Map',
  description: 'Arena map with spawn points and boundaries'
})

const ARENA_CONFIG = {
  // Arena dimensions (in meters)
  size: 50,
  height: 20,
  spawnRadius: 20,

  // Spawn points (8 players around the arena)
  spawnPoints: [
    { pos: [20, 5, 0], rot: [0, -90, 0] },   // East
    { pos: [-20, 5, 0], rot: [0, 90, 0] },   // West
    { pos: [0, 5, 20], rot: [0, 180, 0] },  // North
    { pos: [0, 5, -20], rot: [0, 0, 0] },   // South
    { pos: [14, 5, 14], rot: [0, -135, 0] }, // NE
    { pos: [-14, 5, 14], rot: [0, 135, 0] }, // NW
    { pos: [14, 5, -14], rot: [0, -45, 0] }, // SE
    { pos: [-14, 5, -14], rot: [0, 45, 0] }  // SW
  ],

  // Visual settings
  wallHeight: 15,
  wallThickness: 2,
  floorSize: 60
}

// Track spawned entities
const spawnedEntities = new Set()
let arenaBoundary = null

function createArenaFloor() {
  console.log('🏗️ Creating arena floor...')

  const floor = app.create('plane', {
    name: 'ArenaFloor',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [ARENA_CONFIG.floorSize, 1, ARENA_CONFIG.floorSize],
    collisionEnabled: true,
    visible: true,
    material: {
      color: [0.2, 0.3, 0.4],
      metallic: 0.3,
      roughness: 0.8
    }
  })

  spawnedEntities.add(floor.id)

  // Add grid lines for better spatial awareness
  for (let i = -30; i <= 30; i += 10) {
    // X-direction lines
    const lineX = app.create('box', {
      name: `GridX_${i}`,
      position: [i, 0.01, 0],
      rotation: [0, 0, 0],
      scale: [60, 0.02, 0.1],
      collisionEnabled: false,
      visible: true,
      material: { color: [0.5, 0.5, 0.5] }
    })
    spawnedEntities.add(lineX.id)

    // Z-direction lines
    const lineZ = app.create('box', {
      name: `GridZ_${i}`,
      position: [0, 0.01, i],
      rotation: [0, 0, 0],
      scale: [0.1, 0.02, 60],
      collisionEnabled: false,
      visible: true,
      material: { color: [0.5, 0.5, 0.5] }
    })
    spawnedEntities.add(lineZ.id)
  }

  return floor
}

function createArenaWalls() {
  console.log('🧱 Creating arena walls...')

  const wallMaterial = {
    color: [0.3, 0.2, 0.4],
    metallic: 0.2,
    roughness: 0.6,
    transparent: true,
    opacity: 0.3
  }

  // North wall
  const northWall = app.create('box', {
    name: 'NorthWall',
    position: [0, ARENA_CONFIG.wallHeight/2, -ARENA_CONFIG.size/2],
    scale: [ARENA_CONFIG.size, ARENA_CONFIG.wallHeight, ARENA_CONFIG.wallThickness],
    collisionEnabled: true,
    visible: true,
    material: wallMaterial
  })
  spawnedEntities.add(northWall.id)

  // South wall
  const southWall = app.create('box', {
    name: 'SouthWall',
    position: [0, ARENA_CONFIG.wallHeight/2, ARENA_CONFIG.size/2],
    scale: [ARENA_CONFIG.size, ARENA_CONFIG.wallHeight, ARENA_CONFIG.wallThickness],
    collisionEnabled: true,
    visible: true,
    material: wallMaterial
  })
  spawnedEntities.add(southWall.id)

  // East wall
  const eastWall = app.create('box', {
    name: 'EastWall',
    position: [ARENA_CONFIG.size/2, ARENA_CONFIG.wallHeight/2, 0],
    scale: [ARENA_CONFIG.wallThickness, ARENA_CONFIG.wallHeight, ARENA_CONFIG.size],
    collisionEnabled: true,
    visible: true,
    material: wallMaterial
  })
  spawnedEntities.add(eastWall.id)

  // West wall
  const westWall = app.create('box', {
    name: 'WestWall',
    position: [-ARENA_CONFIG.size/2, ARENA_CONFIG.wallHeight/2, 0],
    scale: [ARENA_CONFIG.wallThickness, ARENA_CONFIG.wallHeight, ARENA_CONFIG.size],
    collisionEnabled: true,
    visible: true,
    material: wallMaterial
  })
  spawnedEntities.add(westWall.id)

  return { northWall, southWall, eastWall, westWall }
}

function createSpawnIndicators() {
  console.log('🎯 Creating spawn point indicators...')

  ARENA_CONFIG.spawnPoints.forEach((spawn, index) => {
    // Spawn platform
    const platform = app.create('cylinder', {
      name: `SpawnPlatform_${index}`,
      position: spawn.pos,
      rotation: [0, 0, 0],
      scale: [2, 0.1, 2],
      collisionEnabled: false,
      visible: true,
      material: {
        color: [0.8, 0.4, 0.2],
        emissive: [0.2, 0.1, 0.05],
        transparent: true,
        opacity: 0.6
      }
    })
    spawnedEntities.add(platform.id)

    // Spawn number
    const sign = app.create('text', {
      name: `SpawnSign_${index}`,
      position: [spawn.pos[0], spawn.pos[1] + 2, spawn.pos[2]],
      rotation: spawn.rot,
      scale: [1, 1, 1],
      collisionEnabled: false,
      visible: true,
      text: `${index + 1}`,
      fontSize: 2,
      color: [1, 1, 1],
      billboard: true
    })
    spawnedEntities.add(sign.id)

    // Direction indicator
    const arrow = app.create('arrow', {
      name: `SpawnArrow_${index}`,
      position: [spawn.pos[0], spawn.pos[1] + 0.5, spawn.pos[2]],
      rotation: spawn.rot,
      scale: [1, 1, 1],
      collisionEnabled: false,
      visible: true,
      material: { color: [0.2, 0.8, 0.2] }
    })
    spawnedEntities.add(arrow.id)
  })
}

function createBoundaryTrigger() {
  console.log('🔧 Creating arena boundary trigger...')

  // Create invisible trigger zone that's slightly larger than the arena
  arenaBoundary = app.create('trigger', {
    name: 'ArenaBoundary',
    position: [0, 10, 0],
    scale: [ARENA_CONFIG.size + 10, ARENA_CONFIG.height, ARENA_CONFIG.size + 10],
    collisionEnabled: true,
    visible: false,
    trigger: {
      enter: 'onExitArena',
      exit: 'onEnterArena'
    }
  })

  spawnedEntities.add(arenaBoundary.id)
  return arenaBoundary
}

// Boundary event handlers
function onExitArena(playerId) {
  console.log(`⚠️ Player ${playerId} left arena boundary - pushing back`)
  // Push player back into arena (this will be handled by match controller)
  world.emit('arena:player-exit-boundary', [playerId])
}

function onEnterArena(playerId) {
  console.log(`✅ Player ${playerId} entered arena boundary`)
}

// Public API for other arena systems
app.on('init', () => {
  console.log('🏟️ Initializing Hyperfy Arena Map...')

  // Create arena environment
  createArenaFloor()
  createArenaWalls()
  createSpawnIndicators()
  createBoundaryTrigger()

  console.log(`✅ Arena created with ${ARENA_CONFIG.spawnPoints.length} spawn points`)

  // Signal that arena is ready
  world.emit('arena:map-ready', [{
    spawnPoints: ARENA_CONFIG.spawnPoints,
    size: ARENA_CONFIG.size,
    boundary: arenaBoundary?.id
  }])
})

// Cleanup function
app.on('cleanup', () => {
  console.log('🧹 Cleaning up arena map...')
  spawnedEntities.forEach(entityId => {
    try {
      const entity = world.find(entityId)
      if (entity) entity.destroy()
    } catch (e) {
      console.warn(`Failed to clean up entity ${entityId}:`, e)
    }
  })
  spawnedEntities.clear()
  arenaBoundary = null
})

// Export configuration for other systems
app.getArenaConfig = () => ARENA_CONFIG
app.getSpawnPoints = () => [...ARENA_CONFIG.spawnPoints]
app.isInArena = (position) => {
  const [x, , z] = position
  return Math.abs(x) <= ARENA_CONFIG.size/2 && Math.abs(z) <= ARENA_CONFIG.size/2
}

console.log('🗺️ Hyperfy Arena Map script loaded - Ready to build arena!')