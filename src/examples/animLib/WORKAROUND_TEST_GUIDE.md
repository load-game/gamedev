# Workaround Test Instructions

## What We're Testing

The workaround for the locomotion issue: when animations end, they should return to locomotion (walk/run/jump) instead of idle T-pose.

## Test Files

- `test-workaround.js` - Implements the workaround with multiple test animations
- Press **H** (or configured key) to trigger test

## How It Works

Instead of using `loop: false` (which breaks locomotion), the workaround uses Hyperfy's update loop:

1. Play animation with `loop: true`
2. Track animation end time using `world.time`
3. In `app.on('update')`, check if time has elapsed
4. Call `player.applyEffect(null)` to clear animation
5. Locomotion should automatically resume

**Why no setTimeout?** Hyperfy's SES environment doesn't expose setTimeout/clearTimeout to app scripts. We use the update loop which is available and reliable.

## Test Instructions

1. **Attach `test-workaround.js` to an app**

2. **Press H** to cycle through test animations:
   - Roll (1.2 seconds)
   - Pistol Shoot (0.5 seconds)
   - Jump Start (1.1 seconds)
   - Spell Shoot (0.4 seconds)

3. **For each animation:**
   - Start moving (walk/run)
   - Press H while moving
   - Animation should play
   - After animation ends: **check if you resume moving**

4. **Success criteria:**
   - ✅ **Working**: You resume walking/running after animation
   - ❌ **Not working**: Frozen in idle pose

## Implementation

The key parts of the workaround (SES-compatible):

```javascript
// Track animation state (no setTimeout!)
let activeAnim = null
let animEndTime = 0
let isPlaying = false

function playOnce(animId, durationMs) {
  // 1. Play with loop: true
  app.emit('animlib:play', {
    anim: animId,
    target: 'player',
    options: {
      loop: true,        // Keep looping
      cancellable: true  // Can be interrupted
    }
  })

  // 2. Track when to stop (using world.time, not setTimeout)
  activeAnim = animId
  animEndTime = world.time + (durationMs / 1000)  // Convert to seconds
  isPlaying = true
}

// 3. In update() loop, check when to stop
app.on('update', (delta) => {
  if (isPlaying && activeAnim && world.time >= animEndTime) {
    player.applyEffect(null)  // Clear animation
    isPlaying = false
    activeAnim = null
    animEndTime = 0
    // Locomotion should automatically resume
  }
})
```

**Key points:**
- No `setTimeout`/`clearTimeout` (not available in SES)
- Uses `world.time` (always available)
- Checks in `app.on('update')` (frame-based, reliable)
- Same result as setTimeout approach

## Notes

- Animation durations are calculated from frame count (e.g., @15 = 15 frames @ 30fps = 0.5s)
- You can add more test animations to the `testAnimations` object
- The workaround is temporary until the VRM engine is fixed
