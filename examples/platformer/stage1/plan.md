# 2D Fighting Stage Implementation Plan

## Overview

Build an app script that attaches to a fighting stage GLB model to create a 2D side-scrolling fighting game experience with fixed-axis camera, collision-based death zones, and spawn point management.

## GLB Node Structure (from screenshot)

- **CamRef** - Camera reference point for side-scrolling view
- **GameBound** - Container with:
  - **GmBndCol** - Collider that kills players on contact
  - **GmBndTrggr** - Trigger zone for camera activation
- **SpawnPoint** - Main spawn reference
- **SpawnPoint.001** through **SpawnPoint.004** - Individual spawn positions

## File to Create

**Location**: `/home/blank/hyperfy/examples/elementals/elemental-stage-2d.js`

## Implementation Details

### 1. App Configuration (app.configure)

```javascript
app.configure([
  // Game State Section
  { key: 'gameSection', type: 'section', label: 'Game State' },
  { key: 'gameActive', type: 'toggle', label: 'Game Active', initial: false },
  
  // Admin Test Buttons
  { key: 'testSection', type: 'section', label: 'Admin Testing' },
  { key: 'startGame', type: 'button', label: 'Start Game', onClick: () => app.send('start-game') },
  { key: 'stopGame', type: 'button', label: 'Stop Game', onClick: () => app.send('stop-game') },
  { key: 'restartGame', type: 'button', label: 'Restart Game', onClick: () => app.send('restart-game') },
  { key: 'teleportToStage', type: 'button', label: 'Teleport to Stage', onClick: () => app.send('teleport-me') },
  
  // Camera Settings
  { key: 'cameraSection', type: 'section', label: 'Camera Settings' },
  { key: 'cameraDistance', type: 'number', label: 'Camera Distance', initial: 15, min: 5, max: 50 },
  { key: 'cameraHeight', type: 'number', label: 'Camera Height', initial: 5, min: 0, max: 20 },
  { key: 'cameraFollowSpeed', type: 'range', label: 'Follow Speed', initial: 0.1, min: 0.01, max: 0.5, step: 0.01 },
])
```

### 2. Server Logic (world.isServer)

**State Management**:

- `gameActive` - Boolean tracking if game is running
- `playersInZone` - Set of player IDs currently in trigger
- `spawnPoints` - Array of spawn point positions from GLB

**Node References**:

```javascript
const camRef = app.get('CamRef')
const gameBound = app.get('GameBound')
const gmBndCol = app.get('GmBndCol')
const gmBndTrggr = app.get('GmBndTrggr')
const spawnPoints = [
  app.get('SpawnPoint'),
  app.get('SpawnPoint.001'),
  app.get('SpawnPoint.002'),
  app.get('SpawnPoint.003'),
  app.get('SpawnPoint.004')
]
```

**Collider Setup (GmBndCol)**:

- Convert to rigidbody type 'static'
- Collider should be trigger volume
- Set `onTriggerEnter` callback to kill player instantly
- Respawn player at random spawn point from array

**Trigger Setup (GmBndTrggr)**:

- Convert to trigger collider
- Track players entering/leaving zone
- `onTriggerEnter`: Add player to playersInZone set, notify clients
- `onTriggerLeave`: Remove player from set, notify clients

**Admin Commands**:

- `app.on('start-game')`: Set gameActive = true, broadcast to clients
- `app.on('stop-game')`: Set gameActive = false, clear playersInZone
- `app.on('restart-game')`: Stop then start, teleport all players to spawns
- `app.on('teleport-me')`: Teleport requesting player to random spawn

**Death/Respawn Logic**:

```javascript
gmBndCol.onTriggerEnter = (hit) => {
  if (hit.playerId) {
    const player = world.getPlayer(hit.playerId)
    player.damage(player.health) // Instant death
    // elemental-combat.js will handle respawn at spawn point
  }
}
```

### 3. Client Logic (world.isClient)

**Camera System**:

- Create custom camera node at CamRef position
- Camera is **not attached to player**
- Fixed X-axis constraint: Camera only moves left/right
- Camera always looks at local player
- Only active when player is in GmBndTrggr zone

**Camera Implementation**:

```javascript
const stageCamera = app.create('camera', {
  name: 'stage-cam-2d',
  fov: 50,
  active: false,
  attachToRig: false,
  isPlayerCamera: false,
  position: [camRef.position.x, props.cameraHeight, camRef.position.z + props.cameraDistance]
})

app.on('update', (delta) => {
  if (!isInZone || !stageCamera.active) return
  
  const localPlayer = world.getPlayer()
  const targetX = localPlayer.position.x
  
  // Smooth follow on X-axis only
  stageCamera.position.x = lerp(
    stageCamera.position.x,
    targetX,
    props.cameraFollowSpeed
  )
  
  // Always look at player
  stageCamera.lookAt([
    localPlayer.position.x,
    localPlayer.position.y + 1,
    localPlayer.position.z
  ])
})
```

**Zone Detection**:

- Listen for server messages: `app.on('player-enter-zone')` and `app.on('player-leave-zone')`
- When local player enters: Activate stageCamera
- When local player leaves: Deactivate stageCamera, return to default camera

**UI Feedback**:

- Small screen-space UI showing "2D Fight Mode Active"
- Display game state (Active/Inactive)
- Show controls reminder

### 4. Integration with Elemental Combat

**Respawn Override**:

The existing `elemental-combat.js` handles death/respawn. We need to:

- Listen for player death events
- When player dies in our zone, set custom respawn point
- Use `player.teleport()` to spawn at stage spawn points

**Event Flow**:

```javascript
world.on('health', ({ playerId, health }) => {
  if (health === 0 && playersInZone.has(playerId)) {
    // Override respawn location
    const spawnPos = getRandomSpawnPoint()
    // Store for elemental-combat to use
    app.emit('stage:override-spawn', [playerId, spawnPos])
  }
})
```

### 5. Spawn Point System

**Spawn Selection**:

- Random selection: Pick random spawn from points 001-004
- Fallback to main SpawnPoint if others unavailable
- Extract world position from GLB node transforms

**Code**:

```javascript
function getRandomSpawnPoint() {
  const validSpawns = spawnPoints.filter(sp => sp !== null)
  const randomIndex = Math.floor(Math.random() * validSpawns.length)
  const spawn = validSpawns[randomIndex]
  return spawn.position.clone()
}
```

## File Structure Pattern

Follow `elemental-item-food.js` pattern with `createItem()` wrapper but adapt for stage app:

- No `createItem()` wrapper (this is a stage, not an inventory item)
- Direct `world.isServer` / `world.isClient` blocks
- Proper cleanup in destroy handlers
- Use `app.state` for server-authoritative game state

## Testing Checklist

1. **GLB Node Detection**: Console log all found nodes (CamRef, spawns, colliders)
2. **Spawn Points**: Verify all 5 spawn points load correctly
3. **Trigger Entry**: Player enters GmBndTrggr → camera activates
4. **Camera Tracking**: Camera follows player left/right only
5. **Collider Death**: Player touches GmBndCol → dies instantly
6. **Respawn**: Player respawns at random spawn point
7. **Trigger Exit**: Player leaves zone → camera deactivates
8. **Admin Buttons**: Start/Stop/Restart all function correctly
9. **Multiple Players**: Test with 2+ players in browser tabs

## Key Technical Notes

- Camera X-axis movement: Only `camera.position.x` changes
- Camera Y/Z position: Fixed based on CamRef + config offset
- `lookAt()` target: Always player position + height offset (player.position.y + 1)
- Smooth following: Use lerp with configurable speed
- Death trigger: Instant damage(player.health) on collision
- Integration: Works alongside elemental-combat.js for death/respawn mechanics
- No physics on camera: Pure kinematic positioning

## Dependencies

- **elemental-combat.js**: For death animations and respawn system
- **elemental-core.js**: For player inventory (if needed)
- Camera node system: Built-in Hyperfy camera nodes
- Physics triggers: PhysX trigger volumes

## Expected Behavior

1. Admin clicks "Start Game"
2. Players approach stage and enter GmBndTrggr zone
3. Camera switches to 2D side-scrolling view tracking player on X-axis
4. Players fight, if pushed to GmBndCol boundary → instant death
5. Dead player respawns at random spawn point
6. Player exits zone → camera returns to normal
7. Admin clicks "Stop Game" → disables all mechanics