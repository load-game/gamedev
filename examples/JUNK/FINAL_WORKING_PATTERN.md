# Working Pattern Found! - romDash + stamina-system Integration

## The Breakthrough

After reviewing the old working versions (`oldromDash.js` and `old-stamina.js`), I found the **key pattern** that makes it work:

## The Working Pattern

```javascript
// Inside event-based initialization (getStamina function or similar)
function getStamina() {
  // ... query initial stamina ...

  // KEY 1: Declare handler as const (or let) INSIDE this scope
  const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
    if (changedPlayerId === player.id) {
      currentStamina = stamina
    }
  }

  // KEY 2: Register handler in SAME scope
  world.on('stamina:changed', staminaChangedHandler)

  // KEY 3: Register cleanup in SAME scope (not separate!)
  app.on('destroy', () => {
    world.off('stamina:changed', staminaChangedHandler)
  })
}
```

## Why This Works

During Hyperfy's SES sandbox blueprint operations:
- Event handlers are serialized separately from main code
- When deserialized, they execute in their original scope context
- If handler and cleanup are in different scopes, the reference is lost
- When in same scope, SES maintains the proper closure

## The Broken Patterns

### ❌ Pattern 1: Top-level declaration with block-level cleanup
```javascript
let staminaChangedHandler = null  // Top level

if (world.isClient) {
  staminaChangedHandler = (data) => { ... }  // Block level
  world.on('stamina:changed', staminaChangedHandler)

  app.on('destroy', () => {
    // ERROR: Lost reference during serialization!
    world.off('stamina:changed', staminaChangedHandler)
  })
}
```

### ❌ Pattern 2: Separate scopes
```javascript
if (world.isClient) {
  function getStamina() {
    const handler = () => { ... }  // Scope A
    world.on('event', handler)
  }

  app.on('destroy', () => {
    // ERROR: Can't see handler from Scope A!
    world.off('event', ???)
  })
}
```

## Applied Fixes

Both files now use the working pattern:

### ✅ romDash.js (lines 121-132)
```javascript
// Inside getStamina() function
const staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
  debugLog('stamina:changed event received:', ...)
  if (changedPlayerId === player.id) {
    currentStamina = stamina
    debugLog('Stamina updated:', currentStamina)
  }
}
world.on('stamina:changed', staminaChangedHandler)
app.on('destroy', () => {
  debugLog('Cleanup: removing stamina:changed listener')
  world.off('stamina:changed', staminaChangedHandler)
})
```

### ✅ romDash-ultra-debug.js (lines 130-162 or 152-162)
```javascript
// Inside event-based initialization (inside else block)
const staminaChangedHandler = (data) => {
  debugLog('📡 EVENT RECEIVED: stamina:changed', data)
  if (data.playerId === player.id) {
    currentStamina = data.stamina
    debugLog('📊 Updated currentStamina to:', currentStamina)
  }
}
world.on('stamina:changed', staminaChangedHandler)
app.on('destroy', () => {
  world.off('stamina:changed', staminaChangedHandler)
})
```

## What to Test

1. **Reload both scripts** in Hyperfy:
   - `examples/ROMs/romDash.js`
   - `examples/essentials/stamina-system.js` (or stamina-system-debug.js)

2. **Test the flow**:
   - Open console (F12)
   - Press F to dash
   - Should see stamina decrease: 100 → 70
   - Should see stamina bar appear
   - Should see stamina regenerate over ~5 seconds

3. **Test blueprint operations**:
   - Save blueprint - no errors
   - Modify blueprint - no errors
   - Reload world - no errors

## Expected Console Output

```
[Dash ROM] Initializing with dash key: keyF
[Stamina System] === STAMINA SYSTEM INITIALIZING ===
[Dash ROM] ✅ Successfully captured key: keyF
[Stamina System] ✅ FULLY INITIALIZED

[Press F]

[Dash ROM] Checking stamina - cost: 30, current: 100
[Stamina System] 📥 EVENT RECEIVED: stamina:try-consume
[Stamina System] ✅ Sufficient stamina, emitting success reply
[Dash ROM] ✅ Stamina consumption SUCCESSFUL
[Stamina System] 📊 Old: 100 New: 70 Delta: -30
[Stamina System] 📊 Regenerating: 70 → 71 → 72 → ... → 100
```

## Key Takeaway

**For Hyperfy's SES sandbox: ALWAYS declare event handlers and their cleanup in the SAME SCOPE.**

This ensures proper closure preservation during blueprint serialization/deserialization.

## Files Updated

- `examples/ROMs/romDash.js` ✅ Now uses working pattern
- `examples/ROMs/romDash-ultra-debug.js` ✅ Now uses working pattern
- `examples/ROMs/romDash-TEMP-FIX.js` ✅ Example using working pattern

The integration should now work without any ReferenceErrors!