// =================================================================
// Wall Hang Mechanic
// =================================================================

// Configuration
app.configure([
  {
    key: 'hangingEmote',
    type: 'file',
    kind: 'emote',
    label: 'Hanging Emote',
  },
])

const PLAYER_HALF_HEIGHT = 1.2
const CONFIG = {
  hangHeight: 1.63, // Player center Y offset from ledge (positive = player below ledge)
  wallOffset: -0.38, // Horizontal offset from wall (negative = toward wall)
  maxGrabAbove: 0.6, // Max ledge height above head to grab
  minGrabBelow: -0.3, // Min ledge height below head to grab
  hangEndCooldown: 0.5, // Cooldown after ending hang
  climbImpulse: 1, // Climb up force
  dropImpulse: 1, // Drop away force
  minFallSpeed: -1.5, // Minimum falling speed to trigger grab
  layerMask: world.createLayerMask('environment'),
}

// Client Implementation
if (world.isClient) {
  const { hangingEmote } = app.props
  const player = world.getPlayer()
  const control = app.control()

  // State
  let hanging = false
  let hangCooldown = 0
  let currentEffect = null
  let hangAnchor = null // Anchor to disable physics while hanging
  const lastPosition = new Vector3()
  const ledgePoint = new Vector3()
  const wallNormal = new Vector3()
  const wallDir = new Vector3() // Horizontal wall direction
  let lastSpace = false
  let lastS = false

  // Reusable vectors
  const v1 = new Vector3()
  const v2 = new Vector3()
  const v3 = new Vector3()
  const e1 = new Euler(0, 0, 0, 'YXZ')
  const q1 = new Quaternion()
  const UP = new Vector3(0, 1, 0)
  const DOWN = new Vector3(0, -1, 0)
  const FORWARD = new Vector3(0, 0, -1)

  // Helper Functions
  function getForwardDirection(outVec) {
    e1.setFromQuaternion(control.camera.quaternion)
    e1.x = e1.z = 0
    q1.setFromEuler(e1)
    return outVec.copy(FORWARD).applyQuaternion(q1)
  }

  function isGrounded() {
    const hit = world.raycast(player.position, DOWN, PLAYER_HALF_HEIGHT + 0.1, CONFIG.layerMask)
    return hit?.distance <= PLAYER_HALF_HEIGHT + 0.05
  }

  function resetHangingState(cooldown) {
    hanging = false
    hangCooldown = cooldown
    currentEffect?.cancel()
    currentEffect = null
    // Remove anchor to re-enable physics
    if (hangAnchor) {
      world.remove(hangAnchor)
      hangAnchor = null
    }
  }

  // Main Update Loop
  app.on('update', dt => {
    // Update cooldown
    if (hangCooldown > 0) hangCooldown -= dt

    // Handle hanging state
    if (hanging) {
      // Anchor disables physics, so no position correction needed

      const space = control.space?.pressed || false
      const s = control.keyS?.pressed || false

      if (space && !lastSpace) {
        // Climb up
        v1.copy(wallNormal).negate().multiplyScalar(0.5).add(UP).normalize()
        player.push(v1.multiplyScalar(CONFIG.climbImpulse))
        resetHangingState(0.5)
      } else if (s && !lastS) {
        // Drop
        v1.copy(wallNormal).multiplyScalar(CONFIG.dropImpulse)
        player.push(v1)
        resetHangingState(0.3)
      }

      lastSpace = space
      lastS = s
      return
    }

    // Calculate velocity (only when not hanging)
    v2.copy(player.position).sub(lastPosition).divideScalar(dt)
    lastPosition.copy(player.position)

    // Early exit: grounded, ascending, or on cooldown
    if (isGrounded() || v2.y >= 0 || v2.y > CONFIG.minFallSpeed || hangCooldown > 0) {
      return
    }

    // Detect ledge
    const dir = getForwardDirection(v3)
    const speed = Math.sqrt(v2.x * v2.x + v2.z * v2.z)
    const reach = speed * dt + 0.6 // Base reach distance
    const chestY = PLAYER_HALF_HEIGHT * 0.5
    const upperY = PLAYER_HALF_HEIGHT + CONFIG.maxGrabAbove

    // Lower raycast
    v1.copy(player.position)
    v1.y += chestY
    const lowerHit = world.raycast(v1, dir, reach, CONFIG.layerMask)
    if (!lowerHit?.point) return

    // Upper raycast (must be clear for ledge)
    v1.copy(player.position)
    v1.y += upperY
    if (world.raycast(v1, dir, reach, CONFIG.layerMask)) return

    // Find ledge surface
    v1.copy(player.position)
    v1.y += chestY
    v1.addScaledVector(dir, lowerHit.distance)
    v1.y += upperY - chestY + 0.1
    const ledgeHit = world.raycast(v1, DOWN, upperY - chestY + CONFIG.maxGrabAbove + 0.1, CONFIG.layerMask)
    if (!ledgeHit?.point) return

    // Calculate ledge point
    ledgePoint.copy(v1).addScaledVector(DOWN, ledgeHit.distance)

    // Check grab range
    const headY = player.position.y + PLAYER_HALF_HEIGHT
    const ledgeY = ledgePoint.y
    if (ledgeY < headY + CONFIG.minGrabBelow || ledgeY > headY + CONFIG.maxGrabAbove) return

    // Grab ledge - position player so hands are at ledge
    hanging = true
    wallNormal.copy(lowerHit.normal)

    // Calculate horizontal wall direction (project normal onto XZ plane)
    v2.copy(wallNormal)
    v2.y = 0 // Remove vertical component
    if (v2.lengthSq() > 0.001) {
      v2.normalize()
    } else {
      // Wall is nearly vertical, use forward direction as fallback
      v2.copy(dir).normalize()
    }
    wallDir.copy(v2) // Store for maintaining position

    // Position player: simple offset from ledge
    // hangHeight: how far below the ledge the player center should be
    // Increase hangHeight to lower player, decrease to raise player
    v1.copy(ledgePoint)
    v1.y = ledgePoint.y - CONFIG.hangHeight
    v1.addScaledVector(wallDir, CONFIG.wallOffset)

    // Teleport player to position (without rotation to avoid affecting camera)
    player.teleport(v1)

    // Calculate rotation to face the wall
    // Use the approach direction (dir) - the direction player was moving when grabbing ledge
    // This ensures player faces the wall regardless of which side they approach from
    v3.copy(dir)
    v3.y = 0 // Remove vertical component
    v3.normalize()

    // Calculate yaw angle (rotation around Y axis) from approach direction
    // Add 180 degrees (π radians) to face opposite direction (toward the wall)
    const rotationY = Math.atan2(v3.x, v3.z) + Math.PI

    // Set player rotation directly (only affects player model, not camera)
    e1.setFromQuaternion(player.quaternion)
    e1.y = rotationY
    q1.setFromEuler(e1)
    player.quaternion.copy(q1)

    // Create anchor at hang position to disable physics and prevent sliding
    const anchorId = `hang-${app.instanceId}`
    hangAnchor = app.create('anchor', { id: anchorId })
    hangAnchor.position.copy(v1)
    // Set anchor rotation to match player rotation (face the wall)
    hangAnchor.rotation.y = rotationY
    world.add(hangAnchor)

    // Apply effect with anchor to disable physics simulation
    currentEffect = player.applyEffect({
      anchor: hangAnchor,
      emote: hangingEmote?.url ? `${hangingEmote.url}?l=0` : '',
      freeze: true,
      turn: false,
      duration: null,
      cancellable: false,
      onEnd: () => {
        hanging = false
        hangCooldown = CONFIG.hangEndCooldown
        currentEffect = null
        // Remove anchor to re-enable physics
        if (hangAnchor) {
          world.remove(hangAnchor)
          hangAnchor = null
        }
      },
    })
  })
}
