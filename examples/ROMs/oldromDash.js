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
const chargeEmote = props.chargeEmote?.url + '?l=0'
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
  const dashKey = config.dashKey || 'keyF'

  debugLog('Dash key:', dashKey)

  if (control?.[dashKey]) {
    control[dashKey].capture = true
    debugLog('Captured', dashKey, 'for dash')
  }

  // Get stamina from combined system or event system
  function getStamina() {
    if (app.stamina) {
      // Combined system
      currentStamina = app.stamina.get()
      debugLog('Initial stamina:', currentStamina)
    } else {
      // Event-based system
      const playerId = player.id
      const initRequestId = Math.random().toString(36).substr(2, 9)
      const initHandler = ({ stamina }) => {
        world.off(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)
        currentStamina = stamina
        debugLog('Initial stamina:', currentStamina)
      }
      world.emit(`stamina:query:${playerId}`, { requestId: initRequestId })
      world.on(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)

      // Listen for updates
      const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
        if (changedPlayerId === player.id) {
          currentStamina = stamina
          debugLog('Stamina updated:', currentStamina)
        }
      }
      world.on('stamina:changed', staminaChangedHandler)
      app.on('destroy', () => {
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
    if (player.hasEffect()) return
    if (!canDash) return

    const staminaCost = config.staminaCost || 30

    if (currentStamina < staminaCost) {
      debugLog('Not enough stamina - current:', currentStamina, 'cost:', staminaCost)
      return
    }

    debugLog('Dash activated! Stamina cost:', staminaCost)
    canDash = false

    const playerId = player.id
    const requestId = Math.random().toString(36).substr(2, 9)

    const replyHandler = ({ success, remaining }) => {
      world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
    }

    world.emit(`stamina:try-consume:${playerId}`, {
      amount: staminaCost,
      requestId,
    })

    world.on(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)

    const dir = getDirection()
    const force = dir.multiplyScalar(30)
    player.push(force)
    player.applyEffect({
      emote: chargeEmote,
      turn: true,
      duration: 0.4,
      onEnd: () => {
        canDash = true
      },
    })
  }

  app.on('update', delta => {
    if (control?.[dashKey]?.pressed) {
      charge()
    }
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