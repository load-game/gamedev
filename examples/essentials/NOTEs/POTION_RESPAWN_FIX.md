# Stamina Potion Respawn Fix

## Problem
The stamina potion only worked once - after collecting it and waiting for respawn, it could not be collected again.

## Root Cause
When a player stayed inside the trigger area during respawn, the `onTriggerEnter` event would not fire again because:
1. `onTriggerEnter` only fires when entering a trigger, not when already inside
2. The player never left the trigger volume, so no re-entry event occurred
3. The AreaTrigger state was not reset after respawn

## Solution
Added AreaTrigger reset when potion respawns:

```javascript
// When respawn timer expires:
if (body) {
  body.collisionEnabled = false
  setTimeout(() => {
    body.collisionEnabled = true
    debugLog('✅ AreaTrigger reset - players can now re-enter')
  }, 100)
}
```

This forces the physics engine to re-evaluate collisions, causing `onTriggerEnter` to fire for any players still inside the trigger area.

## Changes Made

### 1. `/examples/essentials/stamina-boost-potion.js`

#### Fixed State Management
- ✅ State now server-authoritative (wrapped in `world.isServer` checks)
- ✅ Added AreaTrigger reset on respawn (lines 99-105)
- ✅ Consolidated event emissions in `collectPotion` function
- ✅ Moved respawn logic to server-only code path
- ✅ Added periodic status logging for debugging

#### Key Fixes:
```javascript
// Server-only state management
app.on('update', (dt) => {
  if (world.isServer && isCollected) {  // Only server runs this
    // ... respawn logic ...
    if (respawnTimer <= 0) {
      // Reset trigger
      body.collisionEnabled = false
      setTimeout(() => {
        body.collisionEnabled = true  // Re-enable to fire events
      }, 100)
    }
  }
})

// All trigger logic in one place
function collectPotion(playerId) {
  // ... collection logic ...
  if (world.isServer) {
    world.emit('potion:hide', { potionId: app.id })
  }
}
```

### 2. `/examples/essentials/test-potion-respawn.js` (New)
- ✅ Created comprehensive test script
- ✅ Tracks collection count and timing
- ✅ Logs all potion-related events
- ✅ Provides clear success/failure indicators

## How It Works Now

1. **Player enters trigger** → `onTriggerEnter` fires
2. **Collect potion**:
   - Server sets `isCollected = true`
   - Emits `potion:hide` to all clients
   - Starts respawn timer
3. **Respawn timer counts down** (server-only)
4. **When timer expires**:
   - Server sets `isCollected = false`
   - **Reset AreaTrigger** (NEW!)
   - Emits `potion:show` to all clients
5. **Player can collect again**:
   - If still inside trigger: `onTriggerEnter` fires due to reset
   - If left and re-entered: `onTriggerEnter` fires normally

## Testing

### Quick Test
1. Add potion to world with debugMode enabled
2. Walk into trigger → check logs for collection
3. Stay inside trigger area
4. Wait for respawn → check logs for reset
5. Should automatically collect again (if still inside)

### Using Test Script
```javascript
// Add to world:
world.create('app', {
  src: '/examples/essentials/test-potion-respawn.js'
})
```

**Expected console output:**
```
[Potion Respawn Test] COLLECTION #1 at 0.5s
[Stamina Potion] Respawn timer: 29.0 seconds remaining
...
[Stamina Potion] POTION RESPAWNED
[Stamina Potion] AreaTrigger reset - players can now re-enter
[Potion Respawn Test] Potion visible at 30.2s
[Potion Respawn Test] COLLECTION #2 at 30.5s  ✅
[Potion Respawn Test] TEST PASSED
```

## Console Logs to Expect

**First Collection:**
```
[Stamina Potion] TRIGGER ENTERED
[Stamina Potion] Potion collected by player player_123
[Stamina Potion] Starting boost with duration: 10 seconds
[Stamina Potion] Applied unlimited stamina for 10 seconds
[Stamina Potion] Emitted potion:hide event to all clients
```

**Respawn:**
```
[Stamina Potion] Respawn timer: 5.0 seconds remaining
[Stamina Potion] Respawn timer: 4.0 seconds remaining
...
[Stamina Potion] POTION RESPAWNED - isCollected is now false
[Stamina Potion] AreaTrigger reset - players can now re-enter
[Stamina Potion] Emitted potion:show event to all clients
```

**Second Collection:**
```
[Stamina Potion] TRIGGER ENTERED
[Stamina Potion] Potion collected by player player_123
... (same as first collection)
```

## Verification Steps

1. **Add potion** with short respawn time for testing:
   ```javascript
   world.create('app', {
     src: '/examples/essentials/stamina-boost-potion.js',
     config: {
       boostDuration: 10,
       respawnDelay: 5,  // Short for testing
       debugMode: true
     }
   })
   ```

2. **Enable test logging**:
   ```javascript
   world.create('app', {
     src: '/examples/essentials/test-potion-respawn.js'
   })
   ```

3. **Collect potion** and wait inside trigger area

4. **Verify**: Second collection should happen automatically

## Common Issues

**Potion still only works once?**
- Check console for "AreaTrigger reset" log
- Verify trigger is named "AreaTrigger" in .glb
- Ensure `app.keepActive = true` is set
- Confirm no errors in console

**Trigger not re-firing?**
- The 100ms delay should be sufficient
- Check if `body` exists before resetting
- Verify `collisionEnabled` is the correct property

**State out of sync?**
- All state changes now server-only ✅
- Events properly emitted to clients ✅
- Check network panel for event delivery

## Technical Details

### Why the 100ms delay?
The `setTimeout` with 100ms delay ensures:
1. Trigger is fully disabled before re-enabling
2. Physics engine has time to process the change
3. All clients receive the update before re-triggering

### Event Flow
```
Server (Authority)
  ↓ isCollected = true
Emit: potion:hide → All Clients sync visibility
  ↓ Wait respawnDelay
  ↓ isCollected = false
Reset: AreaTrigger.collisionEnabled (force re-evaluation)
Emit: potion:show → All Clients sync visibility

Client (Visual)
  ← Receive potion:hide
Update: sphere.visible = false
  ← Receive potion:show
Update: sphere.visible = true
```

## Performance Impact
- **Negligible** - Only one timer check per frame per potion
- **Network** - 2 events per collection (hide/show)
- **Physics** - Brief trigger disable/enable on respawn only
