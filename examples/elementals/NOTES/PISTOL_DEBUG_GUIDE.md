# Pistol Script Debugging Guide

## Fixed Errors (v2)

### ✅ Error 1: "Cannot read properties of null (reading 'clone')"
**Cause:** The script was trying to find a node named 'CombatPistolSkin' that didn't exist in the app's model.

**Fix:** 
- Script now tries multiple possible node names
- Falls back to cloning the entire app if no specific node found
- Added comprehensive null checks and error logging

### ✅ Error 2: "Cannot read properties of undefined (reading 'position')"
**Cause:** The cloned pistolSkin didn't have a position property, or it was undefined.

**Fix:**
- Added null check for `pistolSkin.position` before accessing
- Added fallback positioning (player's right side) if hand bone not found
- Better error logging to identify what went wrong

## How to Test

1. **Give the pistol** - Click the "Give" button in the app config
2. **Check the console** for these messages:

### ✅ Good Signs:
```
[pistol] Initializing pistol for player: YourName
[pistol] Found mesh node: CombatPistol
[pistol] Pistol instance created and added to world
[pistol] Ammo: 15 rounds, 3 magazines
```

### ⚠️ Warnings (Not Critical):
```
[pistol] No specific mesh found, cloning entire app model
[pistol] Gun_Muzzle bone not found - will use fallback positioning
[pistol] Not a SkinnedMesh - bone animations won't work
```
These mean the script is working but using fallbacks.

### 🚨 Critical Errors:
```
[pistol] CRITICAL: Could not create pistol instance!
[pistol] App children: []
```
This means the app has no model attached at all.

## Troubleshooting

### Problem: Pistol doesn't appear
**Solutions:**
1. Check that your pistol GLB is attached to the app as the "Model"
2. Look for "App children: []" in console - means no model loaded
3. Verify the GLB file uploaded correctly

### Problem: Pistol appears but not at hand
**Solutions:**
1. Check console for "hand bone not found" - player avatar might not be VRM
2. Should fall back to player's right side position
3. Pistol will float near player even without hand bone

### Problem: Can't fire / no controls
**Solutions:**
1. Make sure you have pointer lock (right-click in world)
2. Check ammo count in console logs
3. Verify left mouse button isn't captured by another system

### Problem: Magazine slot not visible
**Solutions:**
1. This is expected if not a SkinnedMesh - magazine animations won't work
2. You can still fire and reload, just no visual magazine

## Console Commands for Testing

Open browser console (F12) and try:

```javascript
// Check the app's model structure
world.apps.forEach(a => {
  if (a.id.includes('pistol')) {
    console.log('Pistol app:', a);
    console.log('Children:', a.children.map(c => ({ id: c.id, type: c.name })));
  }
});

// Check active player
const player = world.getPlayer();
console.log('Player:', player);
console.log('Has rightHand bone?', player.getBoneTransform('rightHand'));
```

## Next Steps After Testing

1. **If pistol appears but wrong position:**
   - Uncomment lines 188-190 and adjust offsets
   - Test different values until it looks right

2. **If bones work:**
   - You'll see specific bone names in console
   - Animations will be possible

3. **If bones don't work:**
   - Still works! Just uses fallback positioning
   - Won't animate slide/hammer/trigger

4. **Test firing:**
   - Right-click to lock pointer
   - Left-click to shoot
   - Should see console logs for each shot

5. **Test reload:**
   - Press R key
   - Should see: "[pistol] Player reloaded: 15 rounds, 2 mags remaining"

## Model Setup Guide

Your pistol GLB should be structured like this in Blender:

```
Root (Empty or Armature)
└── CombatPistol (or Pistol, or any name)
    └── CombatPistolSkin (SkinnedMesh)
        └── Bones:
            ├── Gun_Muzzle
            ├── Gun_GripR
            ├── WAPClip
            └── ...
```

**OR** simpler structure:
```
CombatPistol (Mesh with no bones)
```

Both work! The script handles both cases.

## Known Limitations

1. **Server-side bones don't exist** - Muzzle flash on server uses origin position, not bone
2. **No automatic GLB detection** - You must attach the GLB to the app as its model
3. **Cloning copies all children** - If your GLB has extra objects, they'll be cloned too
4. **One instance per player** - Each player gets their own clone (this is correct behavior)

## File Locations

- Main script: `/cool-scripts/0.10.0/elementals/elemental-item-pistol.js`
- Implementation notes: `/cool-scripts/0.10.0/elementals/PISTOL_IMPLEMENTATION_NOTES.md`
- This guide: `/cool-scripts/0.10.0/elementals/PISTOL_DEBUG_GUIDE.md`

