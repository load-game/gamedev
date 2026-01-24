# 🔥 Hyperfy Arena - Competitive Blockchain Gaming

A complete competitive arena game built on Hyperfy with DojoEngine blockchain integration. Features fast-paced multiplayer combat with persistent onchain rewards, titles, and cosmetics.

## 🎮 Game Overview

**Hyperfy Arena** is a 4-8 player free-for-all combat game where players battle in real-time using Hyperfy's advanced physics and combat systems, with tournament results permanently recorded on StarkNet blockchain via DojoEngine.

### Core Features

- **🗺️ Arena Maps**: Professional multi-layer arena with strategic spawn points
- **⚔️ Combat System**: Integration with Elementals weapons and damage mechanics
- **🏆 Real-Time Scoring**: Live leaderboards and match statistics
- **⛓️ Blockchain Integration**: Tournament results, player stats, and NFT rewards on StarkNet
- **👑 Champion Titles**: Persistent player titles (Novice → Warrior → Champion → Legend)
- **⚔️ Weapon Skins**: Blockchain-minted cosmetic weapon rewards
- **📊 Season Play**: Weekly leaderboards and tournament rankings

## 🚀 Quick Start

### Prerequisites

1. **Hyperfy Core System**: Working Hyperfy world system
2. **DojoEngine Integration**: Local Katana + Torii running with CORS
3. **Elementals Combat**: Basic combat system weapons and health

### Setup Steps

#### 1. Start Your Local Dojo Environment

```bash
# Start complete environment with CORS
./examples/dojo-integration/start-complete-dojo.sh
```

#### 2. Load Arena Scripts

Add these scripts to your Hyperfy world in order:

1. `main-arena.js` - Main orchestrator (loads others automatically)
2. The system will load dependencies automatically:
   - `arena-map.js` - Arena environment and spawn points
   - `arena-match-controller.js` - Match flow and player management
   - `arena-combat-integration.js` - Elementals combat integration
   - `arena-scoring-ui.js` - Real-time UI and leaderboards
   - `deploy-arena-contracts.js` - Smart contract deployment
   - `arena-blockchain-integration.js` - Blockchain recording

#### 3. Start Playing

The arena will automatically start when enough players join (minimum 2). Players spawn with weapons and battle for 3 minutes.

## 🏗️ Architecture

### System Components

```
Hyperfy Arena System
├── Arena Map Layer (arena-map.js)
│   ├── 3D arena environment
│   ├── 8 spawn points
│   └── Boundary triggers
├── Game Logic Layer (arena-match-controller.js)
│   ├── Match start/stop flow
│   ├── Player respawn system
│   └── Score tracking
├── Combat Layer (arena-combat-integration.js)
│   ├── Elementals weapons integration
│   ├── Damage handling
│   └── Player health management
├── UI Layer (arena-scoring-ui.js)
│   ├── Real-time leaderboards
│   ├── Match HUD
│   └── Player statistics
├── Blockchain Layer (arena-blockchain-integration.js)
│   ├── Match result recording
│   ├── Title and skin rewards
│   └── Tournament history
└── Smart Contracts (contracts/arena.cairo)
    ├── TournamentResult model
    ├── ChampionTitle model
    ├── WeaponSkin model
    └── PlayerStats model
```

### Data Flow

1. **Match Starts** → Players spawn with weapons
2. **Combat Occurs** → Real-time damage and scoring
3. **Match Ends** → Results calculated and displayed
4. **Blockchain Recording** → Tournament results stored on StarkNet
5. **Rewards Awarded** → Titles and skins minted as NFTs

## 🎯 Game Mechanics

### Match Rules

- **Duration**: 3 minutes per match
- **Players**: 2-8 players (auto-balanced)
- **Win Condition**: Highest score at time expiration
- **Scoring**:
  - Elimination: 3 points
  - Assist: 1 point
  - Damage dealt: score contribution

### Spawn System

- 8 spawn points positioned strategically around arena
- 3-second respawn timer
- 2-second spawn protection (invulnerability)
- Round-robin spawn assignment to prevent camping

### Combat Balance

- Default weapons: Pistol (ranged), Sword (melee)
- Equal starting loadout for all players
- Damage: Pistol 15-25, Sword 20-35 (base values)
- Critical hits: 20% chance, 2x damage

## ⛓️ Blockchain Features

### Onchain Data

**Tournament Results**
- Match ID and timestamp
- Winner and all participants
- Individual player scores and kills
- Season and tournament type

**Player Progression**
- Total matches, wins, kills, deaths
- Best kill streak and favorite weapon
- Playtime statistics
- Seasonal rankings

**Rewards System**
- **Champion Titles**: Persistent NFT titles based on wins
  - Arena Novice (0 wins)
  - Arena Warrior (5+ wins)
  - Arena Champion (20+ wins)
  - Arena Legend (50+ wins)
- **Weapon Skins**: Cosmetic NFTs earned through performance
  - Common: 10+ kills or 100+ points
  - Rare: 15+ kills or 150+ points
  - Epic: 20+ kills or 200+ points
  - Legendary: Exceptional performance

### Smart Contract Models

```cairo
TournamentResult {
    match_id: felt252,
    winner: ContractAddress,
    participants: Array<ContractAddress>,
    timestamps: u64,
    season_id: u32,
    total_kills: u32,
    match_duration: u32
}

ChampionTitle {
    player: ContractAddress,
    title: felt252,
    title_name: ByteArray,
    tournaments_won: u32,
    total_score: u32
}

WeaponSkin {
    token_id: felt252,
    owner: ContractAddress,
    skin_type: felt252,
    rarity: u32,
    tournament_won: felt252
}
```

## 🧪 Testing and Development

### Quick Testing

1. **Load all arena scripts** in your Hyperfy world
2. **Run the test suite**:
   ```javascript
   app.testArenaFlow() // Complete blockchain flow test
   ```
3. **Check system status**:
   ```javascript
   app.debugArena() // Full system health report
   ```

### Test Commands

- `app.testArenaFlow()` - Test complete integration
- `app.debugArena()` - System health and debugging
- `app.forceTournament()` - Create test tournament
- `app.simulateFullMatch()` - Simulate full match with blockchain
- `app.getArenaStatus()` - Get current arena status

### Development Mode

Enable in `main-arena.js`:
```javascript
const ARENA_CONFIG = {
  autoStart: true,
  debugMode: true,
  enableTesting: true
}
```

## 🔧 Configuration

### Game Balance Adjustments

Located in respective system files:

**Match Settings** (`arena-match-controller.js`):
```javascript
const MATCH_CONFIG = {
  preMatchTime: 10,
  matchDuration: 180,
  respawnTime: 3,
  killPoints: 3,
  assistPoints: 1
}
```

**Combat Settings** (`arena-combat-integration.js`):
```javascript
const COMBAT_CONFIG = {
  damageMultiplier: 1.0,
  spawnProtection: true,
  selfDamage: false
}
```

**Blockchain Thresholds** (`arena-blockchain-integration.js`):
```javascript
const INTEGRATION_CONFIG = {
  minScoreForRecording: 10,
  skinRewardThreshold: 100,
  championTitleThreshold: 5
}
```

### Custom Arena Maps

Modify `arena-map.js` to create custom arenas:

```javascript
const ARENA_CONFIG = {
  size: 50,           // Arena dimensions
  spawnPoints: [...], // Custom spawn positions
  wallHeight: 15      // Boundary height
}
```

## 📊 Monitoring and Statistics

### Real-Time Stats

- Match timer and countdown
- Live player leaderboard
- Individual player stats (K/D/A, score, health)
- Blockchain transaction status
- Tournament history

### Blockchain Analytics

```javascript
// Get player's blockchain achievements
const stats = await app.getPlayerBlockchainStats(playerId)

// Get tournament history
const history = app.getTournamentHistory()

// Query current season leaderboard
const leaderboard = await app.getLeaderboard(seasonId)
```

## 🌐 Network Configuration

### Local Development

- **Network**: LOCAL_KATANA
- **RPC**: http://localhost:5050
- **Torii**: http://localhost:8080
- **World Address**: Your deployed arena world contract

### Production Deployment

1. **Deploy to StarkNet Sepolia** testnet
2. **Update configuration** in `deploy-arena-contracts.js`
3. **Configure network endpoints** in DojoSystem
4. **Test onchain functionality** before mainnet deployment

## 🎨 UI Customization

### HUD Positioning

In `arena-scoring-ui.js`:
```javascript
const UI_CONFIG = {
  hudPosition: [20, 80],           // X, Y percentages
  leaderboardPosition: [80, 20],   // X, Y percentages
  highlightLocalPlayer: true
}
```

### Color Themes

UI colors are configurable throughout the system:
- Damage numbers: White/Orange/Red based on type
- Leaderboard: Gold for top 3, green for local player
- Notifications: Contextual colors (red=danger, green=success)

## 🚀 Future Enhancements

### Planned Features

1. **Team Modes**: 2v2, 3v3, 4v4 competitive modes
2. **Weapon Variety**: More weapon types and unique abilities
3. **Map Variety**: Multiple arena layouts with different strategies
4. **Tournament System**: Scheduled tournaments with prize pools
5. **Spectator Mode**: Watch matches and view live statistics
6. **Guild Integration**: Team-based competitions
7. **Cross-World Ranking**: Global leaderboards across Hyperfy worlds

### Technical Improvements

1. **Performance Optimization**: Reduced blockchain transaction overhead
2. **Advanced Matchmaking**: Skill-based player matching
3. **Replay System**: Match recording and playback
4. **Anti-Cheat**: Server-side validation and analytics
5. **Mobile Support**: Touch controls and mobile optimization

## 🤝 Contributing

### Code Structure

- **Modular Design**: Each system is independent and replaceable
- **Event-Driven**: Systems communicate through world events
- **Error Recovery**: Automatic fault detection and recovery
- **Testing**: Comprehensive test suite for all functionality

### Adding New Features

1. Create new system file following naming convention
2. Add to required scripts in `main-arena.js`
3. Implement event handlers for system communication
4. Add blockchain models if needed
5. Update documentation and tests

## 📄 License

This arena system extends Hyperfy's core capabilities and is part of the Hyperfy ecosystem. Please follow Hyperfy's licensing terms and DojoEngine's Apache 2.0 license for blockchain components.

---

## 🎯 You're Ready!

With Hyperfy Arena, you now have a complete competitive gaming system that combines:
- **Fast real-time 3D combat** (Hyperfy)
- **Persistent blockchain progression** (DojoEngine)
- **Professional game mechanics** (Arena design)
- **True digital ownership** (NFT titles and skins)

**Load the scripts, join the arena, and compete for blockchain glory!** 🏆⚡🔥

For support and updates, check the Hyperfy documentation and DojoEngine guides.