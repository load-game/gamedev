# Multiplayer Equip Issue - Analysis

## Problem Statement
Only one player can use the action to equip the pistol. When multiple players have the pistol, only one gets the equip action.

## Investigation So Far

### Server-Side Analysis
The server correctly:
1. Creates separate instances per player in a Map: `instances.set(playerId, instance)`
2. Sends activate events per player: `app.send('activate', playerId)`
3. Handles calls with playerId: `app.on('call', ([playerId, method, data])` (client-side)

### Client-Side Analysis
The client has:
1. Instance tracking: `const instances = new Map()`
2. Activate handler: Creates instance per player
3. However, actions might be created globally

### Where Actions Are Created
The pistol creates a PICKUP action (for world items), but the EQUIP action is created by elemental-core when an item is activated.

### Potential Issue
Looking at the elemental-core.js, when `app.send('activate', playerId)` is received, it should trigger the createInstance function for that player. But there might be a global action being created instead of a per-player action.

## Next Steps
1. Check if there's a global action variable in elemental-core
2. Verify that actions are created per-player, not globally
3. Check if the issue is in how actions are displayed/associated

## Hypothesis
The issue might be that the equip action is created once globally rather than per-player instance, or there's a shared reference that's being overwritten.