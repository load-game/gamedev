# Quick Start: Debugging romDash + stamina-system

## TL;DR: Use Debug Versions

### 1. Use Debug Versions Instead of Regular Ones

**Replace in your world:**
- ❌ `examples/essentials/stamina-system.js`
- ❌ `examples/ROMs/romDash.js`

**With:**
- ✅ `examples/essentials/stamina-system-debug.js`
- ✅ `examples/ROMs/romDash-ultra-debug.js`

### 2. Open Browser Console (F12)

Look for these key messages:

**Stamina System Should Output:**
```
[STAMINA SYSTEM DEBUG] === STAMINA SYSTEM INITIALIZING ===
[STAMINA SYSTEM DEBUG] Player ID: player_xxx
[STAMINA SYSTEM DEBUG] ✅ STAMINA SYSTEM FULLY INITIALIZED
[STAMINA SYSTEM DEBUG] ✅ All event listeners set up successfully
```

**ROM Dash Should Output:**
```
[ROM DASH ULTRA DEBUG] === ULTRA DEBUG MODE ENABLED ===
[ROM DASH ULTRA DEBUG] === romDash.js Initializing ===
[ROM DASH ULTRA DEBUG] ✅ Successfully captured key: keyF
[ROM DASH ULTRA DEBUG] === QUERYING INITIAL STAMINA ===
[ROM DASH ULTRA DEBUG] ✅ Stamina system confirmed working!
```

### 3. Press Dash Key (Default: F)

**You Should See:**
```
[ROM DASH ULTRA DEBUG] 🎮 KEY PRESS DETECTED! Calling charge()
[ROM DASH ULTRA DEBUG] === CHARGE() CALLED ===
[ROM DASH ULTRA DEBUG] Emitting event: stamina:try-consume:player_xxx
[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:try-consume
[STAMINA SYSTEM DEBUG] ✅ Sufficient stamina, emitting success reply
[ROM DASH ULTRA DEBUG]
=== REPLY RECEIVED ===
[ROM DASH ULTRA DEBUG] ✅ Stamina consumption SUCCESSFUL
```

**Then watch stamina bar decrease from 100 → 70**

### 4. Check What Actually Happens

#### Scenario A: Works Perfectly ✓
- Stamina decreases when you dash (100 → 70)
- Stamina regenerates over time (70 → 100)
- Console shows all messages above

**→ You're done! Use the regular versions.**

#### Scenario B: No Reply from Stamina System ✗
- romDash emits events but gets no reply
- Console shows "Waiting for reply..." then timeout
- Stamina never decreases

**→ The issue is event communication. Check:**
1. Is stamina-system-debug.js actually running?
2. Do player IDs match? (compare console output)
3. Are there any errors in console (red text)?

#### Scenario C: Key Not Captured ✗
- "✗ FAILED to capture key: keyF"
- Pressing F does nothing

**→ Input issue. Try:**
1. Refresh browser
2. Click in game window
3. Try different key config

### 5. Common Fixes

#### Fix 1: Player ID Mismatch
If player IDs don't match:
```javascript
// In both scripts, add this debug line:
debugLog('PLAYER ID:', player.id)  // or playerId for stamina system

// Make sure they output the EXACT same ID
```

#### Fix 2: Event Not Received
If stamina system never receives events:
```javascript
// Test direct event emission:
setTimeout(() => {
  debugLog('Testing direct event...')
  world.emit(`stamina:try-consume:${player.id}`, {
    amount: 10,
    requestId: 'test123',
    source: 'test'
  })
}, 3000)

// Check if stamina system logs it
```

#### Fix 3: Wrong Event Names
Compare what romDash emits vs what stamina system listens for:
```javascript
// romDash should emit:
`stamina:try-consume:${player.id}`

// stamina-system should listen for:
`stamina:try-consume:${playerId}`

// These MUST match!
```

## Test Files Available

### For Isolated Testing:
1. **test-input-only.js** - Tests if key input works
2. **test-event-communication.js** - Tests stamina events alone
3. **test-integration-debug.js** - Full integration test

### For Production:
1. **romDash-fixed.js** - Fixed version with all bugs patched
2. **stamina-system.js** - Regular stamina system

## Expected Behavior

### When Working Correctly:

1. **Initial State:** Stamina = 100
2. **Press F:** Dash activates, Stamina = 70
3. **Wait 2 seconds:** Stamina starts regenerating
4. **Wait ~3 more seconds:** Stamina = 100 again

### Console Flow:
```
[STAMINA] Initializing...
[DASH] Initializing...
[DASH] Querying stamina...
[STAMINA] Received query, replying with stamina: 100
[DASH] Got stamina: 100

[User presses F]

[DASH] Key pressed, dashing!
[DASH] Emitting consume event (amount: 30)
[STAMINA] Received consume request
[STAMINA] New stamina: 70
[STAMINA] Emitting stamina:changed event
[DASH] Received reply: success!

[2 seconds pass]

[STAMINA] Regenerating: 70 → 72 → 74 → ...

[5 seconds total]

[STAMINA] Stamina full: 100
```

## Debug Mode Toggle

All debug versions have a `debugMode` config option:
- **true** = Show all debug logs (verbose)
- **false** = Hide debug logs (clean)

Set it in the Hyperfy editor UI for each script.

## Still Not Working?

1. Read `DEBUGGING_GUIDE.md` for detailed troubleshooting
2. Check both scripts are on the same entity/player
3. Verify no other scripts are interfering
4. Try the test scripts in isolation
5. Check Hyperfy discord for known issues

## Quick Copy-Paste

Replace your scripts with these debug versions:

```javascript
// For romDash:
/examples/ROMs/romDash-ultra-debug.js

// For stamina system:
/examples/essentials/stamina-system-debug.js

// For testing:
/test-event-communication.js
/test-integration-debug.js
```

Then watch the console!