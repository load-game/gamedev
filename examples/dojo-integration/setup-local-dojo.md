# 🛠️ Setting Up Real Local Dojo Environment

Based on https://dojoengine.org/getting-started/your-first-dojo-app

## 📋 Prerequisites Check

You should already have these installed:
- `@dojoengine/core`
- `@dojoengine/torii-client`
- `katana` (local StarkNet sequencer)
- `sozo` (build/deploy tool)

Check if you have them:
```bash
katana --version
sozo --version
```

## 🚀 Quick Local Setup

### 1. Start Local StarkNet with Katana

```bash
# Start a local StarkNet sequencer with dev mode + CORS
katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000"

# This will start a local blockchain at:
# StarkNet RPC: http://localhost:5050
# 5 dev accounts created with test ETH
# CORS enabled for browser access
```

**Alternative without CORS (won't work from browser):**
```bash
katana --dev --block-time 1000 --dev.accounts 5
```

### 2. Create and Deploy a Simple World Contract

Create a new directory for your Dojo world:
```bash
mkdir my-dojo-world
cd my-dojo-world
```

Initialize a new Dojo project:
```bash
sozo init my-dojo-world
```

This creates the basic structure:
```
my-dojo-world/
├── Scarb.toml
├── src/
│   └── lib.cairo
└── worlds.json
```

### 3. Create Simple World Contract

Edit `src/lib.cairo`:
```cairo
#[dojo::interface]
trait IElementalsWorld {
    fn record_elemental_kill(player_id: felt252, elemental_id: felt252, elemental_type: felt252);
    fn mint_elemental_reward(player_id: felt252, item_type: felt252, rarity: felt252, power: u32);
    fn record_significant_damage(player_id: felt252, elemental_id: felt252, damage: u32);
}

#[dojo::contract]
mod ElementalsWorld {
    use super::IElementalsWorld;

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct Player {
        #[key]
        player_id: felt252,
        total_kills: u32,
        legendary_kills: u32,
        highest_damage: u32,
    }

    #[dojo::model]
    #[derive(Drop, Serde)]
    struct ElementalReward {
        #[key]
        token_id: felt252,
        owner: felt252,
        item_type: felt252,
        rarity: felt252,
        power: u32,
        minted: bool,
    }

    // World functions
    #[external(v0)]
    fn record_elemental_kill(
        world: IWorldDispatcher,
        player_id: felt252,
        elemental_id: felt252,
        elemental_type: felt252
    ) {
        // Update player stats
        let mut player = world.entity_model_builder::<Player>(player_id);
        player.total_kills += 1;
        if elemental_type == 2 { // Legendarius type
            player.legendary_kills += 1;
        }
    }

    #[external(v0)]
    fn mint_elemental_reward(
        world: IWorldDispatcher,
        player_id: felt252,
        item_type: felt252,
        rarity: felt252,
        power: u32
    ) -> felt252 {
        let token_id = starknet::info::get_contract_address().into() + world.random();
        let reward = ElementalReward {
            token_id,
            owner: player_id,
            item_type,
            rarity,
            power,
            minted: true,
        };
        world.set_entity(token_id, reward);
        token_id
    }

    #[external(v0)]
    fn record_significant_damage(
        world: IWorldDispatcher,
        player_id: felt252,
        elemental_id: felt252,
        damage: u32
    ) {
        let mut player = world.entity_model_builder::<Player>(player_id);
        if damage > player.highest_damage {
            player.highest_damage = damage;
        }
    }
}
```

### 4. Build and Deploy

```bash
# Build the project
sozo build

# Deploy to local Katana
sozo migrate

# Note the deployed world address!
```

### 5. Start Torii Indexing

```bash
# Start Torii to index the local blockchain
torii --world <YOUR_WORLD_ADDRESS> --rpc http://localhost:5050

# This will start indexing at:
# GraphQL API: http://localhost:8080/graphql
# WebSocket: ws://localhost:8080/graphql
```

## 🔗 Connect Hyperfy to Real Local Dojo

Now update the DojoSystem configuration to use your real local environment:

In `src/core/systems/DojoSystem.js`, update the config:

```javascript
// Change the default config to use real local Dojo
this.config = {
  rpcUrl: 'http://localhost:5050',        // Local Katana
  toriiUrl: 'http://localhost:8080',      // Local Torii
  worldAddress: '0x...',                  // Your deployed world address
  maxRetries: 3,
  syncInterval: 2000, // Faster sync with real system
}
```

## 🧪 Test Real Integration

1. **Start all services**:
```bash
# Terminal 1: Start local blockchain
katana --block-time 1000 --accounts 5

# Terminal 2: Deploy your world (one time)
cd my-dojo-world
sozo build && sozo migrate

# Terminal 3: Start indexing
torii --world <DEPLOYED_ADDRESS> --rpc http://localhost:5050

# Terminal 4: Start Hyperfy
cd ../../
npm run dev
```

2. **Load the test script**:
```
File: examples/dojo-integration/test-dojo-integration.js
```

3. **You should now see**:
- ✅ Real blockchain connection to `http://localhost:5050`
- ✅ Actual indexing from `http://localhost:8080`
- ✅ Real transaction hashes from local StarkNet
- ✅ Entity state persistence survives restarts!

## 🎯 Benefits of Real Local Setup

### **Before (Mock)**
- ❌ Fake transaction hashes
- ❌ State doesn't persist
- ❌ No real blockchain behavior
- ❌ Limited testing capabilities

### **After (Real Local)**
- ✅ Real StarkNet transactions
- ✅ Persistent onchain state
- ✅ actual blockchain gas simulation
- ✅ Full development workflow
- �Can deploy to testnet/mainnet later same way

## 🚀 Next Steps

Once local is working, you can:
1. **Deploy to StarkNet Sepolia** testnet using Katana testnet
2. **Use real wallets** instead of mock accounts
3. **Mint actual NFTs** that appear in real wallets
4. **Deploy to production** when ready

**This gives you the full blockchain gaming development experience!** 🎮🔗⚡