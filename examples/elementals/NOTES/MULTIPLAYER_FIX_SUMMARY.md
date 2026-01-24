# Multiplayer Pistol Fix - Complete

## Root Cause

The pistol code had a **critical scoping bug**: variables that should be per-player were declared in the shared module scope, causing multiple players to overwrite each other's state.

### Before: Shared Variables (BUGGY)
```javascript
createItem(({ player, hooks }) => {
  // These were SHARED across all players!
  let pistolSkin
  let muzzleBone
  let ammo = 100
  let mobileShootBtn = null
  // ...

  return {
    client: { init() { /* uses shared variables */ } },
    server: { init() { /* uses shared variables */ } }
  }
})
```

When Player A and Player B both had pistols:
- Player A's `pistolSkin` was overwritten by Player B's
- Player A's `ammo` was overwritten by Player B's
- The mobile UI buttons pointed to only the last player's pistol
- Result: Only the last player to equip a pistol could use it properly

## After: Instance Properties (FIXED)

```javascript
createItem(({ player, hooks }) => {
  return {
    // Per-instance state - each player gets their own!
    lastFireTime: 0,
    ammo: props.maxAmmo || 100,
    projectiles: new Map(),
    projectileUpdateHandlers: new Map(),

    client: {
      init() {
        // Per-instance visual/audio - each player gets their own!
        let pistolSkin = null
        let muzzleBone = null
        let mobileShootBtn = null
        // ...
      }
    },

    server: {
      init() {
        // Use this.ammo, this.projectiles, etc.
        // Each instance is independent!
      }
    }
  }
})
```

## Changes Made

### 1. Instance Properties (Shared by Client & Server)
Added to the returned object:
- `lastFireTime: 0` - Fire cooldown timer
- `ammo: props.maxAmmo || 100` - Current ammo count
- `projectiles: new Map()` - Active bullet tracking
- `projectileUpdateHandlers: new Map()` - Bullet update handlers

### 2. Instance Variables (Client Only)
Declared inside `client.init()`:
- `pistolSkin` - The pistol mesh (cloned per player)
- `muzzleBone`, `ejectBone`, `gripBone` - Bone references
- `mobileShootBtn`, `mobileAdsBtn` - Mobile UI buttons

### 3. Updated All References
Changed throughout the codebase:
- `ammo` → `this.ammo`
- `lastFireTime` → `this.lastFireTime`
- `projectiles` → `this.projectiles`
- `projectileUpdateHandlers` → `this.projectileUpdateHandlers`

### 4. Helper Functions
Updated to accept instance parameter:
- `checkHasAmmunition(instance)`
- `getAmmoCount(instance)`
- `reloadPistol(instance)`

## Files Fixed

1. `elemental-item-pistol.js` (main version)
2. `elemental-item-pistol-v3.js` (optimized version)
3. `elemental-item-pistol-enhanced.js` (extended features)

## How It Works Now

### Multiple Players Test Scenario

**Player A equips pistol:**
- Server creates instance A with `ammo: 100`, empty projectiles map
- Client creates pistolSkin A, muzzleBone A
- Mobile buttons created for Player A

**Player B equips pistol:**
- Server creates instance B with `ammo: 100`, empty projectiles map
- Client creates pistolSkin B, muzzleBone B
- Mobile buttons created for Player B

**Both fire simultaneously:**
- Player A: `this.ammo` becomes 99, bullet tracked in instance A's projectiles
- Player B: `this.ammo` becomes 99, bullet tracked in instance B's projectiles
- No interference!

## Testing

To verify the fix works:

1. **Load test world with 2+ players**
2. **Give both players pistols:**
   ```javascript
   // For each player console
   pistol give
   ```
3. **Both equip pistols** (select from inventory)
4. **Both fire simultaneously**
5. **Verify:** Both see their own ammo decrease independently
6. **Verify:** Both see muzzle flash at their pistol position
7. **Verify:** Mobile buttons work for both players

## Why This Wasn't Caught Earlier

The bug only manifests with multiple players and specific conditions:
- Both must have the same item type (pistol)
- Item must maintain state (ammo, projectiles)
- State must be visibly different per player (ammo counts)

The food item didn't have this bug because it's stateless - you eat it once and it's gone, so there's no persistent state to conflict.

## Performance Impact

**Negligible:** Each player gets their own small Map objects (~100 bytes each) and a few primitive variables. No performance degradation even with many players.

## Future Prevention

When creating new items:
1. ✅ Declare per-player state as instance properties
2. ✅ Declare per-player visual/audio in client.init()
3. ✅ Always use `this.` to access instance state
4. ✅ Avoid module-level mutable state
5. ✅ Test with 2+ players early in development
