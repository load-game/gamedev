# EVM Integration Complete ✅

The EVM package has been successfully integrated alongside the existing Dojo/Starknet integration in your Hyperfy world.

## What Was Added

### 1. EVM Dependencies
- `wagmi` - React hooks for Ethereum
- `viem` - TypeScript interface for Ethereum
- `@tanstack/react-query` - Data fetching and state management

### 2. EVM Components & Systems

**Client-Side:**
- `src/client/components/EVM.js` - React component for EVM wallet connection UI
- `src/core/systems/EVMClient.js` - Client-side EVM system

**Server-Side:**
- `src/core/systems/EVMServer.js` - Server-side EVM system with wallet management

### 3. Integration Points

**World Registration:**
- `src/core/createClientWorld.js` - Registered EVM client system
- `src/core/createServerWorld.js` - Registered EVM server system

**Network Packets:**
- `src/core/packets.js` - Added `evmConnect` and `evmDisconnect` events

**Player Proxy:**
- `src/core/extras/createPlayerProxy.js` - Added `player.evm`, `player.connect()`, `player.disconnect()`

**Server Network:**
- `src/core/systems/ServerNetwork.js` - Added EVM connection handlers

**UI Integration:**
- `src/client/components/CoreUI.js` - Added EVM React component

**Environment Configuration:**
- `.env.example` - Added `PUBLIC_EVM` and `EVM_SEED_PHRASE` variables

## How to Use

### Environment Setup

Add to your `.env` file:
```bash
# EVM Configuration
PUBLIC_EVM=mainnet  # or sepolia, polygon, etc
EVM_SEED_PHRASE="your mnemonic phrase here"  # For server wallet operations
```

### In Your Apps/Scripts

**Access player EVM address:**
```javascript
const player = world.getPlayer()
console.log(player.evm) // Returns connected wallet address (e.g., "0x1234...")
```

**Access world EVM utilities:**
```javascript
// Client-side
world.evm.actions  // wagmi actions (readContract, writeContract, etc)
world.evm.utils    // viem utilities
world.evm.abis     // Common ABIs (erc20, erc721)

// Server-side
world.evm.wallet   // Wallet client for transactions
world.evm.actions  // Public client for reads
```

**Connect/disconnect wallet:**
```javascript
// Trigger wallet connection
player.connect()

// Disconnect wallet
player.disconnect()
```

**Contract interactions:**
```javascript
// Read from contract
const balance = await world.evm.actions.readContract({
  address: '0x...',
  abi: world.evm.abis.erc20,
  functionName: 'balanceOf',
  args: [player.evm]
})

// Write to contract (client)
await world.evm.actions.writeContract({
  address: '0x...',
  abi: myAbi,
  functionName: 'myFunction',
  args: [...]
})
```

## Coexistence with Dojo/Starknet

The EVM integration works alongside your existing Dojo/Starknet integration:

- **Dojo**: `world.dojo` - Starknet/Dojo integration for onchain games
- **EVM**: `world.evm` - Ethereum/EVM integration for DeFi, NFTs, etc
- **Both**: Can be used simultaneously in the same world

Example using both:
```javascript
// Check Starknet identity
const starknetAddress = player.starknet

// Check Ethereum identity  
const evmAddress = player.evm

// Use Dojo for game state
const gamePosition = await world.dojo.getPosition(player.starknet)

// Use EVM for token balance
const tokenBalance = await world.evm.actions.readContract({
  address: '0x...',
  abi: world.evm.abis.erc20,
  functionName: 'balanceOf',
  args: [player.evm]
})
```

## Available EVM Chains

By default, the integration supports all chains from `wagmi/chains`:
- `mainnet` - Ethereum Mainnet
- `sepolia` - Ethereum Sepolia Testnet
- `polygon` - Polygon Mainnet
- `polygonMumbai` - Polygon Mumbai Testnet
- `optimism` - Optimism Mainnet
- `arbitrum` - Arbitrum Mainnet
- And many more...

Set your preferred chain in `.env`:
```bash
PUBLIC_EVM=sepolia  # For testnet
```

## Security Notes

- `EVM_SEED_PHRASE` is only needed for server-side wallet operations
- Never commit your `.env` file with real seed phrases
- Client-side connections use the player's own wallet (MetaMask, etc)
- Server-side operations use the configured seed phrase wallet

## Testing

To verify the integration is working:

1. Start your world: `npm run dev`
2. Open the browser and check for EVM connection UI
3. Connect your wallet
4. In the console, check: `world.evm` and `world.dojo`
5. Both should be available and functional

## Summary

✅ EVM package successfully integrated  
✅ Works alongside existing Dojo/Starknet integration  
✅ All necessary files created and wired up  
✅ Environment configuration documented  
✅ Usage examples provided  

Your Hyperfy world now supports both Starknet (via Dojo) and Ethereum (via EVM) simultaneously!