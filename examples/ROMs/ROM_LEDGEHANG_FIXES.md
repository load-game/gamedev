# Wall Hang ROM - Stamina & Falling Fixes

## Issues Fixed

### 1. No Falling When Stamina Depleted ✓
**Problem**: When stamina ran out, player would just float in place instead of falling.

**Fix**: Modified `resetHangingState()` to apply downward force:
```javascript
function resetHangingState(cooldown, applyFall = false) {
  // ... existing code ...

  // Apply downward force when falling from ledge
  if (applyFall && player?.body) {
    player.push(DOWN.clone().multiplyScalar(CONFIG.dropImpulse * 2))
    debugLog('Applied downward force - falling from ledge')
  }
}
```

**Application**: Called with `applyFall = true` when:
- Stamina depleted
- Player presses 'S' to drop
- Player leaves/disconnects

### 2. Stamina Check Improved ✓
**Problem**: Initial stamina check didn't consume stamina, causing race conditions.

**Fix**: Changed to atomic `try-consume` pattern:
```javascript
// Old: Just check if currentStamina >= minimum
if (currentStamina < MIN_STAMINA_TO_HANG) return

// New: Use try-consume for atomic check
world.emit(`stamina:try-consume:${playerId}`, {
  amount: MIN_STAMINA_TO_HANG,
  requestId: tryConsumeRequestId,
})
// Proceed with hang only if successful
```

**Benefits**:
- Guaranteed atomic operation (check + consume)
- No race conditions
- Immediate feedback if insufficient stamina

### 3. Hanging Code Refactored ✓
**Problem**: Hanging logic mixed with detection code, hard to debug.

**Fix**: Extracted `startHang()` function:
```javascript
function startHang(ledgePoint, dir, wallNormal) {
  // All hang setup logic in one place
  // Clear separation of concerns
  // Debug logging for each step
}
```

## Additional Improvements

### Enhanced Debug Logging
- More detailed console output
- Stamina values formatted (1 decimal place)
- Clear indication of why hang failed
- Separate events for different failure modes

### Proper Falling Mechanics
When dropping from ledge (S key):
```javascript
// Away from wall + downward force
player.push(wallNormal * CONFIG.dropImpulse)
player.push(DOWN * CONFIG.dropImpulse * 0.5)
```

When stamina depleted:
```javascript
// Pure downward fall
player.push(DOWN * CONFIG.dropImpulse * 2)
```

## State Flow

1. **Falling Check**: Raycast for ledge ✓
2. **Stamina Check**: Try-consume MIN_STAMINA_TO_HANG ✓
3. **Start Hang**: Teleport to ledge, apply effect ✓
4. **Stamina Drain**: Consume per-frame while hanging ✓
5. **Depleted**: Apply downward force, fall ✓

## Testing Checklist
- [x] Player falls when stamina depleted
- [x] Player drops when pressing 'S'
- [x] Stamina check prevents hanging when low
- [x] Stamina drains consistently while hanging
- [x] Player can hang multiple times (if stamina allows)
- [x] Debug logs show stamina values
- [x] Debug logs show failure reasons

## Files Modified
- `/home/blank/hyperfy/examples/ROMs/romLedgeHang.js`
  - Added `resetHangingState(cooldown, applyFall)` parameter
  - Added `startHang()` function for clean separation
  - Changed stamina check to use `try-consume` pattern
  - Enhanced debug logging throughout
  - Removed duplicate code

## Summary
The wall hang ROM now has consistent stamina drain and proper falling mechanics. The try-consume pattern ensures atomic stamina checks, and downward forces are applied when stamina depletes or player drops.