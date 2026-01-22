# Quick Test - Combined GLB Fix

## Test Steps

1. **Restart Hyperfy**
   - Stop and restart to load the updated engine

2. **Test Direct Engine Call**
   - Create an app with `test-engine-fix.js`
   - It will test `player.applyEffect()` directly
   - Check if your player plays the test animation

3. **Test Animation Library**
   - Create an app with `usage.js`
   - Press G to play random animations
   - Should see different animations on your player
   - Not just idle (first animation)

4. **Verify**
   - Check console for `[AnimLib] Playing on player: ...`
   - Animation should match what's logged
   - Different animations should play randomly

## Expected Results

✅ **Working**: Different animations play on player (pistol, roll, jump, etc.)
❌ **Not Working**: Only idle animation plays every time

## If Not Working

1. Verify Hyperfy was restarted
2. Check browser console for errors
3. Verify GLB has multiple animations: `rig.anims.length`
4. Check engine files were modified correctly

## Success Criteria

- Combined GLB files work with player animations
- No need to split into separate GLB files
- Animation name parameter is respected
- Backward compatible with single-animation files
