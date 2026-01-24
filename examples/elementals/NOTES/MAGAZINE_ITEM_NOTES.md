# Magazine Item Implementation Notes

## Overview
The magazine item is now a **holdable/equippable item** that works similarly to the food item. When equipped, you hold it in your left hand.

## Key Differences from Pistol

### Pistol (elemental-item-pistol.js)
- **Active combat item** - fires, reloads, ejects magazines
- **Tracks ammo internally** - `ammo` and `magazineCount` variables
- **Right hand attachment** - Uses `rightHand` bone
- **Complex input handling** - Fire, reload, keybinds
- **Physics ejection** - Creates dynamic rigidbody for ejected magazines

### Magazine (elemental-item-magazine-pistol.js)
- **Passive holdable item** - Just displayed in hand
- **No ammo tracking** - It's just a visual item you carry
- **Left hand attachment** - Uses `leftHand` bone
- **No input handling** - Just follows hand position
- **Simple visual** - Just the magazine mesh scaled and positioned

## GLB Structure Requirements

### For Pistol
```
CombatPistol.glb
├── CombatPistolSkin (SkinnedMesh)
│   ├── Gun_Muzzle (Bone) - Fire origin point
│   ├── Gun_GripR (Bone) - Right hand anchor
│   └── WAPClip (Bone/Mesh) - Magazine mesh
```

### For Magazine
```
Magazine.glb
├── WAPClip (Mesh) - Magazine visual
└── (or any mesh named Magazine/Mag/Clip)
```

## Usage Flow

1. **Add both items to world** (pistol and magazine apps)
2. **Give magazine to player** - It shows up in backpack
3. **Equip magazine** - Player holds it in left hand
4. **Unequip magazine** - Goes back to inventory
5. **Give pistol to player** - Shows up in backpack
6. **Equip pistol** - Player holds it in right hand
7. **Fire/Reload** - Pistol uses internal magazine count

## Current Limitation

The pistol currently **tracks magazines internally** with `magazineCount`. To make it consume actual magazine items from inventory:

### TODO: Magazine Consumption Integration

In `elemental-item-pistol.js`, modify the `server.reload()` function:

```javascript
reload(data) {
	if (magazineCount <= 0) return
	if (ammo >= (props.magazineSize || 15)) return
	
	// TODO: Consume magazine item from inventory
	// Instead of just decrementing magazineCount,
	// we need to:
	// 1. Check if player has 'pistol-magazine' in inventory
	// 2. Consume 1 magazine item
	// 3. Refill ammo
	
	// For now, just internal tracking:
	magazineCount -= 1
	ammo = props.magazineSize || 15
	
	hooks.call('reload', { ammo, magazineCount })
}
```

Future implementation would involve:
```javascript
// Check inventory for magazine item
world.emit('elemental-core:has-item', [player.id, 'pistol-magazine'], (hasItem) => {
	if (hasItem) {
		// Consume magazine
		app.emit('elemental-item:take', [player.id, 'pistol-magazine', 1])
		// Refill ammo
		ammo = props.magazineSize || 15
		hooks.call('reload', { ammo, magazineCount })
	}
})
```

## Configuration

### Magazine Item Props
- **ID**: `pistol-magazine` (must match what pistol looks for)
- **Stack**: 30 (can carry lots of magazines)
- **Droppable**: Yes (can drop magazines)
- **Scale**: Adjustable for visual sizing

### Pistol Item Props
- **Magazine Size**: 15 rounds (how many bullets per magazine)
- **Starting Magazines**: 3 (how many magazines you start with)
- **Eject Force**: 2 (how hard empty mags are ejected)
- **Despawn Time**: 5 seconds (how long ejected mags stay)

## Testing Checklist

- [ ] Magazine can be given to player
- [ ] Magazine shows up in backpack
- [ ] Magazine can be equipped (held in left hand)
- [ ] Magazine follows hand movement smoothly
- [ ] Magazine can be unequipped
- [ ] Pistol can be equipped while holding magazine
- [ ] Pistol ejects magazine on reload
- [ ] Ejected magazine has physics (falls, spins, despawns)
- [ ] Both items have unique IDs (no conflicts)

## Next Steps

1. **Test both items together** - Equip magazine in left hand, pistol in right
2. **Fine-tune magazine positioning** - Use `scale` prop to adjust size
3. **Implement magazine consumption** - Make pistol actually consume magazine items
4. **Add magazine pickup system** - Pick up ejected magazines from ground (optional)
5. **Add shell casings** - Eject bullet shells on fire (separate from magazine ejection)

