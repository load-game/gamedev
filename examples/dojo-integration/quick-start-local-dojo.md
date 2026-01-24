# 🚀 Quick Start: Real Local Dojo + Hyperfy

**Target:** Get Hyperfy connected to a real local StarkNet blockchain in 5 minutes

## 🎯 What You'll Get

- ✅ Real blockchain transactions (not mock!)
- ✅ Persistent onchain state
- ✅ Actual StarkNet blocks every second
- ✅ Real Torii indexing service
- ✅ Full development workflow

## 📋 Prerequisites Check

You should have:
```bash
katana --version    # ✅ Local StarkNet sequencer
sozo --version      # ✅ Dojo build/deploy tool
npm list dojo        # ✅ Core dependencies
```

## ⚡ Quick Setup (3 Commands)

### 1. Start Local Blockchain
```bash
# Terminal 1: Start Katana (with dev mode + CORS for browser)
katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000"

# Alternative without CORS (won't work from browser):
katana --dev --block-time 1000 --dev.accounts 5

# Output:
# 🟢 StarkNet sequencer running at http://localhost:5050
# 🟢 5 dev accounts created with 1000 ETH each
# 🟢 CORS enabled for browser access
```

### 2. Deploy Dojo World
```bash
# Terminal 2: Create and deploy a simple world
cd /tmp/my-dojo-world
sozo init elementals-world  # Creates basic project

# Deploy world to local Katana
sozo migrate

# Output will show your world address - copy it!
# 🟢 World deployed at: 0x05c7b2e5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e
```

### 3. Start Indexing Service
```bash
# Terminal 3: Start Torii indexing
torii --world <YOUR_WORLD_ADDRESS> --rpc http://localhost:5050

# Output:
# 🟢 Torii indexing at http://localhost:8080/graphql
# 🟢 WebSocket available at ws://localhost:8080/graphql
```

## 🎮 Start Hyperfy

```bash
# Terminal 4: Start Hyperfy
cd /home/blank/Work/hyperfy
npm run dev
```

Now load: `examples/dojo-integration/test-dojo-integration.js`

## 🎯 Expected Results

### **Log Output Should Show:**
```
[DojoSystem] ✅ Connected to local Katana, block: 42
[DojoSystem] 🟢 Using real local Katana blockchain!
[DojoSystem] 🟢 Connected to real local Torii!
🧪 Testing DojoEngine + Hyperfy Integration...
🚀 Test init triggered
✅ PASS: Dojo system available
✅ PASS: Connected: true
✅ PASS: Network: LOCAL_KATANA
✅ PASS: Real transaction hashes returned
🏁 TEST SUMMARY: 4/4 tests passed
```

### **What's Different From Mock Mode:**
- 🟢 Real transaction hashes: `0x07c3...abcd` (not `mock_tx_123456`)
- 🟢 Actual block numbers increasing every second
- 🟢 State persists across Hyperfy restarts
- 🟢 Real StarkNet gas simulation
- 🟢 GraphQL queries to real Torii service

## 🔍 Test Real Blockchain

Open browser: `http://localhost:8080/graphql`

Try this query:
```graphql
query {
  _meta {
    block {
      number
      timestamp
    }
  }
}
```

You should see real blockchain data!

## 🎮 Test with Elementals

Load: `examples/dojo-integration/elementals-dojo-hybrid.js`

Now when you battle Elementals:
- ✅ Each kill creates real onchain transaction
- ✅ Legendary drops become real NFTs in local StarkNet
- ✅ Player stats persist forever on blockchain
- ✅ Survives server restarts because data is onchain!

## 🛠️ What's Actually Happening

### **Hyperfy → Dojo Flow:**
```
Elemental dies in Hyperfy
    ↓
Entity synced to Dojo system
    ↓
Real transaction sent to Katana
    ↓
Torii indexes the transaction
    ↓
State persisted in local StarkNet
    ↓
Available via GraphQL API
```

### **Benefits Over Mock:**
- **Real Development**: Same workflow as production deployment
- **Proper Testing**: Test actual gas costs, transaction ordering
- **State Persistence**: Data survives restarts, crashes
- **Production Ready**: Can deploy to testnet/mainnet same way

---

**🎯 You now have a complete local blockchain gaming development environment!**

This is exactly how game studios develop blockchain games - with local test environments before deploying to public networks. 🔮⚡