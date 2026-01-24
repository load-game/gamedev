// Stamina System with ULTRA debug logging

const STAMINA_MAX = 100
const STAMINA_REGEN_RATE = 15
const STAMINA_REGEN_DELAY = 2.0
const STAMINA_LOW_THRESHOLD = 20

const BAR_WIDTH = 0.1
const BAR_HEIGHT = 1.5
const BAR_DEPTH = 0.02
const BAR_OFFSET_X = -0.3
const BAR_OFFSET_Y = 0.1

// Temporary vectors for positioning
const tempVec = new Vector3()
const tempVec2 = new Vector3()
const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const tempEuler = new Euler()

app.configure([
  {
    key: 'showStaminaBar',
    type: 'toggle',
    label: 'Show Stamina Bar',
    initial: true
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
    initial: true,
    hint: 'Enable console debugging'
  },
  {
    key: 'hideMesh',
    type: 'toggle',
    label: 'Hide Block',
    initial: false,
    hint: 'Hide the .glb mesh this script is attached to'
  }
])

function debugLog(...args) {
  if (config.debugMode) {
    console.log('[STAMINA SYSTEM DEBUG]', ...args)
  }
}

debugLog('=== STAMINA SYSTEM INITIALIZING ===')

if (!world.isClient) {
  debugLog('Not running on client - exiting')
  return
}

debugLog('Running on CLIENT')

const player = world.getPlayer()
const playerId = player.id
const control = app.control()

let stamina = STAMINA_MAX
let lastStaminaUse = 0
let staminaRecentlyUsed = false

debugLog('Player:', player)
debugLog('Player ID:', playerId)
debugLog('Initial stamina:', stamina)

// Create bar visuals
const barGroup = app.create('group')
app.add(barGroup)
world.attach(barGroup)

const barWidth = BAR_WIDTH * 0.2
const barHeight = BAR_HEIGHT * 0.1
const barDepth = BAR_DEPTH * 0.8

debugLog('Creating bar visuals...')

const barBg = app.create('prim', {
  type: 'box',
  size: [barWidth, barHeight, barDepth],
  color: '#333333',
  opacity: 0.6,
  transparent: true,
  renderOrder: 1000,
  castShadow: false,
  receiveShadow: false,
  visible: config.showBarObjects
})
barGroup.add(barBg)

debugLog('Background bar created')

const barFront = app.create('prim', {
  type: 'box',
  size: [barWidth * 0.85, barHeight * 0.90, barDepth * 0.90],
  color: '#00ff00',
  emissive: '#00ff00',
  emissiveIntensity: 0.2,
  doubleside: true,
  renderOrder: 1001,
  castShadow: false,
  receiveShadow: false,
  visible: config.showBarObjects
})
barGroup.add(barFront)

debugLog('Front bar created')

const regenAudio = app.create('audio', {
  src: app.props.regenAudio?.url || null,
  volume: 0.1,
  loop: false,
  spatial: false
})
barGroup.add(regenAudio)

debugLog('Audio node created')

let targetScaleY = 1
let barActive = false
let isRegenerating = false

// Update bar visual
function updateBarVisual() {
  if (!config.showStaminaBar) return

  const percent = stamina / STAMINA_MAX
  targetScaleY = percent

  if (stamina >= STAMINA_MAX - 0.1 && !staminaRecentlyUsed) {
    barGroup.active = false
    return
  }

  barFront.scale.y = percent
  const scale = barFront.scale.y
  const offsetY = (1 - scale) * barHeight / 2
  barFront.position.y = -offsetY

  if (percent < 0.25) {
    barFront.color = '#ff0000'
  } else if (percent < 0.5) {
    barFront.color = '#ffff00'
  } else {
    barFront.color = '#00ff00'
  }

  barFront.emissive = barFront.color

  barGroup.active = true
  barBg.active = true
  barFront.active = true
}

// Broadcast stamina change
function emitStaminaChanged(newStamina, oldStamina) {
  debugLog('Emitting stamina:changed event')
  debugLog('Old:', oldStamina, 'New:', newStamina, 'Delta:', newStamina - oldStamina)

  world.emit('stamina:changed', {
    playerId,
    stamina: newStamina,
    maxStamina: STAMINA_MAX,
    percent: newStamina / STAMINA_MAX,
    delta: newStamina - oldStamina
  })
}

// Initialize
barActive = config.showStaminaBar
debugLog('Bar active:', barActive)

if (barActive) {
  barGroup.active = true
  barBg.active = true
  barFront.active = true
  debugLog('Bar components activated')
}

updateBarVisual()
debugLog('Initial visual update completed')

// Hide mesh if configured
if (config.hideMesh) {
  debugLog('Hiding ROM mesh...')
  const block = app.get('Block')
  if (block) {
    block.active = false
    debugLog('✓ Block mesh hidden')
  } else {
    debugLog('✗ Could not find Block mesh')
  }
}

// LISTEN FOR EVENTS - ULTRA DEBUG VERSION

debugLog('\n=== SETTING UP EVENT LISTENERS ===')

// Listen for consume events
world.on(`stamina:consume:${playerId}`, ({ amount, requestId, source }) => {
  debugLog('\n📥 EVENT RECEIVED: stamina:consume')
  debugLog('Amount:', amount)
  debugLog('RequestId:', requestId)
  debugLog('Source:', source)
  debugLog('Current stamina before:', stamina)

  const oldStamina = stamina
  let actualAmount = 0
  let success = false

  if (unlimitedStamina) {
    success = true
    actualAmount = amount
    staminaRecentlyUsed = true
    updateBarVisual()
    emitStaminaChanged(stamina, stamina)
  } else {
    actualAmount = Math.min(amount, stamina)
    stamina = Math.max(0, stamina - actualAmount)
    success = actualAmount > 0
    lastStaminaUse = Date.now() / 1000
    staminaRecentlyUsed = true
    updateBarVisual()
    emitStaminaChanged(stamina, oldStamina)
  }

  debugLog('Emitting reply: stamina:consume-reply')
  debugLog('Success:', success)
  debugLog('Consumed:', actualAmount)
  debugLog('Remaining:', stamina)

  world.emit(`stamina:consume-reply:${playerId}:${requestId}`, {
    success,
    consumed: actualAmount,
    remaining: stamina
  })
})

// Listen for try-consume events
world.on(`stamina:try-consume:${playerId}`, ({ amount, requestId }) => {
  debugLog('\n📥 EVENT RECEIVED: stamina:try-consume')
  debugLog('Amount:', amount)
  debugLog('RequestId:', requestId)
  debugLog('Current stamina:', stamina)
  debugLog('Unlimited stamina:', unlimitedStamina)

  if (unlimitedStamina || stamina >= amount) {
    debugLog('✅ Sufficient stamina, emitting success reply')
    world.emit(`stamina:try-consume-reply:${playerId}:${requestId}`, {
      success: true,
      remaining: stamina
    })
  } else {
    debugLog('❌ Insufficient stamina, emitting failure reply')
    world.emit(`stamina:try-consume-reply:${playerId}:${requestId}`, {
      success: false,
      remaining: stamina
    })
  }
})

// Listen for query events
world.on(`stamina:query:${playerId}`, ({ requestId }) => {
  debugLog('\n📥 EVENT RECEIVED: stamina:query')
  debugLog('RequestId:', requestId)
  debugLog('Current stamina:', stamina)

  debugLog('Emitting reply with stamina data')
  world.emit(`stamina:query-reply:${playerId}:${requestId}`, {
    stamina,
    maxStamina: STAMINA_MAX,
    percent: stamina / STAMINA_MAX
  })
})

// Listen for set events
world.on(`stamina:set:${playerId}`, ({ value }) => {
  debugLog('\n📥 EVENT RECEIVED: stamina:set')
  debugLog('Value:', value)

  const oldStamina = stamina
  stamina = Math.max(0, Math.min(STAMINA_MAX, value))

  if (stamina < STAMINA_MAX) {
    staminaRecentlyUsed = true
  }

  updateBarVisual()
  emitStaminaChanged(stamina, oldStamina)
})

// Listen for add events
world.on(`stamina:add:${playerId}`, ({ amount }) => {
  debugLog('\n📥 EVENT RECEIVED: stamina:add')
  debugLog('Amount:', amount)

  const oldStamina = stamina
  stamina = Math.min(STAMINA_MAX, stamina + amount)

  if (stamina < STAMINA_MAX) {
    staminaRecentlyUsed = true
  }

  updateBarVisual()
  emitStaminaChanged(stamina, oldStamina)
})

debugLog('\n✅ All event listeners set up successfully')

// UPDATE LOOP
app.on('update', (delta) => {
  const currentTime = Date.now() / 1000

  // Smoothly animate bar scale
  const currentScale = barFront.scale.y
  if (Math.abs(currentScale - targetScaleY) > 0.01) {
    barFront.scale.y += (targetScaleY - currentScale) * 10 * delta
    const scale = barFront.scale.y
    const offsetY = (1 - scale) * barHeight / 2
    barFront.position.y = -offsetY
  } else {
    barFront.scale.y = targetScaleY
  }

  // Handle boost timer
  if (boostActive) {
    boostTimer -= delta

    if (boostTimer <= 0) {
      debugLog('Boost timer expired')
      boostActive = false
      boostTimer = 0
      boostAmount = 0
      unlimitedStamina = false
      updateBarVisual()
      world.emit('stamina:boost:end', { playerId })
    }
  }

  // Regenerate stamina
  if (currentTime - lastStaminaUse > 0.5) {
    const oldStamina = stamina
    let regenAmount = STAMINA_REGEN_RATE * delta * 0.5

    if (boostActive) {
      regenAmount += boostAmount * delta
    }

    const newStamina = Math.min(STAMINA_MAX, stamina + regenAmount)

    if (newStamina !== oldStamina) {
      stamina = newStamina

      if (app.props.regenAudio?.url && !isRegenerating && regenAmount > 0.1) {
        regenAudio.src = app.props.regenAudio.url
        regenAudio.volume = 0.2
        regenAudio.loop = false
        try {
          regenAudio.play()
        } catch (e) {
          debugLog('Audio play failed:', e)
        }
        isRegenerating = true
        setTimeout(() => {
          isRegenerating = false
        }, 1000)
      }

      updateBarVisual()
      emitStaminaChanged(stamina, oldStamina)
    } else if (stamina >= STAMINA_MAX - 0.1 && !boostActive) {
      staminaRecentlyUsed = false
      updateBarVisual()
      isRegenerating = false
    }
  }
})

// LATE UPDATE for positioning
debugLog('Setting up lateUpdate for positioning...')

app.on('lateUpdate', (delta) => {
  if (!barActive || !player || !player.position || !control?.camera) {
    return
  }

  // Distance-based scaling
  const cameraPos = control.camera.position
  const distance = cameraPos.distanceTo(player.position)
  let scaleFactor = 5.0 / Math.max(distance, 1.0)
  scaleFactor = Math.max(0.5, Math.min(3.0, scaleFactor))
  barGroup.scale.set(scaleFactor, scaleFactor, scaleFactor)

  // Position bar
  tempEuler.setFromQuaternion(player.quaternion, 'YXZ')
  tempQuat.setFromEuler(tempEuler)

  const forwardDir = tempVec.set(0, 0, -1).applyQuaternion(tempQuat)
  const leftDir = tempVec2.set(-1, 0, 0).applyQuaternion(tempQuat)
  const upDir = tempVec3.set(0, 1, 0).applyQuaternion(tempQuat)

  const leftOffset = leftDir.multiplyScalar(-0.4)
  const upOffset = upDir.multiplyScalar(1.0)
  const forwardOffset = forwardDir.multiplyScalar(0.49)

  barGroup.position.copy(player.position)
    .add(leftOffset)
    .add(upOffset)
    .add(forwardOffset)

  tempEuler.setFromQuaternion(control.camera.quaternion, 'YXZ')
  barGroup.rotation.y = tempEuler.y
})

// BOOST SYSTEM
let boostActive = false
let boostAmount = 0
let boostTimer = 0
let unlimitedStamina = false

world.on(`stamina:boost:start`, ({ playerId: boostPlayerId, boostAmount: amount, duration, unlimited }) => {
  debugLog('\n📥 EVENT RECEIVED: stamina:boost:start')
  debugLog('For player:', boostPlayerId)
  debugLog('My player:', playerId)

  if (boostPlayerId !== playerId) {
    debugLog('Ignoring - not for this player')
    return
  }

  debugLog('✅ Activating boost for this player!')

  unlimitedStamina = unlimited === true
  if (unlimitedStamina) {
    stamina = STAMINA_MAX
    targetScaleY = 1
    updateBarVisual()
    emitStaminaChanged(stamina, stamina)
  } else {
    boostAmount = amount || 15
  }

  boostActive = true
  boostTimer = duration || 10
  staminaRecentlyUsed = true

  if (unlimitedStamina) {
    barFront.color = '#00ff00'
    barFront.emissive = '#00ff00'
    barFront.emissiveIntensity = 3.0
  } else {
    barFront.color = '#00ffff'
    barFront.emissive = '#00ffff'
    barFront.emissiveIntensity = 0.3
  }
  barGroup.active = true

  debugLog('Boost activated - timer:', boostTimer, 'unlimited:', unlimitedStamina)
})

// Cleanup
app.on('destroy', () => {
  debugLog('\n🧹 CLEANUP: Removing all event listeners')
  world.off(`stamina:consume:${playerId}`)
  world.off(`stamina:try-consume:${playerId}`)
  world.off(`stamina:query:${playerId}`)
  world.off(`stamina:set:${playerId}`)
  world.off(`stamina:add:${playerId}`)
  app.off('update')
  app.off('lateUpdate')
})

debugLog('\n✅ STAMINA SYSTEM FULLY INITIALIZED')
debugLog('Player ID:', playerId)
debugLog('Listening for events with playerId prefix:', `stamina:*:${playerId}`)
