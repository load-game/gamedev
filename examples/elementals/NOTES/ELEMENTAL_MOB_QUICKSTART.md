# Elemental Mob Quick Start

## What You Get

✅ **AI Mobs** that chase and attack players  
✅ **Works with elemental weapons** - pistols, swords, etc.  
✅ **Threat system** - mobs target players who damage them  
✅ **Health regeneration** - mobs heal when not in combat  
✅ **Death and respawn** - mobs die, despawn, and respawn  
✅ **Damage numbers** - orange numbers for mob damage (integrated into `elemental-combat.js`)

## Setup (3 Steps)

### 1. Add Core Apps
```
Add to world:
├── elemental-combat.js (handles health/death/damage for players AND mobs)
├── elemental-core.js (inventory system)
└── elemental-mob.js (the AI mob)
```

### 2. Configure Mob
- Upload GLB model with `avatar` mesh
- Set mob name (e.g., "Skeleton Warrior")
- Set max health (default: 100)
- Add emotes (idle, run, attack, dead)
- Configure attack damage: `min,max,crit%,crit_mult` (e.g., "10,20,30,2")

### 3. Add Weapons
```
Add weapon apps:
├── elemental-item-pistol.js
└── elemental-item-sword.js
```

## How It Works

### Player → Mob
1. Player shoots/hits mob with weapon
2. Mob takes damage (health bar updates)
3. **Orange damage numbers** appear above mob
4. Mob adds player to threat table
5. Mob chases and attacks player

### Mob → Player
1. Player gets close to mob (aggro distance)
2. Mob chases player
3. Mob reaches player and attacks
4. **White damage numbers** appear above player
5. Player dies → `elemental-combat.js` handles respawn

## GLB Requirements

Your mob GLB needs:
```
MobModel.glb
├── avatar (SkinnedMesh) - Main character
└── Optional:
    ├── Sword (weapon mesh)
    ├── Capsule (collision mesh)
    └── Bones: rightHand, head
```

## Testing

1. **Add elemental-combat.js** first
2. **Add elemental-mob.js** and configure it
3. **Give yourself a weapon** (pistol or sword)
4. **Approach the mob** - it should aggro
5. **Attack the mob** - orange damage numbers should appear
6. **Let mob attack you** - white damage numbers should appear

## Key Features

### AI Behavior
- **Aggro Distance**: 10m (configurable)
- **Leash Distance**: 11m (returns to spawn)
- **Attack Range**: 1.3m (melee range)
- **Run Speed**: 6 m/s (configurable)

### Combat Stats
- **Max Health**: 100 (configurable)
- **Attack Rate**: 1.3 seconds (configurable)
- **Regen Rate**: 1 second (configurable)
- **Regen Amount**: 1 HP (configurable)

### Death Cycle
```
Dead (3s) → Despawn (3s) → Spawn (3s) → Idle
```

## Damage Format

Attack damage uses this format: `min,max,crit%,crit_mult`

**Examples:**
- `"10,20,30,2"` = 10-20 damage, 30% crit chance, 2x crit multiplier
- `"5,15,50,1.5"` = 5-15 damage, 50% crit chance, 1.5x crit multiplier
- `"20,40,10,3"` = 20-40 damage, 10% crit chance, 3x crit multiplier

## Troubleshooting

**Mob doesn't spawn?**
- Check GLB has `avatar` mesh
- Check console for errors

**Can't damage mob?**
- Make sure `elemental-combat.js` is added (handles mob damage numbers)
- Weapons are updated to support mobs (pistol/sword already compatible)

**Mob doesn't attack?**
- Check aggro distance
- Verify attack emote is set
- Check attack damage format

**Damage numbers wrong color?**
- Mob damage = **Orange** 🟠
- Player damage = **White** ⚪
- Critical hits = **Red** 🔴

## That's It!

You now have a complete mob combat system that works seamlessly with your elemental weapons and health system. No separate "extended" app needed - it's all built into `elemental-combat.js`!
