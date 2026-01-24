# romDash.js Fix Summary

## Problem: "this version does nothing"

The original `romDash.js` had several critical bugs that prevented it from working with the stamina system.

## Root Causes Identified

### 1. Missing Global Stamina Change Listener (CRITICAL)
**Location**: `romDash.js` lines 93-122

**Problem**: The `staminaChangedHandler` was defined inside the `getStamina()` function but never registered at module level. This meant:
- `currentStamina` variable was initialized to 100
- It would get the initial value correctly
- But it never updated when stamina actually changed
- Result: The sync check always passed (stamina always appeared to be 100)

**Fix**: Move the stamina change listener to the global scope with proper cleanup:
```javascript
// Listen for stamina changes to update local cache
const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
  if (changedPlayerId === player.id) {
    currentStamina = stamina
    debugLog('Stamina updated:', currentStamina)
  }
}
world.on('stamina:changed', staminaChangedHandler)

// Cleanup on destroy
app.on('destroy', () => {
  world.off('stamina:changed', staminaChangedHandler)
})
```

### 2. Wrong Event Type for Instant Action
**Location**: `romDash.js` line 183

**Problem**: Using `stamina:consume` instead of `stamina:try-consume`
- `stamina:consume`: For continuous drain (like sprinting), allows partial consumption
- `stamina:try-consume`: For instant actions (like dash), all-or-nothing

**Fix**: Change to `stamina:try-consume`:
```javascript
world.emit(`stamina:try-consume:${playerId}`, {
  amount: staminaCost,
  requestId,
  source: 'romDash',
})
```

### 3. Missing Sync Stamina Check
**Location**: `romDash.js` line 138-148

**Problem**: No immediate feedback when trying to dash without enough stamina
- Would always emit event even when stamina was clearly insufficient
- Wasted event emissions and created laggy feedback

**Fix**: Add sync check before emitting event:
```javascript
// Sync check for immediate feedback - check local cache first
if (currentStamina < staminaCost) {
  debugLog('Not enough stamina (sync check) - cost:', staminaCost, 'current:', currentStamina)
  return
}
```

### 4. Duplicate Handler (Code Quality)
**Location**: `romDash.js` lines 112-121

**Problem**: Same handler defined twice
- Once inside `getStamina()` (never used)
- Once at module level (the fix)

**Fix**: Remove redundant handler from `getStamina()`:
```javascript
// Event-based system - query initial value ONLY
const playerId = player.id
const initRequestId = Math.random().toString(36).substr(2, 9)
const initHandler = ({ stamina }) => {
  world.off(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)
  currentStamina = stamina
  debugLog('Initial stamina:', currentStamina)
}
world.emit(`stamina:query:${playerId}`, { requestId: initRequestId })
world.on(`stamina:query-reply:${playerId}:${initRequestId}`, initHandler)
```

## Additional Improvements Made

### 1. Comprehensive Debug Logging
Added debug logs at every critical point:
- Initialization
- Stamina queries
- Event emissions
- Reply handling
- Key presses
- Force application

### 2. Error Handling
- Check if control object exists
- Check if stamina system is available
- Timeout for stamina replies (500ms)
- Graceful fallback if stamina system not present

### 3. Better State Management
- Clearer variable names
- Better separation of concerns
- Proper cleanup on destroy

## Testing the Fix

### Option 1: Use the fixed version
Use `examples/ROMs/romDash-fixed.js` which includes:
- All bug fixes
- Comprehensive debug logging
- Better error handling
- Stamina system detection
- Automatic fallback mode

### Option 2: Test without stamina
Use `test-dash-basic.js` to verify basic dash works without stamina system:
- This isolates the dash functionality
- Confirms input capture works
- Verifies force application works

### Option 3: Use the updated romDash.js
The original `romDash.js` has been updated with:
- Debug mode enabled by default
- All critical bug fixes
- Enhanced logging

## Expected Behavior After Fix

1. **Initial load**:
   ```
   [Dash ROM] Initializing with dash key: keyF
   [Dash ROM] Dash key: keyF
   [Dash ROM] Captured keyF for dash
   [Dash ROM] getStamina() called
   [Dash ROM] Querying stamina with requestId: abc123...
   ```

2. **Stamina query response**:
   ```
   [Dash ROM] Initial stamina from event system: 100
   ```

3. **When pressing dash key**:
   ```
   [Dash ROM] Update - isPressed: true, lastPressed: false, dashKey: keyF
   [Dash ROM] Key pressed, calling charge()
   [Dash ROM] charge() called
   [Dash ROM] Checking stamina - cost: 30, current: 100
   [Dash ROM] Attempting dash - emitting stamina:try-consume event
   [Dash ROM] RequestId: xyz789...
   [Dash ROM] Emitting stamina:try-consume event
   [Dash ROM] Waiting for reply...
   ```

4. **Stamina reply**:
   ```
   [Dash ROM] Received reply - success: true, remaining: 70
   [Dash ROM] ✓ Stamina consumed - remaining: 70
   [Dash ROM] Dash activated! Stamina cost: 30
   [Dash ROM] Applying force: Vector3 {...}
   ```

5. **Stamina regeneration**:
   ```
   [Dash ROM] Stamina:changed event received: {...}
   [Dash ROM] Stamina updated: 85
   ```

## Files Modified/Created

1. **`examples/ROMs/romDash.js`**: Updated with fixes
2. **`examples/ROMs/romDash-fixed.js`**: New robust version
3. **`test-dash-basic.js`**: Test script without stamina
4. **`DASH_FIX_SUMMARY.md`**: This document

## Verification Checklist

- [ ] Dash works with stamina system installed
- [ ] Stamina is properly deducted
- [ ] Stamina bar updates correctly
- [ ] Can't dash when stamina is too low
- [ ] Dash regenerates with stamina system
- [ ] Works without stamina system (fallback)
- [ ] Mobile button works
- [ ] No console errors
- [ ] Debug logs show proper flow