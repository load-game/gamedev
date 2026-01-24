// Free-Flying Camera Example
// Simple freecam using control.camera directly (no Camera Node needed!)

if (world.isClient) {
  console.log('[Free-Flying Camera] Initializing...')

  let control = null
  let freecamActive = false

  // Movement settings
  const SPEED = 0.15
  const SPEED_BOOST = 3
  const LOOK_SPEED = 0.003
  const LERP_FACTOR = 0.35

  // State
  const velocity = new Vector3()
  let targetQuat = null

  // Get control
  control = app.control()
  if (control) {
    // Capture C key for toggle
    control.keyC.capture = true
    console.log('[Free-Flying Camera] Ready! Press C to toggle freecam')
  }

  app.on('update', (delta) => {
    if (!control) return

    // Toggle freecam with C key
    if (control.keyC.pressed) {
      freecamActive = !freecamActive

      if (freecamActive) {
        // Activate freecam - take control!
        control.camera.write = true

        // Capture all movement keys
        control.keyW.capture = true
        control.keyA.capture = true
        control.keyS.capture = true
        control.keyD.capture = true
        control.keyQ.capture = true
        control.keyE.capture = true
        control.space.capture = true
        control.shiftLeft.capture = true
        control.pointer.capture = true
        control.mouseRight.capture = true
        control.scrollDelta.capture = true  // Prevent camera zoom

        console.log('[Free-Flying Camera] ✓ Activated - WASD to move, Mouse to look, Shift for boost')
      } else {
        // Deactivate freecam - return control
        control.camera.write = false

        // Release all movement keys
        control.keyW.capture = false
        control.keyA.capture = false
        control.keyS.capture = false
        control.keyD.capture = false
        control.keyQ.capture = false
        control.keyE.capture = false
        control.space.capture = false
        control.shiftLeft.capture = false
        control.pointer.capture = false
        control.mouseRight.capture = false
        control.scrollDelta.capture = false

        // Unlock pointer
        if (control.pointer.locked) control.pointer.unlock()

        // Reset state
        velocity.set(0, 0, 0)
        targetQuat = null

        console.log('[Free-Flying Camera] ✗ Deactivated')
      }
    }

    // Update freecam if active
    if (freecamActive) {
      updateFreeCam(delta)
    }
  })

  function updateFreeCam(delta) {
    if (!control || !control.camera) return

    // Calculate movement direction
    const move = new Vector3()

    // WASD for horizontal/forward movement
    if (control.keyW?.down) move.z -= 1
    if (control.keyS?.down) move.z += 1
    if (control.keyA?.down) move.x -= 1
    if (control.keyD?.down) move.x += 1

    // Q/E/Space for vertical movement
    if (control.space?.down) move.y += 1  // Space = up
    if (control.keyQ?.down) move.y += 1   // Q = up
    if (control.keyE?.down) move.y -= 1   // E = down

    // Calculate speed (with boost)
    let currentSpeed = SPEED
    if (control.shiftLeft?.down) {
      currentSpeed *= SPEED_BOOST
    }

    // Calculate desired velocity
    const desiredVelocity = new Vector3()
    if (move.lengthSq() > 0) {
      move.normalize()
      desiredVelocity.copy(move).multiplyScalar(currentSpeed * delta * 60)
      // Apply camera rotation to movement (6DOF - move in the direction you're looking!)
      desiredVelocity.applyQuaternion(control.camera.quaternion)
    }

    // Smooth velocity transition
    velocity.lerp(desiredVelocity, 0.05)

    // Apply velocity to camera position
    control.camera.position.add(velocity)

    // Handle look rotation (only when pointer is locked)
    if (control.pointer.locked) {
      if (!targetQuat) targetQuat = control.camera.quaternion.clone()

      const deltaX = control.pointer.delta.x
      const deltaY = control.pointer.delta.y

      // Convert to euler for easier pitch/yaw manipulation
      const euler = new Euler().setFromQuaternion(targetQuat, 'YXZ')
      euler.y -= deltaX * LOOK_SPEED  // Yaw (left/right)
      euler.x -= deltaY * LOOK_SPEED  // Pitch (up/down)

      // Clamp pitch to prevent gimbal lock
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))

      targetQuat.setFromEuler(euler)

      // Reset pointer delta
      control.pointer.delta.x = 0
      control.pointer.delta.y = 0
    } else {
      // Keep targetQuat in sync when not rotating
      if (targetQuat) targetQuat.copy(control.camera.quaternion)
    }

    // Smooth rotation interpolation
    if (targetQuat) {
      control.camera.quaternion.slerp(targetQuat, LERP_FACTOR)
    }

    // Lock pointer on right mouse click
    if (control.mouseRight?.pressed) {
      control.pointer.lock()
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════')
  console.log('  FREE-FLYING CAMERA')
  console.log('═══════════════════════════════════════')
  console.log('  C          - Toggle freecam')
  console.log('  WASD       - Move (6DOF)')
  console.log('  Q/Space    - Move up')
  console.log('  E          - Move down')
  console.log('  Shift      - Speed boost (3x)')
  console.log('  Right Click - Lock mouse to look')
  console.log('═══════════════════════════════════════')
  console.log('')
}