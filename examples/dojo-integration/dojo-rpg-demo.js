// DojoEngine RPG Demo - Hyperfy Style
// Proper Hyperfy app structure (no wrapper)

console.log('🎮 DojoEngine RPG Demo Initializing...')

// Check if Dojo is available
if (!world.dojo) {
  console.log('❌ DojoEngine not available - running in fallback mode')
  // Fallback game setup will be handled in init
} else {
  console.log('🌐 DojoEngine detected - initializing blockchain RPG demo')
}

// Configure app settings
app.configure([
  {
    key: 'gameMode',
    type: 'switch',
    label: 'Game Mode',
    options: [
      { label: 'Blockchain', value: 'blockchain' },
      { label: 'Offline', value: 'offline' }
    ],
    initial: world.dojo ? 'blockchain' : 'offline'
  },
  {
    key: 'difficulty',
    type: 'switch',
    label: 'Difficulty',
    options: [
      { label: 'Easy', value: 'easy' },
      { label: 'Normal', value: 'normal' },
      { label: 'Hard', value: 'hard' }
    ],
    initial: 'normal'
  },
  {
    key: 'showDebug',
    type: 'switch',
    label: 'Debug Info',
    options: [
      { label: 'Show', value: 'show' },
      { label: 'Hide', value: 'hide' }
    ],
    initial: 'hide'
  }
])

// Game state
app.state.gameStarted = false
app.state.players = new Map()
app.state.mobs = []
app.state.resources = []
app.state.playerGold = 0
app.state.playerInventory = []

// Initialize game
app.on('init', () => {
  console.log('🚀 Game init triggered')
  initGame()
})

function initGame() {
  console.log('🎯 Initializing RPG game...')

  // Initialize based on availability
  if (world.dojo && app.props.gameMode === 'blockchain') {
    initDojoRPG()
  } else {
    initFallbackRPG()
  }
}

function initDojoRPG() {
  console.log('🌐 DOJO RPG MODE STARTED!')

  app.state.gameMode = 'dojo'
  app.state.worldAddress = world.dojo.getWorldAddress()
  app.state.networkId = world.dojo.getNetwork()
  app.state.isConnected = world.dojo.isConnected()

  console.log('   Network:', app.state.networkId)
  console.log('   World:', app.state.worldAddress)

  createGameUI()
  createGameWorld()

  app.state.gameStarted = true
  console.log('✅ Dojo RPG initialized')
}

function initFallbackRPG() {
  console.log('⚠️ OFFLINE RPG MODE')

  app.state.gameMode = 'offline'

  createGameUI()
  createGameWorld()

  app.state.gameStarted = true
  console.log('✅ Offline RPG initialized')
}

// Create game UI
function createGameUI() {
  // Main UI backdrop
  const backdrop = app.create('ui', {
    width: 400,
    height: 600,
    position: [0, 2, -2],
    rotation: [0, 0, 0],
    backgroundColor: [0.1, 0.1, 0.15, 0.9],
    borderRadius: 10
  })

  // Title
  const title = app.create('uitext', {
    text: app.state.gameMode === 'dojo' ? '🎮 Dojo RPG' : '🎮 Classic RPG',
    position: [0, 280, 0],
    fontSize: 24,
    color: [0.8, 0.9, 1.0]
  })
  backdrop.add(title)

  // Connection status
  const statusText = app.state.gameMode === 'dojo' && app.state.isConnected ?
    `🟢 Connected (${app.state.networkId})` :
    '🔴 Offline Mode'

  const status = app.create('uitext', {
    text: statusText,
    position: [0, 250, 0],
    fontSize: 14,
    color: app.state.gameMode === 'dojo' ? [0.2, 0.8, 0.2] : [0.8, 0.2, 0.2]
  })
  backdrop.add(status)

  // Player stats section
  const statsTitle = app.create('uitext', {
    text: '⚔️ Player Stats',
    position: [0, 200, 0],
    fontSize: 18,
    color: [0.9, 0.9, 0.9]
  })
  backdrop.add(statsTitle)

  // Health display
  const healthDisplay = app.create('uitext', {
    text: '❤️ Health: 100/100',
    position: [0, 170, 0],
    fontSize: 14,
    color: [0.8, 0.8, 0.8]
  })
  backdrop.add(healthDisplay)

  // Gold display
  const goldDisplay = app.create('uitext', {
    text: '💰 Gold: 0',
    position: [0, 145, 0],
    fontSize: 14,
    color: [0.8, 0.8, 0.8]
  })
  backdrop.add(goldDisplay)

  // Items section
  const itemsTitle = app.create('uitext', {
    text: '🎒 Inventory',
    position: [0, 110, 0],
    fontSize: 18,
    color: [0.9, 0.9, 0.9]
  })
  backdrop.add(itemsTitle)

  const itemsDisplay = app.create('uitext', {
    text: 'Empty',
    position: [0, 80, 0],
    fontSize: 12,
    color: [0.6, 0.6, 0.6]
  })
  backdrop.add(itemsDisplay)

  // Actions section
  const actionsTitle = app.create('uitext', {
    text: '🎯 Actions',
    position: [0, 40, 0],
    fontSize: 18,
    color: [0.9, 0.9, 0.9]
  })
  backdrop.add(actionsTitle)

  // Hint text
  const hint = app.create('uitext', {
    text: 'Click cubes to attack/farm',
    position: [0, 10, 0],
    fontSize: 12,
    color: [0.5, 0.5, 0.5]
  })
  backdrop.add(hint)

  // Instructions
  const instructions = app.create('uitext', {
    text: '🎮 Controls:\nWASD - Move\nSPACE - Jump\nMouse - Look\nClick - Interact',
    position: [0, -50, 0],
    fontSize: 11,
    color: [0.4, 0.4, 0.4]
  })
  backdrop.add(instructions)

  // Make UI face the camera
  backdrop.lookAt = () => {
    const cameraPos = world.camera.position
    const uiPos = backdrop.position
    const direction = cameraPos.clone().sub(uiPos).normalize()
    backdrop.quaternion.setFromUnitVectors([0, 0, 1], direction.toArray())
  }

  // Store UI references
  app.state.ui = {
    backdrop,
    title,
    status,
    healthDisplay,
    goldDisplay,
    itemsDisplay,
    hint
  }

  console.log('✅ Game UI created')
}

// Create game world
function createGameWorld() {
  console.log('🏗️ Creating game world...')

  // Create ground
  const ground = app.create('plane', {
    position: [0, 0, 0],
    rotation: [-Math.PI / 2, 0, 0],
    width: 50,
    height: 50,
    color: [0.2, 0.5, 0.2]
  })
  ground.collisionEnabled = true

  // Create game objects
  createMobs()
  createResources()
  createPlayer()

  // Set up interactions
  setupInteractions()

  console.log('✅ Game world created')
}

// Create mobs
function createMobs() {
  app.state.mobs = []
  const mobCount = 5

  for (let i = 0; i < mobCount; i++) {
    const x = (Math.random() - 0.5) * 20
    const z = (Math.random() - 0.5) * 20

    const mob = app.create('box', {
      position: [x, 1, z],
      scale: [0.8, 1.2, 0.8],
      color: [0.8, 0.2, 0.2],
      emissive: [0.3, 0.1, 0.1]
    })

    // Add Dojo sync for mobs if available
    if (world.dojo?.isConnected() && app.state.gameMode === 'dojo') {
      const dojoComponent = {
        worldAddress: world.dojo.getWorldAddress(),
        components: ['Position', 'Health'],
        syncInterval: 2000
      }
      mob.add('dojo', dojoComponent)
    }

    // Mob properties
    mob.health = 50
    mob.maxHealth = 50
    mob.damage = 10
    mob.gold = Math.floor(Math.random() * 20) + 5
    mob.damageColor = [1, 0, 0]

    mob.collisionEnabled = true

    app.state.mobs.push(mob)
  }

  console.log(`👹 Created ${mobCount} mobs`)
}

// Create resources
function createResources() {
  app.state.resources = []
  const resourceCount = 8

  for (let i = 0; i < resourceCount; i++) {
    const x = (Math.random() - 0.5) * 30
    const z = (Math.random() - 0.5) * 30

    const resource = app.create('box', {
      position: [x, 0.5, z],
      scale: [0.6, 0.6, 0.6],
      color: [0.5, 0.4, 0.3] // Brown color
    })

    // Add Dojo sync for resources if available
    if (world.dojo?.isConnected() && app.state.gameMode === 'dojo') {
      const dojoComponent = {
        worldAddress: world.dojo.getWorldAddress(),
        components: ['Position', 'Inventory'],
        syncInterval: 5000
      }
      resource.add('dojo', dojoComponent)
    }

    // Resource properties
    resource.type = Math.random() > 0.5 ? 'wood' : 'stone'
    resource.yield = Math.floor(Math.random() * 5) + 2
    resource.color = resource.type === 'wood' ? [0.5, 0.4, 0.3] : [0.4, 0.4, 0.4]

    resource.collisionEnabled = true

    app.state.resources.push(resource)
  }

  console.log(`🌲 Created ${resourceCount} resource nodes`)
}

// Create player
function createPlayer() {
  // Get the local player
  const player = world.entities.getLocalPlayer()
  if (!player) {
    console.error('❌ No local player found')
    return
  }

  console.log('✅ Player found:', player.data.id)

  // Initialize player stats
  app.state.playerHealth = 100
  app.state.playerMaxHealth = 100
  app.state.player = player
  app.state.playerProxy = player.playerProxy

  // Add Dojo sync for player if available
  if (world.dojo?.isConnected() && app.state.gameMode === 'dojo') {
    console.log('🌐 Adding Dojo sync to player...')

    // Mark entity as player for proper bridging
    player.isPlayer = true
    player.playerProxy = app.state.playerProxy

    const dojoComponent = {
      worldAddress: world.dojo.getWorldAddress(),
      components: ['Position', 'Health', 'Inventory', 'Owner'],
      syncInterval: 1000
    }
    player.add('dojo', dojoComponent)
    console.log('✅ Player synced to Dojo (bridged with Hyperfy health)')
  }

  console.log('✅ Player initialized - using Hyperfy health system')
}

// Set up interactions
function setupInteractions() {
  console.log('🔧 Setting up interaction handlers...')

  // Set up click interactions
  app.on('pointerdown', (event) => {
    if (!event.ray) return

    const hit = event.ray.intersectObjects([app.state.mobs, app.state.resources].flat())
    if (hit && hit.object) {
      handleInteraction(hit.object)
    }
  })

  console.log('✅ Interaction handlers set up')
}

// Handle interactions
function handleInteraction(target) {
  if (!app.state.player) return

  const distance = target ?
    Math.sqrt(
      Math.pow(target.position[0] - app.state.player.position[0], 2) +
      Math.pow(target.position[2] - app.state.player.position[2], 2)
    ) : Infinity

  if (distance > 5) {
    console.log('🚫 Target too far away')
    return
  }

  // Handle mob combat
  if (app.state.mobs.includes(target)) {
    attackMob(target)
  }
  // Handle resource gathering
  else if (app.state.resources.includes(target)) {
    gatherResource(target)
  }
}

// Attack mob
async function attackMob(mob) {
  console.log('⚔️ Attacking mob!')

  // Apply damage
  mob.health -= 10

  // Visual feedback
  const originalColor = [...mob.color]
  mob.color = [1, 1, 0] // Yellow flash

  setTimeout(() => {
    if (mob && !mob.destroyed) {
      mob.color = originalColor
    }
  }, 200)

  // If mob dies
  if (mob.health <= 0) {
    const goldEarned = mob.gold
    app.state.playerGold += goldEarned
    console.log(`💰 Mob defeated! Earned ${goldEarned} gold`)

    // Remove from arrays
    const index = app.state.mobs.indexOf(mob)
    if (index > -1) {
      app.state.mobs.splice(index, 1)
    }

    // Remove visual object
    app.remove(mob)

    // Spawn new mob after delay
    setTimeout(() => spawnMob(), 5000)
  } else {
    console.log(`💢 Mob health: ${mob.health}/${mob.maxHealth}`)
  }

  // Update UI
  updateUI()

  // Execute onchain transaction if available
  if (app.state.gameMode === 'dojo' && world.dojo?.isConnected()) {
    try {
      console.log('📡 Executing combat transaction onchain...')
      await world.dojo.execute([{
        target: world.dojo.getWorldAddress(),
        method: 'combat',
        args: [mob.dojo?.sync?.().dojoEntityId || 'mock_id', 10]
      }])
      console.log('✅ Combat transaction submitted')
    } catch (error) {
      console.log('⚠️ Onchain transaction failed:', error.message)
    }
  }
}

// Gather resource
async function gatherResource(resource) {
  console.log(`🪓 Gathering ${resource.type}!`)

  // Add resources to inventory
  for (let i = 0; i < resource.yield; i++) {
    app.state.playerInventory.push(resource.type)
  }

  console.log(`📦 Gathered ${resource.yield} ${resource.type}`)

  // Visual feedback
  const originalScale = [...resource.scale]
  resource.scale = [originalScale[0] * 0.8, originalScale[1] * 0.8, originalScale[2] * 0.8]

  setTimeout(() => {
    if (resource && !resource.destroyed) {
      resource.scale = originalScale
    }
  }, 300)

  // Remove resource
  const index = app.state.resources.indexOf(resource)
  if (index > -1) {
    app.state.resources.splice(index, 1)
  }

  // Remove visual object
  app.remove(resource)

  // Spawn new resource after delay
  setTimeout(() => spawnResource(), 10000)

  // Update UI
  updateUI()

  // Execute onchain transaction if available
  if (app.state.gameMode === 'dojo' && world.dojo?.isConnected()) {
    try {
      console.log('📡 Executing gathering transaction onchain...')
      await world.dojo.execute([{
        target: world.dojo.getWorldAddress(),
        method: 'gather',
        args: [resource.dojo?.sync?.().dojoEntityId || 'mock_id', resource.type, resource.yield]
      }])
      console.log('✅ Gathering transaction submitted')
    } catch (error) {
      console.log('⚠️ Onchain transaction failed:', error.message)
    }
  }
}

// Spawn new mob
function spawnMob() {
  if (app.state.mobs.length >= 10) return // Max mob limit

  const x = (Math.random() - 0.5) * 20
  const z = (Math.random() - 0.5) * 20

  const mob = app.create('box', {
    position: [x, 1, z],
    scale: [0.8, 1.2, 0.8],
    color: [0.8, 0.2, 0.2],
    emissive: [0.3, 0.1, 0.1]
  })

  mob.health = 50
  mob.maxHealth = 50
  mob.damage = 10
  mob.gold = Math.floor(Math.random() * 20) + 5
  mob.collisionEnabled = true

  if (world.dojo?.isConnected() && app.state.gameMode === 'dojo') {
    mob.add('dojo', {
      worldAddress: world.dojo.getWorldAddress(),
      components: ['Position', 'Health']
    })
  }

  app.state.mobs.push(mob)
  console.log('👹 New mob spawned')
}

// Spawn new resource
function spawnResource() {
  if (app.state.resources.length >= 15) return // Max resource limit

  const x = (Math.random() - 0.5) * 30
  const z = (Math.random() - 0.5) * 30

  const resource = app.create('box', {
    position: [x, 0.5, z],
    scale: [0.6, 0.6, 0.6],
    color: [0.5, 0.4, 0.3]
  })

  resource.type = Math.random() > 0.5 ? 'wood' : 'stone'
  resource.yield = Math.floor(Math.random() * 5) + 2
  resource.color = resource.type === 'wood' ? [0.5, 0.4, 0.3] : [0.4, 0.4, 0.4]
  resource.collisionEnabled = true

  if (world.dojo?.isConnected() && app.state.gameMode === 'dojo') {
    resource.add('dojo', {
      worldAddress: world.dojo.getWorldAddress(),
      components: ['Position', 'Inventory']
    })
  }

  app.state.resources.push(resource)
  console.log('🌲 New resource spawned')
}

// Update UI
function updateUI() {
  if (!app.state.ui) return

  // Update health - use player proxy if available
  const currentHealth = app.state.playerProxy ? app.state.playerProxy.health : app.state.playerHealth || 100
  const maxHealth = 100
  app.state.ui.healthDisplay.text = `❤️ Health: ${currentHealth}/${maxHealth}`

  // Update gold
  app.state.ui.goldDisplay.text = `💰 Gold: ${app.state.playerGold}`

  // Update inventory
  if (app.state.playerInventory.length > 0) {
    const inventoryCounts = {}
    app.state.playerInventory.forEach(item => {
      inventoryCounts[item] = (inventoryCounts[item] || 0) + 1
    })

    const inventoryText = Object.entries(inventoryCounts)
      .map(([item, count]) => `${item}: ${count}`)
      .join(', ')

    app.state.ui.itemsDisplay.text = inventoryText
    app.state.ui.itemsDisplay.color = [0.8, 0.8, 0.8]
  } else {
    app.state.ui.itemsDisplay.text = 'Empty'
    app.state.ui.itemsDisplay.color = [0.6, 0.6, 0.6]
  }
}

// Main update loop
app.on('update', () => {
  if (!app.state.gameStarted) return

  // Update UI to face camera
  if (app.state.ui?.backdrop?.lookAt) {
    app.state.ui.backdrop.lookAt()
  }

  // Spawn new objects periodically
  if (Math.random() < 0.002) { // 0.2% chance per frame
    if (app.state.mobs.length < 3) spawnMob()
  }

  if (Math.random() < 0.003) { // 0.3% chance per frame
    if (app.state.resources.length < 5) spawnResource()
  }
})

// Auto-start the game when ready
app.on('start', () => {
  console.log('🎮 Game start triggered')
  // Game already initialized in init()
})

console.log('🎮 Dojo RPG Demo script loaded')