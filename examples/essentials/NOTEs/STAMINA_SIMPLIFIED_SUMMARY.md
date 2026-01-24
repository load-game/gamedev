# Stamina System with heal.js Style Particles

## Overview
Simplified stamina boost visualization with heal.js style particle effects for potion collection, following the fireball.js approach for visibility toggling.

## What Changed

### 1. Stamina Bar Visual Indicator (stamina-system.js)
**Before:** Complex particle system
- Created particles attached to barGroup
- Required continuous emission and cleanup
- High GPU overhead

**After:** Simple emissive intensity
- Unlimited mode: emissiveIntensity = 3.0 (very bright glow)
- Normal mode: emissiveIntensity = 0.2 (subtle glow)
- No particles, no cleanup, no performance impact

**Code:**
```javascript
if (unlimitedStamina) {
  barFront.emissiveIntensity = 3.0  // Very bright
}
```

### 2. Stamina Potion (stamina-potion-simple.js)
**Created new potion script** with:
- **LOD mesh toggling**: `lod.active = false/true` for hide/show
- **Particle effect**: heal.js style green particles on collection
- **Bobbing animation**: Floats up/down when visible
- **Self-cleaning**: Particles auto-remove after 2 seconds

**Effects:**

**Collection:**
```javascript
lod.active = false  // Hide potion

// Spawn heal.js style particles:
const particles = app.create('particles', {
  shape: ['circle', 2, 1],
  speed: '1', size: '0.05', rate: 30, life: '2',
  emissive: '200', color: '#00ff00',
  velocityOrbital: new Vector3(0, 0.2, 0),
  velocityLinear: new Vector3(0, 1, 0)
})
```

**Bobbing Animation:**
```javascript
// Floats up/down when visible
bobTime += dt * 1.5
const bobOffset = Math.sin(bobTime) * 0.05
body.position.y = initialY + bobOffset
```

## Files Modified
- `/examples/essentials/stamina-system.js` - Enhanced emissive intensity
- `/examples/essentials/stamina-potion-simple.js` - Added heal.js style particles
- `/examples/essentials/STAMINA_POTION_SIMPLE.md` - Documentation (NEW)

## Usage

### Add to world:
```javascript
// Stamina system (client-side only)
world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    showStaminaBar: true,
    showBarObjects: true
  }
})

// Stamina potion (client-side only)
world.create('app', {
  src: '/examples/essentials/stamina-potion-simple.js',
  config: {
    boostDuration: 10,  // 10 seconds unlimited
    respawnTime: 30     // Respawns after 30 seconds
  }
})
```

## Visual Effects

### Stamina Bar Colors & Intensity:
- **Full/Regenerating:** Green (`#00ff00`), intensity 0.2
- **Medium:** Yellow (`#ffff00`), intensity 0.2
- **Low:** Red (`#ff0000`), intensity 0.2
- **Unlimited Mode:** Bright Green (`#00ff00`), intensity 3.0

### Potion Behavior:
1. LOD mesh visible (potion appears in world)
2. Player walks into trigger area
3. LOD.active = false (potion disappears)
4. Player gets unlimited stamina for configured duration
5. Stamina bar glows brightly (emissiveIntensity: 3.0)
6. After duration, bar returns to normal intensity
7. After respawn time, LOD.active = true (potion reappears)

## Benefits
1. **Simpler code** - Removed ~100 lines of particle logic
2. **Better performance** - No particle overhead for stamina bar
3. **Clear visual feedback** - Emissive intensity and particle effects
4. **Engaging animation** - Bobbing effect makes potion feel alive
5. **Reliable** - No complex state synchronization
6. **Matches fireball.js** - Consistent with existing Hyperfy patterns

## Testing Checklist
- [ ] Potion gently bobs up/down when visible (floating effect)
- [ ] Green particles appear when potion is collected
- [ ] Potion disappears after collection (LOD.active = false)
- [ ] Stamina bar glows bright green during unlimited mode
- [ ] Stamina doesn't deplete when using dash/sprint
- [ ] After boost duration, bar returns to normal glow
- [ ] After respawn time, potion reappears and bobs again
- [ ] Can collect same potion multiple times
- [ ] Particles are automatically removed after 2 seconds
