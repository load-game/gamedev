# DOF ReferenceError Fix

## Issue
Hyperfy was failing to load with: `ReferenceError: targetFocus is not defined`

## Root Cause
In my previous DOF zoom fix, I introduced a `targetFocus` variable inside the dynamic DOF block, but it was being referenced outside that block. When dynamic DOF was disabled or the camera wasn't available, `targetFocus` was never defined, causing a ReferenceError.

## Solution
Initialized `targetFocus` at the beginning of the `update()` method:

```javascript
// Dynamic DOF compensation based on camera zoom (mouse scroll distance)
let targetFocus = this.targetFocusDistance // Initialize with current target

if (this.dynamicDOF && this.world.camera) {
  // ... dynamic DOF calculations ...
  targetFocus = baseFocus // or raycastDistance
  // ... rest of calculations ...
}

// Now targetFocus is always defined for smooth transition
const distanceDiff = Math.abs(targetFocus - this.currentFocusDistance)
```

## Changes Made
- **ClientCameraControls.js:186**: Added `let targetFocus = this.targetFocusDistance` initialization
- This ensures `targetFocus` is always available, whether dynamic DOF is active or not
- When dynamic DOF is active, it gets updated with calculated values
- When inactive, it uses the existing target focus distance

## Result
✅ Hyperfy should now load without ReferenceError
✅ DOF zoom fix remains intact
✅ Backward compatibility maintained for non-dynamic DOF usage

The fix ensures that the `targetFocus` variable is properly scoped and always available throughout the method execution.