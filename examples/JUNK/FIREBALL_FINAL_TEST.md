# Fireball Final Test Guide - Post Syntax Fixes

## Syntax Fixes Applied

### 1. Fixed Event Listener Placement
**Problem**: `app.on('playAnimation')` and `app.on('shootTime')` event listeners were outside the `init()` method
**Fix**: Moved them inside `init()` method before it closes
**Location**: `examples/elementals/elemental-item-fireball.js` lines 539-546

### 2. Fixed Method Declaration
**Problem**: `applyExplosionDamage` had incorrect closing syntax with `});` instead of `}`
**Fix**: Changed to proper method declaration with `},`
**Location**: Line 576

### 3. Fixed Function Declaration
**Problem**: `init(_state)` was incorrectly declared as a shorthand method inside an if block
**Fix**: Changed to proper function declaration: `function init(_state) {`
**Location**: Line 956

## Current File Structure

The file now has correct JavaScript syntax with the following structure:
1. CONFIG object (top-level constants)
2. Block removal and visual setup
3. createItem() call (line 182) - creates the fireball item instance
4. Client and server methods (init, update, lateUpdate, etc.)
5. createItem() function definition (line 803) - helper for item creation

## How to Test

### Setup
1. Drop `elemental-item-fireball.js` into your world
2. Ensure `elemental-core.js` is present for inventory management
3. Ensure `elemental-combat.js` is present for damage numbers
4. Open browser console (F12) to see debug logs

### Test 1: Basic Pickup
1. Approach the fireball orb
2. Press **E** when prompted
3. **Expected**: Orb disappears from world, appears floating near player
4. **Console**: Should see `[fireball] Item held by X`, `[fireball] Local player picked up fireball`

### Test 2: Shooting Projectile
1. With fireball equipped, aim at ground 10-20 units away
2. Click left mouse button
3. **Expected**:
   - Red trail following projectile path
   - Orange explosion sphere at impact point
   - Yellow shockwave ring expanding
   - Particle burst effect
4. **Console**: Should see `[fireball] CLIENT received projectile:spawn`, `[fireball] Creating explosion`, etc.

### Test 3: Drop and Re-pickup
1. Press **Q** while holding fireball
2. **Expected**: Orb returns to spawn point
3. Walk close to orb
4. **Expected**: "Pick Up Fireball" prompt appears
5. Press **E** to pick up again
6. **Console**: Should see `[fireball] Reactivating pickup action`

### Test 4: Multiplayer
1. Have Player A pick up fireball
2. Have Player B approach same fireball
3. **Expected**: Player B can also pick up (fireball transfers)
4. Both players should be able to shoot independently
5. **Console**: Each player should see their own instance logs

### Test 5: Damage Integration
1. Shoot near another player
2. **Expected**: Damage numbers appear above damaged player
3. If mobs present (elemental-mob.js), shoot near them
4. **Expected**: Damage numbers appear above mobs
5. **Console**: Should see `[fireball] Damaging player X for Y` and damage events emitted

## Debug Commands

Open browser console and type:

```javascript
// Monitor all fireball events
world.on('elemental-item:dmg', (data) => console.log('Player damage:', data));
world.on('elemental-mob:dmg', (data) => console.log('Mob damage:', data));
world.on('elemental:explosion', (data) => console.log('Explosion:', data));

// Force actions (if needed)
app.emit('elemental-core:activate', 'fireball', player.id);
app.send('drop', {playerId: player.id});
```

## Debug Log Patterns to Expect

### On Pickup:
- `[fireball] Player already holding fireball at init` (if held on join)
- `[fireball] Item held by X`
- `[fireball] Local player picked up fireball`
- `[fireball] Setting orb opacity=1, emissive=5`

### On Shoot:
- `[fireball] Mouse left pressed - starting shoot sequence`
- `[fireball] Shoot delay complete - firing projectile`
- `[fireball] CLIENT received projectile:spawn event for id X`
- `[fireball] Creating projectile sphere size [X]`
- `[fireball] Added trail to projectile`
- `[fireball] CLIENT received explosion:spawn event`
- `[fireball] Creating explosion at [x,y,z]`

### On Drop:
- `[fireball] Q pressed, dropping fireball`
- `[fireball] Client received dropped event`
- `[fireball] Reactivating pickup action`
- `[fireball] Pickup action active state: true`

### On Damage:
- `[fireball] Checking for entities in explosion radius`
- `[fireball] Player X hit for Y damage`
- `[fireball] Damaging player X for Y` (server)

## Known Issues and Notes

1. **GLB Animation Errors**: If no shoot animation URL is configured, GLB loading may show errors. These are non-fatal and won't affect functionality.

2. **Particle Visibility**: If projectiles/explosions are invisible, check console logs to ensure they're being created with proper properties (color, emissiveIntensity, opacity).

3. **Pickup Action Refresh**: After dropping, the pickup action may take ~1 second to reappear due to timing loops.

4. **Orb Clipping**: When returning to world position, the orb may clip through geometry briefly.

5. **Multiple Instances**: Each player gets their own fireball instance. The server tracks projectiles per player.

## Integration Points

The fireball integrates with:
- **elemental-core.js**: Handles give/take/activate inventory system
- **elemental-combat.js**: Listens for `elemental-item:dmg` events to show damage numbers
- **elemental-mob.js**: Listens for `elemental-mob:dmg` and `elemental:explosion` events

No configuration needed - systems connect automatically via events.
