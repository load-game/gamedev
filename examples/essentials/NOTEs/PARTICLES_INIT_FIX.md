# Particles Initialization Fix

## Problem
`ReferenceError: Cannot access 'particles' before initialization`

This occurred because particles were being accessed before they were fully initialized.

## Root Cause
The `particles` variable was being accessed in the `collect()` function and `update` loop before it was assigned a value by `createPotionParticles()`.

## Solution

### 1. Delayed Initialization
Moved particle creation to after configure() and wrapped in setTimeout:

```javascript
// Initialize particles after a short delay to ensure everything is loaded
app.setTimeout(() => {
  if (!particles && lod && lod.position) {
    particles = createPotionParticles()
    console.log('[Stamina Potion] Particles created and active')
  }
}, 100)
```

### 2. Added Null Checks
Protected all accesses to particles:

```javascript
// In collect()
if (particles) {
  particles.active = false
}

// In update() - respawn
if (particles) {
  particles.active = true
}
```

## How It Works Now

1. Script loads
2. LOD and body references obtained
3. Configure called
4. **100ms delay** - ensures LOD position is available
5. Particles created and positioned
6. Normal operation resumes

## Benefits
- No initialization race conditions
- Safe access to particles variable
- Graceful handling if particles fail to create
- Clear console logging for debugging

## Testing

1. Reload the potion script
2. Check console for: `[Stamina Potion] Particles created and active`
3. Particles should appear above potion
4. Collect potion - particles should disappear
5. Wait for respawn - particles should reappear
