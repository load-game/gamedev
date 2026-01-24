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
    key: 'superRunEmote',
    type: 'file',
    kind: 'emote',
    label: 'Super Run Emote',
  },
  {
    key: 'staminaDrainRate',
    type: 'number',
    label: 'Stamina Drain Rate',
    hint: 'Stamina consumed per second while sprinting',
    initial: 25,
    min: 0,
    max: 100,
  },
  {
    key: 'debugMode',
    type: 'toggle',
    label: 'Debug Mode',
    initial: false,
    hint: 'Enable console debugging',
  },
])

const PLAYER_HALF_HEIGHT = 0.8
const ACTIVATION_TIME = 0.5
const MOBILE_ACTIVATION_TIME = 1.8
const EXTRA_SPEED = 30
const DEACTIVATION_TIME = 0.5
const layerMask = world.createLayerMask('environment')

// Debug logging utility
function debugLog(...args) {
  if (config.debugMode) {
    console.log('[Sprint ROM]', ...args)
  }
}

debugLog('Initializing with emote:', app.props.superRunEmote?.url || 'none')

if (world.isClient) {
  const { superRunEmote } = app.props
  const player = world.getPlayer()
  const control = app.control()
  let runTime = 0
  let superActive = false
  let staminaDepleted = false
  let currentStamina = 100

  const tempVec = new Vector3()
  const tempQuat = new Quaternion()
  const tempEuler = new Euler(0, 0, 0, 'YXZ')

  const staminaDrainRate = config.staminaDrainRate || 25
  const playerId = player.id

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

  console.log(`[Sprint] Initialized with emote: ${superRunEmote?.url || 'none'}`)

  function getForwardDirection(outVec) {
    tempEuler.setFromQuaternion(control.camera.quaternion)
    tempEuler.x = 0
    tempEuler.z = 0
    tempQuat.setFromEuler(tempEuler)
    return outVec.copy(new Vector3(0, 0, -1)).applyQuaternion(tempQuat)
  }

  function isGrounded() {
    if (!player?.position) return true
    const hit = world.raycast(player.position.clone(), new Vector3(0, -1, 0), PLAYER_HALF_HEIGHT + 0.1, layerMask)
    return hit !== null && hit.distance <= PLAYER_HALF_HEIGHT + 0.05
  }

  function activateSuperRun() {
    if (currentStamina <= 0) {
      staminaDepleted = true
      return
    }

    if (!superActive) {
      superActive = true
      staminaDepleted = false
      debugLog('Activating super run, emote:', superRunEmote?.url || 'none')
      player.applyEffect({
        emote: superRunEmote?.url || '',
        duration: null,
        cancellable: false,
      })
    }
  }

  function deactivateSuperRun() {
    if (superActive) {
      player.applyEffect({
        emote: superRunEmote?.url || '',
        duration: DEACTIVATION_TIME,
        cancellable: true,
      })
      superActive = false
      runTime = 0
    }
  }

  app.on('update', dt => {
    // Get joystick input (mobile) - check if joystick is being used
    const stickZ = control.touchStick?.value.z || 0
    const isJoystickActive = Math.abs(stickZ) > 0.1
    const isMovingForward = stickZ < -0.1 // Joystick pushed forward

    // Check for keyboard sprint (PC) - W + Shift
    const isKeyboardSprinting =
      control.keyW.down &&
      ((control.shiftLeft.down && !control.shiftLeft.capture) ||
        (control.shiftRight.down && !control.shiftRight.capture))

    // For mobile: if joystick active and moving forward, treat as sprinting
    // For PC: if W + Shift pressed, treat as sprinting
    const isSprintingForward = (isKeyboardSprinting || (isJoystickActive && isMovingForward)) && isGrounded()

    // Check stamina before allowing sprint - require minimum stamina to start/restart
    const minStaminaToStart = staminaDrainRate * ACTIVATION_TIME // Need stamina for activation time
    const currentActivationTime = isJoystickActive && isMovingForward ? MOBILE_ACTIVATION_TIME : ACTIVATION_TIME

    if (isSprintingForward && !staminaDepleted && currentStamina >= minStaminaToStart) {
      runTime += dt
      if (runTime >= currentActivationTime && !superActive) {
        activateSuperRun()
      }
    } else if (!isSprintingForward || currentStamina <= 0) {
      deactivateSuperRun()
      // Only reset staminaDepleted when stamina has regenerated above threshold
      if (currentStamina >= minStaminaToStart) {
        staminaDepleted = false
      }
    }

    if (superActive) {
      const consumeRequestId = Math.random().toString(36).substr(2, 9)

      const consumeReplyHandler = ({ success, consumed, remaining }) => {
        world.off(`stamina:consume-reply:${playerId}:${consumeRequestId}`, consumeReplyHandler)
        if (!success || consumed < staminaDrainRate * dt * 0.9) {
          staminaDepleted = true
          deactivateSuperRun()
        }
      }

      world.emit(`stamina:consume:${playerId}`, {
        amount: staminaDrainRate * dt,
        requestId: consumeRequestId,
        source: 'romSprint',
      })

      world.on(`stamina:consume-reply:${playerId}:${consumeRequestId}`, consumeReplyHandler)

      if (!staminaDepleted) {
        player.push(getForwardDirection(tempVec).multiplyScalar(EXTRA_SPEED * dt))
      }
    }
  })

  const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
    if (changedPlayerId === player.id) {
      currentStamina = stamina
    }
  }

  world.on('stamina:changed', staminaChangedHandler)

  app.on('destroy', () => {
    world.off('stamina:changed', staminaChangedHandler)
  })
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
