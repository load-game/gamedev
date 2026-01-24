# Potion Visibility Fix - Completed

## Changes Made

### 1. Increased Emissive Intensity (stamina-system.js)
Increased the stamina bar glow intensity for unlimited mode:
- **Before**: `emissiveIntensity = 1.0`
- **After**: `emissiveIntensity = 3.0`
- **Location**: Line 482
- **Effect**: Much brighter, more visible glow during unlimited stamina

```javascript
if (unlimitedStamina) {
  barFront.color = '#00ff00'
  barFront.emissive = '#00ff00'
  barFront.emissiveIntensity = 3.0  // Very bright glow
}
```

### 2. Hide LOD Mesh on Collection (stamina-potion-simple.js)
Modified the potion to hide both the Sphere and LOD mesh when collected:
- Added LOD mesh detection: `const lod = app.get('LOD')`
- On collection: `lod.active = false` (line 40)
- On respawn: `lod.active = true` (line 65)

```javascript
function collect(playerId) {
  if (isCollected) return
  isCollected = true
  sphere.scale.set(0, 0, 0)  // Hide sphere
  if (lod) lod.active = false // Hide LOD mesh
  // ... rest of collection logic
}

app.on('update', (dt) => {
  if (isCollected) {
    respawnTimer -= dt
    if (respawnTimer <= 0) {
      isCollected = false
      sphere.scale.set(1, 1, 1)  // Show sphere
      if (lod) lod.active = true // Show LOD mesh
      respawnTimer = 0
    }
  }
})
```

## Why These Changes?

### Brighter Emissive Intensity
- Makes unlimited stamina mode more obvious
- Easier to see from a distance
- Clearer visual feedback for players

### Hide LOD Mesh
- LOD mesh is the visible geometry in the .glb file
- Previously only sphere was hidden, LOD remained visible
- Now both are hidden, making collection more obvious
- Follows the fireball.js pattern more closely

## Testing

To test these changes:

1. **Add stamina system and potion to world:**
   ```javascript
   world.create('app', {
     src: '/examples/essentials/stamina-system.js'
   })

   world.create('app', {
     src: '/examples/essentials/stamina-potion-simple.js',
     config: {
       boostDuration: 10,
       respawnTime: 30
     }
   })
   ```

2. **Walk into potion:**
   - Sphere should disappear
   - LOD mesh should disappear
   - Only the AreaTrigger remains (invisible)

3. **Check stamina bar:**
   - Should glow very bright green
   - Clearly visible from distance
   - Glow remains for duration of unlimited stamina

4. **After boost ends:**
   - Bar returns to normal intensity
   - After respawn time, potion reappears fully

## Summary
- Emissive intensity increased from 1.0 to 3.0 for better visibility
- LOD mesh now properly hidden when potion is collected
- Both sphere and LOD reappear together on respawn
- More obvious collection and respawn behavior
