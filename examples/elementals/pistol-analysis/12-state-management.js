// ===== STATE MANAGEMENT AND IDLE STATE =====
function returnToIdleState() {
  console.log(`[pistol] ===== RETURN TO IDLE STATE DEBUG =====`)
  console.log(`[pistol] Returning to idle state from: ${pistolState}`)
  console.log(`[pistol] Is aiming: ${isAiming}`)
  console.log(`[pistol] Additive system available: ${!!player.applyAdditiveAnimation}`)
  console.log(`[pistol] Player.avatar exists: ${!!player.avatar}`)
  if (player.avatar) {
    console.log(`[pistol] Player.avatar.instance exists: ${!!player.avatar.instance}`)
    if (player.avatar.instance) {
      console.log(
        `[pistol] Player.avatar.instance.setAdditiveAnimation exists: ${!!player.avatar.instance.setAdditiveAnimation}`
      )
      console.log(
        `[pistol] Current additive animations: ${player.avatar.instance.getAdditiveAnimations?.() || 'method not available'}`
      )
    }
  }

  // Wait for additive animation system to be available
  if (!player.applyAdditiveAnimation) {
    console.log('[pistol] Additive animation system temporarily unavailable, retrying in 100ms...')
    setTimeout(() => {
      console.log('[pistol] Retrying returnToIdleState after delay...')
      returnToIdleState()
    }, 100)
    return
  }

  // Determine the correct state based on aiming status
  if (isAiming) {
    // Return to aim idle
    const aimIdleUrl = getAnimationUrl('aimIdle')
    console.log(`[pistol] Aim idle URL: ${aimIdleUrl}`)
    if (aimIdleUrl && player.applyAdditiveAnimation) {
      console.log('[pistol] Reapplying aim pose via additive system')
      try {
        player.applyAdditiveAnimation(aimIdleUrl, {
          weight: 1.0,
          loop: true,
          fadeDuration: 0.3,
          debugArmRotations: props.debugArmRotations === true,
        })
        setPistolState('aiming')
        console.log('[pistol] Aim pose reapplied successfully')
      } catch (error) {
        console.error('[pistol] Error reapplying aim pose:', error)
      }
    } else {
      console.log('[pistol] Cannot reapply aim pose - additive system unavailable or no URL')
      if (!aimIdleUrl) console.log('[pistol] No aimIdle animation configured')
      if (!player.applyAdditiveAnimation) console.log('[pistol] Additive animation system unavailable')
    }
  } else {
    // Return to pistol grip idle
    const pistolIdleUrl = getAnimationUrl('pistolIdle')
    console.log(`[pistol] Pistol idle URL: ${pistolIdleUrl}`)
    if (pistolIdleUrl && player.applyAdditiveAnimation) {
      console.log('[pistol] Reapplying grip pose via additive system')
      try {
        player.applyAdditiveAnimation(pistolIdleUrl, {
          weight: 1.0,
          loop: true,
          fadeDuration: 0.3,
          debugArmRotations: props.debugArmRotations === true,
        })
        setPistolState('equipped')
        console.log('[pistol] Grip pose reapplied successfully')
      } catch (error) {
        console.error('[pistol] Error reapplying grip pose:', error)
      }
    } else {
      console.log('[pistol] Cannot reapply grip pose - additive system unavailable or no URL')
      if (!pistolIdleUrl) console.log('[pistol] No pistolIdle animation configured')
      if (!player.applyAdditiveAnimation) console.log('[pistol] Additive animation system unavailable')
    }
  }
}
