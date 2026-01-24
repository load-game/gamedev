# 🛠️ Setup Scripts Summary

## What You Can Run Now

### 1️⃣ One-Click Everything
```bash
./start-blockchain-dev.sh      # Starts everything & Hyperfy
```

### 2️⃣ Individual Commands (More Control)
```bash
./start-katana.sh              # Start blockchain (Terminal 1)
./deploy-contracts.sh          # Deploy contracts (Terminal 2)
./start-torii.sh <world_addr>  # Start indexer (Terminal 3)
npm run dev                    # Start Hyperfy (Terminal 4)
```

### 3️⃣ Verify Everything Works
```bash
./test-setup.sh                # Check if all services running
```

## File Locations

```
examples/dojo-integration/
├── start-blockchain-dev.sh    # Master script - runs everything
├── start-katana.sh           # Start StarkNet sequencer
├── deploy-contracts.sh       # Compile & deploy Cairo contracts
├── start-torii.sh            # Start indexer
├── test-setup.sh             # Verify setup
├── .env.blockchain.example   # Environment variables template
└── QUICKSTART.md             # Full documentation
```

## Quick Test

```bash
cd examples/dojo-integration
./test-setup.sh
```

**You should see:**
- ✅ Katana is running
- ✅ Torii is running  
- ✅ Contracts deployed
- 🎉 Environment is ready!

## Next Steps

1. Read: `QUICKSTART.md` (comprehensive guide)
2. Test: `./test-setup.sh`
3. Run: `./start-blockchain-dev.sh`
4. Load: `elementals-dojo-hybrid.js` in Hyperfy

