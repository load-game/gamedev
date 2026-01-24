# Stamina Potion - Complete with fix for setTimeout

## Error Fixed
**TypeError#7: app.setTimeout is not a function**

## Root Cause
`app.setTimeout` does not exist in Hyperfy. The standard JavaScript `setTimeout` function must be used instead.

## Fix Applied
Changed from `app.setTimeout` to `setTimeout` in `/examples/essentials/stamina-potion-simple.js`:

```javascript
// Changed from:
app.setTimeout(() => { ... }, 100)

// To:
setTimeout(() => { ... }, 100)
```

## Current Implementation

### Features
1. **Particles** - heal.js style (active when potion visible)
2. **Bobbing animation** - Floats up/down when potion visible
3. **LOD toggling** - Simple show/hide for collection
4. **Respawn system** - Configurable cooldown timer

### State Management
- Particles persist across state changes (not recreated)
- `particles.active = true/false` toggles visibility
- Particles initialized after 100ms delay (ensures LOD position available)

### Code Highlights

```javascript
// Initialize particles safely
setTimeout(() => {
  if (!particles && lod && lod.position) {
    particles = createPotionParticles()
  }
}, 100)

// Toggle particles with potion state
function collect() {
  isCollected = true
  lod.active = false
  if (particles) particles.active = false
}

// Respawn with particles
if (respawnTimer <= 0) {
  isCollected = false
  lod.active = true
  if (particles) particles.active = true
}
```

## Testing

1. Add potion to world
2. Check console for: `[Stamina Potion] Particles created and active`
3. Particles should orbit above potion
4. Collect potion - particles disappear
5. Wait for respawn - particles reappear
6. Bobbing animation should be active when visible

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

## Files
- `/examples/essentials/stamina-potion-simple.js` - Final implementation
- `/examples/essentials/stamina-system.js` - Stamina bar with glow
- `/examples/essentials/STAMINA_POTION_FINAL.md` - Complete documentation
