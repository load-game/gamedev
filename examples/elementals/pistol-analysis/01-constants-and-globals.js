// ===== PISTOL CONSTANTS AND GLOBAL VARIABLES =====
// This file contains all the constants and global variables used in the pistol system

// Combat constants
const MIN_DMG = 20
const MAX_DMG = 40
const CRIT_CHANCE = 0.2
const CRIT_MULTIPLIER = 1.8

// Projectile physics constants
const PROJECTILE_SPEED = 50 // Faster for "bullet" feel
const PROJECTILE_LIFETIME = 3 // Shorter lifetime for bullets
const RANGE = 100 // Longer range for a pistol
const FIRE_RATE = 0.1 // Cooldown in seconds between shots (reduced for testing)

// Global variables
let pickupAction = null // Pickup action for the pistol

// Vector objects for calculations
const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()

// ===== DEBUG HELPER =====
function debugLog(...args) {
  if (props.debugLogs) {
    console.log('[pistol]', ...args)
  }
}
