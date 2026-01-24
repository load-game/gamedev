# DojoEngine + Hyperfy Integration Guide

> **🚀 QUICK START:** New to blockchain gaming? Start here: **[QUICKSTART.md](QUICKSTART.md)** - Get running in 3 commands!

## Overview

This integration combines **Hyperfy's real-time 3D, physics, and multiplayer capabilities** with **DojoEngine's onchain verifiable game logic and persistence**. The result is a powerful hybrid platform for blockchain gaming with true digital ownership.

## Architecture

### Hybrid System Design

```
┌─────────────────────┐    ┌─────────────────────┐
│     HYPERFY         │    │    DOJOENGINE       │
│                     │    │                     │
│ • Real-time 3D      │◄──►│ • Onchain Logic     │
│ • Physics           │    │ • Verifiable State  │
│ • Multiplayer       │    │ • Asset Ownership   │
│ • Rendering         │    │ • Persistent World  │
│ • Audio/VR/AR       │    │ • Cairo Smart       │
│                     │    │   Contracts         │
└─────────────────────┘    └─────────────────────┘
```

### Component Mapping

| Hyperfy Component | DojoEngine Component | Purpose |
|------------------|---------------------|---------|
| Position         | Position            | Entity location |
| Rotation         | Rotation            | Entity orientation |
| Health           | Health              | Entity hit points |
| Inventory        | Inventory           | Item storage |
| Owner            | Owner               | Wallet ownership |
| Custom Data      | Custom Components   | Game-specific logic |

## Installation

### 1. Install Dependencies

```bash
# Core DojoEngine packages
npm install @dojoengine/core @dojoengine/torii-client

# Hyperfy already includes necessary dependencies
npm install
```

### 2. System Integration

The DojoSystem is automatically registered when using Hyperfy's client world:

```javascript
// Already integrated in createClientWorld.js
import { DojoSystem } from './systems/DojoSystem'
world.register('dojo', DojoSystem)
```

## Usage Examples

### Basic Entity Synchronization

```javascript
// Get access to Dojo system
const dojo = world.dojo

if (dojo.isConnected()) {
  console.log('Dojo connected to:', dojo.getNetwork())

  // Sync an entity to onchain state
  const entityId = await dojo.syncEntity(myEntity)
  console.log('Entity synced with ID:', entityId)
}
```

### Advanced Entity Configuration

```javascript
// Create entity with Dojo synchronization
const player = app.create('box', {
  position: [0, 1, 0],
  scale: [1, 2, 1]
})

// Add Dojo component for onchain sync
player.add('dojo', {
  worldAddress: world.dojo.getWorldAddress(),
  components: ['Position', 'Health', 'Inventory'],
  syncInterval: 1000, // Sync every second
  autoSync: true
})

// Set initial properties
player.health = 100
player.maxHealth = 100
player.inventory = []
```

### Onchain Transactions

```javascript
// Execute game actions onchain
try {
  const result = await world.dojo.execute([
    {
      target: world.dojo.getWorldAddress(),
      method: 'combat',
      args: ['mob_entity_id', 10] // entity_id, damage
    }
  ])

  console.log('Transaction submitted:', result.transaction_hash)
} catch (error) {
  console.error('Transaction failed:', error)
}
```

## Real-World Game Examples

### 1. RPG with Persistent Characters

```javascript
({
  init() {
    // Create player character
    this.player = app.create('avatar', {
      position: [0, 0, 0]
    })

    // Sync player to blockchain
    this.player.add('dojo', {
      components: ['Position', 'Health', 'Level', 'Stats', 'Inventory']
    })

    // Initialize stats
    this.player.health = 100
    this.player.level = 1
    this.player.experience = 0
    this.player.stats = {
      strength: 10,
      defense: 5,
      speed: 8
    }
  },

  async gainExperience(amount) {
    this.player.experience += amount

    // Onchain progression
    await world.dojo.execute([{
      target: world.dojo.getWorldAddress(),
      method: 'gainExperience',
      args: [this.player.dojoEntityId, amount]
    }])
  }
})
```

### 2. Trading Card Game

```javascript
({
  init() {
    // Create card collection
    this.collection = app.create('ui', {
      width: 800,
      height: 600,
      position: [0, 1.5, -2]
    })

    // Sync collection to blockchain
    this.collection.add('dojo', {
      components: ['Inventory'],
      syncInterval: 5000
    })

    this.collection.inventory = [
      { type: 'card', id: 'fire_dragon', rarity: 'legendary' },
      { type: 'card', id: 'healing_potion', rarity: 'common' }
    ]
  },

  async tradeCard(cardId, targetPlayer, offeredCardId) {
    // Execute trade onchain
    await world.dojo.execute([{
      target: world.dojo.getWorldAddress(),
      method: 'trade',
      args: [cardId, targetPlayer, offeredCardId]
    }])
  }
})
```

### 3. Persistent World Economy

```javascript
({
  init() {
    // Create marketplace
    this.marketplace = app.create('build', {
      blueprint: 'marketplace',
      position: [10, 0, 10]
    })

    // Sync marketplace to blockchain
    this.marketplace.add('dojo', {
      components: ['Position', 'Inventory', 'Economy']
    })

    this.marketplace.inventory = [] // Items for sale
    this.marketplace.balance = 1000000 // Gold reserves
  },

  async buyItem(itemId, price) {
    // Verify buyer has sufficient funds
    const playerGold = await world.dojo.getComponent(
      this.player.dojoEntityId, 'Gold'
    )

    if (playerGold >= price) {
      // Execute purchase onchain
      await world.dojo.execute([{
        target: world.dojo.getWorldAddress(),
        method: 'purchase',
        args: [itemId, price, this.player.dojoEntityId]
      }])
    }
  }
})
```

## Advanced Features

### Custom Components

```javascript
// Define custom Dojo component
const CustomSkillComponent = {
  name: 'Skills',
  schema: {
    primarySkill: 'string',
    skillLevel: 'uint',
    experience: 'uint'
  }
}

// Add to entity
player.add('dojo', {
  components: ['Position', 'Health', 'Skills'] // Custom component included
})

// Set custom component values
player.skills = {
  primarySkill: 'sword_mastery',
  skillLevel: 5,
  experience: 1200
}
```

### Event-Driven Updates

```javascript
// Listen for onchain events
world.events.on('dojo:transaction', async (data) => {
  console.log('Onchain transaction:', data)

  // Handle specific event types
  switch (data.method) {
    case 'combat':
      this.handleCombatResult(data.result)
      break
    case 'crafting':
      this.handleCraftingResult(data.result)
      break
  }
})
```

### Optimistic Execution

```javascript
// Execute locally first, confirm onchain later
async function quickAction(action) {
  // Immediate local result (optimistic)
  const localResult = executeLocally(action)

  try {
    // Confirm onchain
    const onchainResult = await world.dojo.execute(action)

    // If onchain differs, rollback local changes
    if (!validateResult(localResult, onchainResult)) {
      rollbackChanges(action)
      applyOnchainResult(onchainResult)
    }
  } catch (error) {
    // Onchain failed, rollback optimistic changes
    rollbackChanges(action)
  }
}
```

## Configuration

### DojoSystem Configuration

```javascript
// Customize Dojo behavior
const dojoConfig = {
  rpcUrl: 'https://starknet-sepolia.cartridge.gg',
  toriiUrl: 'https://your-torii-instance.com',
  worldAddress: '0x1234...abcd',
  maxRetries: 5,
  syncInterval: 1000 // milliseconds
}

// Initialize with custom config
await world.dojo.init(dojoConfig)
```

### Entity-Specific Settings

```javascript
// Fine-tune individual entity sync
entity.add('dojo', {
  worldAddress: '0x1234...abcd',
  components: ['Position', 'Health'],
  syncInterval: 2000,
  autoSync: true,
  optimisticUpdates: true,
  maxRetries: 3
})
```

## Development Workflow

### 1. Local Development

```bash
# Start Hyperfy with Dojo integration
npm run dev

# Local Dojo testnet (if needed)
docker-compose up -d dojo-testnet
```

### 2. Testing

```javascript
// Check Dojo connectivity
if (world.dojo.isConnected()) {
  console.log('🟢 Dojo connected')
} else {
  console.log('🔴 Fallback mode - Dojo not available')
}

// Test entity sync
const testEntity = app.create('box', { position: [0, 1, 0] })
const dojoId = await world.dojo.syncEntity(testEntity)
console.log('Entity synced:', dojoId)
```

### 3. Deployment

```javascript
// Production-ready configuration
const prodConfig = {
  rpcUrl: 'https://starknet-mainnet.cartridge.gg',
  toriiUrl: 'https://torii.yourgame.com',
  worldAddress: process.env.DOJO_WORLD_ADDRESS,
  maxRetries: 10
}

await world.dojo.init(prodConfig)
```

## Best Practices

### Performance Optimization

1. **Selective Sync**: Only sync essential components frequently
2. **Batch Updates**: Group multiple changes into single transactions
3. **Optimistic Execution**: Apply changes locally, confirm onchain later
4. **Caching**: Cache onchain data to reduce API calls

```javascript
// Good: Selective component sync
entity.add('dojo', {
  components: ['Position'], // Only position synced frequently
  syncInterval: 1000
})

entity.add('dojo', {
  components: ['Inventory'], // Inventory synced less frequently
  syncInterval: 10000
})
```

### Error Handling

```javascript
try {
  await world.dojo.execute(transaction)
} catch (error) {
  console.error('Onchain transaction failed:', error)

  // Fallback handling
  if (error.code === 'INSUFICIENT_FUNDS') {
    showInsufficientFundsMessage()
  } else if (error.code === 'NETWORK_ERROR') {
    scheduleRetry(transaction)
  }
}
```

### Security Considerations

1. **Input Validation**: Always validate onchain inputs
2. **Rate Limiting**: Implement transaction rate limiting
3. **Access Control**: Verify ownership before operations
4. **Audit Trail**: Log all onchain transactions

```javascript
// Always verify ownership
async function transferItem(itemId, targetPlayer) {
  const owner = await world.dojo.getComponent(itemId, 'Owner')
  if (owner.address !== world.web3.getAddress()) {
    throw new Error('Not owner of item')
  }

  // Proceed with transfer
  await world.dojo.execute([{
    target: world.dojo.getWorldAddress(),
    method: 'transfer',
    args: [itemId, targetPlayer]
  }])
}
```

## Troubleshooting

### Common Issues

1. **Dojo Not Connected**
   ```javascript
   if (!world.dojo.isConnected()) {
     console.error('Dojo not available - check network configuration')
   }
   ```

2. **Entity Sync Failure**
   ```javascript
   try {
     await world.dojo.syncEntity(entity)
   } catch (error) {
     console.error('Sync failed:', error)
     // Continue in offline mode
   }
   ```

3. **Transaction Failures**
   ```javascript
   try {
     await world.dojo.execute(transaction)
   } catch (error) {
     if (error.code === 'NETWORK_ERROR') {
       // Retry with exponential backoff
       setTimeout(() => retryTransaction(transaction), 2000)
     }
   }
   ```

### Debug Information

```javascript
// Get comprehensive debug info
const debugInfo = world.dojo.getDebugInfo()
console.log('Dojo Debug Info:', debugInfo)
/*
{
  isConnected: true,
  networkId: 'SN_SEPOLIA',
  worldAddress: '0x1234...abcd',
  syncedEntities: 5,
  pendingTransactions: 2,
  config: { ... }
}
*/
```

## Resources

- [DojoEngine Documentation](https://dojoengine.org)
- [Hyperfy Documentation](https://hyperfy.io)
- [StarkNet Documentation](https://docs.starknet.io)
- [Cartridge Controller](https://cartridge.gg)

## Support

For issues with this integration:
1. Check the browser console for detailed error messages
2. Verify network connectivity to Dojo services
3. Ensure all dependencies are installed correctly
4. Review transaction status on StarkNet explorers

---

**This integration represents the cutting edge of blockchain gaming technology**, combining the best of real-time 3D worlds with verifiable onchain game logic. Happy building! 🎮🔗