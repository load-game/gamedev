# Locomotion Animation Issue

## Problem
When an animation ends (with `loop: false`), the character reverts to idle instead of resuming locomotion animations (walk, run, jump, etc.).

## Root Cause
When `player.applyEffect()` plays an animation with `loop: false`, it fades out the locomotion poses. When the animation ends, the locomotion poses should fade back in, but this transition may not be happening smoothly due to:
1. Pose fade-out happening over 0.15s
2. Timing between emote end and locomotion resume
3. The engine may need explicit re-enabling of locomotion

## Current Behavior
1. Character is walking/running (locomotion active)
2. Animation plays with `loop: false` (emote overrides locomotion)
3. Animation ends → character returns to idle T-pose
4. Expected: should resume walking/running from locomotion system

## Workaround (SES-Compatible)

Use `loop: true` with `cancellable: true` and manually stop the animation using `world.time`:

```javascript
// Instead of loop: false (breaks locomotion)
app.emit('animlib:play', {
  anim: 'vrmpistolshoot15',
  options: {
    loop: false,  // ❌ Returns to idle T-pose
    cancellable: true
  }
})

// Use this workaround (works in Hyperfy SES)
let activeAnim = null
let animEndTime = 0
let isPlaying = false

function playOnce(animId, durationMs) {
  // 1. Play with loop: true
  app.emit('animlib:play', {
    anim: animId,
    target: 'player',
    playerId: 'local',
    options: {
      loop: true,        // ✅ Keep looping
      cancellable: true  // ✅ Can be interrupted
    }
  })

  // 2. Track when to stop (using world.time)
  activeAnim = animId
  animEndTime = world.time + (durationMs / 1000)  // Convert to seconds
  isPlaying = true
}

// 3. In update() loop, check when to stop
app.on('update', (delta) => {
  if (isPlaying && activeAnim && world.time >= animEndTime) {
    const player = world.getPlayer()
    player.applyEffect(null)  // Clear animation
    isPlaying = false
    activeAnim = null
    animEndTime = 0
    console.log('Animation cleared. Locomotion should resume.')
  }
})

// Use: Play roll for 1.2 seconds
playOnce('vrmroll35', 1200)
```

**Note:** Hyperfy's SES environment doesn't provide `setTimeout`/`clearTimeout`. Using `world.time` and the `app.on('update')` loop achieves the same result with native Hyperfy APIs.

See `test-workaround-fixed.js` for a complete working example.

## Investigation Notes

The VRM engine sets `locomotionDisabled = false` when emotes end:
```javascript
// In createVRMFactory.js line 756
locomotionDisabled = false // Re-enable locomotion when emote finishes
```

The locomotion update loop should resume and fade poses back in:
```javascript
// In updateLocomotion()
for (const key in poses) {
  const pose = poses[key]
  const weight = THREE.MathUtils.lerp(pose.weight, pose.target, 1 - Math.exp(-lerpSpeed * delta))
  pose.setWeight(weight)  // Should fade in
}
```

However, the fade-in may not be working as expected, or there's a timing issue.

## Potential Engine Fix

The issue could be fixed in `/home/blank/hyperfy/src/core/extras/createVRMFactory.js` by:

1. Storing last locomotion weight before clearing
2. Explicitly fading poses back in when emote ends
3. Ensuring proper timing between fade-out and fade-in

This would require debugging the actual running VRM factory to see what's happening with pose weights when locomotion resumes.

## Test Script

Use `debug-locomotion.js` to monitor the state:

```javascript
// This script logs locomotion pose states to console
// Attach to app and watch while testing animations
```

## Summary

This is a known limitation with how animations interact with the locomotion system. The workaround is to use `loop: true` with manual stopping, which properly restores locomotion.
