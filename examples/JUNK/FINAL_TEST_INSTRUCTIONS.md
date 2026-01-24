# Test Instructions: romDash + stamina-system Integration

## Current Issue
You reported that romDash.js and romDash-fixed.js aren't decreasing stamina from stamina-system.js.

## What We've Done
Created ultra-debug versions with comprehensive logging to trace exactly where the communication breaks down.

## Files Created for Testing

### Ultra-Debug Versions (Use These First)
1. **`examples/essentials/stamina-system-debug.js`** - Debug version of stamina system
2. **`examples/ROMs/romDash-ultra-debug.js`** - Debug version of dash ROM
3. **`test-integration-debug.js`** - Standalone integration test
4. **`test-event-communication.js`** - Event communication test

### Debugging Documentation
1. **`DEBUGGING_GUIDE.md`** - Comprehensive debugging guide
2. **`INTEGRATION_TEST_QUICK_START.md`** - Quick test instructions

### Production Versions
1. **`examples/ROMs/romDash-fixed.js`** - Fixed production version
2. **`examples/ROMs/romDash.js`** - Original with debug enabled

## Step-by-Step Testing

### Step 1: Use Debug Versions

Replace your current scripts with the debug versions in Hyperfy:

**Load these scripts in your world:**
```
examples/essentials/stamina-system-debug.js
examples/ROMs/romDash-ultra-debug.js
```

**Important:** Make sure both scripts are running on the same player entity.

### Step 2: Open Browser Console

Press **F12** in your browser to open developer tools, then click the "Console" tab.

### Step 3: Look for Initialization Messages

You should see these messages in order:

**Stamina System Debug Output:**
```
[STAMINA SYSTEM DEBUG] === STAMINA SYSTEM INITIALIZING ===
[STAMINA SYSTEM DEBUG] Running on CLIENT
[STAMINA SYSTEM DEBUG] Player: {...}
[STAMINA SYSTEM DEBUG] Player ID: player_xxxxxxxx
[STAMINA SYSTEM DEBUG] Initial stamina: 100
[STAMINA SYSTEM DEBUG] Creating bar visuals...
[STAMINA SYSTEM DEBUG] Background bar created
[STAMINA SYSTEM DEBUG] Front bar created
[STAMINA SYSTEM DEBUG] Audio node created
[STAMINA SYSTEM DEBUG] Bar components activated
[STAMINA SYSTEM DEBUG] Initial visual update completed
[STAMINA SYSTEM DEBUG]
=== SETTING UP EVENT LISTENERS ===
[STAMINA SYSTEM DEBUG] Listening for: stamina:consume:player_xxxxxxxx
[STAMINA SYSTEM DEBUG] Listening for: stamina:try-consume:player_xxxxxxxx
[STAMINA SYSTEM DEBUG] Listening for: stamina:query:player_xxxxxxxx
[STAMINA SYSTEM DEBUG] Listening for: stamina:set:player_xxxxxxxx
[STAMINA SYSTEM DEBUG] Listening for: stamina:add:player_xxxxxxxx
[STAMINA SYSTEM DEBUG] ✅ All event listeners set up successfully
[STAMINA SYSTEM DEBUG] ✅ STAMINA SYSTEM FULLY INITIALIZED
[STAMINA SYSTEM DEBUG] Player ID: player_xxxxxxxx
```

**romDash Ultra Debug Output:**
```
[ROM DASH ULTRA DEBUG] === ULTRA DEBUG MODE ENABLED ===
[ROM DASH ULTRA DEBUG] === romDash.js Initializing ===
[ROM DASH ULTRA DEBUG] Config: {...}
[ROM DASH ULTRA DEBUG] Running on CLIENT
[ROM DASH ULTRA DEBUG] Player object: {...}
[ROM DASH ULTRA DEBUG] Player ID: player_xxxxxxxx
[ROM DASH ULTRA DEBUG] Control object: {...}
[ROM DASH ULTRA DEBUG] Dash key configured as: keyF
[ROM DASH ULTRA DEBUG] All control keys: ["keyW", "keyA", "keyS", "keyD", ...]
[ROM DASH ULTRA DEBUG] Key-specific object: {capture: false, pressed: false, ...}
[ROM DASH ULTRA DEBUG] ✅ Successfully captured key: keyF
[ROM DASH ULTRA DEBUG] Checking for combined stamina API...
[ROM DASH ULTRA DEBUG] app.stamina: undefined
[ROM DASH ULTRA DEBUG] ℹ Will attempt event-based communication
[ROM DASH ULTRA DEBUG]
=== SETTING UP STAMINA EVENT MONITORS ===
[ROM DASH ULTRA DEBUG]
=== QUERYING INITIAL STAMINA ===
[ROM DASH ULTRA DEBUG] Emitting stamina:query with requestId: abc123...
[ROM DASH ULTRA DEBUG] Setting up listener for: stamina:query-reply:player_xxxxxxxx:abc123...
```

### Step 4: Verify Stamina Query Response

Within 1-2 seconds, you should see:

```
[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:query
[STAMINA SYSTEM DEBUG] RequestId: abc123...
[STAMINA SYSTEM DEBUG] Current stamina: 100
[STAMINA SYSTEM DEBUG] Emitting reply with stamina data

[ROM DASH ULTRA DEBUG]
📡 QUERY REPLY RECEIVED:
{ stamina: 100, maxStamina: 100, percent: 1 }
[ROM DASH ULTRA DEBUG] ✅ Stamina system confirmed working!
[ROM DASH ULTRA DEBUG] Initial stamina value: 100
```

**If you DON'T see the reply:**
- Check that both scripts are on the same player entity
- Look for any red errors in console
- Verify the player IDs match exactly

### Step 5: Test Dash Functionality

Press the **F key** (or your configured dash key).

**You should see:**

```
[ROM DASH ULTRA DEBUG] 🔄 Update - isPressed: true, lastPressed: false, dashKey: keyF
[ROM DASH ULTRA DEBUG] 🎮 KEY PRESS DETECTED! Calling charge()
[ROM DASH ULTRA DEBUG]
=== CHARGE() CALLED ===
[ROM DASH ULTRA DEBUG] State: canDash = true, hasEffect = false
[ROM DASH ULTRA DEBUG] Stamina check - cost: 30, current: 100
[ROM DASH ULTRA DEBUG] Attempting dash - emitting stamina:try-consume event
[ROM DASH ULTRA DEBUG] Request ID: def456...
[ROM DASH ULTRA DEBUG] Player ID: player_xxxxxxxx
[ROM DASH ULTRA DEBUG] Amount: 30
[ROM DASH ULTRA DEBUG] Setting up listener for: stamina:try-consume-reply:player_xxxxxxxx:def456...
[ROM DASH ULTRA DEBUG] Emitting event: stamina:try-consume:player_xxxxxxxx
[ROM DASH ULTRA DEBUG] Event emitted, waiting for reply...
[ROM DASH ULTRA DEBUG] Waiting for reply...
```

Then within milliseconds:

```
[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:try-consume
[STAMINA SYSTEM DEBUG] Amount: 30
[STAMINA SYSTEM DEBUG] RequestId: def456...
[STAMINA SYSTEM DEBUG] Current stamina: 100
[STAMINA SYSTEM DEBUG] Unlimited stamina: false
[STAMINA SYSTEM DEBUG] ✅ Sufficient stamina, emitting success reply

[ROM DASH ULTRA DEBUG]
=== REPLY RECEIVED ===
[ROM DASH ULTRA DEBUG] Full data: { success: true, remaining: 100 }
[ROM DASH ULTRA DEBUG] Success: true
[ROM DASH ULTRA DEBUG] Remaining: 100
[ROM DASH ULTRA DEBUG] ✅ Stamina consumption SUCCESSFUL
[ROM DASH ULTRA DEBUG] → performDash() called
[ROM DASH ULTRA DEBUG] → Applying force to player: Vector3 {...}
[ROM DASH ULTRA DEBUG] → Effect ended, canDash = true

[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:try-consume
[STAMINA SYSTEM DEBUG] Emitting stamina:changed event
[STAMINA SYSTEM DEBUG] Old: 100 New: 70 Delta: -30
```

Then you should see the stamina bar update and regeneration begin:

```
[STAMINA SYSTEM DEBUG] Regenerating stamina
[STAMINA SYSTEM DEBUG] Old: 70 New: 71 Delta: 1
[ROM DASH ULTRA DEBUG] 📡 EVENT RECEIVED: stamina:changed
[ROM DASH ULTRA DEBUG] 📊 Updated currentStamina to: 71
```

### Step 6: Verify Stamina Bar Visuals

You should see:
1. **Green stamina bar** appears above your character
2. **Bar decreases** from full to ~70% after dash
3. **Bar slowly refills** over ~5 seconds
4. **Bar disappears** when stamina is full

## Common Issues

### Issue 1: No Stamina Query Reply

**Symptoms:**
- Stamina system initializes
- romDash queries stamina
- No reply received

**Solution:**
Check that player IDs match exactly in both scripts.

### Issue 2: No Reply to Dash Attempt

**Symptoms:**
- Dash query works
- Dash attempt emits event
- No reply received

**Solution:**
Check that the event names match exactly:
- romDash emits: `stamina:try-consume:${player.id}`
- stamina-system listens: `stamina:try-consume:${playerId}`

### Issue 3: Keys Not Working

**Symptoms:**
- "✗ FAILED to capture key: keyF"
- Pressing key does nothing

**Solution:**
1. Click in the game window to focus
2. Check available keys in console
3. Try a different key

### Issue 4: Stamina Bar Missing

**Symptoms:**
- Stamina decreases in console
- No visual bar appears

**Solution:**
1. Check `showStaminaBar` is enabled
2. Check `showBarObjects` is enabled
3. Look for bar positioning errors in console

## What to Report Back

After testing with the debug versions, tell me:

1. **Do both scripts initialize?**
   - Do you see both "INITIALIZING" messages?

2. **Does stamina query work?**
   - Do you see the query response with stamina: 100?

3. **Does key press register?**
   - Do you see "KEY PRESS DETECTED" when you press F?

4. **Does romDash emit event?**
   - Do you see "Emitting event: stamina:try-consume:..."?

5. **Does stamina system receive it?**
   - Do you see "📥 EVENT RECEIVED: stamina:try-consume"?

6. **Does stamina system reply?**
   - Do you see "✅ Sufficient stamina, emitting success reply"?

7. **Does romDash receive reply?**
   - Do you see "✅ Stamina consumption SUCCESSFUL"?

8. **Does stamina decrease?**
   - Do you see "Old: 100 New: 70 Delta: -30"?

9. **Do you see the stamina bar?**
   - Does a green bar appear above your character?

## Expected Console Output Summary

When everything works, console should show:

```
[STAMINA] Initializing...
[DASH] Initializing...
[STAMINA] ✅ FULLY INITIALIZED
[DASH] ✅ Successfully captured key
[DASH] Querying stamina...
[STAMINA] Received query
[DASH] ✅ Stamina system confirmed working!

[User presses F]

[DASH] 🎮 KEY PRESS DETECTED!
[DASH] Emitting consume event
[STAMINA] 📥 Received consume request
[STAMINA] ✅ Emitting success reply
[DASH] ✅ Consumption successful!
[STAMINA] stamina:changed event
[STAMINA] Old: 100 New: 70 Delta: -30
```

## Next Steps

1. **Test with debug versions** (instructions above)
2. **Copy console output** and show me what you see
3. **Tell me where it stops working**
4. **I'll fix the specific issue**

## Summary Files

All debug files and documentation are ready:
- **Debug versions** have detailed logging
- **Test scripts** isolate specific functionality
- **Documentation** explains what to look for

The ultra-debug versions will tell us EXACTLY where the communication breaks down. Once we know that, I can fix it!