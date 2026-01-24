app.configure([
  { type: 'section', label: 'Level Mode' },
  {
    type: 'switch',
    key: 'mode',
    label: 'Mode',
    options: [
      { label: 'Generate', value: 'generate' },
      { label: 'Edit', value: 'edit' },
      { label: 'Clear', value: 'clear' },
    ],
    initial: 'generate'
  },

  { type: 'section', label: 'Generation Settings' },
  {
    type: 'number',
    key: 'difficulty',
    label: 'Difficulty',
    min: 1,
    max: 10,
    initial: 3
  },
  {
    type: 'number',
    key: 'length',
    label: 'Level Length',
    min: 20,
    max: 200,
    initial: 50
  },
  {
    type: 'toggle',
    key: 'includeGrinding',
    label: 'Include Grind Rails',
    initial: true
  },
  {
    type: 'toggle',
    key: 'includeClimbing',
    label: 'Include Climbing',
    initial: true
  },
  {
    type: 'toggle',
    key: 'includeLedges',
    label: 'Include Ledges',
    initial: true
  },
  {
    type: 'toggle',
    key: 'includeAirDive',
    label: 'Include Air Dive Areas',
    initial: true
  },

  { type: 'section', label: 'Falling Platform Settings' },
  {
    type: 'number',
    key: 'fallDelay',
    label: 'Fall Delay (ms)',
    min: 100,
    max: 3000,
    initial: 800
  },
  {
    type: 'number',
    key: 'fallSpeed',
    label: 'Fall Speed',
    min: 1,
    max: 20,
    initial: 8
  },
  {
    type: 'toggle',
    key: 'respawnFallingPlatforms',
    label: 'Auto-Respawn Falling Platforms',
    initial: false
  },
  {
    type: 'number',
    key: 'respawnTime',
    label: 'Respawn Time (seconds)',
    min: 5,
    max: 60,
    initial: 15
  },

  { type: 'section', label: 'Level Editor' },
  {
    type: 'switch',
    key: 'platformType',
    label: 'Platform to Place',
    options: [
      { label: 'Small', value: 'small' },
      { label: 'Medium', value: 'medium' },
      { label: 'Large', value: 'large' },
      { label: 'X-Large', value: 'x-large' },
      { label: 'Falling', value: 'falling' },
      { label: 'Grind Rail', value: 'grind' },
      { label: 'Climbable Wall', value: 'climb' },
      { label: 'Ledge', value: 'ledge' },
    ],
    initial: 'small'
  },

  { type: 'section', label: 'Actions' },
  {
    type: 'button',
    label: 'Generate New Level',
    onClick: () => app.send('generate-level')
  },
  {
    type: 'button',
    label: 'Save Level',
    onClick: () => app.send('save-level')
  },
  {
    type: 'button',
    label: 'Load Saved Level',
    onClick: () => app.send('load-level')
  },
  {
    type: 'button',
    label: 'Clear All',
    onClick: () => app.send('clear-all')
  },
])

// Global state
let platforms = []
let mechanics = {
  grindRails: [],
  climbableWalls: [],
  ledges: [],
  airDiveAreas: []
}
let editMode = false
const savedLevels = []

// Platform type configurations
const platformConfigs = {
  small: { width: 2, depth: 2, height: 0.5, node: 'Pltfrm', falling: false },
  medium: { width: 4, depth: 3, height: 0.5, node: 'MedPltfrm', falling: false },
  large: { width: 6, depth: 4, height: 0.5, node: 'LrgPltfrm', falling: false },
  'x-large': { width: 8, depth: 5, height: 0.5, node: 'XlrgPltfrm', falling: false },
  falling: {
    width: 4,
    depth: 3,
    height: 0.5,
    node: 'FllnPltfrm',
    falling: true,
    triggerRadius: 2.5,
    fallDelay: 800,
    fallSpeed: 8,
    respawnTime: 15
  }
}

console.log('[LevelGenerator] Initialized')

// App event handlers
app.on('generate-level', generateLevel)
app.on('save-level', saveLevel)
app.on('load-level', loadLevel)
app.on('clear-all', clearLevel)

function generateLevel() {
  clearLevel()

  const props = app.props
  const seed = Date.now()
  Math.seedrandom = Math.seedrandom || function(seed) {
    const x = Math.sin(seed++) * 10000
    return x - Math.floor(x)
  }

  const random = () => Math.seedrandom(seed++)

  const difficulty = props.difficulty || 3
  const length = props.length || 50
  const includeGrinding = props.includeGrinding !== false
  const includeClimbing = props.includeClimbing !== false
  const includeLedges = props.includeLedges !== false
  const includeAirDive = props.includeAirDive !== false

  console.log(`[LevelGenerator] Generating level: diff=${difficulty}, len=${length}`)

  const currentPos = new THREE.Vector3(0, 0, 0)
  const pathPoints = []

  for (let i = 0; i < length; i++) {
    pathPoints.push(currentPos.clone())

    const moveDistance = 3 + random() * 4
    const heightVariation = (random() - 0.5) * difficulty * 0.8
    const lateralVariation = (random() - 0.5) * difficulty * 0.4

    currentPos.x += lateralVariation
    currentPos.y += heightVariation
    currentPos.z += moveDistance
  }

  placePlatformsAlongPath(pathPoints, random)

  if (includeGrinding) {
    addGrindRails(pathPoints, difficulty, random)
  }

  if (includeClimbing) {
    addClimbableWalls(pathPoints, difficulty, random)
  }

  if (includeLedges) {
    addLedges(pathPoints, difficulty, random)
  }

  if (includeAirDive) {
    addAirDiveAreas(pathPoints, difficulty, random)
  }

  console.log(`[LevelGenerator] Generated ${platforms.length} platforms and ${getTotalMechanics()} mechanics`)
}

function placePlatformsAlongPath(pathPoints, random) {
  pathPoints.forEach((point, index) => {
    if (index > 0 && random() < 0.2) return

    let platformType = 'small'
    const roll = random()

    if (roll < 0.1) platformType = 'x-large'
    else if (roll < 0.25) platformType = 'large'
    else if (roll < 0.5) platformType = 'medium'
    else if (roll < 0.8) platformType = 'small'
    else platformType = 'falling'

    placePlatform(point, platformType)
  })
}

function placePlatform(position, type) {
  const config = platformConfigs[type]
  if (!config) return

  const platform = app.create('rigidbody', {
    type: 'static',
    shape: 'box',
    width: config.width,
    height: config.height,
    depth: config.depth,
    position: [position.x, position.y, position.z],
    collision: true,
    layer: 'environment',
    tag: `platform_${type}`,
  })

  const mesh = app.create('mesh', {
    file: `asset://platform-${type}.glb`,
    position: [position.x, position.y - config.height/2, position.z],
    scale: [1, 1, 1],
    collision: false,
  })

  app.add(platform)
  app.add(mesh)

  const platformData = {
    type,
    position: position.clone(),
    rigidbody: platform,
    mesh: mesh,
    config: { ...config },
    isFalling: config.falling || false,
    fallen: false,
    fallingStartTime: null
  }

  if (platformData.config.falling) {
    setupFallingPlatformTrigger(platformData)
  }

  platforms.push(platformData)
}

function setupFallingPlatformTrigger(platformData) {
  const props = app.props
  const config = {
    ...platformData.config,
    fallDelay: props.fallDelay || platformData.config.fallDelay,
    fallSpeed: props.fallSpeed || platformData.config.fallSpeed,
    respawnTime: props.respawnFallingPlatforms ? (props.respawnTime || platformData.config.respawnTime) : 0
  }

  platformData.config = config

  const triggerArea = app.create('collider', {
    type: 'box',
    width: config.width * 1.2,
    height: config.triggerRadius,
    depth: config.depth * 1.2,
    position: [platformData.position.x, platformData.position.y + config.triggerRadius, platformData.position.z],
    trigger: true,
    layer: 'prop',
    tag: `falling_trigger_${platformData.type}`,
  })

  triggerArea.onTriggerEnter = (hit) => {
    if (hit.playerId && !platformData.fallen && !platformData.fallingStartTime) {
      console.log(`[LevelGenerator] Player ${hit.playerId} triggered falling platform`)
      startPlatformFall(platformData)
    }
  }

  app.add(triggerArea)
  platformData.triggerArea = triggerArea
}

function startPlatformFall(platformData) {
  if (platformData.fallingStartTime || platformData.fallen) return

  const config = platformData.config
  platformData.fallingStartTime = Date.now()

  console.log(`[LevelGenerator] Platform will fall in ${config.fallDelay}ms with speed ${config.fallSpeed}`)

  setTimeout(() => {
    if (!platformData.rigidbody) return

    platformData.rigidbody.setDynamic(true)
    platformData.rigidbody.setLinearVelocity(new THREE.Vector3(0, -config.fallSpeed, 0))

    platformData.rigidbody.addForce(
      new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
      ),
      PHYSX.PxForceModeEnum.eIMPULSE,
      true
    )

    platformData.fallen = true
    console.log('[LevelGenerator] Falling platform activated!')

    setTimeout(() => {
      if (platformData.triggerArea) {
        platformData.triggerArea.destroy()
        platformData.triggerArea = null
      }

      if (config.respawnTime > 0) {
        setTimeout(() => respawnPlatform(platformData), config.respawnTime * 1000)
      }
    }, 5000)
  }, config.fallDelay)
}

function respawnPlatform(platformData) {
  if (!platformData.rigidbody) return

  const config = platformData.config

  platformData.rigidbody.position.copy(platformData.position)
  platformData.rigidbody.setDynamic(false)
  platformData.rigidbody.setLinearVelocity(new THREE.Vector3(0, 0, 0))
  platformData.fallen = false
  platformData.fallingStartTime = null

  if (platformData.triggerArea) {
    platformData.triggerArea.destroy()
  }
  setupFallingPlatformTrigger(platformData)

  console.log('[LevelGenerator] Falling platform respawned!')
}

function addGrindRails(pathPoints, difficulty, random) {
  const railCount = Math.floor(difficulty * 0.8 + random() * 3)

  for (let i = 0; i < railCount; i++) {
    const startIndex = Math.floor(random() * (pathPoints.length - 10))
    const endIndex = startIndex + 5 + Math.floor(random() * 10)

    if (endIndex >= pathPoints.length) continue

    const railPoints = pathPoints
      .slice(startIndex, endIndex)
      .map(p => [p.x, p.y + 2, p.z])

    const railId = createGrindRail(railPoints, {
      speed: 5 + random() * 8,
      friction: 0.9 + random() * 0.09,
      triggerRadius: 2,
    })

    mechanics.grindRails.push({ id: railId, points: railPoints })
  }
}

function addClimbableWalls(pathPoints, difficulty, random) {
  const wallCount = Math.floor(difficulty * 0.6 + random() * 3)

  for (let i = 0; i < wallCount; i++) {
    const index = Math.floor(random() * (pathPoints.length - 5)) + 5
    const position = pathPoints[index]

    const wall = app.create('rigidbody', {
      type: 'static',
      shape: 'box',
      width: 0.2,
      height: 4,
      depth: 6,
      position: [position.x, position.y + 2, position.z + 3],
      collision: true,
      layer: 'prop',
      tag: 'climbable_wall',
    })

    app.add(wall)

    mechanics.climbableWalls.push({
      position: new THREE.Vector3(position.x, position.y + 2, position.z + 3),
      rigidbody: wall
    })
  }
}

function addLedges(pathPoints, difficulty, random) {
  const ledgeCount = Math.floor(difficulty * 0.7 + random() * 4)

  for (let i = 0; i < ledgeCount; i++) {
    const index = Math.floor(random() * (pathPoints.length - 5)) + 3
    const position = pathPoints[index]

    const ledge = app.create('rigidbody', {
      type: 'box',
      width: 2,
      height: 0.2,
      depth: 1,
      position: [position.x, position.y + 1.5, position.z + 2],
      collision: true,
      layer: 'prop',
      tag: 'ledge_platform',
    })

    app.add(ledge)

    mechanics.ledges.push({
      position: new THREE.Vector3(position.x, position.y + 1.5, position.z + 2),
      rigidbody: ledge
    })
  }
}

function addAirDiveAreas(pathPoints, difficulty, random) {
  const diveAreaCount = Math.floor(difficulty * 0.5 + random() * 2)

  for (let i = 0; i < diveAreaCount; i++) {
    const startIndex = Math.floor(random() * (pathPoints.length - 15))
    const endIndex = startIndex + 10 + Math.floor(random() * 10)

    if (endIndex >= pathPoints.length) continue

    const diveArea = {
      start: pathPoints[startIndex].clone(),
      end: pathPoints[endIndex].clone(),
      height: pathPoints[startIndex].y + 5 + random() * 5
    }

    mechanics.airDiveAreas.push(diveArea)

    const trigger = app.create('collider', {
      type: 'sphere',
      radius: 5,
      trigger: true,
      layer: 'prop',
      position: [diveArea.start.x, diveArea.height, diveArea.start.z + 5],
      tag: 'air-dive-trigger',
    })

    trigger.onContactStart = other => {
      if (other.playerId) {
        app.emit('air-dive-available', [other.playerId, diveArea])
      }
    }

    app.add(trigger)
  }
}

function createGrindRail(points, options = {}) {
  const railId = `rail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const railData = {
    id: railId,
    points,
    speed: options.speed || 8,
    friction: options.friction || 0.95,
    triggerRadius: options.triggerRadius || 2,
    active: true,
  }

  const railGeo = new THREE.BufferGeometry()
  const vertices = points.flat()
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))

  const railMat = new THREE.MeshBasicMaterial({ color: 0x888888 })
  const railLine = new THREE.Line(railGeo, railMat)

  const railMesh = app.create('mesh', {
    position: [0, 0, 0],
    collision: false,
  })

  railMesh.three.add(railLine)
  app.add(railMesh)

  const trigger = app.create('collider', {
    type: 'sphere',
    radius: options.triggerRadius,
    trigger: true,
    layer: 'prop',
    position: points[0],
    tag: 'grind_trigger',
  })

  trigger.onContactStart = other => {
    if (other.playerId) {
      app.emit('start-grinding', [other.playerId, railData])
    }
  }

  app.add(trigger)

  return railId
}

function enableEditMode() {
  editMode = true

  mechanics.grindRails.forEach(rail => {
    // Hide grind rails if needed
  })

  app.on('click', handleEditModeClick)

  console.log('[LevelGenerator] Edit mode enabled')
}

function handleEditModeClick(event) {
  if (!editMode) return

  const camera = app.getCamera()
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(event, camera)

  const planeY = 0
  const planeNormal = new THREE.Vector3(0, 1, 0)
  const planeConstant = -planeY

  const intersectPoint = new THREE.Vector3()
  const ray = raycaster.ray

  const distance = (-planeConstant - planeNormal.dot(ray.origin)) / planeNormal.dot(ray.direction)

  if (distance > 0) {
    intersectPoint.copy(ray.direction).multiplyScalar(distance).add(ray.origin)

    const platformType = app.props.platformType || 'small'

    if (platformType === 'grind') {
      placeGrindRailInEditMode(intersectPoint)
    } else if (platformType === 'climb') {
      placeClimbableWallInEditMode(intersectPoint)
    } else if (platformType === 'ledge') {
      placeLedgeInEditMode(intersectPoint)
    } else {
      placePlatform(intersectPoint, platformType)
    }
  }
}

function placeGrindRailInEditMode(position) {
  const railPoints = [
    [position.x - 5, position.y, position.z],
    [position.x, position.y, position.z],
    [position.x + 5, position.y, position.z]
  ]

  const railId = createGrindRail(railPoints, {
    speed: 6,
    triggerRadius: 2
  })

  mechanics.grindRails.push({ id: railId, points: railPoints })
}

function placeClimbableWallInEditMode(position) {
  const wall = app.create('rigidbody', {
    type: 'box',
    width: 0.2,
    height: 4,
    depth: 6,
    position: [position.x, position.y + 2, position.z],
    collision: true,
    layer: 'prop',
    tag: 'climbable_wall',
  })

  app.add(wall)

  mechanics.climbableWalls.push({
    position: new THREE.Vector3(position.x, position.y + 2, position.z),
    rigidbody: wall
  })
}

function placeLedgeInEditMode(position) {
  const ledge = app.create('rigidbody', {
    type: 'box',
    width: 2,
    height: 0.2,
    depth: 1,
    position: [position.x, position.y, position.z],
    collision: true,
    layer: 'prop',
    tag: 'ledge_platform',
  })

  app.add(ledge)

  mechanics.ledges.push({
    position: new THREE.Vector3(position.x, position.y, position.z),
    rigidbody: ledge
  })
}

function disableEditMode() {
  editMode = false
  app.off('click', handleEditModeClick)
  console.log('[LevelGenerator] Edit mode disabled')
}

function saveLevel() {
  const levelData = {
    platforms: platforms.map(p => ({
      type: p.type,
      position: [p.position.x, p.position.y, p.position.z]
    })),
    mechanics: {
      grindRails: mechanics.grindRails.map(rail => ({ points: rail.points })),
      climbableWalls: mechanics.climbableWalls.map(wall => ({
        position: [wall.position.x, wall.position.y, wall.position.z]
      })),
      ledges: mechanics.ledges.map(ledge => ({
        position: [ledge.position.x, ledge.position.y, ledge.position.z]
      })),
      airDiveAreas: mechanics.airDiveAreas.map(area => ({
        start: [area.start.x, area.start.y, area.start.z],
        end: [area.end.x, area.end.y, area.end.z],
        height: area.height
      }))
    },
    timestamp: Date.now()
  }

  if (world.isServer) {
    app.state.savedLevel = levelData
    console.log('[LevelGenerator] Level saved to server state')
  }

  savedLevels.push(levelData)
  console.log(`[LevelGenerator] Saved ${platforms.length} platforms level`)
}

function loadLevel() {
  const savedLevel = world.isServer ? app.state.savedLevel : null

  if (!savedLevel) {
    console.log('[LevelGenerator] No saved level found')
    return
  }

  clearLevel()

  savedLevel.platforms.forEach(platformData => {
    const position = new THREE.Vector3(
      platformData.position[0],
      platformData.position[1],
      platformData.position[2]
    )
    placePlatform(position, platformData.type)
  })

  if (savedLevel.mechanics) {
    if (savedLevel.mechanics.grindRails) {
      savedLevel.mechanics.grindRails.forEach(railData => {
        const railId = createGrindRail(railData.points, {
          speed: 6,
          triggerRadius: 2
        })
        mechanics.grindRails.push({ id: railId, points: railData.points })
      })
    }
  }

  console.log('[LevelGenerator] Level loaded successfully')
}

function clearLevel() {
  platforms.forEach(platform => {
    platform.rigidbody?.destroy?.()
    platform.mesh?.destroy?.()
  })
  platforms = []

  Object.values(mechanics).forEach(mechanicArray => {
    mechanicArray.forEach(mechanic => {
      if (mechanic.rigidbody) mechanic.rigidbody?.destroy?.()
      if (mechanic.trigger) mechanic.trigger?.destroy?.()
      if (mechanic.mesh) mechanic.mesh?.destroy?.()
    })
  })

  mechanics = {
    grindRails: [],
    climbableWalls: [],
    ledges: [],
    airDiveAreas: []
  }

  console.log('[LevelGenerator] All platforms cleared')
}

function getTotalMechanics() {
  return mechanics.grindRails.length +
         mechanics.climbableWalls.length +
         mechanics.ledges.length +
         mechanics.airDiveAreas.length
}

// Update loop
app.on('update', (delta) => {
  const mode = app.props.mode || 'generate'

  if (mode === 'edit' && !editMode) {
    enableEditMode()
  } else if (mode !== 'edit' && editMode) {
    disableEditMode()
  } else if (mode === 'clear') {
    clearLevel()
    app.props.mode = 'generate'
  }
})

// Cleanup
app.on('destroy', () => {
  clearLevel()
  disableEditMode()
  console.log('[LevelGenerator] Cleaned up')
})