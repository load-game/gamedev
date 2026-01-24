# Fireball Elemental Item - FINAL VERSION

## How It Works

The fireball supports **two modes**:

### Mode 1: World Pickup (Non-Admin Players)
1. Drop `elemental-item-fireball.js` in your world
2. Spawns as red flaming orb at position
3. Non-admin players walk close → "Pick Up Fireball" prompt appears
4. Press **E** → orb disappears from world, appears in their inventory
5. Press **B** → drag to hotbar → equip → shoot!

### Mode 2: Admin Give (Testing/Admin)
1. In editor, click "Give to Local Player" button
2. Fireball added directly to inventory
3. Equip and shoot immediately

## Complete Setup

### Step 1: Add to World
Drop `elemental-item-fireball.js` into your world folder or add via editor.

### Step 2: Position (Optional)
In world file or editor, set position where it spawns:
```javascript
app.position = [x, y, z]
```

### Step 3: Test
**As Admin:**
- Click "Give to Local Player" button
- Press B → drag to hotbar → press key → left-click to shoot

**As Player:**
- Walk to red flaming orb
- Press E when prompted "Pick Up Fireball"
- Press B → drag to hotbar → press key → left-click to shoot

## Configuration

Select fireball in editor:
- **ID**: `fireball` (must be unique)
- **Name**: Display name (e.g., "Fireball Orb")
- **Icon**: Inventory icon texture
- **Stack**: 1 (not stackable)
- **Shoot Animation GLB**: Optional animation when shooting
- **Droppable**: false (default, can be changed)

## Troubleshooting

**Can't see fireball orb?**
- Check console for errors
- Verify script loaded
- Ensure position not inside geometry

**Pickup not working?**
- Must be on client side (not headless server)
- Check distance (should be within ~3 units)
- Verify action key bound (E by default)

**Can't shoot?**
- Must equip from hotbar first
- Need pointer lock (click in game)
- Wait 1 second charge
- 4 second cooldown between shots

**Admin button not working?**
- Ensure player selected
- Check console for errors
- Try spawning fresh instance

**Damage not working?**
- Need enemy with health component
- Check elemental-mob.js for mob setup
- Or elemental-combat.js for PvP

## Technical Details

**Client-Side:**
- Visual orb creation
- Particle effects (fire + sparkles)
- Input handling
- Pickup action
- Animation playback

**Server-Side:**
- Projectile physics
- Collision detection
- Damage application
- State syncing
- Cooldown enforcement

**State Management:**
- `heldBy = null` → orb in world, pickup active
- `heldBy = playerId` → orb held, pickup inactive
- Updates all clients via events

## State Flow

```
Spawn → Orb in world (pickup active)
  ↓ (player presses E)
Pickup → Give to player inventory
  ↓ (player equips from hotbar)
Equip → Orb follows player
  ↓ (player left-clicks)
Shoot → Projectile + explosion
  ↓ (player unequips)
Unequip → Orb returns to world
```

## Files

- `elemental-item-fireball.js` - Main script
- `FIREBALL_SIMPLE.md` - Simple usage guide
- This file - Complete documentation

## Final Notes

✅ Works for non-admin players (world pickup)
✅ Works for admin testing (give button)
✅ Integrates with elemental inventory
✅ Full projectile physics
✅ Explosion effects
✅ Proper state management
✅ Multiple players can have fireballs
✅ Clean server/client separation
