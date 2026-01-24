// ===== CLIENT VARIABLES AND STATE MANAGEMENT =====
// Client-scoped variables (accessible in all client methods)
let zoomLevels = []
let currentZoomLevelIndex = 0
let currentZoom = 1.5
let targetZoom = 1.5
let isAiming = false
let aimIdleAnimationUrl = null
let currentAnimation = null // Track current additive animation
let animationCooldown = 0 // Prevent rapid animation changes
const ZOOM_TRANSITION_SPEED = 8.0

// Pistol state management for proper transitions
let pistolState = 'unequipped' // 'unequipped', 'equipped', 'aiming', 'firing', 'reloading'

// State transition functions
function setPistolState(newState) {
  console.log(`[pistol] State transition: ${pistolState} → ${newState}`)
  pistolState = newState
}
