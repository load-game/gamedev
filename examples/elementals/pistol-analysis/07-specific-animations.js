// ===== SPECIFIC ANIMATION FUNCTIONS =====
// Helper function to play pistol grip animation
function playPistolGripAnimation() {
  // console.log('[pistol] ===== PLAY PISTOL GRIP ANIMATION DEBUG =====')
  // console.log('[pistol] Playing pistol grip animation')

  // Play pistol idle animation if available
  const pistolIdleUrl = getAnimationUrl('pistolIdle')
  // console.log('[pistol] pistolIdleUrl:', pistolIdleUrl)
  // console.log('[pistol] player.applyAdditiveAnimation exists:', !!player.applyAdditiveAnimation)

  if (pistolIdleUrl && player.applyAdditiveAnimation) {
    // console.log('[pistol] Applying grip pose via additive system')
    // console.log('[pistol] About to call player.applyAdditiveAnimation with URL:', pistolIdleUrl)

    try {
      player.applyAdditiveAnimation(pistolIdleUrl, {
        weight: 1.0,
        loop: true,
        fadeDuration: 0.3,
        debugArmRotations: props.debugArmRotations === true,
      })
      // console.log('[pistol] Grip pose applied via additive system - SUCCESS')
    } catch (error) {
      console.error('[pistol] Error applying grip pose:', error)
    }
  } else {
    // console.log('[pistol] No pistolIdle animation or additive system unavailable')
    if (!pistolIdleUrl) {
      // console.log('[pistol] No pistolIdle animation configured - letting natural locomotion continue')
    }
    if (!player.applyAdditiveAnimation) {
      // console.log('[pistol] Additive animation system unavailable')
    }
  }
  // console.log('[pistol] ===== END PLAY PISTOL GRIP ANIMATION DEBUG =====')
}

// Helper function to play aim animation
function playAimAnimation() {
  // console.log('[pistol] Playing aim animation')

  // Play aim idle animation
  const aimIdleUrl = getAnimationUrl('aimIdle')
  if (aimIdleUrl && player.applyAdditiveAnimation) {
    // console.log('[pistol] Applying aim pose via additive system')
    player.applyAdditiveAnimation(aimIdleUrl, {
      weight: 1.0,
      loop: true,
      fadeDuration: 0.3,
      debugArmRotations: props.debugArmRotations === true,
    })
    // console.log('[pistol] Aim pose applied via additive system')
  } else {
    // console.log('[pistol] No aimIdle animation or additive system unavailable')
    if (!aimIdleUrl) {
      // console.log('[pistol] No aimIdle animation configured')
    }
    if (!player.applyAdditiveAnimation) {
      // console.log('[pistol] Additive animation system unavailable')
    }
  }
}
