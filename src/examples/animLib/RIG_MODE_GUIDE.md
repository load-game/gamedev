# Rig Animation Mode Guide

## Switching to Rig Animations

**Key Change:** We switched from player animations to rig animations, which work with combined GLB files.

## What Changed

### In usage.js:
- Changed from `target: 'player'` to `target: 'rig'`
- Removed options that only apply to player animations
- Now plays directly on the VrmRig SkinnedMesh

## How to Test

1. Load `usage.js` in an app
2. Press **G** to play random animations
3. Watch the **VrmRig mesh** (not your player character)
4. You should see different animations playing

## Why This Works

**Rig animations** (`rig.play({name: 'AnimationName'})`):
- ✅ Support multiple animations in one GLB
- ✅ Can play any animation by name
- ✅ Work with combined animation files

**Player animations** (`player.applyEffect({emote: url})`):
- ❌ Only play first animation in GLB
- ❌ Need separate GLB files per animation
- ❌ Designed for single-emote files

## Test Files Available

- `usage.js` - Press G for random rig animations
- `test-rig-anim.js` - Tests specific animations on rig
- `demo-rig-vs-player.js` - Shows both modes

## Example Event

```javascript
// From any app, play on the rig:
app.emit('animlib:play', {
  anim: 'vrmpistolshoot15',
  target: 'rig'  // or omit, defaults to 'rig'
})
```

## Next Steps

If rig animations work for your use case, you're all set! If you need player-specific animations, you'll need to export each animation as a separate GLB file.
