# Test Now: romDash + stamina-system Integration

## ✅ READY TO TEST

The integration is now fixed using the working pattern from `oldromDash.js`.

## Quick Test Steps

### 1. Load Scripts

In your Hyperfy world, use:
- `examples/ROMs/romDash.js` (or romDash-ultra-debug.js for detailed logs)
- `examples/essentials/stamina-system.js` (or stamina-system-debug.js)

### 2. Open Console

Press **F12** → Click **Console** tab

### 3. Test Dash

Press **F key** (or your configured dash key)

### 4. Verify

**You should see:**
- ✅ Console shows "KEY PRESS DETECTED"
- ✅ Stamina decreases from 100 to 70
- ✅ Green stamina bar appears above character
- ✅ Stamina regenerates over ~5 seconds
- ✅ No errors in console (especially no ReferenceError)

## Console Output (Success)

```
[Dash ROM] Initializing with dash key: keyF
[Stamina System] === STAMINA SYSTEM INITIALIZING ===
[Dash ROM] ✅ Successfully captured key: keyF
[Stamina System] Player ID: player_xxxxxxxx
[Stamina System] ✅ FULLY INITIALIZED

[User presses F]

[Dash ROM] 🎮 KEY PRESS DETECTED! Calling charge()
[Dash ROM] Checking stamina - cost: 30, current: 100
[Stamina System] 📥 EVENT RECEIVED: stamina:try-consume
[Stamina System] Amount: 30, Current stamina: 100
[Stamina System] ✅ Sufficient stamina, emitting success reply
[Dash ROM] ✅ Stamina consumption SUCCESSFUL
[Stamina System] 📊 Old: 100 New: 70 Delta: -30
[Dash ROM] 📡 EVENT RECEIVED: stamina:changed
[Dash ROM] 📊 Updated currentStamina to: 70

[Regeneration over time]

[Stamina System] 📊 Regenerating: 70 → 71 → 72 → ... → 100
```

## If Stamina System Not Responding

If you don't see the stamina system responding:

1. **Check both scripts are loaded** on the same player entity
2. **Use debug versions** for more detailed logging:
   - `examples/ROMs/romDash-ultra-debug.js`
   - `examples/essentials/stamina-system-debug.js`
3. **Check console** for any red errors
4. **Verify player IDs match** in both scripts' logs

## If You See Errors

**ReferenceError: staminaChangedHandler is not defined**
- ❌ Old version still cached
- **Fix:** Hard refresh (Ctrl+Shift+R) and reload scripts

**No stamina bar visible**
- ❌ `showStaminaBar` config may be disabled
- **Fix:** Check config in Hyperfy editor, ensure it's enabled

**Key press not detected**
- ❌ Control object not available
- **Fix:** Click in game window to focus, then try again

**No event communication**
- ❌ Scripts not on same entity
- **Fix:** Ensure both scripts are on the player (not world)

## Test Blueprint Operations

After confirming it works:

1. **Save blueprint** - should see no errors
2. **Modify blueprint** - should see no errors
3. **Reload world** - should work normally

If you see errors during these operations, the scope fix didn't work - let me know!

## Success Criteria

✅ **All working if:**
- Dash key triggers dash
- Stamina decreases correctly
- Stamina bar appears and updates
- Stamina regenerates over time
- No console errors
- Blueprint operations work without errors

## Next Steps

If working: Disable debug mode or use non-debug versions for production.

If not working: Share console output and I'll diagnose!

---

**The fix ensures handler and cleanup are in same scope, matching the pattern from oldromDash.js that was proven to work.**

Test it now! 🚀