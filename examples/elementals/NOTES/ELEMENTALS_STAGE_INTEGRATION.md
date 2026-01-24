# Elementals Stage Integration Guide

## Overview

The `elemental-stage-2d.js` fighting stage is designed to work harmoniously with the `@elementals/` system. Instead of duplicating functionality, the stage leverages the existing elementals infrastructure for health management, inventory, and combat.

## Required Elementals Apps

For the stage to work properly, you need these elementals apps in your world:

### 1. **elemental-combat.js** (Required)
- **Purpose**: Handles health, damage, death, and respawn
- **Features**: 
  - Player health tracking
  - Death animations and respawn
  - Healing over time
  - Custom spawn points
- **Integration**: Stage sends health events to this app for KO handling

### 2. **elemental-core.js** (Recommended)
- **Purpose**: Inventory and item management
- **Features**:
  - Player inventory system
  - Item activation/deactivation
  - Item giving and taking
- **Integration**: Stage can give items to players (weapons, etc.)

### 3. **elemental-item-pistol.js** (Optional)
- **Purpose**: Combat pistol weapon
- **Features**:
  - Firing mechanics
  - Damage system
  - Magazine management
- **Integration**: Players can use weapons on the stage

### 4. **elemental-item-sword.js** (Optional)
- **Purpose**: Melee sword weapon
- **Features**:
  - Melee combat
  - Damage system
  - Attack animations
- **Integration**: Players can use melee weapons on the stage

## Stage Configuration

The stage has comprehensive configuration options:

### Camera Settings

- **Camera Distance** (Default: 15) - How far back the camera is from the stage
- **Camera Height** (Default: 5) - How high above the stage the camera is positioned
- **Follow Speed** (Default: 0.1) - How smoothly the camera follows player movement
- **Follow Player X** (Default: Yes) - Whether camera follows player left/right movement
- **Lock Mouse in Zone** (Default: Yes) - Prevents mouse from rotating camera (true 2D feel)
- **Hide Reticle in Zone** (Default: Yes) - Hides crosshair for cleaner 2D view
- **Disable Scroll Zoom in Zone** (Default: Yes) - Prevents mouse scroll from zooming camera into first-person

### Stage Visuals

- **Boundary Visibility** (Default: Invisible) - Show or hide the stage boundary trigger mesh
- **Death Zone Visibility** (Default: Invisible) - Show or hide death zone collider mesh

### Elementals Integration

- **Use Elementals Health System** (Default: Yes)
  - When enabled, stage uses `elemental-combat.js` for health/death/respawn
  - When disabled, stage won't apply damage (for testing or custom systems)

- **Use Elementals Inventory** (Default: Yes)
  - When enabled, stage can give items via `elemental-core.js`
  - When disabled, stage won't interact with inventory system

## How It Works

### 1. **Health System Integration**

When a player leaves the fighting stage boundary:

```javascript
// CLIENT: Stage detects player leaving
stageBoundary.onTriggerLeave = hit => {
  if (localPlayer.id === hit.playerId) {
    // Visual feedback
    deactivateStageCamera()
    hideUI()
    
    // Notify server to apply KO
    app.send('player-leave-stage', { playerId: hit.playerId })
  }
}

// SERVER: Apply KO damage
app.on('player-leave-stage', (data) => {
  if (props.useElementalsHealth !== false && gameActive) {
    const player = world.getPlayer(data.playerId)
    player.damage(player.health) // Instant KO via elementals
  }
})
```

The `elemental-combat.js` app receives the health event and:
- Plays death animation
- Handles respawn logic
- Teleports player to spawn point (set by stage)
- Restores full health

### 2. **Respawn System Integration**

When a player dies in the fighting zone, the stage sets a random spawn point:

```javascript
// SERVER: Listen for death events
world.on('health', ({ playerId, health }) => {
  if (health === 0 && playersInZone.has(playerId)) {
    const spawnPos = getRandomSpawnPoint()
    if (spawnPos) {
      // Set spawn point for elemental-combat to use
      world.set('elemental-combat:spawn', [spawnPos.x, spawnPos.y, spawnPos.z])
    }
  }
})
```

This ensures players respawn at one of the stage's spawn points after being KO'd.

### 3. **Trigger Visibility**

The stage allows you to hide trigger meshes while keeping collision detection active:

```javascript
// Configuration
{
  key: 'boundaryVisibility',
  type: 'switch',
  options: [
    { label: 'Visible', value: 'visible' },
    { label: 'Invisible', value: 'invisible' }
  ],
  initial: 'invisible'
}

// Hide visual meshes but keep triggers working
if (props.boundaryVisibility === 'invisible') {
  stageBoundary.traverse(child => {
    if (child.name === 'mesh' || child.isMesh) {
      child.visible = false
    }
  })
}
```

This is useful for production - players see the stage but not the invisible walls.

### 4. **Item System Integration**

The stage can give items to players using the elementals inventory:

```javascript
// Give pistol to player
app.emit('elemental-item:give', [playerId, 'pistol', 1])

// Give magazine to player  
app.emit('elemental-item:give', [playerId, 'magazine', 1])
```

## Setup Instructions

### Step 1: Add Required Apps

1. **Add elemental-combat.js** to your world
   - Configure death emote and duration
   - Set spawn points for respawn
   - Enable healing if desired

2. **Add elemental-core.js** to your world
   - This handles inventory management
   - Players will see action bar and backpack UI

3. **Add weapon apps** (optional)
   - `elemental-item-pistol.js` for ranged combat
   - `elemental-item-sword.js` for melee combat
   - Configure weapon properties as needed

### Step 2: Add Stage App

1. **Add elemental-stage-2d.js** to your world
2. **Configure GLB nodes** in your stage model:
   - `AreaTrigger` or `StageBoundary` or `FightingZone` - Fighting zone boundary (uses AreaTrigger pattern)
   - `SpawnPoint` through `SpawnPoint.004` - Player spawn points
   - `GmBndCol` - Death zones below stage (optional)
   - `GameBound` - General game boundary visual reference (optional)

3. **Configure stage settings**:
   - Camera settings (distance, height, follow speed)
   - Elementals integration (health system, inventory)
   - Game controls (start/stop/restart)

### Step 3: Test Integration

1. **Give players weapons**:
   - Use the "Give to Local Player" button in weapon apps
   - Or use stage teleport commands to give items

2. **Test combat**:
   - Players can damage each other with weapons
   - Health is managed by `elemental-combat.js`
   - Death and respawn work automatically

3. **Test stage boundaries**:
   - Players who leave the fighting area get KO'd
   - They respawn at configured spawn points
   - Health is restored by elementals system

## Benefits of Integration

### 1. **No Duplication**
- Stage doesn't duplicate health/inventory logic
- Single source of truth for player state
- Easier maintenance and updates

### 2. **Consistent Systems**
- All elementals apps work together
- Unified health and damage system
- Consistent respawn behavior

### 3. **Modularity**
- Stage focuses on fighting game mechanics
- Elementals handle RPG/combat mechanics
- Easy to mix and match systems

### 4. **Extensibility**
- Add new weapons without changing stage
- Add new item types without stage changes
- Stage works with any elementals-compatible items

## Troubleshooting

### Players Don't Take Damage
- Check that `elemental-combat.js` is added to world
- Verify "Use Elementals Health System" is enabled
- Check console for health system integration logs

### Players Don't Respawn
- Check that `elemental-combat.js` has spawn points configured
- Verify death emote is configured
- Check console for respawn events

### Items Don't Appear in Inventory
- Check that `elemental-core.js` is added to world
- Verify "Use Elementals Inventory" is enabled
- Check that weapon apps are configured with correct IDs

### Stage Boundaries Don't Work
- Check GLB model has `AreaTrigger` or `StageBoundary` node
- Verify node is positioned correctly around fighting area
- Check console for boundary detection logs

## Advanced Configuration

### Custom Spawn Points
Configure spawn points in `elemental-combat.js`:
- Use "Set Spawn" button to set custom spawn location
- Stage will use elementals spawn system for respawns

### Custom Death Behavior
Modify `elemental-combat.js` death settings:
- Change death emote animation
- Adjust death duration
- Customize respawn behavior

### Weapon Integration
Add custom weapons that work with the stage:
- Use `elemental-item-*` pattern
- Implement damage system compatible with elementals
- Stage will automatically work with any elementals-compatible weapons

## Example World Setup

```
World Apps:
├── elemental-combat.js (health/death/respawn)
├── elemental-core.js (inventory system)
├── elemental-stage-2d.js (fighting stage)
├── elemental-item-pistol.js (ranged weapon)
├── elemental-item-sword.js (melee weapon)
└── elemental-item-magazine-pistol.js (ammo)
```

This setup provides a complete fighting game experience with:
- Health and damage system
- Inventory management
- Fighting stage with boundaries
- Multiple weapon types
- Automatic respawn system

The stage and elementals work together seamlessly to provide a polished fighting game experience!

