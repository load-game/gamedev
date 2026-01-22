# Animation Library

Event-driven animation management for SkinnedMesh nodes.

## Quick Start

### 1. Setup in Hyperfy World

1. Create a **SkinnedMesh node** with a GLB that has animations
2. Set the node's ID (e.g., "VrmRig" - must match Blender object name)
3. Create an **App** (empty app is fine)
4. Attach `animation-library.js` script to the app
5. Configure: **Rig Node ID** = "VrmRig"
6. Done!

### 2. Configure the Library

In the animation library app settings:
- **Rig Node ID**: Enter the ID of your SkinnedMesh node (e.g., "VrmRig")
- **Debug**: Enable to see console logs

### 3. Play Animations from Any App

```javascript
// Play on the rig (recommended for combined GLB files)
app.emit('animlib:play', {
  anim: 'vrmjump30',  // Animation ID (auto-generated)
  target: 'rig'
})

// Or use the simpler version (defaults to rig)
app.emit('animlib:play', { anim: 'vrmjump30' })
```

**Why this pattern?** Like in `schizo-pc.js`, we `app.get()` the rig/node. This keeps the script separate from the model, making it easier to swap models without reconfiguring.

**Note on Player Animations:** The `target: 'player'` option now works with combined GLB files! The engine fix allows selecting specific animations by name from combined files.

## How It Works

### Animation Discovery

When the library initializes:

1. It looks up the rig/node by ID: `app.get('VrmRig')`
2. Reads the node's `.anims` property (array of animation names)
3. Generates simple IDs for each animation
4. Sets up event listeners to respond to requests
5. Ready to play!

**Example:**
- VrmRig node has GLB with: `VRM|Jump@30`, `VRM|PistolShoot@15`
- Library creates: `vrmjump30`, `vrmpistolshoot15`
- Play with: `app.emit('animlib:play', { anim: 'vrmjump30' })`

### Playing Animations

```javascript
// Query what animations are available
app.emit('animlib:query', {})

// Listen for response
world.on('animlib:available', (data) => {
  console.log('Found', data.count, 'animations on', data.rig)
  // [ {id: 'vrmjump30', name: 'VRM|Jump@30'}, ... ]
})

// Play an animation (triggered from any app)
app.emit('animlib:play', {
  anim: 'vrmjump30'  // Use the animation ID
})

// The library receives this and automatically plays it on the rig:
world.on('animlib:play') → rig.play({ name: 'VRM|Jump@30' })
```

### Event Flow

```
External App → app.emit('animlib:play', { anim: 'jump' })
             ↓
World Event Bus
             ↓
Animation Library (on app) → world.on('animlib:play') → rig.play({ name: 'Jump' })
```

## Setup Example

Let's say you have a player model:

### In Hyperfy World:

1. **Create SkinnedMesh node:**
   - Add → SkinnedMesh
   - Load your VRM/GLB (with animations)
   - Set ID to "VrmRig" (check this matches your Blender object name)

2. **Create Animation Library app:**
   - Add → App
   - Attach `animation-library.js` script
   - Configure: **Rig Node ID** = "VrmRig"
   - Enable Debug to see what's happening

3. **Create Usage app:**
   - Add → App
   - Attach `usage.js` script
   - Press **G** key to play random animations!

### From Any Other App:

```javascript
// Query animations
app.emit('animlib:query', {})

world.on('animlib:available', (data) => {
  console.log('Available on', data.rig + ':', data.count, 'animations')

  // Play first animation
  if (data.animations.length > 0) {
    app.emit('animlib:play', {
      anim: data.animations[0].id
    })
  }
})
```

## Troubleshooting

### "Rig not found: VrmRig"

- Check node's ID matches exactly (case-sensitive)
- Verify node exists in world hierarchy
- Ensure GLB is loaded on that node

### "No animations found on rig"

- Check `rig.anims` property exists
- Verify GLB/VRM has animations
- Enable debug mode to see details
- Try playing manually: `rig.play({ name: 'AnimationName' })`

### "Rig does not have a play() method"

- Node must be SkinnedMesh type
- Check `rig.type` to verify
- Regular Mesh nodes won't work

## Files

- `animation-library.js` - Main library (attach to app, configure rig ID)
- `usage.js` - Example usage (press G for random animations on rig)
- `demo-rig-vs-player.js` - Interactive demo comparing rig vs player modes
- `RIG_MODE_GUIDE.md` - Guide for using rig animations
- `README.md` - This documentation

## Playing Animations on Player vs Rig

The library supports two playback modes:

### Player Mode (Default)
Plays animations retargeted to the player character:
```javascript
app.emit('animlib:play', {
  anim: 'animation_id',
  target: 'player',      // Optional, defaults to 'player'
  playerId: 'local',     // 'local' or specific player ID
  options: {
    speed: 1.5,          // Animation speed multiplier
    gaze: true,          // Enable head tracking
    loop: false,         // Loop animation
    cancellable: true    // Can be interrupted
  }
})
```

### Rig Mode
Plays animation directly on the SkinnedMesh node:
```javascript
app.emit('animlib:play', {
  anim: 'animation_id',
  target: 'rig'          // Plays on the configured rig node
})
```

**Key Differences:**
- Player mode retargets animations to player skeleton (VRM compatible)
- Rig mode plays directly on the mesh (useful for environmental animations)
- Player mode supports URL parameters (speed, gaze, loop)
- Rig mode uses the node's built-in .play() method

## Technical Pattern

**From schizo-pc.js:**
```javascript
const screen = app.get('PCRig')    // Get the node
const anims = screen.anims         // Access animations
screen.play({ name: 'ON' })        // Play animation
```

**Same pattern here:**
```javascript
const rig = app.get('VrmRig')      // Get the node (from config)
const anims = rig.anims            // Access animations
rig.play({ name: anim.name })      // Play animation
```

## License

Part of the Hyperfy examples collection.