app.configure([
  {
    key: 'superRunEmote',
    type: 'file',
    kind: 'emote',
    label: 'Super Run Emote',
  },
])

const PLAYER_HALF_HEIGHT = 0.8
const ACTIVATION_TIME = 0.5
const EXTRA_SPEED = 30
const DEACTIVATION_TIME = 0.5
const layerMask = world.createLayerMask('environment')

if (world.isClient) {
  const { superRunEmote } = app.props
  const player = world.getPlayer()
  const control = app.control()
  let runTime = 0
  let superActive = false

  const tempVec = new Vector3()
  const tempQuat = new Quaternion()
  const tempEuler = new Euler(0, 0, 0, 'YXZ')

  function getForwardDirection(outVec) {
    tempEuler.setFromQuaternion(control.camera.quaternion)
    tempEuler.x = 0
    tempEuler.z = 0
    tempQuat.setFromEuler(tempEuler)
    return outVec.copy(new Vector3(0, 0, -1)).applyQuaternion(tempQuat)
  }

  function isGrounded() {
    if (!player?.position) return true
    const hit = world.raycast(
      player.position.clone(),
      new Vector3(0, -1, 0),
      PLAYER_HALF_HEIGHT + 0.1,
      layerMask
    )
    return hit !== null && hit.distance <= PLAYER_HALF_HEIGHT + 0.05
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

    if (isSprintingForward) {
      runTime += dt
      if (runTime >= ACTIVATION_TIME && !superActive) {
        superActive = true
        player.applyEffect({
          emote: superRunEmote?.url || '',
          duration: null,
          cancellable: false,
        })
      }
    } else {
      if (superActive) {
        player.applyEffect({
          emote: superRunEmote?.url || '',
          duration: DEACTIVATION_TIME,
          cancellable: true,
        })
        superActive = false
      }
      runTime = 0
    }

    if (superActive && isSprintingForward) {
      player.push(getForwardDirection(tempVec).multiplyScalar(EXTRA_SPEED * dt))
    }
  })
}