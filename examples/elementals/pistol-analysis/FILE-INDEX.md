# Pistol Analysis - File Index

## Complete File Breakdown

### Core System (Files 1-10)
- `01-constants-and-globals.js` - Combat constants, physics, global variables
- `02-item-creation-shared.js` - Item creation and shared variables  
- `03-reload-system.js` - Reload functionality and animations
- `04-animation-url-helper.js` - Animation URL validation
- `05-main-animation-system.js` - Core animation system with additive support
- `06-animation-management.js` - Animation clearing and management
- `07-specific-animations.js` - Grip and aim animation functions
- `08-movement-system.js` - Movement detection and animation selection
- `09-pistol-model-animations.js` - 3D model animation handling
- `10-sound-and-particles.js` - Audio and particle effects

### Client System (Files 11-18)
- `11-client-state.js` - Client state variables
- `12-state-management.js` - State transitions and idle handling
- `13-debug-functions.js` - Debug utilities
- `14-client-init-part1.js` - Client initialization (part 1)
- `15-mobile-buttons-equip.js` - Mobile UI and equip sequence
- `16-client-update-part1.js` - Main update loop (part 1)
- `17-ads-movement-zoom.js` - ADS system and movement
- `18-client-lateupdate-cleanup.js` - Late update and cleanup

### Server System (Files 19-22)
- `19-server-init.js` - Server initialization
- `20-server-fire-part1.js` - Server fire function (part 1)
- `21-server-fire-part2-reload.js` - Server fire (part 2) and reload
- `22-projectile-update.js` - Projectile physics

### Configuration (File 23)
- `23-item-configuration.js` - Complete configuration schema

### Documentation
- `README.md` - Comprehensive analysis overview
- `COMPARISON-ISSUES.md` - Backup vs V3 comparison
- `FILE-INDEX.md` - This file

## Quick Reference

### Key Working Functions (from backup)
```javascript
// Animation System
playAnimation(animUrl, options)           // Main animation dispatcher
playPistolGripAnimation()                 // Sets up idle grip pose
playAimAnimation()                        // Sets up aiming pose
playMovementAnimation()                   // Updates based on movement
getPlayerMovementState()                  // Detects WASD + Shift movement

// State Management  
setPistolState(newState)                  // State transitions
returnToIdleState()                       // Restores appropriate pose
clearAllAnimations()                      // Cleanup function

// Effects
playSound(soundType)                      // Spatial audio
createMuzzleFlash()                       // Particle effects
createShellEjection()                     // Shell casing particles
```

### Key Variables
```javascript
// State Tracking
let pistolState = 'unequipped'            // Current state
let currentAnimation = null               // Active animation
let isAiming = false                      // ADS state
let ammo = props.maxAmmo || 100           // Ammunition count

// Animation Control
let animationCooldown = 0                 // Prevents spam
const ZOOM_TRANSITION_SPEED = 8.0         // Zoom interpolation
```

### Animation Types
1. **Pose Animations** (Additive):
   - `pistolIdle`, `aimIdle`, movement variants
   - Layer on top of natural locomotion
   - Use `player.applyAdditiveAnimation()`

2. **Action Animations** (Standard Emotes):
   - `equip`, `fire`, `reload`
   - Temporarily replace locomotion
   - Use various emote fallback methods

### State Flow
```
unequipped → equipping → equipped → aiming → firing → reloading → equipped/aiming
```

## Usage for V3 Fix

1. **Compare each chunk** with corresponding v3 code
2. **Identify missing functions** and restore them
3. **Fix broken references** to undefined functions
4. **Test incrementally** after each restoration
5. **Preserve working parts** of v3 while adding missing backup functionality

## Next Steps

1. Start with `05-main-animation-system.js` - core animation logic
2. Restore missing functions from `07-specific-animations.js`
3. Fix state management using `12-state-management.js`
4. Verify movement system from `08-movement-system.js`
5. Test and iterate

All files are located in: `/home/blank/hyperfy/examples/elementals/pistol-analysis/`