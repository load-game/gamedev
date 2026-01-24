// ===== ANIMATION MANAGEMENT =====
// Helper function to clear all animations and reset to default
function clearAllAnimations() {
  console.log('[pistol] Clearing additive animations and resetting to default')

  // Only clear additive animations - don't try to clear standard emotes
  if (player.clearAdditiveAnimations) {
    player.clearAdditiveAnimations({ fadeDuration: 0.2 })
    console.log('[pistol] Cleared additive animations')
  } else {
    console.log('[pistol] Additive animation system unavailable - cannot clear')
  }

  // Reset tracking
  currentAnimation = null
  animationCooldown = 0
}

// Helper function to force reset animation state (for debugging)
function resetAnimationState() {
  console.log('[pistol] Force resetting animation state')
  currentAnimation = null
  animationCooldown = 0
  clearAllAnimations()
}
