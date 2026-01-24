# Stamina Potion - Simple Version with Visual Indicator

## Changes Made

### 1. Removed Particle System from Stamina Bar
The complex particle system has been removed from `/examples/essentials/stamina-system.js`. Instead, unlimited stamina mode is now indicated by:
- **Bright green color** (`#00ff00`)
- **High emissive intensity** (1.0 instead of 0.3)
- **Glowing effect** that makes the bar clearly visible

### 2. Simplified Potion Script
Created `/examples/essentials/stamina-potion-simple.js` with simple scaling effect:
- **When collected**: Sphere scales to (0, 0, 0) - disappears immediately
- **During cooldown**: Spheres stays hidden
- **When respawning**: Sphere scales back to (1, 1, 1) - reappears

This matches the fireball.js approach and avoids complex state management issues.

### 3. Removed Config Options
- Removed `showUnlimitedParticles` toggle (no longer needed)
- Removed related debug logging

## How It Works

### Stamina Bar Visual Indicator
```javascript
// When unlimited stamina is active:
barFront.color = '#00ff00'
barFront.emissive = '#00ff00'
barFront.emissiveIntensity = 1.0  // Bright glow

// Normal stamina:
barFront.color = '#00ff00' // Green
barFront.emissiveIntensity = 0.2  // Subtle glow

// Low stamina:
barFront.color = '#ff0000'  // Red
```

### Potion Collection Effect
```javascript
// On collection:
sphere.scale.set(0, 0, 0) // Instantly hide

// On respawn:
sphere.scale.set(1, 1, 1) // Instantly show
```

## Usage

### Add Stamina System
```javascript
world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    showStaminaBar: true,
    showBarObjects: true
  }
})
```

### Add Stamina Potion
```javascript
world.create('app', {
  src: '/examples/essentials/stamina-potion-simple.js',
  config: {
    boostDuration: 10,  // 10 seconds of unlimited stamina
    respawnTime: 30     // Respawns after 30 seconds
  }
})
```

## Testing

1. Walk into a stamina potion - sphere should disappear immediately
2. Stamina bar should glow bright green
3. Stamina won't deplete when using dash/sprint
4. After 10 seconds, bar returns to normal intensity
5. After 30 seconds total, potion sphere reappears

## Visual Effects

### Before (with particles)
- Small green particles orbiting the bar
- Required complex particle system
- High GPU overhead for continuous emission

### After (emissive intensity)
- Bright green glow on stamina bar
- Simple, efficient rendering
- Clear visual indicator
- No performance impact

## Files Modified
- `/examples/essentials/stamina-system.js` - Removed particles, added emissive intensity
- `/examples/essentials/stamina-potion-simple.js` - New simple potion script

## Benefits
- **Simpler code** - No complex state management
- **Better performance** - No particle overhead
- **Clear visual feedback** - High emissive intensity is obvious
- **Reliable** - No synchronization issues
