// romDash with ULTRA debug logging to trace every step

app.configure([
  {
    key: 'rName',
    type: 'text',
    label: 'Rom Name'
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
      { label: 'Blue', value: 'blue' }
    ],
    initial: 'red'
  },
  {
    key: 'chargeEmote',
    type: 'file',
    kind: 'emote',
    label: 'Charge Emote'
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
      { label: 'Space', value: 'space' }
    ]
  },
  {
    key: 'showMobileButton',
    type: 'toggle',
    label: 'Show Mobile Dash Button',
    initial: true
  },
  {
    key: 'staminaCost',
    type: 'number',
    label: 'Stamina Cost',
    hint: 'Amount of stamina consumed per dash',
    initial: 30,
    min: 0,
    max: 100
  },
  {
    key: 'debugMode',
    type: 'toggle',
    label: 'Debug Mode',
    initial: true,
    hint: 'Enable console debugging'
  }
])

const FORWARD = new Vector3(0, 0, -1)
const chargeEmote = props.chargeEmote?.url ? props.chargeEmote.url + '?l=0' : ''
const v1 = new Vector3()
const q1 = new Quaternion()
const e1 = new Euler(0, 0, 0, 'YXZ')

// Debug state tracking
let debugFrameCount = 0

// ULTRA debug logging
function debugLog(...args) {
  if (config.debugMode) {
    console.log('[ROM DASH ULTRA DEBUG]', ...args)
  }
}

debugLog('=== ULTRA DEBUG MODE ENABLED ===')
debugLog('=== romDash.js Initializing ===')
debugLog('Config:', JSON.stringify(config))

if (world.isClient) {
  debugLog('Running on CLIENT')

  const player = world.getPlayer()
  const control = app.control()
  let canDash = true
  let currentStamina = 100
  let lastPressed = false
  let staminaSystemAvailable = false
  const dashKey = config.dashKey || 'keyF'

  debugLog('Player object:', player)
  debugLog('Player ID:', player?.id)
  debugLog('Control object:', control)
  debugLog('Dash key configured as:', dashKey)

  // Check control object structure
  if (control) {
    const controlKeys = Object.keys(control)
    debugLog('All control keys:', controlKeys)
    debugLog('Key-specific object:', control[dashKey])

    if (control[dashKey]) {
      control[dashKey].capture = true
      debugLog('✓ Successfully captured key:', dashKey)
    } else {
      debugLog('✗ FAILED to capture key:', dashKey)
      debugLog('Available key-like controls:', controlKeys.filter(k => k.startsWith('key') || k === 'space'))
    }
  } else {
    debugLog('✗ CONTROL OBJECT IS UNDEFINED!')
    debugLog('This is a critical error - app.control() returned nothing')
  }

  // Check if stamina system exists via combined API
  debugLog('Checking for combined stamina API...')
  debugLog('app.stamina:', app.stamina)

  if (app.stamina) {
    staminaSystemAvailable = true
    currentStamina = app.stamina.get()
    debugLog('✓ Stamina system available via combined API')
    debugLog('Initial stamina:', currentStamina)

    // For combined API, we still need to listen for changes
    const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
      if (changedPlayerId === player.id) {
        currentStamina = stamina
        debugLog('📊 Stamina updated from combined API:', currentStamina)
      }
    }
    world.on('stamina:changed', staminaChangedHandler)
    app.on('destroy', () => {
      world.off('stamina:changed', staminaChangedHandler)
    })
  } else {
    debugLog('ℹ No combined stamina API available')
    debugLog('ℹ Will attempt event-based communication')

    // ============================================================
    // KEY FIX: Handler and cleanup declared in SAME SCOPE!
    // This matches the working pattern from oldromDash.js
    // ============================================================

    // Monitor ALL stamina events for debugging
    debugLog('\n=== SETTING UP STAMINA EVENT MONITORS ===')

    const staminaChangedHandler = (data) => {
      debugLog('📡 EVENT RECEIVED: stamina:changed', data)
      if (data.playerId === player.id) {
        currentStamina = data.stamina
        debugLog('📊 Updated currentStamina to:', currentStamina)
      }
    }
    world.on('stamina:changed', staminaChangedHandler)
    app.on('destroy', () => {
      world.off('stamina:changed', staminaChangedHandler)
    })

    // Listen for all possible reply patterns
    world.on(`stamina:try-consume-reply:${player.id}`, (data) => {
      debugLog('📡 REPLY RECEIVED (no requestId): stamina:try-consume-reply', data)
    })

    world.on(`stamina:consume-reply:${player.id}`, (data) => {
      debugLog('📡 REPLY RECEIVED (no requestId): stamina:consume-reply', data)
    })

    // Query initial stamina value
    debugLog('\n=== QUERYING INITIAL STAMINA ===')
    const initRequestId = Math.random().toString(36).substr(2, 9)
    debugLog('Emitting stamina:query with requestId:', initRequestId)

    const initHandler = (data) => {
      debugLog('📡 QUERY REPLY RECEIVED:', data)
      world.off(`stamina:query-reply:${player.id}:${initRequestId}`, initHandler)
      currentStamina = data.stamina
      staminaSystemAvailable = true
      debugLog('✅ Stamina system confirmed working!')
      debugLog('Initial stamina value:', currentStamina)
    }

    world.on(`stamina:query-reply:${player.id}:${initRequestId}`, initHandler)
    world.emit(`stamina:query:${player.id}`, { requestId: initRequestId })
  }

  // Set up update loop with detailed logging
  debugLog('\n=== SETTING UP UPDATE LOOP ===')

  app.on('update', (delta) => {
    if (!control) {
      debugLog('❌ UPDATE: Control is undefined, skipping')
      return
    }

    const isPressed = control[dashKey]?.pressed || false
    debugLog('🔄 Update - isPressed:', isPressed, 'lastPressed:', lastPressed, 'dashKey:', dashKey)

    if (isPressed && !lastPressed) {
      debugLog('🎮 KEY PRESS DETECTED! Calling charge()')
      charge()
    }

    lastPressed = isPressed
  })

  // Get direction function
  function getDirection() {
    debugLog('→ getDirection() called')

    if (!control?.camera) {
      debugLog('❌ Camera not available, using default forward')
      return new Vector3(0, 0, -1)
    }

    e1.setFromQuaternion(control.camera.quaternion)
    e1.x = 0
    e1.z = 0
    q1.setFromEuler(e1)
    const dir = v1.copy(FORWARD).applyQuaternion(q1)

    debugLog('→ Direction calculated:', dir)
    return dir
  }

  // Perform dash function
  function performDash() {
    debugLog('→ performDash() called')

    const dir = getDirection()
    const force = dir.multiplyScalar(30)

    debugLog('→ Applying force to player:', force)
    player.push(force)

    if (chargeEmote) {
      debugLog('→ Applying effect with emote:', chargeEmote)
      player.applyEffect({
        emote: chargeEmote,
        turn: true,
        duration: 0.4,
        onEnd: () => {
          debugLog('→ Effect ended, canDash = true')
          canDash = true
        }
      })
    } else {
      debugLog('→ No emote configured, using timeout')
      setTimeout(() => {
        debugLog('→ Timeout completed, canDash = true')
        canDash = true
      }, 400)
    }
  }

  // Main charge function
  function charge() {
    debugLog('\n=== CHARGE() CALLED ===')
    debugLog('State: canDash =', canDash, 'hasEffect =', player.hasEffect())

    if (player.hasEffect()) {
      debugLog('❌ Cannot dash - player has effect')
      return
    }

    if (!canDash) {
      debugLog('❌ Cannot dash - already dashing')
      return
    }

    const staminaCost = config.staminaCost || 30
    debugLog('Stamina check - cost:', staminaCost, 'current:', currentStamina)

    // If stamina system not available, allow free dashes
    if (!staminaSystemAvailable) {
      debugLog('⚠ Stamina system not available - allowing free dash')
      canDash = false
      performDash()
      return
    }

    // Sync check - don't even ask if we don't have enough
    if (currentStamina < staminaCost) {
      debugLog('❌ Not enough stamina (sync check)')
      debugLog('Need:', staminaCost, 'Have:', currentStamina)
      return
    }

    canDash = false

    const requestId = Math.random().toString(36).substr(2, 9)
    debugLog('Emitting stamina:try-consume event')
    debugLog('Request ID:', requestId)
    debugLog('Player ID:', player.id)
    debugLog('Amount:', staminaCost)

    const replyHandler = (data) => {
      debugLog('\n=== REPLY RECEIVED ===')
      debugLog('Full reply data:', data)
      debugLog('Success:', data.success)
      debugLog('Remaining:', data.remaining)

      const expectedEventName = `stamina:try-consume-reply:${player.id}:${requestId}`
      debugLog('Removing listener for:', expectedEventName)
      world.off(expectedEventName, replyHandler)

      if (!data.success) {
        debugLog('❌ Stamina consumption FAILED')
        debugLog('Remaining stamina:', data.remaining)
        canDash = true
        return
      }

      debugLog('✅ Stamina consumption SUCCESSFUL')
      debugLog('New stamina value:', data.remaining)
      performDash()
    }

    // Listen for reply
    const replyEventName = `stamina:try-consume-reply:${player.id}:${requestId}`
    debugLog('Setting up listener for:', replyEventName)
    world.on(replyEventName, replyHandler)

    // Emit consume event
    const consumeEventName = `stamina:try-consume:${player.id}`
    debugLog('Emitting event:', consumeEventName)
    world.emit(consumeEventName, {
      amount: staminaCost,
      requestId: requestId,
      source: 'romDash'
    })

    debugLog('Event emitted, waiting for reply...')

    // Timeout after 1 second
    setTimeout(() => {
      if (!canDash) {
        debugLog('⏰ TIMEOUT - No reply received within 1 second')
        debugLog('This could mean:')
        debugLog('1. Stamina system is not listening')
        debugLog('2. Event name mismatch')
        debugLog('3. Player ID mismatch')
        world.off(replyEventName, replyHandler)
        canDash = true
      }
    }, 1000)
  }

  // Setup mobile button
  if (config.showMobileButton) {
    debugLog('\n=== SETTING UP MOBILE BUTTON ===')
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
        debugLog('📱 Mobile button pressed, calling charge()')
        charge()
      },
      alignItems: 'center',
      justifyContent: 'center'
    })

    const label = app.create('uitext', {
      value: 'DASH',
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold'
    })

    dashBtn.add(label)
    app.add(dashBtn)
    debugLog('✅ Mobile button created')
  }

  // Cleanup on destroy - use arrow function to capture staminaChangedHandler
  app.on('destroy', () => {
    if (staminaChangedHandler) {
      debugLog('🧹 Cleaning up event listeners')
      world.off('stamina:changed', staminaChangedHandler)
    }
  })
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
romName.value = props.rName || 'Dash ROM'
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
  trigger: true
})
app.add(romBody)

debugLog('=== ROM DASH FULLY INITIALIZED ===')
