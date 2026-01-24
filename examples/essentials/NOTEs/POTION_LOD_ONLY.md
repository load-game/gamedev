# Stamina Potion - LOD-Only Version

## Update: Using LOD Mesh Only

### Discovery
The Sphere mesh is never visible in the potion .glb file. The only visible geometry is in the LOD group.

### Changes Made

#### stamina-potion-simple.js
Removed all sphere-related logic and now only toggles LOD visibility:

**Before:**
```javascript
const sphere = app.get('Sphere')
const lod = app.get('LOD')
sphere.scale.set(0, 0, 0)  // Hide sphere
lod.active = false         // Hide LOD
```

**After:**
```javascript
const lod = app.get('LOD')  // Only LOD is visible
lod.active = false // Hide LOD when collected
lod.active = true  // Show LOD when respawns
```

### Why This Works
- AreaTrigger provides the collision detection (always invisible)
- LOD mesh provides the visual representation (only visible mesh)
- Toggling LOD.active is sufficient for collection/respawn effect
- Simpler code, less confusion

### Behavior
1. Potion starts with LOD.active = true (visible)
2. Player enters trigger area
3. LOD.active = false (potion disappears)
4. Player gets unlimited stamina
5. After respawn time, LOD.active = true (potion reappears)

### Code Structure
```javascript
if (!world.isClient) return

const lod = app.get('LOD')
const body = app.get('AreaTrigger')

let isCollected = false
let respawnTimer = 0

function collect(playerId) {
  if (isCollected) return
  isCollected = true
  lod.active = false  // Hide potion
  // ... give unlimited stamina
  respawnTimer = config.respawnTime
}

body.onTriggerEnter = (hit) => {
  if (!hit?.playerId || isCollected) return
  collect(hit.playerId)
}

app.on('update', (dt) => {
  if (isCollected) {
    respawnTimer -= dt
    if (respawnTimer <= 0) {
      isCollected = false
      lod.active = true  // Show potion again
      respawnTimer = 0
    }
  }
})
```

## Usage
```javascript
world.create('app', {
  src: '/examples/essentials/stamina-potion-simple.js',
  config: {
    boostDuration: 10,  // 10 seconds unlimited stamina
    respawnTime: 30     // 30 seconds before respawn
  }
})
```

## Testing
1. Potion should be visible at start
2. Walk into trigger area
3. Potion should disappear completely
4. Stamina bar should glow bright green
5. After cooldown, potion reappears
6. Can be collected again
