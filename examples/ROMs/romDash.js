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
    initial: true,  // Enable debug by default to see what's happening
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

debugLog('Initializing with dash key:', config.dashKey || 'keyF')

if (world.isClient) {
  const player = world.getPlayer()
  const control = app.control()
  let canDash = true
  let currentStamina = 100
  let lastPressed = false
  const dashKey = config.dashKey || 'keyF'

  debugLog('Dash key:', dashKey)
  debugLog('Control object:', control)
  debugLog('Control key available:', control?.[dashKey])

  if (control?.[dashKey]) {
    control[dashKey].capture = true
    debugLog('Captured', dashKey, 'for dash')
  } else {
    debugLog('WARNING: Could not capture', dashKey, '- key not available in control')
  }

  // Get stamina from combined system or event system
  function getStamina() {
    debugLog('getStamina() called')
    if (app.stamina) {
      // Combined system
      currentStamina = app.stamina.get()
      debugLog('Initial stamina from combined system:', currentStamina)
    } else {
      // Event-based system - query initial value
      const playerId = player.id
      const initRequestId = Math.random().toString(36).substr(2, 9)
      debugLog('Querying stamina with requestId:', initRequestId)
      const initHandler = ({ stamina }) => {
        world.off(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)
        currentStamina = stamina
        debugLog('Initial stamina from event system:', currentStamina)
      }
      world.emit(`stamina:query:${playerId}`, { requestId: initRequestId })
      world.on(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)

      // ============================================================
      // KEY FIX: Declare handler AND cleanup in SAME SCOPE!
      // This matches the working pattern from oldromDash.js
      // ============================================================
      const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
        debugLog('stamina:changed event received:', { changedPlayerId, stamina, myPlayerId: player.id })
        if (changedPlayerId === player.id) {
          currentStamina = stamina
          debugLog('Stamina updated:', currentStamina)
        }
      }
      world.on('stamina:changed', staminaChangedHandler)
      app.on('destroy', () => {
        debugLog('Cleanup: removing stamina:changed listener')
        world.off('stamina:changed', staminaChangedHandler)
      })
    }
  }

  getStamina()

  function getDirection() {
    e1.setFromQuaternion(control.camera.quaternion)
    e1.x = 0
    e1.z = 0
    q1.setFromEuler(e1)
    const dir = v1.copy(FORWARD).applyQuaternion(q1)
    return dir
  }

  function charge() {
    debugLog('charge() called')
    if (player.hasEffect()) {
      debugLog('Cannot dash - player has effect')
      return
    }
    if (!canDash) {
      debugLog('Cannot dash - already dashing')
      return
    }

    const staminaCost = config.staminaCost || 30
    debugLog('Checking stamina - cost:', staminaCost, 'current:', currentStamina)

    // Sync check for immediate feedback - check local cache first
    if (currentStamina < staminaCost) {
      debugLog('Not enough stamina (sync check) - cost:', staminaCost, 'current:', currentStamina)
      return
    }

    canDash = false
    debugLog('Attempting dash - emitting stamina:try-consume event')

    const playerId = player.id
    const requestId = Math.random().toString(36).substr(2, 9)
    debugLog('RequestId:', requestId)

    const replyHandler = ({ success, remaining }) => {
      debugLog('Received reply - success:', success, 'remaining:', remaining)
      world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)

      if (!success) {
        debugLog('Not enough stamina - cost:', staminaCost, 'remaining:', remaining)
        canDash = true
        return
      }

      debugLog('Dash activated! Stamina cost:', staminaCost)
      const dir = getDirection()
      const force = dir.multiplyScalar(30)
      debugLog('Applying force:', force)
      player.push(force)
      player.applyEffect({
        emote: chargeEmote,
        turn: true,
        duration: 0.4,
        onEnd: () => {
          debugLog('Dash effect ended')
          canDash = true
        },
      })
    }

    debugLog('Emitting stamina:try-consume event')
    world.emit(`stamina:try-consume:${playerId}`, {
      amount: staminaCost,
      requestId,
      source: 'romDash',
    })

    world.on(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
    debugLog('Waiting for reply...')
  }

  app.on('update', delta => {
    const isPressed = control?.[dashKey]?.pressed || false
    debugLog('Update - isPressed:', isPressed, 'lastPressed:', lastPressed, 'dashKey:', dashKey)

    // Only trigger dash on key press (not hold)
    if (isPressed && !lastPressed) {
      debugLog('Key pressed, calling charge()')
      charge()
    }

    lastPressed = isPressed
  })

  if (config.showMobileButton) {
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
      onPointerDown: charge,
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
    debugLog('Mobile button created')
  }
}

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
mesh.linked = false

let colorSet = false
let lastColor = null
app.on('update', () => {
  if (!colorSet && mesh && mesh.material) {
    mesh.material.color = props.color
    colorSet = true
    lastColor = props.color
  } else if (colorSet && mesh && mesh.material && props.color !== lastColor) {
    mesh.material.color = props.color
    lastColor = props.color
  }
})

ui.add(romName)
app.add(ui)

// Add kinematic rigidbody so ROM can trigger collision detection
// The static rigidbody in the .glb won't fire trigger events
const romBody = app.create('rigidbody', {
  type: 'kinematic',
  trigger: true,
})
app.add(romBody)