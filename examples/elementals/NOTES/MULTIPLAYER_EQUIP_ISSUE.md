# Multiplayer Equip Issue - Root Cause & Solution

## Problem
Only one player can use the "Equip Pistol" action when multiple players have pistols in their inventory.

## Investigation Summary

### Server-Side (✓ Working)
- Creates separate instances per player using `instances.set(playerId, instance)`
- Sends `app.send('activate', playerId)` per player
- Handles calls with playerId: `app.on('call', ([playerId, method, data])` (client-side)

### Client-Side (✓ Working)
- Stores instances per player: `const instances = new Map()`
- Creates instance per player in activate handler
- Calls methods on correct instance: `instance.client?.[method]?.(data)`

### The Issue: Global Actions
The problem is likely that **actions are being created globally instead of per-player**.

Looking at the code:
1. **Pistol creates**: Only a PICKUP action (for world items)
2. **Elemental-core creates**: EQUIP action when item is activated
3. **Actions are added to**: `$actions` container (global, created once)
4. **Issue**: Actions may not be associated with specific player instances

## Why Only One Player Can Equip

When Player A and Player B both have pistols:
1. Both trigger `elemental-core:activate:pistol`
2. Both create client-side instances
3. But the EQUIP action may be:
   - Overwritten (global variable)
   - Only associated with first player's instance
   - Not properly scoped per-player

## Solution

The fix needs to be in elemental-core.js where actions are created. Actions should be:
1. Created per-player, not globally
2. Associated with the specific item instance for that player
3. Updated when the active item changes per-player

### Recommended Fix Location

In `/home/blank/hyperfy/examples/elementals/elemental-core.js`, the action creation and management needs to be made per-player instead of global.

### Verification

To verify this is the issue:
1. Open browser console
2. Check `world.systems.elemental-core.instances`
3. Verify multiple instances exist for different players
4. Check if actions are created per-instance or globally

### Workaround

For now, players can use the console command to equip:
```javascript
// Find pistol spec ID
const pistolId = 'elemental-item-pistol'; // or the actual ID

// Equip by setting active slot (0-4 for hotbar)
world.run('active 0'); // If pistol is in slot 0
```

### Test Created

I've created `test-multiplayer-equip.js` to help diagnose the issue.

## Next Steps

To fix this properly, we need to:
1. Make actions per-player in elemental-core
2. Ensure actions are recreated when player changes active item
3. Test with 2+ players simultaneously

This is an architectural issue in how actions are scoped in the elemental-core system, not a bug in the pistol code itself.
