# Stamina Potion Single-Use Bug - Root Cause and Fix

## Problem
The stamina potion could only be collected once. After respawning, attempting to collect it again would show:
```
[Stamina Potion] ❌ Potion already collected, ignoring trigger (isCollected=true)
```

## Root Cause Analysis
The bug was caused by **state desynchronization between client and server** due to the trigger handler running on both:

### What Was Happening:
1. **First Collection**:
   - Server: `isCollected = true`, starts respawn timer
   - Client: `isCollected = true` (from trigger handler)
   - **Both client and server set `isCollected = true`** ❌

2. **During Respawn**:
   - Server: Respawn timer decrements, eventually sets `isCollected = false`
   - Client: `isCollected` stays `true` forever (no update mechanism)
   - **Client and server states diverge** ❌

3. **Second Collection Attempt**:
   - Client: `onTriggerEnter` fires first with `isCollected = true`
   - Client logs "already collected" and returns early
   - Server never gets the trigger event
   - **Collection fails** ❌

## Solution
Made the trigger handler **server-only** to ensure single source of truth:

```javascript
// Before - Runs on both client and server
body.onTriggerEnter = (hit) => {
  // State management logic
}

// After - Server-only
if (world.isServer) {
  body.onTriggerEnter = (hit) => {
    // State management logic
  }
}
```

### Why This Works:
1. **Single source of truth**: Only server manages `isCollected` state
2. **State synchronization**: Server emits events to sync clients
3. **No race conditions**: Client can't interfere with collection logic

## Changes Made

### `/examples/essentials/stamina-boost-potion.js`

1. **Wrapped trigger handler in `world.isServer` check** (lines 108-115):
   - Ensures only server handles collection logic
   - Prevents client-side state corruption

2. **Cleaned up state management**:
   - Removed redundant logging
   - Streamlined update loop
   - Concise event emissions

3. **Maintained event-based sync**:
   - `potion:hide` - Hides potion on all clients
   - `potion:show` - Shows potion on all clients after respawn
   - `potion:collected` - Notifies other systems of collection

## Verification

### How to Test:
1. Add potion to world with debug mode:
   ```javascript
   world.create('app', {
     src: '/examples/essentials/stamina-boost-potion.js',
     config: { debugMode: true }
   })
   ```

2. Add quick test script:
   ```javascript
   world.create('app', {
     src: '/examples/essentials/test-respawn-quick.js'
   })
   ```

3. Collect potion, wait for respawn, collect again

### Expected Console Output:
```
[Stamina Potion] Potion initialized - Duration: 10 Respawn: 5
[Stamina Potion] Potion collected by player player_123 - 10 seconds unlimited stamina
[Stamina Potion] ⏱️ Respawn timer: 3.0 seconds remaining
[Stamina Potion] ⏱️ Respawn timer: 0.0 seconds remaining
[Stamina Potion] 🎉 POTION RESPAWNED - ready for collection
[Respawn Test] COLLECTION #2 at 5.5s
[Respawn Test] ✅ SUCCESS - Multiple collections work!
```

## Key Lesson
**Never run trigger handlers on both client and server** when state management is involved. Always:
1. Choose a single authority (usually server)
2. Use events to synchronize state
3. Keep client-side logic purely visual

## Files Modified
- `/examples/essentials/stamina-boost-potion.js` - Fixed trigger handler scope
- `/examples/essentials/test-respawn-quick.js` - Added simple verification test
