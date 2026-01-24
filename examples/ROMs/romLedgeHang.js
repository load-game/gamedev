// Wall Hang Mechanic with Stamina Integration
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
    initial: 'blue',
  },
  {
    key: 'hangingEmote',
    type: 'file',
    kind: 'emote',
    label: 'Hanging Emote',
  },
  {
    key: 'staminaDrainRate',
    type: 'number',
    label: 'Stamina Drain Rate',
    hint: 'Stamina consumed per second while hanging',
    initial: 5,
    min: 0,
    max: 100,
  },
  {
    key: 'minStaminaToHang',
    type: 'number',
    label: 'Min Stamina To Hang',
    hint: 'Minimum stamina required to start hanging',
    initial: 20,
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

const DEFAULT_PLAYER_HEIGHT = 2.4 // Default player height in meters
const DEFAULT_HANG_HEIGHT = 2.35 // Default hang height offset

// Stamina integration
const STAMINA_DRAIN_RATE = config.staminaDrainRate || 15
const MIN_STAMINA_TO_HANG = config.minStaminaToHang || 20

// Debug logging utility
function debugLog(...args) {
  if (config.debugMode) {
    console.log('[Ledge Hang ROM]', ...args)
  }
}

const CONFIG = {
  hangHeightRatio: DEFAULT_HANG_HEIGHT / DEFAULT_PLAYER_HEIGHT, // Ratio of hang height to player height
  wallOffset: -0.38, // Horizontal offset from wall (negative = toward wall)
  maxGrabAbove: 0.6, // Max ledge height above head to grab
  minGrabBelow: -0.3, // Min ledge height below head to grab
  hangEndCooldown: 0.5, // Cooldown after ending hang
  jumpUpImpulse: 4, // Jump up the wall force
  dropImpulse: 1, // Drop away force
  minFallSpeed: -1.5, // Minimum falling speed to trigger grab
  layerMask: world.createLayerMask('environment'),
}

// Helper function to get player height, with fallback to default
function getPlayerHeight(player) {
  return player.avatar?.getHeight() ?? player.height ?? DEFAULT_PLAYER_HEIGHT
}

// Helper function to get player half height
function getPlayerHalfHeight(player) {
  return getPlayerHeight(player) * 0.5
}

// Helper function to get hang height based on player size
function getHangHeight(player) {
  return getPlayerHeight(player) * CONFIG.hangHeightRatio
}

console.log('[Ledge Hang ROM] File loaded - world.isClient:', world.isClient)

try {
if (world.isClient) {
  const { hangingEmote } = app.props
  const player = world.getPlayer()
  const control = app.control()
  const playerId = player.id

  let hanging = false
  let hangCooldown = 0
  let currentEffect = null
  let hangAnchor = null
  let lastPosition = new Vector3()
  let wallNormal = new Vector3()
  let lastSpace = false
  let lastS = false
  let targetRotationY = 0
  let rotationSet = false
  let currentStamina = 100
  let staminaDepleted = false
  let waitingForConsumeReply = false
  let staminaConsumeTimer = 0  // Grace period before stamina starts draining

  // Get stamina from stamina system
  function getStamina() {
    if (app.stamina) {
      // Combined system
      currentStamina = app.stamina.get()
      debugLog('Initial stamina:', currentStamina)
    } else {
      // Event-based system
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
  debugLog('Initialized with emote:', hangingEmote?.url || 'none', 'stamina drain:', STAMINA_DRAIN_RATE)

  // Reusable vectors
  const v1 = new Vector3()
  const v2 = new Vector3()
  const v3 = new Vector3()
  const e1 = new Euler(0, 0, 0, 'YXZ')
  const q1 = new Quaternion()
  const UP = new Vector3(0, 1, 0)
  const DOWN = new Vector3(0, -1, 0)
  const FORWARD = new Vector3(0, 0, -1)
  function getForwardDirection(outVec) {
    e1.setFromQuaternion(control.camera.quaternion)
    e1.x = e1.z = 0
    q1.setFromEuler(e1)
    return outVec.copy(FORWARD).applyQuaternion(q1)
  }

  function isGrounded() {
    const halfHeight = getPlayerHalfHeight(player)
    const hit = world.raycast(player.position, DOWN, halfHeight + 0.1, CONFIG.layerMask)
    return hit?.distance <= halfHeight + 0.05
  }

  function resetHangingState(cooldown, applyFall = false) {
    if (hanging) {
      debugLog('>>> ENDING HANG <<<')
    }
    hanging = false
    hangCooldown = cooldown
    rotationSet = false
    staminaDepleted = false
    waitingForConsumeReply = false
    staminaConsumeTimer = 0
    currentEffect?.cancel()
    currentEffect = null
    if (hangAnchor) {
      world.remove(hangAnchor)
      hangAnchor = null
    }

    // Apply downward force when falling from ledge
    if (applyFall && player?.body) {
      player.push(DOWN.clone().multiplyScalar(CONFIG.dropImpulse * 2))
      debugLog('Applied downward force - falling from ledge')
    }
  }

  function startHang(ledgePoint, dir, wallNormal) {
    if (!player || !player.position) return

    hanging = true
    staminaDepleted = false
    staminaConsumeTimer = 1.5  // 1.5 second grace period before stamina starts draining
    debugLog('>>> STARTING HANG <<< hanging=true, stamina:', currentStamina.toFixed(1), 'timer:', staminaConsumeTimer.toFixed(1))

    wallNormal.copy(v2)
    wallNormal.y = 0
    if (wallNormal.lengthSq() > 0.001) {
      wallNormal.normalize()
    } else {
      wallNormal.copy(dir).normalize()
    }

    const rotationY = Math.atan2(-wallNormal.x, -wallNormal.z)

    v1.copy(ledgePoint)
    v1.y = ledgePoint.y - getHangHeight(player)
    v1.addScaledVector(wallNormal, CONFIG.wallOffset)

    player.teleport(v1, rotationY)

    hangAnchor = app.create('anchor', { id: `hang-${player.id}` })
    hangAnchor.position.copy(v1)
    hangAnchor.rotation.y = rotationY
    world.add(hangAnchor)

    currentEffect = player.applyEffect({
      anchor: hangAnchor,
      emote: hangingEmote?.url ? `${hangingEmote.url}?l=0` : '',
      snare: 1,
      turn: false,
      duration: null,
      cancellable: false,
      onEnd: () => resetHangingState(CONFIG.hangEndCooldown, false),
    })

    targetRotationY = rotationY
  }

  app.on('update', dt => {
    if (hangCooldown > 0) hangCooldown -= dt

    // Consume stamina while hanging
    if (hanging && !staminaDepleted && !waitingForConsumeReply) {
      staminaConsumeTimer -= dt

      if (staminaConsumeTimer <= 0) {
        const consumeRequestId = Math.random().toString(36).substr(2, 9)

        // Calculate consume amount with safety checks
        let rawAmount = STAMINA_DRAIN_RATE * dt
        let consumeAmount = Math.min(rawAmount, 0.5) // Cap max consume per frame

        // Extra safety: if dt is weirdly large, don't consume anything
        if (dt > 0.1) {
          console.warn('[Ledge Hang ROM] WARNING: dt is too large:', dt.toFixed(4), 'skipping consume')
          consumeAmount = 0
        }

        const consumeReplyHandler = ({ success, remaining }) => {
          waitingForConsumeReply = false
          world.off(`stamina:consume-reply:${playerId}:${consumeRequestId}`, consumeReplyHandler)
          if (config.debugMode) {
            debugLog('Consume reply - success:', success, 'remaining:', remaining?.toFixed(1))
          }
          if (!success) {
            staminaDepleted = true
            debugLog('Stamina depleted, ending hang')
            resetHangingState(0.5, true)  // Apply fall when stamina depleted
          }
        }

        waitingForConsumeReply = true
        debugLog('Consuming stamina - amount:', consumeAmount.toFixed(3))

        world.emit(`stamina:consume:${playerId}`, {
          amount: consumeAmount,
          requestId: consumeRequestId,
          source: 'romLedgeHang',
        })

        world.on(`stamina:consume-reply:${playerId}:${consumeRequestId}`, consumeReplyHandler)
      }
    }

    if (hanging) {
      // Set rotation on first frame of hanging (after effect is applied)
      if (!rotationSet) {
        e1.setFromQuaternion(player.quaternion)
        e1.y = targetRotationY
        q1.setFromEuler(e1)
        player.quaternion.copy(q1)
        rotationSet = true
      }

      // Support both keyboard and mobile touch controls
      const space = control.space?.pressed || control.touchA?.pressed || false
      const s = control.keyS?.pressed || control.touchB?.pressed || false

      if (space && !lastSpace) {
        // Jump upward along the wall - primarily vertical with slight push away
        debugLog('Jumping up from hang')
        v1.copy(UP).multiplyScalar(0.9) // 90% upward
        v2.copy(wallNormal).negate().multiplyScalar(0.1) // 10% away from wall
        v1.add(v2).normalize()
        player.push(v1.multiplyScalar(CONFIG.jumpUpImpulse))
        resetHangingState(0.5, false)  // Don't apply fall for upward jump
      } else if (s && !lastS) {
        debugLog('Dropping from hang')
        v1.copy(wallNormal).multiplyScalar(CONFIG.dropImpulse)
        player.push(v1)
        // Add downward force for more natural fall
        v2.copy(DOWN).multiplyScalar(CONFIG.dropImpulse * 0.5)
        player.push(v2)
        resetHangingState(0.3, true)  // Apply fall for drop
      }

      lastSpace = space
      lastS = s
      return
    }

    v2.copy(player.position).sub(lastPosition).divideScalar(dt)
    lastPosition.copy(player.position)

    if (isGrounded() || v2.y >= 0 || v2.y > CONFIG.minFallSpeed || hangCooldown > 0) {
      if (isGrounded() && config.debugMode) {
        debugLog('Not checking for ledge - player is grounded')
      }
      return
    }

    const dir = getForwardDirection(v3)
    const speed = Math.sqrt(v2.x * v2.x + v2.z * v2.z)
    const reach = speed * dt + 0.6
    const halfHeight = getPlayerHalfHeight(player)
    const chestY = halfHeight * 0.5 // Chest is at 25% of total height
    const upperY = halfHeight + CONFIG.maxGrabAbove

    v1.copy(player.position)
    v1.y += chestY
    const lowerHit = world.raycast(v1, dir, reach, CONFIG.layerMask)
    if (!lowerHit?.point) return

    v1.copy(player.position)
    v1.y += upperY
    if (world.raycast(v1, dir, reach, CONFIG.layerMask)) return

    v1.copy(player.position)
    v1.y += chestY
    v1.addScaledVector(dir, lowerHit.distance)
    v1.y += upperY - chestY + 0.1
    const ledgeHit = world.raycast(v1, DOWN, upperY - chestY + CONFIG.maxGrabAbove + 0.1, CONFIG.layerMask)
    if (!ledgeHit?.point) return

    const ledgePoint = v1.clone().addScaledVector(DOWN, ledgeHit.distance)
    const headY = player.position.y + halfHeight
    const ledgeY = ledgePoint.y
    if (ledgeY < headY + CONFIG.minGrabBelow || ledgeY > headY + CONFIG.maxGrabAbove) return

    // Check stamina before starting hang (try-consume for atomic check)
    const tryConsumeRequestId = Math.random().toString(36).substr(2, 9)
    debugLog('Checking stamina for ledge grab - required:', MIN_STAMINA_TO_HANG, 'current:', currentStamina.toFixed(1))

    const tryConsumeHandler = ({ success }) => {
      world.off(`stamina:try-consume-reply:${playerId}:${tryConsumeRequestId}`, tryConsumeHandler)
      if (!success) {
        debugLog('Not enough stamina to start hang - current:', currentStamina.toFixed(1), 'minimum:', MIN_STAMINA_TO_HANG)
        return
      }
      // Stamina check passed, continue with hang
      debugLog('Stamina check passed, starting hang')
      startHang(ledgePoint, dir, wallNormal)
    }

    world.emit(`stamina:try-consume:${playerId}`, {
      amount: MIN_STAMINA_TO_HANG,
      requestId: tryConsumeRequestId,
      source: 'romLedgeHang',
    })
    world.on(`stamina:try-consume-reply:${playerId}:${tryConsumeRequestId}`, tryConsumeHandler)
  })

  // Cleanup when player leaves
  world.on('leave', ({ playerId }) => {
    if (playerId === player.id) {
      resetHangingState(0, true)
    }
  })
}
} catch (error) {
  console.error('[Ledge Hang ROM] ERROR:', error.message, error.stack)
}

// Conventional ROM wrapper logic
const ui = app.create('ui')
ui.rotation.y = 180 * DEG2RAD
ui.position.z = -0.12
ui.position.y = -0.46
ui.width = 20
const romName = app.create('uitext')
romName.fontSize = 4
romName.textAlign = 'center'
romName.color = '#000000'
romName.value = props.rName || 'Ledge Hang'
romName.backgroundColor = '#ffffff'
romName.fontFamily = 'Arial Black'
app.add(ui)
ui.add(romName)

// Color the ROM mesh
const mesh = app.get('RomColor')
if (mesh) {
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
}

// Add kinematic rigidbody for collision detection
const romBody = app.create('rigidbody', {
  type: 'kinematic',
  trigger: true,
})
app.add(romBody)
