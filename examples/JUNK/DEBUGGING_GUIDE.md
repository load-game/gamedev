# Debugging romDash + stamina-system Integration

## Problem: Stamina not decreasing when dashing

### Quick Test Steps

#### Step 1: Test Event Communication
Use the debug version of both scripts to see what's happening:

1. **Use `stamina-system-debug.js`** instead of `stamina-system.js`
2. **Use `romDash-ultra-debug.js`** instead of `romDash.js`

#### Step 2: Check Console Output

Start Hyperfy and look for these messages in the browser console:

**From stamina-system-debug.js, you should see:**
```
[STAMINA SYSTEM DEBUG] === STAMINA SYSTEM INITIALIZING ===
[STAMINA SYSTEM DEBUG] Player ID: player_...
[STAMINA SYSTEM DEBUG] Initial stamina: 100
[STAMINA SYSTEM DEBUG] === SETTING UP EVENT LISTENERS ===
[STAMINA SYSTEM DEBUG] ✅ All event listeners set up successfully
[STAMINA SYSTEM DEBUG] ✅ STAMINA SYSTEM FULLY INITIALIZED
```

**From romDash-ultra-debug.js, you should see:**
```
[ROM DASH ULTRA DEBUG] === ULTRA DEBUG MODE ENABLED ===
[ROM DASH ULTRA DEBUG] === romDash.js Initializing ===
[ROM DASH ULTRA DEBUG] Running on CLIENT
[ROM DASH ULTRA DEBUG] Player ID: player_...
[ROM DASH ULTRA DEBUG] Control object: {...}
[ROM DASH ULTRA DEBUG] ✓ Successfully captured key: keyF
[ROM DASH ULTRA DEBUG] Checking for combined stamina API...
[ROM DASH ULTRA DEBUG] app.stamina: undefined
[ROM DASH ULTRA DEBUG] ℹ Will attempt event-based communication
[ROM DASH ULTRA DEBUG] === SETTING UP STAMINA EVENT MONITORS ===
[ROM DASH ULTRA DEBUG] === QUERYING INITIAL STAMINA ===
[ROM DASH ULTRA DEBUG] Emitting stamina:query with requestId: ...
```

#### Step 3: Look for Stamina Query Response

After querying stamina, you should see:
```
[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:query
[STAMINA SYSTEM DEBUG] RequestId: ...
[STAMINA SYSTEM DEBUG] Current stamina: 100
[STAMINA SYSTEM DEBUG] Emitting reply with stamina data

[ROM DASH ULTRA DEBUG]
📡 QUERY REPLY RECEIVED:
{ stamina: 100, maxStamina: 100, percent: 1 }
[ROM DASH ULTRA DEBUG] ✅ Stamina system confirmed working!
[ROM DASH ULTRA DEBUG] Initial stamina value: 100
```

If you DON'T see the reply, the event communication is broken.

#### Step 4: Test Dash Input

When you press the dash key (F by default), you should see:
```
[ROM DASH ULTRA DEBUG] 🔄 Update - isPressed: true, lastPressed: false, dashKey: keyF
[ROM DASH ULTRA DEBUG] 🎮 KEY PRESS DETECTED! Calling charge()
[ROM DASH ULTRA DEBUG]
=== CHARGE() CALLED ===
[ROM DASH ULTRA DEBUG] State: canDash = true, hasEffect = false
[ROM DASH ULTRA DEBUG] Stamina check - cost: 30, current: 100
[ROM DASH ULTRA DEBUG] Attempting dash - emitting stamina:try-consume event
[ROM DASH ULTRA DEBUG] Request ID: ...
[ROM DASH ULTRA DEBUG] Player ID: player_...
[ROM DASH ULTRA DEBUG] Amount: 30
[ROM DASH ULTRA DEBUG] Emitting event: stamina:try-consume:player_...
[ROM DASH ULTRA DEBUG] Event emitted, waiting for reply...
```

#### Step 5: Check for Stamina System Response

The stamina system should respond:
```
[STAMINA SYSTEM DEBUG]
📥 EVENT RECEIVED: stamina:try-consume
[STAMINA SYSTEM DEBUG] Amount: 30
[STAMINA SYSTEM DEBUG] RequestId: ...
[STAMINA SYSTEM DEBUG] Current stamina: 100
[STAMINA SYSTEM DEBUG] Unlimited stamina: false
[STAMINA SYSTEM DEBUG] ✅ Sufficient stamina, emitting success reply

[ROM DASH ULTRA DEBUG]
=== REPLY RECEIVED ===
[ROM DASH ULTRA DEBUG] Full data: { success: true, remaining: 100 }
[ROM DASH ULTRA DEBUG] Success: true
[ROM DASH ULTRA DEBUG] Remaining: 100
[ROM DASH ULTRA DEBUG] ✅ Stamina consumption SUCCESSFUL
[ROM DASH ULTRA DEBUG] New stamina value: 100
```

### Common Issues and Solutions

#### Issue 1: No Reply from Stamina System

**Symptoms:**
- romDash emits events but never receives replies
- You see "Waiting for reply..." but nothing happens
- Timeout message after 1 second

**Possible Causes:**
1. **Stamina system not loaded** - Check if stamina-system.js is actually running
2. **Player ID mismatch** - Different player IDs between systems
3. **Event name mismatch** - Typo in event names

**Solution:**
Check the stamina system initialization:
```javascript
// In stamina-system.js, you should see:
world.on(`stamina:try-consume:${playerId}`, ...)

// The playerId should match what romDash uses
```

#### Issue 2: Wrong Event Names

**Symptoms:**
- Events being emitted but not received
- Console shows events with wrong names

**Check:**
```javascript
// romDash should emit:
`stamina:try-consume:${player.id}`

// stamina-system should listen for:
`stamina:try-consume:${playerId}`
```

#### Issue 3: Player ID Mismatch

**Symptoms:**
- Everything looks correct but no communication

**Check:**
```javascript
// In romDash:
debugLog('Player ID:', player.id)

// In stamina-system:
debugLog('Player ID:', playerId)

// These should be EXACTLY the same
```

#### Issue 4: Control Object Issues

**Symptoms:**
- "Control object: undefined"
- "CONTROL OBJECT IS UNDEFINED!"

**Solution:**
This is a deeper Hyperfy issue. Try:
1. Refresh the page
2. Check if other scripts can access app.control()
3. Verify Hyperfy version compatibility

### Complete Test Flow

1. **Load both debug scripts**
2. **Open browser console**
3. **Look for initialization messages**
4. **Check stamina query/response**
5. **Press dash key**
6. **Look for event emission**
7. **Check for stamina system response**
8. **Verify stamina reduction**

### What Success Looks Like

After pressing dash key, you should see the stamina bar decrease from 100 to 70, then slowly regenerate back to 100.

Console should show:
```
[STAMINA SYSTEM DEBUG] Current stamina: 100
[ROM DASH ULTRA DEBUG] New stamina value: 100
[STAMINA SYSTEM DEBUG] Old: 100 New: 70 Delta: -30  // After dash
[STAMINA SYSTEM DEBUG] Old: 70 New: 71 Delta: 1     // During regen
...
[STAMINA SYSTEM DEBUG] Old: 99 New: 100 Delta: 1    // Full regen
```

### If Still Not Working

1. **Use test-event-communication.js** - This isolates event communication
2. **Check Hyperfy version** - Ensure compatibility
3. **Verify script loading order** - Stamina system should load before romDash
4. **Look for errors** - Check console for red errors
5. **Use test-integration-debug.js** - Tests the full integration

### Debug Versions Summary

**stamina-system-debug.js:**
- Ultra detailed logging of all events
- Shows every stamina:change emission
- Logs all incoming events with full data

**romDash-ultra-debug.js:**
- Traces every step of the dash process
- Shows event emissions and expected replies
- Includes timeout protection

**test-event-communication.js:**
- Isolates event communication
- Tests stamina system independently
- Verifies event emission and reception

Use these together to pinpoint exactly where the communication breaks down.