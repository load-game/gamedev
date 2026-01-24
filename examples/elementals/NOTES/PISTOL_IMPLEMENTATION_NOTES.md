# Combat Pistol Implementation Notes

## ✅ Completed Tasks

### 1. **SkinnedMesh Integration**
- Script now uses `app.get('CombatPistolSkin')` to get the skinned mesh from the GLB
- Properly clones the mesh for each player instance
- Gets bone references for key components:
  - `Gun_Muzzle` - For muzzle flash positioning
  - `Gun_GripR` - For hand attachment reference
  - `WAPClip` - Magazine slot bone

### 2. **Player Hand Anchoring**
- Uses `player.getBoneTransform('rightHand')` to get the player's right hand bone transform
- Pistol follows the hand in real-time via `lateUpdate()`
- Position and rotation are properly synced to the hand matrix
- Optional offset adjustments commented out for fine-tuning alignment

### 3. **Magazine System**
- Added `magazineSize` prop (default: 15 rounds)
- Added `startingMags` prop (default: 3 magazines)
- Tracks current ammo and magazine count separately
- Magazine visibility toggles based on inventory state

### 4. **Reload Mechanic**
- Press **R key** to reload
- Consumes one magazine from inventory
- Refills ammo to full magazine capacity
- Server-authoritative ammo tracking
- Client receives updated ammo/magazine counts

### 5. **Muzzle Flash Positioning**
- Muzzle flash now uses the actual `Gun_Muzzle` bone position
- Falls back to player height + 1.5m if bone not available
- Server creates temporary emissive sphere for debugging

### 6. **Animation Placeholder System**
- Added props for three emote animations:
  - `equipEmote` - When pistol is equipped
  - `fireEmote` - When firing
  - `reloadEmote` - During reload
- Code commented out with `TODO` markers
- Uses `player.applyEffect({ emote: url })` pattern

### 7. **Props Configuration**
- Organized into clear sections:
  - Basic Item Properties
  - Ammo & Magazine Settings
  - Animation Emotes
  - Admin Tools
- All new props have helpful labels and hints

## 🔧 What You Need to Do Next

### 1. **Test the GLB Structure**
Run the script and check console for warnings:
```
[pistol] CombatPistolSkin not found in GLB!
[pistol] Gun_Muzzle bone not found
[pistol] Gun_GripR bone not found
[pistol] WAPClip bone not found
```

If you see these warnings, the bone/mesh names in your Blender GLB don't match. Check the exact names in Blender and update lines 33, 45-49 in the script.

### 2. **Fine-Tune Hand Alignment**
The pistol should follow the right hand, but you may need to add offsets for perfect alignment. Uncomment and adjust these lines (143-145):
```javascript
pistolSkin.position.x += 0.05; // Move left/right
pistolSkin.position.y -= 0.02; // Move up/down
pistolSkin.rotation.x += 0.1;  // Rotate for better grip
```

Test in-game and tweak the values until the grip looks natural.

### 3. **Add Animation Emotes**
Once you have the GLB animations ready:

1. Upload your emote GLBs to Hyperfy
2. In the pistol app config, add them to the respective fields:
   - Equip Animation
   - Fire Animation  
   - Reload Animation
3. Uncomment the `player.applyEffect()` calls at:
   - Lines 62-67 (equip)
   - Lines 99-104 (fire)
   - Lines 116-124 (reload)

Adjust the `duration` values to match your animation lengths.

### 4. **Bone Animations** (Advanced)
If you want to animate individual bones (slide, hammer, trigger):

```javascript
// In client update() or lateUpdate()
const slideBone = pistolSkin.getBone('Gun_Cock1');
const hammerBone = pistolSkin.getBone('Gun_Hammer');
const triggerBone = pistolSkin.getBone('Gun_Trigger_Pr');

// Animate slide on fire
if (slideBone && justFired) {
  slideBone.position.z -= 0.05; // Pull back
  // Reset after delay
}

// Animate hammer on fire
if (hammerBone && justFired) {
  hammerBone.rotation.x -= 0.5; // Rotate back
}
```

### 5. **Magazine Item Integration**
When you create the magazine consumable item:

1. In `elemental-item-magazine.js`, give it the same ID pattern
2. In pistol reload server code (line 255), replace:
   ```javascript
   // TODO: When magazine item exists, consume it from elemental-core inventory
   // hooks.take(1); // This would consume from inventory
   ```
   
   With:
   ```javascript
   // Try to consume a magazine from inventory
   app.emit('elemental-item:take', [player.id, 'pistol-magazine', 1]);
   ```

3. Magazine item should add to `magazineCount` when picked up

## 🎮 Controls

- **Left Mouse Button** - Fire (must have ammo and pointer locked)
- **R Key** - Reload (consumes one magazine from inventory)

## 📊 Current Defaults

- Magazine Size: 15 rounds
- Starting Magazines: 3
- Fire Rate: 0.5 seconds between shots
- Damage: 20-40 (20% crit chance for 1.8x multiplier)
- Range: 100 units
- Projectile Speed: 50 units/second
- Projectile Lifetime: 3 seconds

## 🐛 Known Issues / TODOs

1. **Magazine visibility** - Currently just toggles visibility, doesn't detach/reattach the magazine mesh during reload animation
2. **Ejection port** - `Gun_VFX_Eject` bone not used yet for shell ejection particles
3. **Laser/Suppressor attachments** - `WAPFlashLaser` and `WAPSupp` bones available but not implemented
4. **Ammo UI** - No on-screen ammo counter yet (could add a screen-space UI)
5. **Empty magazine** - No different behavior when clicking with empty mag (should play "empty click" sound)

## 📝 Bone Reference

Your GLB has these bones available:
- `Pose` - Root bone
- `Gun_Root` - Pistol root
- `Gun_GripR` - Right hand grip point ✅ Used
- `Gun_Trigger_Pr` - Trigger (can animate)
- `Gun_Cock1` - Slide (can animate for recoil)
- `Gun_Hammer` - Hammer (can animate on fire)
- `Gun_Safety` - Safety switch
- `Gun_VFX_Eject` - Shell ejection point
- `Gun_Muzzle` - Muzzle flash point ✅ Used
- `WAPClip` - Magazine slot ✅ Used
- `WAPFlashLaser` - Laser/flashlight mount
- `WAPSupp` - Suppressor mount

## 🔗 Related Files

- `/cool-scripts/0.10.0/elementals/elemental-core.js` - Main inventory system
- `/cool-scripts/0.10.0/elementals/elemental-combat.js` - Combat/damage system
- `/cool-scripts/0.10.0/elementals/elemental-item-sword.js` - Reference melee weapon

