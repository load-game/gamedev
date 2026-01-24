// Simple 2D Fighting Stage
// Uses global app pattern like prim-switcher.js

// IMPORTANT: Keep the stage visual meshes visible!
// The app's GLB model contains the visual stage geometry
// We only need to get references to trigger zones and spawn points
// The visual meshes will remain visible automatically

// Get GLB node references for triggers/colliders only
const gameBound = app.get('GameBound')
const gmBndCol = app.get('GmBndCol')

// Stage boundary system - using area trigger pattern (like areatrigger.js)
const stageBoundary = app.get('AreaTrigger') || app.get('StageBoundary') || app.get('FightingZone')

// Debug GLB node detection
console.log('[2D Stage] GLB Node Detection:')
console.log('  - GameBound:', !!gameBound)
console.log('  - GmBndCol:', !!gmBndCol)
console.log('  - StageBoundary/AreaTrigger:', !!stageBoundary, '(using AreaTrigger pattern)')

// Check for elementals system dependencies
console.log('[2D Stage] Elementals System Integration:')
console.log('  - Looking for elemental-combat.js for health/death management')
console.log('  - Looking for elemental-core.js for inventory management')
console.log('  - Stage will leverage existing elementals systems')

// The stage visual meshes are part of the app's GLB and will render automatically
console.log('[2D Stage] Stage visual meshes will render from GLB model')

// Spawn points array
const spawnPoints = [
  app.get('SpawnPoint'),
  app.get('SpawnPoint.001'),
  app.get('SpawnPoint.002'),
  app.get('SpawnPoint.003'),
  app.get('SpawnPoint.004'),
].filter(point => point !== null)

// Game state
let gameActive = false
let playersInZone = new Set()
let isInZone = false
let stageCamera = null
let stageUI = null
let statusText = null
let propsLogged = false

console.log('[2D Stage] Elemental fighting stage initialized')
console.log(`[2D Stage] Found ${spawnPoints.length} spawn points:`)
spawnPoints.forEach((point, i) => {
  if (point && point.position) {
    console.log(`  - SpawnPoint ${i}: [${point.position.x.toFixed(2)}, ${point.position.y.toFixed(2)}, ${point.position.z.toFixed(2)}]`)
  }
})

// Debug props availability
app.on('update', () => {
  if (!propsLogged) {
    console.log('[2D Stage] Props available:', props)
    console.log('[2D Stage] Camera distance:', props.cameraDistance)
    console.log('[2D Stage] Camera height:', props.cameraHeight)
    console.log('[2D Stage] Camera follow speed:', props.cameraFollowSpeed)
    propsLogged = true
  }
})

// Configure app
app.configure([
  { type: 'section', key: 'gameSection', label: 'Game Status' },
  { key: 'gameStatus', type: 'text', label: 'Status', initial: 'Game Inactive' },
  { type: 'section', key: 'adminSection', label: 'Admin Controls' },
  {
    type: 'button',
    key: 'startGame',
    label: 'Start Game',
    onClick: () => startGame(),
  },
  {
    type: 'button',
    key: 'stopGame',
    label: 'Stop Game',
    onClick: () => stopGame(),
  },
  {
    type: 'button',
    key: 'restartGame',
    label: 'Restart Game',
    onClick: () => restartGame(),
  },
  {
    type: 'button',
    key: 'teleportToStage',
    label: 'Teleport to Stage',
    onClick: () => teleportPlayer(world.getPlayer()?.id),
  },
  {
    type: 'button',
    key: 'testCamera',
    label: 'Test 2D Camera',
    onClick: () => test2DCamera(),
  },
  { type: 'section', key: 'cameraSection', label: 'Camera Settings' },
  { key: 'cameraDistance', type: 'number', label: 'Camera Distance', initial: 15, min: 5, max: 50 },
  { key: 'cameraHeight', type: 'number', label: 'Camera Height', initial: 5, min: 0, max: 20 },
  { key: 'cameraFollowSpeed', type: 'range', label: 'Follow Speed', initial: 0.1, min: 0.01, max: 0.5, step: 0.01 },
  {
    key: 'cameraFollowX', type: 'switch', label: 'Follow Player X', options: [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' }
    ], initial: 'true'
  },
  {
    key: 'lockMouseInZone', type: 'switch', label: 'Lock Mouse in Zone', options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], initial: true, hint: 'Prevent mouse from moving camera in 2D mode'
  },
  {
    key: 'hideReticleInZone', type: 'switch', label: 'Hide Reticle in Zone', options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], initial: true, hint: 'Hide crosshair in 2D fighting mode'
  },
  {
    key: 'disableScrollZoom', type: 'switch', label: 'Disable Scroll Zoom in Zone', options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], initial: true, hint: 'Prevent mouse scroll from zooming camera in 2D mode'
  },
  { type: 'section', key: 'stageVisualSection', label: 'Stage Visuals' },
  {
    key: 'boundaryVisibility', type: 'switch', label: 'Boundary Visibility', options: [
      { label: 'Visible', value: 'visible' },
      { label: 'Invisible', value: 'invisible' }
    ], initial: 'invisible', hint: 'Show or hide the stage boundary trigger mesh'
  },
  {
    key: 'deathZoneVisibility', type: 'switch', label: 'Death Zone Visibility', options: [
      { label: 'Visible', value: 'visible' },
      { label: 'Invisible', value: 'invisible' }
    ], initial: 'invisible', hint: 'Show or hide the death zone collider mesh'
  },

  { type: 'section', key: 'elementalsSection', label: 'Elementals Integration' },
  {
    key: 'useElementalsHealth', type: 'switch', label: 'Use Elementals Health System', options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], initial: true, hint: 'Leverage elemental-combat.js for health/death/respawn'
  },
  {
    key: 'useElementalsInventory', type: 'switch', label: 'Use Elementals Inventory', options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], initial: true, hint: 'Leverage elemental-core.js for item management'
  },
])

console.log('[2D Stage] Configuration completed')

// Apply visibility settings to trigger meshes
// Hide visual meshes but keep triggers active for collision detection
if (props.boundaryVisibility === 'invisible') {
  if (stageBoundary) {
    // Hide all mesh children but keep the trigger active
    stageBoundary.traverse(child => {
      if (child.name === 'mesh' || child.isMesh) {
        child.visible = false
      }
    })
    console.log('[2D Stage] Stage boundary visual meshes hidden (trigger still active)')
  }
}

if (props.deathZoneVisibility === 'invisible') {
  if (gmBndCol) {
    // Hide all mesh children but keep the trigger active
    gmBndCol.traverse(child => {
      if (child.name === 'mesh' || child.isMesh) {
        child.visible = false
      }
    })
    console.log('[2D Stage] Death zone visual meshes hidden (trigger still active)')
  }
}

// Debug props after configuration
setTimeout(() => {
  console.log('[2D Stage] Props after timeout:', props)
  console.log('[2D Stage] Camera distance from props:', props.cameraDistance)
  console.log('[2D Stage] Boundary visibility:', props.boundaryVisibility)
  console.log('[2D Stage] Death zone visibility:', props.deathZoneVisibility)
}, 1000)

// Server-side initialization
if (world.isServer) {
  // Listen for client messages about stage boundaries
  app.on('player-enter-stage', (data, networkId) => {
    const playerId = data.playerId
    console.log(`[2D Stage] SERVER: Player ${playerId} entered stage`)
    playersInZone.add(playerId)
  })

  app.on('player-leave-stage', (data, networkId) => {
    const playerId = data.playerId
    console.log(`[2D Stage] SERVER: Player ${playerId} left stage - applying KO`)
    playersInZone.delete(playerId)

    // Apply KO damage via elementals health system
    if (props.useElementalsHealth !== false && gameActive) {
      const player = world.getPlayer(playerId)
      if (player) {
        if (player.health !== undefined) {
          player.damage(player.health) // Instant KO
          console.log(`[2D Stage] SERVER: KO'd player ${playerId} (via elementals health system)`)
        } else {
          app.emit('health', { playerId, health: 0 })
          console.log(`[2D Stage] SERVER: KO'd player ${playerId} (via health event)`)
        }
      }
    }
  })

  app.on('player-death-zone', (data, networkId) => {
    const playerId = data.playerId
    console.log(`[2D Stage] SERVER: Player ${playerId} entered death zone - instant death`)

    // Apply instant death via elementals health system
    if (props.useElementalsHealth !== false) {
      const player = world.getPlayer(playerId)
      if (player) {
        if (player.health !== undefined) {
          player.damage(player.health)
          console.log(`[2D Stage] SERVER: Killed player ${playerId} in death zone`)
        } else {
          app.emit('health', { playerId, health: 0 })
          console.log(`[2D Stage] SERVER: Killed player ${playerId} via health event`)
        }
      }
    }
  })

  // Listen for player death events from elementals-combat
  world.on('health', ({ playerId, health }) => {
    if (health === 0 && playersInZone.has(playerId)) {
      const spawnPos = getRandomSpawnPoint()
      if (spawnPos) {
        // Set the spawn point in world storage for elemental-combat to use
        // Convert Vector3 to array manually
        world.set('elemental-combat:spawn', [spawnPos.x, spawnPos.y, spawnPos.z])
        console.log(`[2D Stage] Set respawn for player ${playerId} at`, spawnPos.x, spawnPos.y, spawnPos.z)
      }
    }
  })

  console.log('[2D Stage] Server initialized - elementals integration active')
}

// Client-side initialization
if (world.isClient) {
  // Get control interface for camera manipulation
  const control = app.control()
  if (!control) {
    console.error('[2D Stage] No control interface available!')
    return
  }

  console.log('[2D Stage] Using control.camera for 2D perspective')
  console.log('[2D Stage] Using camera height:', props.cameraHeight || 5)
  console.log('[2D Stage] Using camera distance:', props.cameraDistance || 15)

  // Store original camera settings for restoration
  const originalCameraSettings = {
    position: control.camera.position.clone(),
    rotation: control.camera.rotation.clone(),
    fov: control.camera.fov,
  }

  stageCamera = {
    control,
    originalSettings: originalCameraSettings,
    active: false,
  }

  console.log('[2D Stage] Control camera interface ready for 2D perspective')

  // Setup stage boundary trigger on CLIENT (like areatrigger.js)
  if (stageBoundary) {
    stageBoundary.onTriggerEnter = hit => {
      console.log(`[2D Stage] CLIENT: STAGE ENTER:`, hit.playerId)
      if (hit.playerId) {
        const localPlayer = world.getPlayer()
        if (localPlayer && localPlayer.id === hit.playerId) {
          console.log('[2D Stage] CLIENT: Local player entered fighting stage!')
          playersInZone.add(hit.playerId)
          isInZone = true
          activateStageCamera()
          showUI('2D Fight Mode Active')

          // Notify server
          app.send('player-enter-stage', { playerId: hit.playerId })
        }
      }
    }

    stageBoundary.onTriggerLeave = hit => {
      console.log(`[2D Stage] CLIENT: STAGE LEAVE:`, hit.playerId)
      if (hit.playerId) {
        const localPlayer = world.getPlayer()
        if (localPlayer && localPlayer.id === hit.playerId) {
          console.log('[2D Stage] CLIENT: Local player left fighting stage - KO!')
          playersInZone.delete(hit.playerId)
          isInZone = false
          deactivateStageCamera()
          hideUI()

          // Notify server to apply KO damage
          app.send('player-leave-stage', { playerId: hit.playerId })
        }
      }
    }

    console.log('[2D Stage] CLIENT: Stage boundary trigger configured')
  } else {
    console.warn('[2D Stage] CLIENT: No stage boundary found!')
  }

  // Setup death zone trigger on CLIENT
  if (gmBndCol) {
    gmBndCol.onTriggerEnter = hit => {
      console.log(`[2D Stage] CLIENT: DEATH ZONE ENTER:`, hit.playerId)
      if (hit.playerId) {
        const localPlayer = world.getPlayer()
        if (localPlayer && localPlayer.id === hit.playerId) {
          console.log('[2D Stage] CLIENT: Local player entered death zone - instant KO!')

          // Notify server to apply instant death
          app.send('player-death-zone', { playerId: hit.playerId })
        }
      }
    }

    console.log('[2D Stage] CLIENT: Death zone trigger configured')
  }

  // Note: Triggers are handled directly on client side (see above)
  // Server messages are only for game state changes

  app.on('game-state-changed', data => {
    if (isInZone) {
      showUI(data.active ? '2D Fight Mode Active' : 'Game Inactive')
    }
  })

  // Update loop for camera following
  app.on('update', delta => {
    if (!isInZone || !stageCamera || !stageCamera.active) return

    updateStageCamera(delta)
  })

  console.log('[2D Stage] Client initialized')

  // Listen for chat commands for teleport
  world.on('command', e => {
    if (!e.args || e.args.length === 0) return

    console.log('[2D Stage] Received command:', e.args[0])

    // Handle /stage, /spawn, /center, /origin commands
    handleTeleportCommand(e.args[0], e.playerId)
  })
}

function handleTeleportCommand(commandText, playerId) {
  console.log('[2D Stage] Handling teleport command:', commandText)

  const placeName = commandText.slice(1) // Remove the '/' prefix

  // Define known places and their positions
  const places = {
    stage: getRandomSpawnPoint(),
    spawn: getRandomSpawnPoint(),
    center: new Vector3(0, 100, 0), // Center at Y=100 to match stage height
    origin: new Vector3(0, 0, 0),
  }

  const targetPlace = placeName.toLowerCase()

  if (places[targetPlace]) {
    const player = world.getPlayer(playerId)
    if (player && places[targetPlace]) {
      const pos = places[targetPlace]
      // player.teleport() accepts Vector3 directly, no need for toArray()
      player.teleport(pos)
      console.log(`[2D Stage] Teleported player ${playerId} to ${targetPlace}:`, pos.x, pos.y, pos.z)
    } else if (!places[targetPlace]) {
      console.warn(`[2D Stage] No spawn point available for ${targetPlace}`)
    }
  } else {
    console.log(`[2D Stage] Unknown teleport destination: ${targetPlace}`)
  }
}

function activateStageCamera() {
  console.log('[2D Stage] ACTIVATE: stageCamera exists:', !!stageCamera)
  if (!stageCamera || !stageCamera.control) return

  try {
    // Take control of the camera
    stageCamera.control.camera.write = true
    stageCamera.active = true

    // Lock mouse movement for 2D perspective (if enabled)
    if (props.lockMouseInZone !== false) {
      stageCamera.control.pointer.lock()
    }

    // Prevent scroll zoom in 2D mode (stops camera zooming into first person)
    if (props.disableScrollZoom !== false) {
      stageCamera.control.scrollDelta.capture = true
    }

    // Hide reticle for cleaner 2D view (if enabled)
    if (props.hideReticleInZone !== false) {
      stageCamera.control.hideReticle(true)
    }

    // Set 2D perspective camera settings
    const targetHeight = props.cameraHeight || 100
    const targetDistance = props.cameraDistance || 15

    stageCamera.control.camera.position.set(0, targetHeight, targetDistance)
    stageCamera.control.camera.rotation.set(0, 0, 0)
    stageCamera.control.camera.fov = 50

    console.log('[2D Stage] Stage camera activated - mouse locked, reticle hidden')
    console.log('[2D Stage] Camera position:', stageCamera.control.camera.position.x, stageCamera.control.camera.position.y, stageCamera.control.camera.position.z)
  } catch (error) {
    console.error('[2D Stage] Failed to activate camera:', error)
  }
}

function deactivateStageCamera() {
  console.log('[2D Stage] DEACTIVATE: Attempting to deactivate camera')
  if (!stageCamera || !stageCamera.control) return

  try {
    // Release camera control and restore original settings
    stageCamera.control.camera.write = false
    stageCamera.active = false

    // Unlock mouse movement (restore to normal)
    if (props.lockMouseInZone !== false) {
      stageCamera.control.pointer.unlock()
    }

    // Restore scroll zoom functionality
    if (props.disableScrollZoom !== false) {
      stageCamera.control.scrollDelta.capture = false
    }

    // Restore reticle (restore to normal)
    if (props.hideReticleInZone !== false) {
      stageCamera.control.hideReticle(false)
    }

    // Restore original camera settings
    if (stageCamera.originalSettings) {
      stageCamera.control.camera.position.copy(stageCamera.originalSettings.position)
      stageCamera.control.camera.rotation.copy(stageCamera.originalSettings.rotation)
      stageCamera.control.camera.fov = stageCamera.originalSettings.fov
    }

    console.log('[2D Stage] Stage camera deactivated - mouse unlocked, reticle restored')
  } catch (error) {
    console.error('[2D Stage] Failed to deactivate camera:', error)
  }
}

function updateStageCamera(delta) {
  if (!stageCamera || !stageCamera.active || !stageCamera.control) return

  const localPlayer = world.getPlayer()
  if (!localPlayer) return

  // For 2D side-scrolling perspective, camera follows player movement
  const targetHeight = props.cameraHeight || 100
  const targetDistance = props.cameraDistance || 15
  const followSpeed = props.cameraFollowSpeed || 0.1
  const followX = props.cameraFollowX === 'true' // Follow player X movement

  // Get player position
  const playerPos = localPlayer.position

  // Calculate target camera position
  let targetX = 0
  if (followX) {
    targetX = playerPos.x // Camera follows player X movement
  }

  const targetY = targetHeight
  const targetZ = targetDistance

  // Smooth camera movement
  const currentPos = stageCamera.control.camera.position
  currentPos.x += (targetX - currentPos.x) * followSpeed
  currentPos.y += (targetY - currentPos.y) * followSpeed
  currentPos.z += (targetZ - currentPos.z) * followSpeed

  // For 2D side-scrolling, camera should look straight ahead (no lookAt needed)
  // The camera rotation is already set correctly in activateStageCamera()
  // Just keep the camera pointed at the stage center

  // Debug camera position occasionally
  if (Math.random() < 0.05) { // Only log 5% of the time to avoid spam
    console.log('[2D Stage] 2D camera position:', {
      x: currentPos.x.toFixed(2),
      y: currentPos.y.toFixed(2),
      z: currentPos.z.toFixed(2),
      playerX: playerPos.x.toFixed(2),
      followX: followX
    })
  }
}

function startGame() {
  gameActive = true
  app.state.gameActive = true
  app.send('game-state-changed', { active: true })

  // Update config status
  app.config.gameStatus = 'Game Active'

  console.log('[2D Stage] Game started')
}

function stopGame() {
  gameActive = false
  app.state.gameActive = false
  playersInZone.clear()
  app.send('game-state-changed', { active: false })

  // Update config status
  app.config.gameStatus = 'Game Inactive'

  console.log('[2D Stage] Game stopped')
}

function restartGame() {
  console.log('[2D Stage] Restarting game...')
  stopGame()
  setTimeout(() => startGame(), 1000)
}

function teleportPlayer(networkId) {
  const spawnPos = getRandomSpawnPoint()
  const player = world.getPlayer(networkId)
  if (player && spawnPos) {
    // player.teleport() accepts Vector3 directly
    player.teleport(spawnPos)
    console.log(`[2D Stage] Teleported player ${networkId} to stage at`, spawnPos.x, spawnPos.y, spawnPos.z)
  } else {
    console.warn(`[2D Stage] Failed to teleport player ${networkId} - player or spawn not found`)
  }
}

function getRandomSpawnPoint() {
  if (spawnPoints.length === 0) {
    console.warn('[2D Stage] No spawn points available')
    return null
  }

  // Use spawn points 001-004 for random selection, fallback to main SpawnPoint
  const validSpawns = spawnPoints.length > 1 ? spawnPoints.slice(1) : spawnPoints
  const randomIndex = Math.floor(Math.random() * validSpawns.length)
  const spawn = validSpawns[randomIndex]

  if (!spawn) {
    console.warn('[2D Stage] Selected spawn point is null')
    return null
  }

  const spawnPos = spawn.position.clone()
  console.log(`[2D Stage] Selected random spawn point ${randomIndex + 1}/${validSpawns.length}:`, spawnPos.x, spawnPos.y, spawnPos.z)
  return spawnPos
}

function showUI(message) {
  // Create or update UI element
  if (!stageUI) {
    console.log('[2D Stage] UI: Creating screen UI for message:', message)

    stageUI = app.create('ui', {
      space: 'screen',
      width: 300,
      height: 80,
      x: 960, // Center of 1920px screen
      y: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 10,
      padding: 15,
    })

    statusText = app.create('uitext', {
      value: message,
      color: '#00ff00',
      fontSize: 20,
      align: 'center',
    })

    stageUI.add(statusText)
    app.add(stageUI)
  } else {
    statusText.value = message
  }
}

function hideUI() {
  if (stageUI) {
    app.remove(stageUI)
    stageUI = null
    statusText = null
  }
}

function test2DCamera() {
  console.log('[2D Stage] TEST: Button clicked - manually activating 2D camera')
  console.log('[2D Stage] TEST: stageCamera exists:', !!stageCamera)
  console.log('[2D Stage] TEST: stageCamera.control exists:', !!stageCamera?.control)

  if (!stageCamera) {
    console.error('[2D Stage] TEST: ERROR - stageCamera is null!')
    return
  }

  console.log('[2D Stage] TEST: stageCamera.active:', stageCamera.active)

  isInZone = true
  activateStageCamera()
  showUI('2D Camera Test Mode')

  // Check if activation worked
  setTimeout(() => {
    console.log('[2D Stage] TEST: After activation - stageCamera.active:', stageCamera.active)
  }, 100)

  // Deactivate after 10 seconds
  setTimeout(() => {
    console.log('[2D Stage] TEST: Deactivating 2D camera')
    isInZone = false
    deactivateStageCamera()
    hideUI()
  }, 10000)
}
