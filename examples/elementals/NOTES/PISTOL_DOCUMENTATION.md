# Pistol System - Technical Documentation

## Overview

The pistol is a complete ranged weapon system built for Hyperfy's elementals framework. It demonstrates projectile-based combat with sophisticated animation blending, particle effects, spatial audio, and client/server synchronization.

## Core Architecture

### Client/Server Architecture

The pistol uses Hyperfy's dual-mode architecture:
- **Server**: Authoritative hit detection, damage calculation, ammo management
- **Client**: Visual effects, audio, input handling, animation system

### Main Components

1. **Weapon Model**: GLB-based pistol with bone hierarchy
2. **Projectile System**: Raycast-based hit detection with visual trails
3. **Animation Pipeline**: Additive animation blending for natural movement
4. **Effect System**: Particle-based muzzle flash, shell casings, impact sparks
5. **Audio System**: Spatial 3D sound positioning at muzzle
6. **ADS System**: Toggleable aim-down-sights with camera zoom

## How It Works

### Initialization (client:init)

1. **Pistol Model Setup**
   - Clones the pistol GLB model from app hierarchy
   - Attaches to player's right hand via bone transform anchoring
   - Extracts bone references (muzzle, ejection port, grip)
   - Calculates grip offset for proper hand alignment

2. **Animation System**
   - Clears existing additive animations
   - Plays equip animation (standard emote)
   - Transitions to pistol grip pose (additive)
   - Sets up pose maintenance system

3. **Input Binding**
   - Captures fire button (left mouse default)
   - Captures ADS button (right mouse default)
   - Creates mobile UI buttons for touch input

### Firing Sequence (client:update → server:fire → client:fire)

1. **Client Input**
   - Fire button pressed with cooldown check (FIRE_RATE: 0.1s)
   - Checks ammo availability
   - Gets firing direction from camera quaternion

2. **Visual Feedback (Immediate)**
   - Decrements local ammo counter
   - Plays pistol model animation (EmoteShoot)
   - Creates muzzle flash particles at bone position
   - Ejects shell casing from ejection bone
   - Plays spatial fire sound at muzzle

3. **Server Authority**
   - Receives fire event with origin and direction
   - Performs raycast for hit detection
   - Calculates damage (20-40, 20% crit chance)
   - Applies damage to hit entities
   - Broadcasts projectile data for trails

4. **Projectile Visualization**
   - Creates bullet trail particles
   - Animates from origin toward target
   - Spawns impact sparks at hit location
   - Cleans up after lifetime

### Aim Down Sights (ADS)

1. **Toggle System**
   - Right-click toggles aim state
   - Transitions between poses:
     - Not aiming: Pistol grip (arms lowered)
     - Aiming: Aim idle (arms raised)

2. **Camera Zoom**
   - Smooth interpolation to 85mm focal length
   - Restores 24mm focal length when exiting ADS
   - Uses ZOOM_TRANSITION_SPEED for smooth transitions

3. **Pose Blending**
   - Additive animations layer over base locomotion
   - Arms follow hand position while maintaining weapon offset
   - Natural movement preserved (player can walk/run)

### Reload System

1. **Client Request**
   - R key triggers reload
   - Plays reload animation (additive)

2. **Server Authority**
   - Receives reload event
   - Resets ammo to maxAmmo
   - Confirms to client

3. **Pose Restoration**
   - After reload animation completes
   - Automatically returns to appropriate pose (grip or aim)

## Animation System

### Additive Animation Pipeline

The pistol uses Hyperfy's advanced additive animation system:

1. **Pose Animations** (Additive - blend over locomotion)
   - `PistolIdle`: Arms lowered, weapon at side
   - `AimIdle`: Arms raised, weapon ready
   - `PistolWalk`: Walking with weapon at side
   - `AimWalk`: Walking while aiming
   - `PistolRun`: Running with weapon at side
   - `AimRun`: Running while aiming

2. **Action Animations** (Standard - replace locomotion)
   - `equip`: One-time draw animation
   - `fire`: One-shot recoil
   - `reload`: Magazine change sequence

### Animation Configuration

```javascript
{
  useAdditiveAnimations: true,          // Enable smart blending
  pistolAnimationWeight: 1.0,           // Full influence
  conflictResolutionMode: 'additive_priority',
  fadeDuration: 0.15,                   // Smooth transitions
  loop: true,                           // Continuous poses
  maxBoneRotation: 15,                  // Prevent over-rotation
  rotationScale: 0.3                    // Conservative rotation
}
```

## Technical Features

### 1. Smart Bone Anchoring

```javascript
// Grip bone offset calculation
if (gripBone && gripBone.position) {
  gripOffset.copy(gripBone.position)
}

// World-space positioning
pistolSkin.position.setFromMatrixPosition(handMatrix)
pistolSkin.quaternion.setFromRotationMatrix(handMatrix)

// Apply offset
if (gripOffset.lengthSq() > 0) {
  const worldGripOffset = v1.copy(gripOffset)
  worldGripOffset.applyQuaternion(pistolSkin.quaternion)
  pistolSkin.position.sub(worldGripOffset)
}
```

### 2. Self-Hit Prevention

- Raycast origin projected forward from muzzle bone
- Minimum hit distance of 0.5m
- Player ID comparison to prevent self-damage

### 3. Memory Management

- Projectile tracking with cleanup handlers
- Automatic UI button removal
- Animation state reset on unequip
- Particle system auto-cleanup

### 4. Input Handling

- Configurable keybinds (fire, reload, ADS)
- Pointer lock support (optional)
- Mobile touch button support
- Button capture to prevent default behavior

## Configuration System

### Core Properties

```javascript
{
  // Damage
  MIN_DMG: 20,
  MAX_DMG: 40,
  CRIT_CHANCE: 0.2,
  CRIT_MULTIPLIER: 1.8,

  // Ballistics
  PROJECTILE_SPEED: 50,
  PROJECTILE_LIFETIME: 3,
  RANGE: 100,
  FIRE_RATE: 0.1,

  // Ammo
  maxAmmo: 100,
  showAmmoCount: true,

  // Zoom
  adsFocalLength: 85,
  zoomSpeed: 15.0
}
```

### Animation URLs (Configurable)

- `pistolIdleEmote`: Arms down idle pose
- `aimIdleEmote`: Arms up idle pose
- `equipEmote`: Draw animation
- `fireEmote`: Firing recoil
- `reloadEmote`: Reload sequence
- `pistolWalkEmote`: Walking with weapon down
- `aimWalkEmote`: Walking while aiming
- `pistolRunEmote`: Running with weapon down
- `aimRunEmote`: Running while aiming

### Sound URLs

- `fireSound`: Gunshot audio
- `reloadSound`: Reload audio
- `impactSound`: Hit impact audio

### Visual Properties

- `muzzleFlashColor`: Particle color at muzzle
- `shellCasingColor`: Ejected casing color
- `bulletTrailColor`: Projectile trail color
- `impactSparkColor`: Hit effect color
- `enableParticles`: Toggle all particles

## Integration Points

### Required External Events

- `elemental-item:give`: Inventory integration
- `elemental-item:ammo-update`: UI ammo display
- `health`: Damage/death handling
- `elemental-mob:hit`: NPC damage

### Required Avatar Methods

- `player.applyAdditiveAnimation()` - Additive poses
- `player.clearAdditiveAnimations()` - Cleanup
- `player.getBoneTransform()` - Hand positioning
- `player.applyEffect()` - Recoil/resets

### Required World Functions

- `world.raycast()` - Hit detection
- `world.prefs.setFocalLength()` - Camera zoom
- `world.createLayerMask()` - Collision filtering

## Performance Considerations

1. **Animation**: Uses additive layers to avoid locomotion replacement
2. **Particles**: Automatic cleanup after short lifetimes
3. **Projectiles**: Visual only - raycast handles actual hit detection
4. **Audio**: Spatial falloff limits distance-based processing
5. **Updates**: Efficient delta-time animations with cooldowns

## Mobile Support

- Touch buttons for fire and ADS
- Automatic UI positioning relative to screen edges
- Cursor pointer styles for touch feedback
- Same functionality as desktop input

## Extensions & Customization

### Adding New Features

1. **Burst Fire**: Modify fire rate logic with burst counter
2. **Scope Overlay**: Add UI scope texture during ADS
3. **Ammo Types**: Extend configuration for different damage profiles
4. **Weapon Sway**: Add breathing/sway patterns to poses
5. **Dry Fire**: Add empty click sound when no ammo

### Creating New Weapons

The pistol architecture can be replicated for other weapons:
- Same dual-animation method (poses + actions)
- Different bone positions (rifle = shoulder, knife = hand)
- Unique particle/sound profiles
- Shared animation system across weapons

## Files

- `elemental-item-pistol.js` - Main pistol implementation
- `elemental-item-pistol-v3.js` - Optimized variant
- `elemental-item-pistol-enhanced.js` - Extended features
- `pistol-analysis/` - Performance and debugging data

## Version History

- **v1.0**: Basic firing and animation
- **v2.0**: Additive animation system, particle effects
- **v3.0**: Optimized raycast, improved anchoring, mobile support
- **v1764864708**: Current version with full feature set
