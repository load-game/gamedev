# Bug Fix Explanation: tempEuler is not defined

## Root Cause

The `stamina-system-debug.js` file was missing the temporary variable declarations needed for the bar positioning code in the `lateUpdate` function.

## What Happened

When creating the debug version of the stamina system, the temporary vector and quaternion variables were accidentally omitted from the top of the file:

```javascript
// These were MISSING in stamina-system-debug.js:
const tempVec = new Vector3()
const tempVec2 = new Vector3()
const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const tempEuler = new Euler()
```

## Where They Are Used

These variables are used in the `lateUpdate` function to position the stamina bar relative to the player:

```javascript
app.on('lateUpdate', (delta) => {
  // ... validation code ...

  // Position bar - NEEDS the temp variables
  tempEuler.setFromQuaternion(player.quaternion, 'YXZ')
  tempQuat.setFromEuler(tempEuler)

  const forwardDir = tempVec.set(0, 0, -1).applyQuaternion(tempQuat)
  const leftDir = tempVec2.set(-1, 0, 0).applyQuaternion(tempQuat)
  const upDir = tempVec3.set(0, 1, 0).applyQuaternion(tempQuat)

  // ... more positioning code ...
})
```

## The Fix

Added the missing variable declarations at the top of the file (after the constants but before `app.configure()`):

```javascript
// Temporary vectors for positioning
const tempVec = new Vector3()
const tempVec2 = new Vector3()
const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const tempEuler = new Euler()
```

## Why It Was Working Before

You mentioned "it was working before but we've changed something" - this is because:

1. The original `stamina-system.js` had these variables declared
2. When I created `stamina-system-debug.js`, I accidentally omitted them
3. The crash only happens when `lateUpdate` runs (which is after initialization)

## Verification

The fix has been applied to `examples/essentials/stamina-system-debug.js`. The file should now:
- Initialize without errors
- Properly position the stamina bar
- Continue to provide debug logging
- Work correctly with `romDash-ultra-debug.js`

## Next Steps

1. **Reload the stamina-system-debug.js** script in Hyperfy
2. **Check the console** for initialization messages
3. **Press the dash key** to test the full flow
4. **Look for the stamina bar** above your character
5. **Verify stamina decreases** when you dash

The debug logging will show you every step of the process to help identify any remaining issues.