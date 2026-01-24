# 🧪 Testing Hyperfy Arena

## ✅ IMPORTANT: How Testing Actually Works

Hyperfy apps run in a **SES sandbox** which means functions are not exposed to the browser console like `app.testArenaFlow()`. Here's how to actually test the arena:

## 🎮 Method 1: In-World UI Testing (Recommended)

### Load the Quick Test Script

1. **Load `quick-test.js`** into your Hyperfy world
2. A test panel will appear in the top-center of your screen
3. Click the **"RUN ARENA TEST"** button or wait for auto-test
4. Watch the real-time results in the panel

### What Quick Test Does

- ✅ Checks World system availability
- 👥 Counts players in the world
- ⛓️ Verifies DojoSystem connection
- 📡 Tests arena event emission
- 🎉 Shows pass/fail status

## 🔧 Method 2: Browser Console Testing

If you load the full arena system, some functions ARE available (from `main-arena.js`):

```javascript
// These work after loading main-arena.js
window.testArenaFlow()     // Test complete integration
window.debugArena()        // Debug all systems
window.forceArenaMatch()   // Force test tournament
window.simulateArenaMatch() // Simulate match flow
```

**Note:** These only work if the arena systems are loaded and there are no syntax errors.

## 🏟️ Method 3: Manual System Verification

### 1. Check DojoSystem Status
```javascript
console.log('Dojo status:', world.dojo?.config?.network)
console.log('Connected:', !!world.dojo?.client)
```

### 2. Check Arena Systems
```javascript
// Look for arena-specific events
world.emit('arena:test-request', [{}])
```

### 3. Monitor Console Logs
Look for these messages:
- `🏟️ Initializing Arena Match Controller...`
- `⛓️ Initializing Arena Blockchain Integration...`
- `🎮 Loading all arena systems...`
- `🎉 All arena systems loaded successfully!`

## 📋 Step-by-Step Testing Guide

### Step 1: Basic Infrastructure Test

Load `quick-test.js` only:
1. Add script to world
2. Watch panel for results
3. Verify World and DojoSystem are working

**Expected output:**
```
✅ World system available
👥 Players: 1
✅ DojoSystem connected
✅ Test events emitted!
🎉 Quick test complete!
```

### Step 2: Arena Systems Test

If basic test passes, load `main-arena.js`:

1. **Add scripts in this order:**
   - `arena-map.js`
   - `arena-match-controller.js`
   - `arena-combat-integration.js`
   - `arena-scoring-ui.js`
   - `deploy-arena-contracts.js`
   - `arena-blockchain-integration.js`
   - `main-arena.js`

2. **Watch console for:**
   ```
   📦 arena-map loaded successfully
   📦 arena-match-controller loaded successfully
   ⛓️ Blockchain contracts ready
   🎉 All arena systems loaded successfully!
   ```

3. **Use console commands:**
   ```javascript
   window.debugArena() // System health report
   ```

### Step 3: Full Integration Test

If all systems are loaded:

1. **Run full flow test:**
   ```javascript
   window.testArenaFlow()
   ```

2. **Watch for:**
   ```
   🧪 Starting COMPLETE ARENA BLOCKCHAIN FLOW TEST...
   📋 Test 1: System Readiness Check
   ⛓️ Test 2: Blockchain Integration
   🏟️ Test 3: Simulated Arena Match
   📊 Test 4: Blockchain Result Verification
   🎉 COMPLETE ARENA FLOW TEST PASSED!
   ```

## 🚨 Common Testing Issues

### Issue: "app.testArenaFlow is not defined"
**Solution:** Apps don't expose functions to console. Use `window.testArenaFlow()` instead or load the UI test interface.

### Issue: "DojoSystem not available"
**Solution:** Make sure your local Katana + Torii are running with CORS. Verify your DojoSystem logs show successful connection.

### Issue: "No arena systems loaded"
**Solution:** Load scripts in correct order. Check console for syntax errors during loading.

### Issue: "Event not working"
**Solution:** Arena systems emit events but other scripts need to listen for them. Check the setupTiming in each system.

## 🔍 What Each Test Actually Verifies

### Quick Test (`quick-test.js`)
- ✅ **World Access**: Can you access `world` object?
- ✅ **Entity Count**: Are there players in the world?
- ✅ **Dojo Integration**: Is DojoSystem connected to local network?
- ✅ **Event System**: Can you emit and potentially receive arena events?

### Full Arena Test (`testCompleteArenaFlow`)
- ✅ **System Readiness**: All required systems have loaded and are healthy
- ✅ **Blockchain Connection**: Can query contracts and execute transactions
- ✅ **Match Simulation**: Can create and process a complete match lifecycle
- ✅ **Blockchain Recording**: Can record match results and verify them onchain

### Debug Test (`debugArena`)
- ✅ **Individual System Health**: Checks each system component
- ✅ **Configuration Status**: Shows current arena configuration
- ✅ **Connection Status**: Network and blockchain connectivity
- ✅ **Player Statistics**: Current match and player data

## 🎯 Success Indicators

### Minimum Working System
```
✅ World system available
👥 Players: 1+
✅ DojoSystem connected
✅ Test events emitted!
```

### Full Arena System
```
🏟️ Initializing Arena Match Controller...
⛓️ Initializing Arena Blockchain Integration...
🎉 All arena systems loaded successfully!
🔥 Hyperfy Arena is now ready for play!
```

### Complete Blockchain Integration
```
🎉 COMPLETE ARENA FLOW TEST PASSED!
🏆 All systems are working correctly!
⛓️ Match results recorded on blockchain
🎮 Real-time combat + blockchain persistence working!
```

## 🚀 Getting from Testing to Playing

1. **Pass Quick Test** → Basic infrastructure working
2. **Success with Full Arena** → Ready for local testing
3. **Pass Integration Test** → Ready for blockchain gameplay
4. **Test Real Match** → Actually play and fight!
5. **Check Blockchain** → Verify rewards recorded onchain

---

**Remember:** Start small with `quick-test.js`, then gradually add complexity. The in-world UI testing is much more reliable than console commands in Hyperfy's SES environment! 🎮