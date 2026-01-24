# Stamina Boost Timer - Debugging Guide

## Issue: Boost Not Deactivating

If your stamina boost (unlimited stamina) is not turning off after the configured duration, follow these debugging steps.

## Debug Steps

### Step 1: Enable Debug Mode

In your stamina-system.js app, enable debug mode:

```javascript
app.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    debugMode: true  // Set this to true!
  }
})
```

Check console for logs like:
```
[Stamina System] Received stamina:boost:start event for player player_456
[Stamina System] Activating boost for this player - duration: 10 unlimited: true
[Stamina System] Boost activated - timer set to: 10 seconds
[Stamina System] Update loop running - boostActive: true boostTimer: 9.987 unlimited: true
[Stamina System] Boost timer decreasing: 9.987 → 9.876 delta: 0.111
[Stamina System] Boost timer decreasing: 9.876 → 9.765 delta: 0.111
... (should continue until 0)
[Stamina System] Boost timer expired! Deactivating boost
[Stamina System] Stamina boost ended - unlimited mode deactivated
```

If you see the timer decreasing, it's working correctly. If not, proceed to Step 2.

### Step 2: Check for Multiple Stamina Systems

The most common cause: Multiple stamina-system.js instances running simultaneously.

**Symptoms:**
- Timer logs show jumping values (e.g., 10 → 9.8 → 10.1 → 9.9)
- Events fire multiple times
- Boost never deactivates

**Check:**
```javascript
// In browser console, check how many stamina systems exist
world.apps.filter(app => app.src?.includes('stamina-system.js')).length
```

**Solution:**
Ensure only ONE stamina system is in your world. Remove duplicates from:
- World initialization code
- Player spawn scripts
- Other app configurations

### Step 3: Verify Timer Test

Use the provided test script to verify the timer mechanism works:

```javascript
// Add this app to test timer functionality
world.create('app', {
  src: '/examples/essentials/test-boost-timer.js'
})
```

Expected console output:
```
[Boost Timer Test] Test configured - waiting to start
[Boost Timer Test] Starting 2-second timer
[Boost Timer Test] Timer: 2.000 → 1.889 delta: 0.111
[Boost Timer Test] Timer: 1.889 → 1.778 delta: 0.111
... (continues counting down)
[Boost Timer Test] Timer finished!
```

If this works but stamina boost doesn't, the issue is in event handling.

### Step 4: Check Event Propagation

Add this debug code to verify events are firing:

```javascript
// Add to your test script or browser console
world.on('stamina:boost:start', (data) => {
  console.log('✓ boost:start event received', data)
})

world.on('stamina:boost:end', (data) => {
  console.log('✓ boost:end event received', data)
})

world.on('stamina:boost:started', (data) => {
  console.log('✓ boost:started event received', data)
})
```

Both `boost:start` and `boost:started` should fire when collecting a potion.
Only `boost:end` should fire when it expires.

If `boost:end` never fires, the timer is not expiring (bug in stamina-system.js).

### Step 5: Verify Potion Configuration

Check that duration is being set correctly:

```javascript
// In stamina-boost-potion.js, verify the config
console.log('Potion config:', {
  boostDuration: config.boostDuration,
  type: typeof config.boostDuration,
  parsed: parseFloat(config.boostDuration)
})
```

Should show:
```
Potion config: {
  boostDuration: "10",
  type: "string",
  parsed: 10
}
```

If `parsed` is NaN, the duration is invalid.

### Step 6: Check Event Listener Registration

Ensure events are registered before they're emitted:

```javascript
// In stamina-system.js, check registration order
console.log('Registering stamina:boost:start listener')
world.on(`stamina:boost:start`, ({ playerId: boostPlayerId, ... }) => {
  console.log('stamina:boost:start event received!')
  // ... handler code
})

console.log('Registered listener')
```

Should log:
```
Registering stamina:boost:start listener
Registered listener
```

If registration happens AFTER potion emission, events are missed.

### Step 7: Hard Test with Minimal Setup

Create a minimal test case:

```javascript
// Minimal stamina system test
const STAMINA_MAX = 100
let stamina = 50
let boostActive = false
let boostTimer = 0
let unlimitedStamina = false

world.on('test:boost:start', ({ duration }) => {
  console.log('Starting boost for', duration, 'seconds')
  boostActive = true
  boostTimer = duration
  unlimitedStamina = true
  stamina = STAMINA_MAX
})

app.on('update', (dt) => {
  if (boostActive) {
    boostTimer -= dt
    console.log('Timer:', boostTimer.toFixed(2))
    if (boostTimer <= 0) {
      boostActive = false
      unlimitedStamina = false
      console.log('BOOST ENDED')
    }
  }
})

// Start after 1 second
app.setTimeout(() => {
  world.emit('test:boost:start', { duration: 3 })
}, 1000)
```

This should count down from 3 to 0 and log "BOOST ENDED".

## Common Issues & Solutions

### Issue: Timer Not Decrementing
**Check:** Verify `app.on('update', ...)` is being called
**Solution:** Add `app.keepActive = true` to stamina-system.js

### Issue: Timer Jumps/Resets
**Cause:** Multiple stamina systems running
**Solution:** Ensure only one instance exists

### Issue: Events Not Received
**Check:** Event names must match exactly
**Solution:** Verify `world.emit('stamina:boost:start', ...)` and `world.on('stamina:boost:start', ...)` use same name

### Issue: Infinite Timer
**Cause:** `delta` is 0 or negative
**Solution:** Log `delta` value in update loop

### Issue: Timer Works But Boost Doesn't End
**Cause:** `unlimitedStamina` not being reset
**Solution:** Verify it's set to false in timer expiration logic

## Logging Configuration

Add to stamina-system.js for detailed logging:

```javascript
// At the top
const DEBUG = true  // Set to true for verbose logging
function debugLog(...args) {
  if (DEBUG || config.debugMode) {
    console.log('[Stamina Debug]', ...args)
  }
}

// In update loop
debugLog('Update - boostActive:', boostActive, 'timer:', boostTimer)

// In event handlers
debugLog('Event received:', eventName, data)

// In consume handlers
debugLog('Consume - unlimited:', unlimitedStamina, 'success:', success)
```

## Final Verification

Once debugged, verify with 1-second duration:

```javascript
// Set potion duration to 1 second
world.create('app', {
  src: '/examples/essentials/stamina-boost-potion.js',
  config: {
    boostDuration: 1,  // 1 second for quick testing
    debugMode: true
  }
})
```

Expected behavior:
1. Collect potion → stamina full & green bar
2. Wait 1 second → bar disappears/returns to normal
3. Sprint/dash should now consume stamina

If this works, your system is properly configured!
