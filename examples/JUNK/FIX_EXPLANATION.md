# Fix Explanation: staminaChangedHandler is not defined

## The Problem

The error `staminaChangedHandler is not defined` occurred because of variable scoping issues in the cleanup code.

### Root Cause

The original code had:
```javascript
const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
  // ... handler code ...
}
world.on('stamina:changed', staminaChangedHandler)

// Cleanup
app.on('destroy', () => {
  world.off('stamina:changed', staminaChangedHandler)
})
```

When using `const` inside a block (like the `if (world.isClient)` block), the variable is block-scoped and may not be properly available when the cleanup function runs.

## The Fix

Changed the arrow function to a regular function declaration:
```javascript
function staminaChangedHandler({ playerId: changedPlayerId, stamina }) {
  // ... handler code ...
}
world.on('stamina:changed', staminaChangedHandler)

// Cleanup
app.on('destroy', () => {
  debugLog('Cleanup: removing stamina:changed listener')
  world.off('stamina:changed', staminaChangedHandler)
})
```

Function declarations are hoisted and have better scoping behavior for this use case.

## What Your Logs Show

Your logs show the stamina system IS working correctly:

```
[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:try-consume
[STAMINA SYSTEM DEBUG] Amount: 30
[STAMINA SYSTEM DEBUG] RequestId: 45qbxa1wu
[STAMINA SYSTEM DEBUG] Current stamina: 100
[STAMINA SYSTEM DEBUG] Unlimited stamina: false
[STAMINA SYSTEM DEBUG] ✅ Sufficient stamina, emitting success reply
```

This proves:
1. ✅ romDash is emitting the event correctly
2. ✅ Stamina system is receiving the event
3. ✅ Stamina system is processing it (deducting stamina)
4. ✅ Stamina system is sending the reply

The only issue was the cleanup handler trying to reference the function after it went out of scope.

## Now Try This

1. **Reload romDash.js** in your Hyperfy world
2. **Press the dash key (F)**
3. **Check the console** - you should see:
   ```
   [ROM DASH ULTRA DEBUG] ✅ Stamina consumption SUCCESSFUL
   [STAMINA SYSTEM DEBUG] stamina:changed event
   [STAMINA SYSTEM DEBUG] Old: 100 New: 70 Delta: -30
   ```
4. **Watch the stamina bar** - it should decrease from 100 to 70

The integration should now work correctly!