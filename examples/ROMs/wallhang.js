// Wall Hang Mechanic
app.configure([
  {
    key: 'hangingEmote',
    type: 'file',
    kind: 'emote',
    label: 'Hanging Emote',
  },
])

const DEFAULT_PLAYER_HEIGHT = 2.4 // Default player height in meters
const DEFAULT_HANG_HEIGHT = 2.35 // Default hang height offset

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

if (world.isClient) {
  const { hangingEmote } = app.props
  const player = world.getPlayer()
  const control = app.control()

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

  function resetHangingState(cooldown) {
    hanging = false
    hangCooldown = cooldown
    rotationSet = false
    currentEffect?.cancel()
    currentEffect = null
    if (hangAnchor) {
      world.remove(hangAnchor)
      hangAnchor = null
    }
  }

  app.on('update', dt => {
    if (hangCooldown > 0) hangCooldown -= dt

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
        v1.copy(UP).multiplyScalar(0.9) // 90% upward
        v2.copy(wallNormal).negate().multiplyScalar(0.1) // 10% away from wall
        v1.add(v2).normalize()
        player.push(v1.multiplyScalar(CONFIG.jumpUpImpulse))
        resetHangingState(0.5)
      } else if (s && !lastS) {
        v1.copy(wallNormal).multiplyScalar(CONFIG.dropImpulse)
        player.push(v1)
        resetHangingState(0.3)
      }

      lastSpace = space
      lastS = s
      return
    }

    v2.copy(player.position).sub(lastPosition).divideScalar(dt)
    lastPosition.copy(player.position)

    if (isGrounded() || v2.y >= 0 || v2.y > CONFIG.minFallSpeed || hangCooldown > 0) {
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

    hanging = true
    wallNormal.copy(lowerHit.normal)

    v2.copy(wallNormal)
    v2.y = 0
    if (v2.lengthSq() > 0.001) {
      v2.normalize()
    } else {
      v2.copy(dir).normalize()
    }

    v1.copy(ledgePoint)
    v1.y = ledgePoint.y - getHangHeight(player)
    v1.addScaledVector(v2, CONFIG.wallOffset)

    const rotationY = Math.atan2(-v2.x, -v2.z)
    targetRotationY = rotationY
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
      onEnd: () => resetHangingState(CONFIG.hangEndCooldown),
    })
  })

  // Cleanup when player leaves
  world.on('leave', ({ playerId }) => {
    if (playerId === player.id) {
      resetHangingState(0)
    }
  })
}
