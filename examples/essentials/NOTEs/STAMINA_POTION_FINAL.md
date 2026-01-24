# Stamina Potion - Final Implementation

## Overview
Complete stamina potion system with particles, bobbing animation, collection effects, and respawn mechanics.

## Features

### 1. Particle Effect
- **Active when potion is available** (can be collected)
- **Hidden when potion is collected**
- **Resumes when potion respawns**
- **heal.js style** - orbital + vertical movement
- **Subtle**: Small particles (0.015), low rate (15/sec)
- **Self-cleaning**: Persists across state changes

### Configuration:
```javascript
size: '0.015',    // Very small
rate: 15,         // Moderate emission
emissive: '100',  // Subtle glow
life: '2',        // 2 second lifespan
speed: '0.5',     // Slow movement
velocityOrbital: new Vector3(0, 0.3, 0)  // Orbit around Y
```

### 2. Bobbing Animation
- **Active when potion is visible**
- **Stops when collected**
- **Resumes when respawns**
- **Gentle floating**: 5cm up/down, 1.5 cycles/sec

### Animation Logic:
```javascript
if (!isCollected && body.position) {
  bobTime += dt * bobSpeed
  const bobOffset = Math.sin(bobTime) * bobAmplitude
  body.position.y = initialY + bobOffset
}
```

### 3. Collection & Respawn
**Collection:**
```javascript
// When player enters trigger:
isCollected = true
lod.active = false          // Hide potion
particles.active = false    // Hide particles
// Give unlimited stamina
```

**Respawn:**
```javascript
// After respawnTime seconds:
isCollected = false
lod.active = true           // Show potion
particles.active = true     // Show particles
bobTime continues...        // Resume bobbing
```

## Complete State Flow

1. **Initial State** (`!isCollected`)
   - LOD visible ✓
   - Particles active ✓
   - Bobbing ✓
   - Can be collected ✓

2. **Collected** (`isCollected = true`)
   - LOD hidden ✓
   - Particles hidden ✓
   - Bobbing stopped ✓
   - Stamina boost given ✓
   - Respawn timer starts ✓

3. **Respawning** (`isCollected = false` after timer)
   - LOD visible ✓
   - Particles active ✓
   - Bobbing resumes ✓
   - Can be collected again ✓

## State Sync

| State | LOD | Particles | Bobbing | Action |
|-------|-----|-----------|---------|--------|
| Visible | ✓ Active | ✓ Active | ✓ Running | Can collect |
| Collected | ✗ Hidden | ✗ Hidden | ✗ Paused | Stamina boost |
| Respawned | ✓ Active | ✓ Active | ✓ Running | Can collect |

## Code Structure

```javascript
// Initialize
particles = createPotionParticles()

// Update loop
app.on('update', (dt) => {
  // Handle respawn
  if (isCollected && respawnTimer <= 0) {
    isCollected = false
    lod.active = true
    particles.active = true  // Show particles
  }

  // Bob when visible
  if (!isCollected) {
    bobAnimation()
  }
})

// On collection
function collect() {
  isCollected = true
  lod.active = false
  particles.active = false  // Hide particles
}
```

## Performance

- **Particles**: Created once, reused across states
- **Bobbing**: Simple sin() calculation, no allocations
- **Memory**: No leaks, all references maintained
- **CPU**: Minimal impact, only when visible

## Testing

Full test sequence:
1. ✅ Potion visible with particles and bobbing
2. ✅ Walk into trigger
3. ✅ Potion and particles disappear
4. ✅ Green stamina bar glow
5. ✅ Stamina unlimited for duration
6. ✅ Wait for respawn
7. ✅ Potion returns with particles and bobbing
8. ✅ Can collect again

## Configuration

```javascript
world.create('app', {
  src: '/examples/essentials/stamina-potion-simple.js',
  config: {
    boostDuration: 10,  // 10 seconds unlimited stamina
    respawnTime: 30     // 30 seconds before respawn
  }
})
```

## Dependencies

**Required nodes in .glb:**
- LOD (visible potion mesh)
- AreaTrigger (invisible collision)

**Optional configurations:**
- Adjust bobAmplitude for more/less bobbing
- Adjust bobSpeed for faster/slower bobbing
- Adjust particle parameters for different effects
