# SES Sandbox Fix: staminaChangedHandler Scope Issue

## The Problem

Both romDash.js versions were throwing:
```
ReferenceError: staminaChangedHandler is not defined
```

This occurred during blueprint modification/save operations in Hyperfy's SES (Secure ECMAScript) sandbox environment.

## Root Cause

The issue was caused by how SES handles function scoping during blueprint operations:

1. Functions declared with `function` keyword or `const` inside a block have block scope
2. The cleanup handler (`app.on('destroy', ...)`) is serialized as part of the blueprint
3. During blueprint operations, the scope context is lost
4. SES cannot find the referenced function when it tries to execute the cleanup

## The Fix

Changed from:
```javascript
// ❌ BROKEN - function declaration inside block
function staminaChangedHandler({ playerId: changedPlayerId, stamina }) {
  // ... handler code ...
}
world.on('stamina:changed', staminaChangedHandler)

app.on('destroy', () => {
  // ERROR: staminaChangedHandler not in scope during blueprint ops
  world.off('stamina:changed', staminaChangedHandler)
})
```

To:
```javascript
// ✅ FIXED - let declaration with arrow function
let staminaChangedHandler = null
staminaChangedHandler = ({ playerId: changedPlayerId, stamina }) => {
  // ... handler code ...
}
world.on('stamina:changed', staminaChangedHandler)

app.on('destroy', () => {
  // Arrow function captures staminaChangedHandler in scope
  if (staminaChangedHandler) {
    world.off('stamina:changed', staminaChangedHandler)
  }
})
```

## Why This Works

1. **`let` declaration** - Creates a variable in the outer scope that SES can track
2. **`null` assignment first** - Ensures variable exists before use
3. **Arrow function** - Properly captures the variable in its closure
4. **Existence check** - Defensive check prevents errors if variable is undefined

## Applied To Both Versions

- ✅ `examples/ROMs/romDash.js`
- ✅ `examples/ROMs/romDash-ultra-debug.js`

## Testing

After reloading the scripts:
1. Open Hyperfy world
2. Check console - no more ReferenceError
3. Press dash key (F)
4. Should see stamina decrease: 100 → 70
5. Stamina should regenerate over time
6. Save/modify blueprint - no errors

## SES Sandbox Considerations

When coding for Hyperfy's SES environment:
- Avoid nested function declarations that need to be serialized
- Use `let`/`var` for functions that need to be referenced in callbacks
- Arrow functions have better scope capture than function declarations
- Always check if a function exists before calling it in cleanup code

This pattern should be used for any event handlers that need to be cleaned up on destroy.