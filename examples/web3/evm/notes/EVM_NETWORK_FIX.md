# EVM Network Events Fix

## Problem: Network Packets Not Registered

The console shows errors:
```
writePacket failed: evmDisconnect (name not found)
writePacket failed: evmConnect (name not found)
```

This happens because `EVMClient.js` is trying to send network events:
```javascript
this.world.network.send('evmDisconnect')
this.world.network.send('evmConnect', address)
```

But these events were never registered in the network protocol!

## Solution: Use Local Events Only

For client-side wallet connections, network events are unnecessary because:
1. Wallet connection is purely client-side (MetaMask → browser)
2. No server communication needed for basic wallet connection
3. The server doesn't need to know about wallet status
4. Reduces network traffic

## Fix Applied

Changed both connect and disconnect handlers to use local events only:

```javascript
// BEFORE (causes network errors):
if (this.world.network) {
  this.world.network.send('evmConnect', address)
} else {
  this.emit('evmConnect', address)
}

// AFTER (works correctly):
this.emit('evmConnect', address)
```

This uses the EventEmitter pattern (`this.emit()`) instead of network packet sends.

## Benefits

1. ✅ No network errors
2. ✅ Cleaner architecture (no unnecessary network traffic)
3. ✅ Still supports event listeners for interested components
4. ✅ Components can listen via `world.evm.on('evmConnect', callback)`

## Files Modified

- `src/core/systems/EVMClient.js` - Removed network sends, use local events only

## Testing

After applying this fix:
- ✅ No more network errors in console
- ✅ `evmDisconnect` and `evmConnect` events emit locally
- ✅ Components can still listen: `world.evm.on('evmConnect', handler)`
- ✅ No server-side changes needed
