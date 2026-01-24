# Stamina Potion Trigger Fix

## Problem
The stamina potion trigger wasn't responding when players collided with it, even though it had the same node setup as `platform-switcher.js`.

## Root Cause
The trigger handler was wrapped in a `world.isServer` check, which prevented it from being assigned properly. In Hyperfy, `onTriggerEnter` should be assigned directly without server/client conditionals.

## Solution
Changed the trigger assignment pattern to match `platform-switcher.js`:

### Before (Not Working)
```javascript
if (world.isServer) {
  body.onTriggerEnter = (hit) => {
    // handler code
  }
}
```

### After (Working)
```javascript
app.keepActive = true

body.onTriggerEnter = (hit) => {
  // handler code
}
```

## Changes Made

### 1. stamina-boost-potion.js
- ✅ Removed `world.isServer` wrapper around trigger assignment
- ✅ Added `app.keepActive = true` to ensure app stays active
- ✅ Moved update loop outside server check (handles respawn timer)
- ✅ Added sphere visibility reset when respawning

### 2. test-stamina-potion.js
- ✅ Simplified event logging (works globally, not just for local player)
- ✅ Added key T press to check stamina status on demand
- ✅ Removed complex player ID checks that could fail

## How It Works Now

1. **Player enters trigger** → `onTriggerEnter` fires immediately
2. **Handler checks**:
   - `hit.playerId` exists (player triggered it)
   - `isCollected` is false (not on cooldown)
   - Player object exists
3. **Collects potion**:
   - Sets `isCollected = true`
   - Hides sphere: `sphere.visible = false`
   - Sets stamina to 100%
   - Activates unlimited stamina mode
   - Starts respawn timer
4. **Update loop** (runs every frame):
   - Decrements respawn timer
   - When timer expires: resets `isCollected`, shows sphere

## Testing

### Console Logs to Expect

**Trigger Entry:**
```
[Stamina Potion] Player player_123 entered trigger
[Stamina Potion] Potion collected by player player_123
```

**Unlimited Mode:**
```
[Stamina System] Unlimited stamina activated for 10 seconds
[BOOST] Unlimited stamina activated for 10s
```

**Respawn:**
```
[Stamina Potion] Potion respawned
```

### Test Commands

**Enable debug logging** in potion config:
```javascript
debugMode: true
```

**Check stamina status** (press T if test script attached):
```
[Stamina Status] Stamina: 100.0/100.0 Boost active: true Time left: 7.3s
```

## Key Differences from Platform Switcher

| Feature | Platform Switcher | Stamina Potion |
|---------|------------------|----------------|
| Trigger Assignment | Direct (no server check) | Now matches! ✅ |
| Update Loop | For platform swapping | For respawn timer |
| State Tracking | `resetTimer` | `isCollected` flag |
| keepActive | Not needed (always active) | Required for respawn |

## Files Modified

- `/examples/essentials/stamina-boost-potion.js` - Fixed trigger pattern
- `/examples/ROMs/test-stamina-potion.js` - Simplified test logging

## Verification Steps

1. Add potion to world with AreaTrigger + Sphere nodes
2. Enable debugMode in config
3. Walk player into trigger area
4. Check console for "entered trigger" log
5. Verify sphere disappears
6. Check stamina is 100% and unlimited
7. Wait for respawn delay
8. Verify sphere reappears

## Common Issues

**Trigger still not firing?**
- Verify AreaTrigger node exists and is named correctly
- Check trigger is marked as trigger (not solid collider)
- Ensure trigger volume is large enough
- Look for errors in console about missing nodes

**Potion doesn't respawn?**
- Verify update loop is running (check for respawn logs)
- Ensure respawnTimer is being decremented
- Check that `isCollected` is reset to false

**Sphere doesn't hide/show?**
- Verify sphere node is named "Sphere" in .glb
- Check `sphere.visible = false/true` is being called
- Ensure sphere exists before trying to modify it
