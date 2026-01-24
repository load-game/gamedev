# Elemental Mob System

## Overview

The Elemental Mob System provides AI-controlled creatures that integrate seamlessly with the `@elementals/` ecosystem. Similar to how `prism-mob.js` works with the prism system, `elemental-mob.js` creates intelligent mobs that can fight players using elemental weapons and health systems.

## Required Apps

### Core Elementals Apps
- **`elemental-combat.js`** - Handles player health, death, respawn, and mob combat integration
- **`elemental-core.js`** - Manages inventory and item system

### Weapon Apps
- **`elemental-item-pistol.js`** - Can damage mobs with projectiles
- **`elemental-item-sword.js`** - Can damage mobs with melee attacks

### Mob App
- **`elemental-mob.js`** - Creates AI mobs that fight players

## How It Works

### 1. **Mob AI System**

The mob follows a state machine with these phases:

```javascript
// Mob States
Spawn → Idle → Chase → Attack → Leash → Dead → Despawn → Spawn
```

**States:**
- **Spawn**: Mob appears and waits for players
- **Idle**: Mob waits and regenerates health
- **Chase**: Mob runs toward nearest player
- **Attack**: Mob attacks nearby players
- **Leash**: Mob returns to spawn point if too far
- **Dead**: Mob plays death animation
- **Despawn**: Mob disappears temporarily

### 2. **Combat Integration**

**Mobs attacking players:**
```javascript
// Mob damages player using elemental system
app.emit('elemental-item:dmg', [playerId, amount, crit])
player.damage(amount) // Direct damage to player
```

**Players attacking mobs:**
```javascript
// Weapon hits mob
world.emit('elemental-mob:hit', [mobId, playerId, amount, crit])
```

### 3. **Health System**

Mobs use their own health tracking but integrate with elemental damage display:
- **Player damage**: Shows white/orange numbers above mob
- **Critical hits**: Shows red numbers above mob
- **Health bar**: Changes color (green → yellow → red) as health decreases

## Configuration

### Mob Settings

#### **Basic Properties**
- **Assets**: GLB model with avatar, weapon, and collision meshes
- **Mob Name**: Display name shown above health bar
- **Max Health**: Starting health (default: 100)

#### **Animations**
- **Idle Emote**: Animation when mob is waiting
- **Run Emote**: Animation when mob is chasing
- **Attack Emote**: Animation when mob is attacking
- **Dead Emote**: Animation when mob dies

#### **Combat Stats**
- **Attack Damage**: Format `min,max,crit_chance,crit_multiplier` (e.g., "10,20,30,2")
- **Attack Rate**: Seconds between attacks (default: 1.3)
- **Run Speed**: Movement speed when chasing (default: 6)

#### **AI Behavior**
- **Aggro Distance**: How close players need to be to trigger chase (default: 10)
- **Leash Distance**: How far mob can chase before returning home (default: 11)
- **Regen Rate**: Seconds between health regeneration (default: 1)
- **Regen Amount**: Health restored per regeneration (default: 1)

## GLB Model Requirements

Your mob GLB should include these nodes:

```
MobModel.glb
├── Avatar (SkinnedMesh) - Main character model
├── Sword (Mesh) - Weapon model (optional)
├── Sphere (Mesh) - Debug aggro sphere (optional)
├── Capsule (Mesh) - Collision mesh
└── CapsuleCollider (Collider) - Physics collider
```

**Bone Structure (if using SkinnedMesh):**
- `rightHand` - For weapon attachment
- `head` - For nametag positioning

## Setup Instructions

### Step 1: Add Required Apps

1. **Add elemental-combat.js**
   - Handles player health/death/respawn
   - Handles mob combat integration
   - Shows damage numbers for both players and mobs
   - Configure death emote and spawn points

2. **Add elemental-core.js**
   - Manages inventory system
   - Players will see action bar and backpack

3. **Add weapon apps**
   - `elemental-item-pistol.js` for ranged combat
   - `elemental-item-sword.js` for melee combat

### Step 2: Add Mob App

1. **Add elemental-mob.js** to your world
2. **Configure GLB model** with mob assets
3. **Set mob properties**:
   - Upload GLB model as "Assets"
   - Set mob name and max health
   - Configure attack damage and rate
   - Set AI behavior (aggro distance, leash distance)
   - Add emote animations

### Step 3: Test Integration

1. **Give players weapons**:
   - Use "Give to Local Player" in weapon apps
   - Or use elemental-core inventory system

2. **Test combat**:
   - Players can damage mobs with weapons
   - Mobs will chase and attack players
   - Health is managed by elemental-combat.js

3. **Test AI behavior**:
   - Mobs should aggro when players get close
   - Mobs should chase players within leash distance
   - Mobs should return home when players are too far

## Combat Flow

### Player vs Mob
1. **Player approaches mob** → Mob enters chase state
2. **Player attacks mob** → Weapon deals damage, mob health decreases
3. **Mob reaches player** → Mob enters attack state, damages player
4. **Player dies** → elemental-combat.js handles respawn
5. **Mob dies** → Mob plays death animation, despawns, respawns

### Mob vs Player
1. **Mob detects player** → Enters chase state
2. **Mob reaches player** → Enters attack state
3. **Mob attacks** → Deals damage to player using elemental system
4. **Player health reaches 0** → elemental-combat.js handles death/respawn

## Advanced Features

### 1. **Threat System**

Mobs use a threat table to determine targets:
- **Damage generates threat** - Players who damage mob get higher threat
- **Highest threat = target** - Mob chases player with most threat
- **Threat decays** - Threat decreases over time if player stops fighting

### 2. **Regeneration**

Mobs regenerate health when not in combat:
- **Regen Rate**: Time between regeneration ticks
- **Regen Amount**: Health restored per tick
- **Only when idle** - No regeneration while chasing/attacking

### 3. **Leash System**

Mobs return to spawn point if players get too far:
- **Leash Distance**: Maximum chase range
- **Return to spawn** - Mob runs back to starting position
- **Reset threat** - Threat table clears when mob leashes

### 4. **Death and Respawn**

Mob death cycle:
1. **Health reaches 0** → Enter dead state
2. **Play death animation** → Dead emote plays
3. **Despawn** → Mob becomes invisible
4. **Wait respawn time** → Timer before respawn
5. **Respawn** → Mob returns to spawn point with full health

## Integration Benefits

### 1. **Unified Systems**
- Uses same damage display as elemental weapons
- Integrates with elemental health system
- Works with elemental inventory system

### 2. **Consistent Experience**
- Same damage numbers and effects
- Same death/respawn mechanics
- Same weapon compatibility

### 3. **Modular Design**
- Add mobs without changing weapon code
- Add weapons without changing mob code
- Mix and match different systems

## Troubleshooting

### Mob Doesn't Spawn
- Check GLB model is uploaded as "Assets"
- Verify mob name is set
- Check console for initialization errors

### Mob Doesn't Attack Players
- Check aggro distance setting
- Verify mob has attack emote configured
- Check attack damage format (min,max,crit_chance,crit_multiplier)

### Players Can't Damage Mob
- Check elemental-combat-extended.js is added
- Verify weapon apps are updated for mob combat
- Check mob tag format (should start with 'elemental-mob:')

### Mob Gets Stuck
- Check leash distance is reasonable
- Verify spawn point is accessible
- Check for collision issues in GLB model

## Example World Setup

```
World Apps:
├── elemental-combat.js (player/mob health/death/respawn)
├── elemental-core.js (inventory system)
├── elemental-item-pistol.js (ranged weapon)
├── elemental-item-sword.js (melee weapon)
└── elemental-mob.js (AI mobs)
```

This setup provides:
- **Player combat system** with health, weapons, inventory
- **AI mob system** with intelligent behavior
- **Integrated combat** where players and mobs can fight each other
- **Unified damage system** with consistent visuals and mechanics

The elemental mob system creates a complete PvE experience that integrates seamlessly with the existing elemental ecosystem!
