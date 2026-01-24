// ===== RELOAD SYSTEM =====
// This file contains the reload functionality and animation handling

// Reload function - restore ammo
function reloadPistol() {
  const maxAmmo = props.maxAmmo || 100
  if (ammo >= maxAmmo) {
    debugLog('Already at max ammo')
    return
  }

  ammo = maxAmmo
  debugLog(`Reloaded! Ammo: ${ammo}/${maxAmmo}`)

  // Notify core inventory of ammo change
  if (props.showAmmoCount) {
    world.emit('elemental-item:ammo-update', {
      playerId: player.id,
      itemId: props.id,
      ammo: ammo,
      maxAmmo: maxAmmo,
    })
  }

  // Play BOTH pistol model animation AND player animation
  playPistolAnimation('EmoteReload')
  playSound('reloadSound')

  // Play reload animation
  const reloadUrl = getAnimationUrl('reload')
  if (reloadUrl) {
    setPistolState('reloading')
    playAnimation(reloadUrl, {
      duration: props.reloadDuration || 0.917,
      loop: false,
      fadeDuration: 0.2,
      isPose: true, // Mark as pose animation to use additive blending
    })

    // Reload animation is now additive, so we just need to restore the appropriate pose
    const reloadDuration = props.reloadDuration || 0.917
    setTimeout(
      () => {
        console.log('[pistol] Reload animation completed, restoring pose')
        console.log('[pistol] Current pistol state:', pistolState)
        console.log('[pistol] Is aiming:', isAiming)
        console.log('[pistol] Additive system available:', !!player.applyAdditiveAnimation)
        console.log('[pistol] Player.avatar exists:', !!player.avatar)

        // CRITICAL: Reset currentAnimation so maintenance system knows to reapply poses
        currentAnimation = null
        console.log('[pistol] Reset currentAnimation to null for pose maintenance')

        // Since reload is now additive, we can immediately restore the pose
        console.log('[pistol] Calling returnToIdleState() immediately (reload is additive)')
        returnToIdleState()
      },
      reloadDuration * 1000 + 500
    ) // Add 500ms delay to ensure additive animation has time to load
  } else {
    // No reload animation, just restore pose immediately
    console.log('[pistol] No reload animation, restoring pose immediately')
    returnToIdleState()
  }

  // Notify server
  hooks.call('reload', { ammo })
}
