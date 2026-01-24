// ===== MOVEMENT AND ANIMATION SYSTEM =====
// Helper function to detect player movement state
function getPlayerMovementState() {
  if (!control) return 'idle'

  // Check if player is moving (WASD keys)
  const isMoving =
    (control.keyW && control.keyW.down) ||
    (control.keyA && control.keyA.down) ||
    (control.keyS && control.keyS.down) ||
    (control.keyD && control.keyD.down)

  // Check if player is running (Shift key)
  const isRunning = control.keyShift && control.keyShift.down

  if (isRunning && isMoving) return 'run'
  if (isMoving) return 'walk'
  return 'idle'
}

// Helper function to play movement-based animation
function playMovementAnimation() {
  const movementState = getPlayerMovementState()
  console.log(`[pistol] Player movement state: ${movementState}`)

  let animType = ''
  if (isAiming) {
    // Aiming animations
    if (movementState === 'run') animType = 'aimRun'
    else if (movementState === 'walk') animType = 'aimWalk'
    else animType = 'aimIdle'
  } else {
    // Pistol grip animations
    if (movementState === 'run') animType = 'pistolRun'
    else if (movementState === 'walk') animType = 'pistolWalk'
    else animType = 'pistolIdle'
  }

  const animUrl = getAnimationUrl(animType)
  if (animUrl && player.applyAdditiveAnimation) {
    console.log(`[pistol] Playing ${animType} animation for ${movementState} state`)
    player.applyAdditiveAnimation(animUrl, {
      weight: 1.0,
      loop: true,
      fadeDuration: 0.2,
      debugArmRotations: props.debugArmRotations === true,
    })
  } else {
    console.log(`[pistol] No ${animType} animation configured, falling back to basic pose`)
    // Fallback to basic pose
    if (isAiming) {
      playAimAnimation()
    } else {
      playPistolGripAnimation()
    }
  }
}
