// Stamina System with Animated Bar
// Version: 2.0 (Vertical animated bar anchored to chest)
// Features: Stamina management, regeneration, animated vertical bar attached to chest bone

const STAMINA_MAX = 100
const STAMINA_REGEN_RATE = 15
const STAMINA_REGEN_DELAY = 2.0
const STAMINA_LOW_THRESHOLD = 20

// Bar configuration (animated vertical bar)
const BAR_WIDTH = 0.1      // Thickness (horizontal)
const BAR_HEIGHT = 1.5     // Height (vertical)
const BAR_DEPTH = 0.02     // Depth
const BAR_OFFSET_X = -0.3  // Horizontal offset from chest (negative = left)
const BAR_OFFSET_Y = 0.1   // Vertical offset from chest

app.configure([
  {
    key: 'showStaminaBar',
    type: 'toggle',
    label: 'Show Stamina Bar',
    initial: true,
  },
  {
    key: 'showBarObjects',
    type: 'toggle',
    label: 'Show Bar Objects',
    initial: true,
    hint: 'Show the 3D bar model (uncheck for invisible logic only)'
  },
  {
    key: 'regenAudio',
    type: 'file',
    kind: 'audio',
    label: 'Regeneration Audio',
    hint: 'Sound to play when stamina regenerates'
  },
  {
    key: 'debugMode',
    type: 'toggle',
    label: 'Debug Mode',
    initial: false,
    hint: 'Enable console debugging'
  },
  {
    key: 'hideMesh',
    type: 'toggle',
    label: 'Hide Block',
    initial: false,
    hint: 'Hide the .glb mesh this script is attached to'
  },
])

if (!world.isClient) return

// Debug logging utility
function debugLog(...args) {
  if (config.debugMode) {
    console.log('[Stamina System]', ...args)
  }
}

debugLog('Stamina System initializing for player')

const player = world.getPlayer()
const playerId = player.id
const control = app.control()
let stamina = STAMINA_MAX
let lastStaminaUse = 0
let staminaRecentlyUsed = false

debugLog('System initializing...')

// Bar group with prims (manual positioning like fireball)
const barGroup = app.create('group')
app.add(barGroup)
world.attach(barGroup) // Attach to world for manual positioning

// Even smaller bar dimensions (0.2x size = 80% smaller than original)
const barWidth = BAR_WIDTH * 0.2       // 0.02m width
const barHeight = BAR_HEIGHT * 0.1     // 0.3m height
const barDepth = BAR_DEPTH * 0.8       // 0.016m depth (slightly thinner)

// Background bar (semi-transparent black part) - render first
const barBg = app.create('prim', {
  type: 'box',
  size: [barWidth, barHeight, barDepth],
  color: '#333333',
  opacity: 0.6, // Semi-transparent to show encasing effect
  transparent: true,
  renderOrder: 1000, // Render before fill to avoid overlap issues
  castShadow: false,
  receiveShadow: false,
  visible: config.showBarObjects, // Hide/show based on config
})
barGroup.add(barBg)

// Front bar (green part) - centered at same position for both-side visibility
// Significantly smaller to create visible border effect with emissive glow
const barFront = app.create('prim', {
  type: 'box',
  size: [barWidth * 0.85, barHeight * 0.90, barDepth * 0.90], // Much smaller than background
  color: '#00ff00',
  emissive: '#00ff00', // Emissive glow effect
  emissiveIntensity: 0.2, // Subtle glow
  doubleside: true,
  renderOrder: 1001, // Render after background
  castShadow: false,
  receiveShadow: false,
  visible: config.showBarObjects, // Hide/show based on config
})
barGroup.add(barFront)

// Audio node for regeneration sound
const regenAudio = app.create('audio', {
  src: app.props.regenAudio?.url || null,
  volume: 0.1,
  loop: false,
  spatial: false, // 2D UI sound, not 3D spatial
})
barGroup.add(regenAudio)

// State tracking
let targetScaleY = 1
let barActive = false
let isRegenerating = false

// Position tracking
const tempVec = new Vector3()
const tempVec2 = new Vector3()
const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const tempEuler = new Euler()

// Update bar visual based on stamina
function updateBarVisual() {
  if (!config.showStaminaBar) return

  const percent = stamina / STAMINA_MAX
  targetScaleY = percent

  // Hide bar when stamina is full and not recently used
  if (stamina >= STAMINA_MAX - 0.1 && !staminaRecentlyUsed) {
    barGroup.active = false
    return
  }

  // Update front bar scale (grows from bottom upward)
  barFront.scale.y = percent

  // Position front bar to fill from bottom (when scale changes, origin is at center)
  const scale = barFront.scale.y
  const offsetY = (1 - scale) * barHeight / 2
  barFront.position.y = -offsetY

  // Color based on percentage
  if (percent < 0.25) {
    barFront.color = '#ff0000'  // Red = low
  } else if (percent < 0.5) {
    barFront.color = '#ffff00'  // Yellow = medium
  } else {
    barFront.color = '#00ff00'  // Green = full
  }

  // Reset emissive intensity based on unlimited stamina state
  if (unlimitedStamina) {
    barFront.emissive = '#00ff00'
    barFront.emissiveIntensity = 3.0  // Bright glow for unlimited mode
  } else {
    barFront.emissive = barFront.color
    barFront.emissiveIntensity = 0.2  // Normal glow
  }

  // Show bar
  barGroup.active = true
  barBg.active = true
  barFront.active = true
}

// Broadcast stamina change to other apps
function emitStaminaChanged(newStamina, oldStamina) {
  world.emit('stamina:changed', {
    playerId,
    stamina: newStamina,
    maxStamina: STAMINA_MAX,
    percent: newStamina / STAMINA_MAX,
    delta: newStamina - oldStamina,
  })
}

// Initialize
debugLog(`System initialized for player ${playerId}, stamina: ${stamina}/${STAMINA_MAX}`)
barActive = config.showStaminaBar

// Hide ROM mesh if configured (hide the .glb model this code is attached to)
if (config.hideMesh) {
  // Hide the "Block" mesh from the .glb
  const block = app.get('Block')
  if (block) {
    block.active = false
    debugLog('Hidden ROM mesh (Block)')
  } else {
    debugLog('Could not find Block mesh to hide')
  }
}

// Ensure bar components are active for initial setup
if (barActive) {
  barGroup.active = true
  barBg.active = true
  barFront.active = true
  debugLog('Bar components activated')
}

updateBarVisual()
debugLog('UI bar initialized with automatic billboarding (hidden when full)')

// Handle stamina consumption requests from other apps
world.on(`stamina:consume:${playerId}`, ({ amount, requestId }) => {
  const oldStamina = stamina
  let actualAmount = 0
  let success = false

  if (unlimitedStamina) {
    // With unlimited stamina, always succeed but don't deduct
    success = true
    actualAmount = amount
    staminaRecentlyUsed = true
    updateBarVisual()
    emitStaminaChanged(stamina, stamina) // Emit but stamina stays same
  } else {
    actualAmount = Math.min(amount, stamina)
    stamina = Math.max(0, stamina - actualAmount)
    success = actualAmount > 0
    lastStaminaUse = Date.now() / 1000
    staminaRecentlyUsed = true // Show bar when stamina is being used
    updateBarVisual()
    emitStaminaChanged(stamina, oldStamina)
  }

  world.emit(`stamina:consume-reply:${playerId}:${requestId}`, {
    success: success,
    consumed: actualAmount,
    remaining: stamina,
  })
})

// Handle try-consume requests (all-or-nothing)
world.on(`stamina:try-consume:${playerId}`, ({ amount, requestId }) => {
  if (unlimitedStamina || stamina >= amount) {
    const oldStamina = stamina
    if (!unlimitedStamina) {
      stamina -= amount
    }
    lastStaminaUse = Date.now() / 1000
    staminaRecentlyUsed = true // Show bar when stamina is being used
    updateBarVisual()
    if (!unlimitedStamina) {
      emitStaminaChanged(stamina, oldStamina)
    } else {
      emitStaminaChanged(stamina, stamina) // Stays same
    }

    world.emit(`stamina:try-consume-reply:${playerId}:${requestId}`, {
      success: true,
      remaining: stamina,
    })
  } else {
    world.emit(`stamina:try-consume-reply:${playerId}:${requestId}`, {
      success: false,
      remaining: stamina,
    })
  }
})

// Handle stamina queries
world.on(`stamina:query:${playerId}`, ({ requestId }) => {
  world.emit(`stamina:query-reply:${playerId}:${requestId}`, {
    stamina,
    maxStamina: STAMINA_MAX,
    percent: stamina / STAMINA_MAX,
  })
})

// Handle direct stamina modification
world.on(`stamina:set:${playerId}`, ({ value }) => {
  const oldStamina = stamina
  stamina = Math.max(0, Math.min(STAMINA_MAX, value))
  if (stamina < STAMINA_MAX) {
    staminaRecentlyUsed = true // Show bar when stamina is not full
  }
  updateBarVisual()
  emitStaminaChanged(stamina, oldStamina)
})

world.on(`stamina:add:${playerId}`, ({ amount }) => {
  const oldStamina = stamina
  stamina = Math.min(STAMINA_MAX, stamina + amount)
  if (stamina < STAMINA_MAX) {
    staminaRecentlyUsed = true // Show bar when stamina is not full
  }
  updateBarVisual()
  emitStaminaChanged(stamina, oldStamina)
})

// Main update loop for stamina regeneration
app.on('update', (delta) => {
  const currentTime = Date.now() / 1000

  if (Math.random() < 0.05) {
    debugLog('Update loop running - boostActive:', boostActive, 'boostTimer:', boostTimer.toFixed(3), 'unlimited:', unlimitedStamina)
  }

  // Smoothly animate bar scale to target
  const currentScale = barFront.scale.y
  if (Math.abs(currentScale - targetScaleY) > 0.01) {
    barFront.scale.y += (targetScaleY - currentScale) * 10 * delta
    // Update position to keep bar anchored at bottom
    const scale = barFront.scale.y
    const offsetY = (1 - scale) * barHeight / 2
    barFront.position.y = -offsetY
  } else {
    barFront.scale.y = targetScaleY
  }

  // Handle boost timer
  if (boostActive) {
    const oldBoostTimer = boostTimer
    boostTimer -= delta

    if (Math.random() < 0.1) {
      debugLog('Boost timer decreasing:', oldBoostTimer.toFixed(3), '→', boostTimer.toFixed(3), 'delta:', delta.toFixed(3))
    }

    if (boostTimer <= 0) {
      debugLog('Boost timer expired! Deactivating boost')
      boostActive = false
      boostTimer = 0
      boostAmount = 0
      unlimitedStamina = false

      // Reset bar color and intensity
      updateBarVisual()

      world.emit('stamina:boost:end', { playerId })
      debugLog('Stamina boost ended - unlimited mode deactivated')
    }
  }

  // Regenerate stamina - reduced delay to allow regen while moving
  if (currentTime - lastStaminaUse > 0.5) {  // 0.5s delay instead of 2.0s
    const oldStamina = stamina
    let regenAmount = STAMINA_REGEN_RATE * delta * 0.5  // 50% regen rate while active

    // Add boost amount if active
    if (boostActive) {
      regenAmount += boostAmount * delta
      debugLog('Boosted regen:', regenAmount, 'per second')
    }

    const newStamina = Math.min(STAMINA_MAX, stamina + regenAmount)

    if (newStamina !== oldStamina) {
      stamina = newStamina

      // Play regeneration audio if configured
      if (app.props.regenAudio?.url && !isRegenerating && regenAmount > 0.1) {
        regenAudio.src = app.props.regenAudio.url
        regenAudio.volume = 0.2  // Quieter for subtle effect
        regenAudio.loop = false  // Single play per regen tick

        // Only play if audio isn't already playing
        try {
          regenAudio.play()
        } catch (e) {
          debugLog('Audio play failed:', e)
        }

        isRegenerating = true
        // Reset flag after audio duration or short delay
        setTimeout(() => {
          isRegenerating = false
        }, 1000)  // 1 second before allowing another play
      }

      updateBarVisual()
      emitStaminaChanged(stamina, oldStamina)
    } else if (stamina >= STAMINA_MAX - 0.1 && !boostActive) {
      // Hide bar after stamina is full for a moment (only if boost not active)
      staminaRecentlyUsed = false
      updateBarVisual()
      isRegenerating = false
    }
  }
})

// Late update for position following, camera-facing billboarding, and distance-based scaling
app.on('lateUpdate', (delta) => {
  if (!barActive || !player || !player.position || !control?.camera) {
    if (!barActive) debugLog('Bar not active')
    if (!player) debugLog('Player not found')
    if (!player?.position) debugLog('Player position not available')
    if (!control?.camera) debugLog('Camera not available')
    return
  }

  // Calculate distance from camera to player
  const cameraPos = control.camera.position
  const distance = cameraPos.distanceTo(player.position)

  // Scale bar based on distance (bigger when closer, smaller when far)
  let scaleFactor = 5.0 / Math.max(distance, 1.0)
  scaleFactor = Math.max(0.5, Math.min(3.0, scaleFactor))
  barGroup.scale.set(scaleFactor, scaleFactor, scaleFactor)

  // Use player's rotation to align bar position relative to camera
  tempEuler.setFromQuaternion(player.quaternion, 'YXZ')
  tempQuat.setFromEuler(tempEuler)

  // Get direction vectors from player's orientation
  // Forward is -Z in player space
  const forwardDir = tempVec.set(0, 0, -1).applyQuaternion(tempQuat)
  // Left is -X in player space
  const leftDir = tempVec2.set(-1, 0, 0).applyQuaternion(tempQuat)
  // Up is +Y in player space
  const upDir = tempVec3.set(0, 1, 0).applyQuaternion(tempQuat)

  // Position bar on player's right side
  const leftOffset = leftDir.multiplyScalar(-0.4)  // 0.4m to right (negative left)
  const upOffset = upDir.multiplyScalar(1.0)       // 1.0m up
  const forwardOffset = forwardDir.multiplyScalar(0.49)  // 0.49m forward

  barGroup.position.copy(player.position)
    .add(leftOffset)
    .add(upOffset)
    .add(forwardOffset)

  // Make bar face the camera using control.camera yaw (like romDash.js)
  tempEuler.setFromQuaternion(control.camera.quaternion, 'YXZ')
  barGroup.rotation.y = tempEuler.y

  // (Removed particle position update - now using world space with manual offset)

  // Debug logging to verify positioning
  if (Math.random() < 0.01) {
    debugLog(`Bar pos: ${barGroup.position.x.toFixed(2)}, ${barGroup.position.y.toFixed(2)}, ${barGroup.position.z.toFixed(2)}`)
  }
})

// Boost state
let boostActive = false
let boostAmount = 0
let boostTimer = 0
let unlimitedStamina = false

// Handle stamina boost start
world.on(`stamina:boost:start`, ({ playerId: boostPlayerId, boostAmount: amount, duration, unlimited }) => {
  debugLog('Received stamina:boost:start event for player', boostPlayerId, 'my playerId:', playerId)

  if (boostPlayerId !== playerId) {
    debugLog('Ignoring boost event - not for this player')
    return
  }

  debugLog('Activating boost for this player - duration:', duration, 'unlimited:', unlimited)

  unlimitedStamina = unlimited === true
  if (unlimitedStamina) {
    debugLog('Unlimited stamina activated for', duration, 'seconds')
    // Set stamina to max
    stamina = STAMINA_MAX
    targetScaleY = 1
    updateBarVisual()
    emitStaminaChanged(stamina, stamina)
  } else {
    debugLog('Stamina boost activated:', amount, 'per second for', duration, 'seconds')
    boostAmount = amount || 15
  }

  boostActive = true
  boostTimer = duration || 10
  staminaRecentlyUsed = true

  debugLog('Boost activated - timer set to:', boostTimer, 'seconds')

  // Change bar color and intensity to indicate boost
  if (unlimitedStamina) {
    // Very bright green glow for unlimited mode
    barFront.color = '#00ff00'
    barFront.emissive = '#00ff00'
    barFront.emissiveIntensity = 3.0  // Very high intensity for strong glow
  } else {
    // Cyan for regular boost
    barFront.color = '#00ffff'
    barFront.emissive = '#00ffff'
    barFront.emissiveIntensity = 0.3
  }
  barGroup.active = true

  world.emit('stamina:boost:started', {
    playerId,
    boostAmount: boostAmount,
    duration: boostTimer,
    unlimited: unlimitedStamina,
  })
})

// Cleanup on destroy
app.on('destroy', () => {
  world.off(`stamina:consume:${playerId}`)
  world.off(`stamina:try-consume:${playerId}`)
  world.off(`stamina:query:${playerId}`)
  world.off(`stamina:set:${playerId}`)
  world.off(`stamina:add:${playerId}`)
  app.off('update')
  app.off('lateUpdate')
})

// Expose stamina API for direct access (optional)
app.stamina = {
  get: () => stamina,
  getMax: () => STAMINA_MAX,
  getPercent: () => stamina / STAMINA_MAX,
  consume: (amount) => {
    const oldStamina = stamina
    const actualAmount = Math.min(amount, stamina)
    stamina = Math.max(0, stamina - actualAmount)
    lastStaminaUse = Date.now() / 1000
    staminaRecentlyUsed = true // Show bar when stamina is being used
    updateBarVisual()
    emitStaminaChanged(stamina, oldStamina)
    return actualAmount
  },
  tryConsume: (amount) => {
    if (stamina >= amount) {
      const oldStamina = stamina
      stamina -= amount
      lastStaminaUse = Date.now() / 1000
      staminaRecentlyUsed = true // Show bar when stamina is being used
      updateBarVisual()
      emitStaminaChanged(stamina, oldStamina)
      return true
    }
    return false
  },
  has: (amount) => stamina >= amount,
  setStamina: (value) => {
    const oldStamina = stamina
    stamina = Math.max(0, Math.min(STAMINA_MAX, value))
    if (stamina < STAMINA_MAX) {
      staminaRecentlyUsed = true // Show bar when stamina is not full
    }
    updateBarVisual()
    emitStaminaChanged(stamina, oldStamina)
  },
  add: (amount) => {
    const oldStamina = stamina
    stamina = Math.min(STAMINA_MAX, stamina + amount)
    if (stamina < STAMINA_MAX) {
      staminaRecentlyUsed = true // Show bar when stamina is not full
    }
    updateBarVisual()
    emitStaminaChanged(stamina, oldStamina)
  },
  isBoostActive: () => boostActive,
  getBoostAmount: () => boostAmount,
  getBoostTimeRemaining: () => boostTimer,
}