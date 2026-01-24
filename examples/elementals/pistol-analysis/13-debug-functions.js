// ===== DEBUG FUNCTIONS =====
// Debug function to test additive blending
function testAdditiveBlending() {
  console.log(`[pistol] Testing additive blending...`)
  console.log(`[pistol] props.useAdditiveAnimations:`, props.useAdditiveAnimations)
  console.log(`[pistol] player.applyAdditiveAnimation exists:`, !!player.applyAdditiveAnimation)
  console.log(`[pistol] player.clearAdditiveAnimations exists:`, !!player.clearAdditiveAnimations)

  const testUrl = getAnimationUrl('aimIdle')
  console.log(`[pistol] Test URL: ${testUrl}`)

  if (testUrl && player.applyAdditiveAnimation) {
    console.log(`[pistol] Attempting to play test additive animation...`)
    player.applyAdditiveAnimation(testUrl, {
      weight: 1.0,
      loop: true,
      fadeDuration: 0.3,
      debugArmRotations: props.debugArmRotations === true,
    })
  } else {
    console.log(`[pistol] Testing via playAnimation with isPose flag...`)
    if (testUrl) {
      playAnimation(testUrl, { loop: true, duration: 2.0, isPose: true })
    }
  }
}

// Helper function to debug emote state
function debugEmoteState() {
  console.log('[pistol] === EMOTE STATE DEBUG ===')
  console.log('[pistol] player.avatar exists:', !!player.avatar)
  if (player.avatar) {
    console.log('[pistol] player.avatar.emote:', player.avatar.emote)
    console.log('[pistol] player.avatar.instance exists:', !!player.avatar.instance)
    if (player.avatar.instance) {
      console.log('[pistol] player.avatar.instance.currentEmote:', player.avatar.instance.currentEmote)
      console.log('[pistol] player.avatar.instance.locomotionDisabled:', player.avatar.instance.locomotionDisabled)
    }
  }

  const worldPlayer = world.getPlayer()
  console.log('[pistol] worldPlayer.avatar exists:', !!worldPlayer?.avatar)
  if (worldPlayer?.avatar) {
    console.log('[pistol] worldPlayer.avatar.emote:', worldPlayer.avatar.emote)
    console.log('[pistol] worldPlayer.avatar.instance exists:', !!worldPlayer.avatar.instance)
    if (worldPlayer.avatar.instance) {
      console.log('[pistol] worldPlayer.avatar.instance.currentEmote:', worldPlayer.avatar.instance.currentEmote)
      console.log(
        '[pistol] worldPlayer.avatar.instance.locomotionDisabled:',
        worldPlayer.avatar.instance.locomotionDisabled
      )
    }
  }
  console.log('[pistol] === END EMOTE STATE DEBUG ===')
}
