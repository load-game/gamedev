# Stamina System - Complete Implementation

## Overview
Fully functional stamina system with visual indicators, particle effects, bobbing animations, and consumable potions.

## Components

### 1. Stamina Bar (stamina-system.js)
**Visual indicator for player stamina**
- Vertical bar anchored to player
- Color changes: Green → Yellow → Red based on stamina level
- **Unlimited mode glow**: emissiveIntensity = 3.0 (bright green)
- Auto-hides when stamina full and not in use

**Colors & Intensity:**
- Full/Regenerating: `#00ff00`, intensity 0.2
- Medium: `#ffff00`, intensity 0.2
- Low: `#ff0000`, intensity 0.2
- Unlimited Mode: `#00ff00`, intensity 3.0

### 2. Stamina Potion (stamina-potion-simple.js)
**Consumable item for unlimited stamina**

**Features:**
- Subtle heal.js style particles (active when potion visible)
- Floating bobbing animation (gentle up/down motion)
- Simple LOD visibility toggling (collect/hide, respawn/show)
- Configurable boost duration and respawn time

**Particle Effect:**
```javascript
// Active when potion can be collected
size: '0.015'      // Very small for subtlety
rate: 15           // Moderate emission
emissive: '100'    // Subtle glow
color: '#00ff00'   // Green stamina theme
velocityOrbital: new Vector3(0, 0.3, 0)  // Gentle orbit
```

**Bobbing Animation:**
```javascript
// Gentle floating when visible
amplitude: 0.05    // ±5cm up/down
speed: 1.5         // 1.5 cycles per second
animation: sin() based for smooth motion
```

**State Management:**

| State | LOD | Particles | Bobbing | Collectible |
|-------|-----|-----------|---------|-------------|
| Visible | ✓ Active | ✓ Active | ✓ Running | ✓ Yes |
| Collected | ✗ Hidden | ✗ Hidden | ✗ Paused | ✗ No |
| Respawned | ✓ Active | ✓ Active | ✓ Running | ✓ Yes |

**Collection Flow:**
1. Potion visible with particles and bobbing
2. Player enters trigger area
3. LOD and particles disappear
4. Player receives unlimited stamina (boost)
5. Stamina bar glows bright green
6. After boost duration, bar returns to normal
7. After respawn time, potion returns with particles and bobbing
8. Can be collected again

## Usage

### Setup Stamina System:
```javascript
world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    showStaminaBar: true,
    showBarObjects: true
  }
})
```

### Add Stamina Potion:
```javascript
world.create('app', {
  src: '/examples/essentials/stamina-potion-simple.js',
  config: {
    boostDuration: 10,  // 10 seconds unlimited stamina
    respawnTime: 30     // 30 seconds before respawn
  }
})
```

## Technical Details

### State Synchronization
- Single source of truth (client-side state)
- No server/client desync issues
- Simple boolean + timer logic

### Performance
- Particles: Created once, reused
- Bobbing: Simple sin() math
- Memory: No allocations in update loop
- Cleanup: Automatic via Hyperfy particle system

### Requirements
**Potion .glb must contain:**
- LOD mesh (visible potion)
- AreaTrigger (invisible collision)

## Testing Checklist
- [ ] Potion visible with green particles floating
- [ ] Potion gently bobs up/down (±5cm)
- [ ] Potion disappears when collected
- [ ] Green stamina bar glows brightly (intensity 3.0)
- [ ] Stamina unlimited for configured duration
- [ ] After duration, bar returns to normal
- [ ] After respawn time, potion reappears
- [ ] Particles resume when potion respawns
- [ ] Bobbing resumes when potion respawns
- [ ] Can collect potion multiple times

## Files Modified
- `/examples/essentials/stamina-system.js` - Stamina bar with emissive glow
- `/examples/essentials/stamina-potion-simple.js` - Potion with particles & bobbing
- `/examples/essentials/STAMINA_POTION_FINAL.md` - Complete documentation

## Benefits
1. Clear visual feedback for stamina state
2. Engaging collectible with particles and animation
3. Performance optimized (no continuous overhead)
4. Simple state management (no sync issues)
5. Consistent with Hyperfy patterns
6. Fully configurable
