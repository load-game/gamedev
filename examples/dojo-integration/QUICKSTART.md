# 🚀 Hyperfy Blockchain Gaming - Quick Start

Tired of complex blockchain setup? This gets you from zero to on-chain gaming in 3 commands.

## What You Get

✅ **Real Blockchain**: Local StarkNet with real transactions
✅ **Smart Contracts**: Your Cairo contracts deployed and working
✅ **Indexing**: GraphQL API for querying blockchain state
✅ **Hyperfy Integration**: Works with your existing Hyperfy apps

## Prerequisites (One-Time Setup)

```bash
# Install Dojo toolchain (if you haven't already)
curl -L https://install.dojoengine.org | bash
```

## Quick Start (3 Commands)

### Option 1: One-Click Everything

```bash
# From hyperfy root directory
cd examples/dojo-integration
./start-blockchain-dev.sh
```

This script:
1. ✅ Checks all tools are installed
2. ✅ Starts Katana (blockchain)
3. ✅ Compiles your Cairo contracts
4. ✅ Deploys contracts to blockchain
5. ✅ Starts Torii (indexer)
6. ✅ Starts Hyperfy dev server

**When you see this, you're ready:**
```
🌍 World Address: 0x05c7b2e5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e
🚀 Starting Hyperfy...
> hyperfy@0.15.0 dev
```

### Option 2: Step-by-Step (More Control)

```bash
cd examples/dojo-integration

# Terminal 1: Start blockchain
./start-katana.sh

# Terminal 2: Deploy contracts
./deploy-contracts.sh

# Terminal 3: Start indexer (use world address from deploy output)
./start-torii.sh 0xYOUR_WORLD_ADDRESS

# Terminal 4: Start Hyperfy
cd ../..
npm run dev
```

## Test Your Setup

```bash
cd examples/dojo-integration
./test-setup.sh
```

**Expected output:**
```
🧪 Testing Blockchain Dev Environment
═══════════════════════════════════════════════════════════════

1️⃣  Testing Katana...
✅ Katana is running

2️⃣  Testing Torii...
✅ Torii is running

3️⃣  Testing contracts...
✅ Contracts deployed
   World: 0x05c7b2e5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e

🎉 Environment is ready!
```

## Load Blockchain Apps in Hyperfy

### 1. Test Dojo API
Open in Hyperfy Builder (press B):
```
examples/dojo-integration/test-dojo-api.js
```

Click "Test Dojo API" button to verify blockchain connection.

### 2. Elementals + Blockchain
```
examples/dojo-integration/elementals-dojo-hybrid.js
```

This enhances the Elementals game with:
- On-chain kill tracking
- NFT rewards for legendary kills
- Persistent player achievements

### 3. Fragment Collector (Full Example)
```
examples/fragment-collector/
```

Complete blockchain game with:
- Cairo smart contracts
- On-chain fragment collection
- NFT deployment on completion
- Real-time state synchronization

## Project Structure

```
hyperfy/
├── examples/
│   ├── dojo-integration/           # Blockchain integration examples
│   │   ├── start-blockchain-dev.sh # One-click start
│   │   ├── test-setup.sh           # Verify setup
│   │   └── elementals-dojo-hybrid.js
│   └── fragment-collector/         # Full blockchain game
│       ├── src/lib.cairo           # Smart contracts
│       ├── Scarb.toml              # Dojo project config
│       └── manifests/              # Deployed contract data
├── src/core/systems/
│   └── DojoSystem.js               # Blockchain integration
└── src/core/systems/
    └── ClientWeb3.js               # Cartridge wallet integration
```

## Troubleshooting

### Problem: "Katana not found"
**Solution:** Install Dojo tools:
```bash
curl -L https://install.dojoengine.org | bash
```

### Problem: "Port already in use"
**Solution:** Kill existing services:
```bash
lsof -ti:5050 | xargs kill -9  # Katana
lsof -ti:8080 | xargs kill -9  # Torii
```

### Problem: "Contracts not deployed"
**Solution:** Run deploy script:
```bash
cd examples/dojo-integration
./deploy-contracts.sh
```

### Problem: "CORS errors in browser"
**Solution:** Katana is already started with CORS enabled in our scripts.

## Environment Variables

Copy template:
```bash
cp examples/dojo-integration/.env.blockchain.example .env.local
```

Customize if needed (usually not required for local dev):
```bash
# Katana Configuration
KATANA_RPC_URL=http://localhost:5050
KATANA_ACCOUNT=0x6162896d1d7ab204c7ccac6dd5f8e9e7c25ecd5ae4fe4c32e36c7a9d5c0a1c
KATANA_PRIVATE_KEY=0x1800000000300000180000000000030000000000003006001800006600

# Dojo World (from deploy output)
DOJO_WORLD_ADDRESS=0x05c7b2e5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e

# Torii
TORII_URL=http://localhost:8080
```

## Understanding the Architecture

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Hyperfy Client                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Your Game App (elementals-dojo-hybrid.js)        │  │
│  │  → world.dojo.execute()                           │  │
│  └────────────────↓──────────────────────────────────┘  │
│                   ↓                                      │
│  ┌────────────────↓──────────────────────────────────┐  │
│  │  DojoSystem.js (Blockchain Bridge)                │  │
│  │  └─ Katana (Local StarkNet)                      │  │
│  └───────────────────────────────────────────────────┘  │
│                   ↓                                      │
│  ┌────────────────↓──────────────────────────────────┐  │
│  │  Torii Indexer                                    │  │
│  │  └─ GraphQL API (localhost:8080/graphql)         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Development Workflow

1. **Change contract**: Edit `lib.cairo`
2. **Rebuild**: `sozo build`
3. **Redeploy**: `sozo migrate`
4. **Update World Address**: Use new address in scripts
5. **Test in Hyperfy**: Reload app

## Production Deployment

When ready for testnet/mainnet:

1. Update `.env.local` with production RPC
2. Deploy contracts to real network:
   ```bash
   cd examples/fragment-collector
   sozo migrate --network sepolia  # or mainnet
   ```
3. Update Hyperfy config with real world address
4. Update `start-torii.sh` to use production RPC

## Next Steps

- [ ] Build your first blockchain feature
- [ ] Modify `fragment-collector/src/lib.cairo`
- [ ] Experiment with the Elementals hybrid
- [ ] Create your own Dojo-enabled app

## Getting Help

- **Dojo Issues**: [DojoEngine Discord](https://discord.gg/dojoengine)
- **Hyperfy Issues**: [GitHub Issues](https://github.com/hyperfy-xyz/hyperfy/issues)
- **Cairo Help**: [Cairo Book](https://book.cairo-lang.org/)

## Summary

You went from "too ambitious" to **having a complete blockchain gaming platform** with:

- ✅ Working wallet integration
- ✅ Deployed Cairo contracts
- ✅ Real blockchain transactions
- ✅ Hyperfy integration
- ✅ **One-click startup script**

The hard part is done. The setup is now easy.

**Welcome to on-chain gaming! 🎮⛓️**
