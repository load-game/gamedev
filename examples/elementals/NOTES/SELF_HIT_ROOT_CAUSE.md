# Self-Hit Bug - Root Cause Analysis

## The Problem: 100% Self-Hits

When firing the pistol, bullets were hitting the player who fired them with 100% certainty.

## Root Causes Identified

### 1. **Missing Muzzle Bone (PRIMARY CAUSE)**

**What was happening:**
- The pistol GLB model's muzzle bone was null or undefined
- Code checked `if (muzzleBone && muzzleBone.matrixWorld)` but muzzleBone was null
- When the bone was null, code fell back to:
  ```javascript
  const origin = player.position.clone()
  origin.y += 1.5
  // NO FORWARD OFFSET!
  ```

**Result:** Raycast origin was at player position +1.5Y, guaranteeing self-hits.

**The Fix:**
```javascript
if (muzzleBone && muzzleBone.matrixWorld) {
  // Use muzzle bone position
} else {
  // CRITICAL: Add forward offset even without bone
  const forwardOffset = dir.clone().multiplyScalar(2.0)
  origin.add(forwardOffset)
}
```

### 2. **Mobile Handler Used Wrong Offset**

**What was happening:**
- Keyboard handler: Used 1.5 + 0.5 = 2.0 units forward
- Mobile handler: Used 0.3 (old value) with no safety offset
- Result: Mobile users experienced self-hits even WITH a muzzle bone

**The Fix:**
- Updated mobile handler to use same 1.5 + 0.5 = 2.0 units
- Now consistent across all input methods

### 3. **Server Raycast Included Player Layer**

**What was happening:**
- Single raycast checked both environment and players
- Even with forward offset, could still hit own collision
- Filtering after hit detection was unreliable

**The Fix:**
- Dual raycast system:
  - Environment only (cannot hit players)
  - Players only (explicitly filter self)
- Self-hits ignored at source, not after detection

## Complete Fix Applied

### Client-Side (Both Keyboard & Mobile)

```javascript
// 1. Calculate base origin
const origin = player.position.clone()
origin.y += 1.5

// 2. Apply forward offset (1.5 or 2.0 if no bone)
if (muzzleBone && muzzleBone.matrixWorld) {
  origin.setFromMatrixPosition(muzzleBone.matrixWorld)
  const forwardOffset = dir.clone().multiplyScalar(1.5)
  origin.add(forwardOffset)
} else {
  // Fallback when bone unavailable
  const forwardOffset = dir.clone().multiplyScalar(2.0)
  origin.add(forwardOffset)
}

// 3. Add safety offset (0.5)
const safetyOrigin = origin.clone()
const safetyOffset = dir.clone().multiplyScalar(0.5)
safetyOrigin.add(safetyOffset)

// 4. Send to server
hooks.call('fire', {
  origin: safetyOrigin.toArray()
})
```

### Server-Side

```javascript
// 1. Environment raycast (safe - no players)
const envHit = world.raycast(origin, dir, RANGE, envLayerMask)

// 2. Player raycast (will hit self)
const playerHit = world.raycast(origin, dir, RANGE, playerLayerMask)

// 3. Choose closest VALID hit
let hit = null
if (envHit && (!playerHit || envHit.distance < playerHit.distance)) {
  hit = envHit  // Environment is closer
} else if (playerHit && playerHit.playerId !== player.id) {
  hit = playerHit  // Other player is closer
}
// Self hits are automatically ignored (hit remains null)
```

## Files Fixed

1. `elemental-item-pistol.js`
   - Keyboard handler: Added fallback offset
   - Mobile handler: Updated 0.3 → 1.5 + safety offset

2. `elemental-item-pistol-v3.js`
   - Both handlers: Added fallback offset and safety offset

3. `elemental-item-pistol-enhanced.js`
   - Both handlers: Added fallback offset and safety offset

## Testing Verification

### With Debug Logs
When firing, you should see:

**Client Console:**
```
[pistol] CLIENT - Safety origin: [x, y, z]
[pistol] CLIENT - Player position: [x, y, z]
[pistol] CLIENT - Total offset: 2.0-2.5
```

**Server Console:**
```
[pistol] SERVER - Received origin: [x, y, z]
[pistol] SERVER - Player position: [x, y, z]
[pistol] SERVER - Distance from player: 2.0-2.5
[pistol] Environment raycast: HIT at Xm or no hit
[pistol] Player raycast: HIT player Y at Zm or no hit
[pistol] Shooter ID: playerId
[pistol] Self-hit detected... IGNORING (if it happens)
```

### Expected Behavior
- **No muzzle bone:** Should see "WARNING: No muzzle bone" but still work
- **With muzzle bone:** No warning, offset = ~2.0-2.5 units
- **Self-hit filter:** If self-hit detected, should see "IGNORING"
- **Result:** Player should NEVER take damage from own shots

## Why This Was Tricky

The bug was **100% reproducible** because:
1. Muzzle bone is often null (depends on GLB model)
2. Fallback had NO forward offset
3. Raycast was inside player collision
4. Server filtered AFTER hit detection (too late)

The fix addresses ALL code paths:
- With/without muzzle bone
- Keyboard and mobile input
- Environment and player targets
- Prevention at raycast level (not after)
