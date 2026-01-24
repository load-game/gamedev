# EVM Wallet Connection - Test Guide

## What We've Fixed

### 1. Removed Invalid `app.on('init')` Dependency
- **Problem**: The wallet app was waiting for an `app.on('init')` event that doesn't exist in Hyperfy
- **Fix**: Removed the init handler and initialized the app immediately
- **Location**: `examples/wallet-connect-base.js:214-233`

### 2. Added Missing Address to connect() Return Value
- **Problem**: The `connect()` method wasn't returning the wallet address
- **Fix**: Added `address: this.address` to the return object
- **Location**: `src/core/systems/EVMClient.js:70`

### 3. Fixed EVM Architecture
- **Completed**: Separated EVM into client/server systems following drama-haus pattern
- **Files Created**:
  - `src/core/systems/EVMClient.js` (132 lines)
  - `src/core/systems/EVMServer.js` (52 lines)
- **Files Modified**:
  - `src/core/createClientWorld.js`
  - `src/core/createServerWorld.js`
  - `src/client/components/EVM.js`

## How to Test

### Prerequisites
1. **MetaMask or browser wallet** must be installed and configured for Base network
2. **Dev server is running** (started successfully on port 3000)

### Test Steps

1. **Open browser console** (F12) to see debug logs
2. **Navigate to** `http://localhost:3000` (or your configured port)
3. **Open the wallet app** in Hyperfy
4. **Click the "Connect to Base" button**
5. **Check console logs** - you should see:
   ```
   ========== BUTTON CLICKED ==========
   app.state.connected: false
   world.evm exists: true
   typeof world.evm: object
   world.evm keys: bind, connect, disconnect, deposit, withdraw, onDepositRequest, onWithdrawRequest
   Calling connectWallet()...
   === connectWallet() called ===
   world.evm exists: true
   world.evm.connect exists: function
   🔄 Calling world.evm.connect()...
   [EVM] connect() called from app
   [EVM] Connecting with connector: MetaMask
   ```

### Expected Behavior
- **Wallet prompt** should appear asking to connect
- **After approval**: UI updates to show "✅ Base: 0x1234...5678"
- **Button changes** to "Disconnect" with red background

### If Nothing Happens

Check these common issues:

1. **world.evm not available**
   - Verify EVM system is registered in `src/core/createClientWorld.js:23`
   - Check browser console for "world.evm exists: true"

2. **No wallet prompt appears**
   - Ensure MetaMask is installed and unlocked
   - Check MetaMask is configured for Base network
   - Look for errors in browser console

3. **Connect button doesn't respond**
   - Verify the onClick handler is logging "BUTTON CLICKED"
   - Check for JavaScript errors in console

## Key Implementation Details

### Correct Hyperfy App Pattern
```javascript
// ✅ CORRECT - Direct JavaScript, no wrapper
app.configure([...])
const ui = app.create('ui', {...})

// ❌ WRONG - Don't use this pattern
({
  init() { ... }
})
```

### Wallet Connection Flow
```javascript
// App calls:
const result = await world.evm.connect()

// EVMClient handles:
1. Check if already connected
2. Verify connectors are available
3. Call wagmi's connect() with first connector
4. Return { success: true, address: walletAddress }
```

### Debug Information
The wallet app logs extensive debug info to console:
- App loading status
- world.evm availability
- Button click events
- Connection attempt details
- Error messages with stack traces

## Files Modified Summary

1. **examples/wallet-connect-base.js** - Fixed init issue, added debug logs
2. **src/core/systems/EVMClient.js** - Added connect/disconnect methods, fixed return values
3. **src/core/systems/EVMServer.js** - Created server-side EVM system
4. **src/client/components/EVM.js** - Updated to use wagmi v2 hooks
5. **package.json** - Added wagmi and @tanstack/react-query dependencies
6. **CLAUDE.md** - Documented technical caveats and patterns

## Next Steps

If wallet connection still doesn't work:

1. **Check browser console** for specific error messages
2. **Verify MetaMask** is on Base network (chain ID: 8453)
3. **Test with Starknet** integration to compare patterns (it works reliably)
4. **Check EVM.bind()** is called before app tries to connect

The EVM system follows the same architecture as Starknet (world.web3) which is known to work correctly in drama-haus.
