// Dash ROM with Stamina Integration
// Fixed version with proper error handling and debugging

app.configure([
  {
    key: 'rName',
    type: 'text',
    label: 'Rom Name',
  },
  {
    key: 'color',
    type: 'dropdown',
    label: 'Color',
    options: [
      { label: 'Red', value: 'red' },
      { label: 'Orange', value: 'orange' },
      { label: 'Yellow', value: 'yellow' },
      { label: 'Green', value: 'green' },
      { label: 'Blue', value: 'blue' },
    ],
    initial: 'red',
  },
  {
    key: 'chargeEmote',
    type: 'file',
    kind: 'emote',
    label: 'Charge Emote',
  },
  {
    key: 'dashKey',
    type: 'switch',
    label: 'Dash Key',
    initial: 'keyF',
    options: [
      { label: 'F', value: 'keyF' },
      { label: 'E', value: 'keyE' },
      { label: 'Q', value: 'keyQ' },
      { label: 'R', value: 'keyR' },
      { label: 'Space', value: 'space' },
    ],
  },
  {
    key: 'showMobileButton',
    type: 'toggle',
    label: 'Show Mobile Dash Button',
    initial: true,
  },
  {
    key: 'staminaCost',
    type: 'number',
    label: 'Stamina Cost',
    hint: 'Amount of stamina consumed per dash',
    initial: 30,
    min: 0,
    max: 100,
  },
  {
    key: 'debugMode',
    type: 'toggle',
    label: 'Debug Mode',
    initial: false,
    hint: 'Enable console debugging'
  },
])

const FORWARD = new Vector3(0, 0, -1)
const chargeEmote = props.chargeEmote?.url ? props.chargeEmote.url + '?l=0' : ''
const v1 = new Vector3()
const q1 = new Quaternion()
const e1 = new Euler(0, 0, 0, 'YXZ')

// Debug logging utility
function debugLog(...args) {
  if (config.debugMode) {
    console.log('[Dash ROM]', ...args)
  }
}

debugLog('=== Initializing Dash ROM ===')
debugLog('Dash key:', config.dashKey || 'keyF')
debugLog('Stamina cost:', config.staminaCost || 30)

if (world.isClient) {
  const player = world.getPlayer()
  const control = app.control()
  let canDash = true
  let currentStamina = 100
  let lastPressed = false
  let staminaSystemAvailable = false
  const dashKey = config.dashKey || 'keyF'

  debugLog('Player ID:', player?.id)
  debugLog('Control:', control ? 'Available' : 'NOT AVAILABLE')

  // Capture key input
  if (control) {
    if (control[dashKey]) {
      control[dashKey].capture = true
      debugLog('✓ Captured key:', dashKey)
    } else {
      debugLog('✗ Key not available:', dashKey)
      debugLog('Available keys:', Object.keys(control).filter(k => k.startsWith('key')))
    }
  } else {
    debugLog('✗ WARNING: Control object not available - input will not work!')
  }

  // Check if stamina system is available (combined API)
  if (app.stamina) {
    staminaSystemAvailable = true
    currentStamina = app.stamina.get()
    debugLog('✓ Stamina system available (combined API)')
    debugLog('Initial stamina:', currentStamina)
  } else {
    debugLog('ℹ Stamina system not available via combined API')
    debugLog('ℹ Will use event-based system')
  }

  // Initialize stamina via event system
  function initStamina() {
    const playerId = player.id
    const initRequestId = Math.random().toString(36).substr(2, 9)
    debugLog('Querying stamina - requestId:', initRequestId)

    const initHandler = ({ stamina, maxStamina, percent }) => {
      world.off(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)
      currentStamina = stamina
      staminaSystemAvailable = true
      debugLog('✓ Stamina query response received')
      debugLog('Initial stamina:', currentStamina, '/', maxStamina, `(${Math.round(percent * 100)}%)`)
    }

    world.emit(`stamina:query:${playerId}`, { requestId: initRequestId })
    world.on(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)

    // Timeout after 1 second - if no response, stamina system isn't available
    setTimeout(() => {
      if (!staminaSystemAvailable) {
        debugLog('⚠ Stamina system not responding - will work without stamina limits')
      }
    }, 1000)
  }

  initStamina()

  // Listen for stamina changes
  const staminaChangedHandler = ({ playerId: changedPlayerId, stamina, maxStamina, percent }) => {
    if (changedPlayerId === player.id) {
      currentStamina = stamina
      debugLog('Stamina update:', stamina.toFixed(1), '/', maxStamina, `(${Math.round(percent * 100)}%)`)
    }
  }
  world.on('stamina:changed', staminaChangedHandler)

  function getDirection() {
    if (!control?.camera) {
      debugLog('✗ Camera not available for direction')
      return new Vector3(0, 0, -1)
    }
    e1.setFromQuaternion(control.camera.quaternion)
    e1.x = 0
    e1.z = 0
    q1.setFromEuler(e1)
    const dir = v1.copy(FORWARD).applyQuaternion(q1)
    return dir
  }

  function performDash() {
    debugLog('Performing dash - applying force')
    const dir = getDirection()
    const force = dir.multiplyScalar(30)
    player.push(force)

    if (chargeEmote) {
      player.applyEffect({
        emote: chargeEmote,
        turn: true,
        duration: 0.4,
        onEnd: () => {
          debugLog('Dash effect completed')
          canDash = true
        },
      })
    } else {
      debugLog('No emote configured')
      setTimeout(() => {
        canDash = true
      }, 400)
    }
  }

  function charge() {
    debugLog('charge() called - canDash:', canDash)

    if (player.hasEffect()) {
      debugLog('✗ Cannot dash - player has active effect')
      return
    }
    if (!canDash) {
      debugLog('✗ Cannot dash - still recovering')
      return
    }

    const staminaCost = config.staminaCost || 30
    debugLog('Stamina check - cost:', staminaCost, 'current:', currentStamina.toFixed(1))

    // If stamina system not available, allow dash without cost
    if (!staminaSystemAvailable) {
      debugLog('ℹ Stamina system not available - dashing without cost')
      canDash = false
      performDash()
      return
    }

    // Check stamina synchronously first
    if (currentStamina < staminaCost) {
      debugLog('✗ Not enough stamina - need:', staminaCost, 'have:', currentStamina.toFixed(1))
      return
    }

    canDash = false

    // Try to consume stamina
    const playerId = player.id
    const requestId = Math.random().toString(36).substr(2, 9)
    debugLog('Emitting stamina:try-consume - requestId:', requestId)

    const replyHandler = ({ success, remaining }) => {
      debugLog('Received stamina:try-consume-reply - success:', success)
      world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)

      if (!success) {
        debugLog('✗ Stamina consumption failed - remaining:', remaining)
        canDash = true
        return
      }

      debugLog('✓ Stamina consumed - remaining:', remaining)
      performDash()
    }

    world.emit(`stamina:try-consume:${playerId}`, {
      amount: staminaCost,
      requestId,
      source: 'romDash',
    })

    world.on(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)

    // Timeout after 500ms - if no response, allow dash anyway
    setTimeout(() => {
      if (!canDash) {
        debugLog('⚠ Stamina reply timeout - allowing dash')
        world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
        performDash()
      }
    }, 500)
  }

  app.on('update', delta => {
    if (!control) {
      debugLog('✗ Control not available in update')
      return
    }

    const isPressed = control[dashKey]?.pressed || false
    if (isPressed && !lastPressed) {
      debugLog('Key pressed - dash key:', dashKey)
      charge()
    }
    lastPressed = isPressed
  })

  // Cleanup
  app.on('destroy', () => {
    debugLog('Cleaning up event listeners')
    world.off('stamina:changed', staminaChangedHandler)
  })

  // Mobile button
  if (config.showMobileButton) {
    debugLog('Creating mobile dash button')
    const dashBtn = app.create('ui', {
      space: 'screen',
      width: 50,
      height: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 25,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-120, -110],
      cursor: 'pointer',
      onPointerDown: () => {
        debugLog('Mobile button pressed')
        charge()
      },
      alignItems: 'center',
      justifyContent: 'center',
    })
    const label = app.create('uitext', {
      value: 'DASH',
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    })
    dashBtn.add(label)
    app.add(dashBtn)
    debugLog('✓ Mobile button created')
  }
}

// ROM visual
const ui = app.create('ui')
ui.rotation.y = 180 * DEG2RAD
ui.position.z = -0.12
ui.position.y = -0.46
ui.width = 20
const romName = app.create('uitext')
romName.fontSize = 4
romName.textAlign = 'center'
romName.color = '#000000'
romName.value = props.rName
romName.backgroundColor = '#ffffff'
romName.fontFamily = 'Arial Black'
const mesh = app.get('RomColor')
if (mesh) {
  mesh.linked = false
  app.on('update', () => {
    if (mesh.material) {
      mesh.material.color = props.color
    }
  })
}
ui.add(romName)
app.add(ui)

// Add kinematic rigidbody
const romBody = app.create('rigidbody', {
  type: 'kinematic',
  trigger: true,
})
app.add(romBody)

debugLog('=== Dash ROM initialized ===')