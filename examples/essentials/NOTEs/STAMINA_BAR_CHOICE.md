# Stamina System: Options

The stamina system offers two visual options:

## Option 1: Animated Stamina Bar (Recommended)
**File:** `/examples/essentials/stamina-system.js`

### Features
- **Single file** - Logic and visuals combined
- **Animated vertical bar** - Smooth animations, chest-anchored
- **Direct integration** - No internal events, direct function calls
- **Easy setup** - Just add one file to world
- **All features included** - Regeneration, consumption, visuals
- **Chest bone anchoring** - Bar moves with avatar animations

### Bar Appearance
- **Vertical orientation** - 0.1m wide × 1.5m tall, positioned on left side of chest
- **Chest-anchored** - Left side of chest (offset -0.3m), moves with animations
- **Smooth animations** - Lerped scaling for fluid transitions
- **Color-coded** - Green/Yellow/Red based on stamina level

### Installation
```
1. Add stamina-system.js to world
2. Add romDash.js or romSprint.js
3. Done! Bar is included automatically
```

### When to Use
- ✓ Starting new project (recommended)
- ✓ Want simplest setup (one file)
- ✓ Need animated, modern-looking bar
- ✓ Want bar to move with avatar

---

## Option 2: Static Stamina Bar (Legacy)
**File:** `/examples/essentials/stamina-system.js` (with `showStaminaBar: false`)

**Note:** The static bar was the original implementation but has been replaced with the animated bar. To use static bar, you would need to modify the source code.

---

## Quick Comparison

| Feature | Animated Bar |
|---------|-------------|
| **Files** | 1 (stamina-system.js) |
| **Bar Type** | Animated Vertical |
| **Anchoring** | Chest bone (left side) |
| **Performance** | Best (direct) |
| **Setup** | Easiest |
| **Visuals** | Smooth animations, color-coded |

---

## Recommended Choice

**For all users:** Use **stamina-system.js**
- Simplest setup (one file)
- All features included
- Best performance
- Modern animated bar
- Chest-anchored (moves with avatar)

The animated bar implementation in stamina-system.js is based on user-created reference design that was perfected in-world.

---

## Technical Details

**Internal:** Direct function calls (stamina → updateBarVisual)
**External:** Events for app communication (romDash, romSprint)
**Performance:** Best (no internal event overhead)

The system uses chest bone detection to anchor the bar to the avatar's skeleton, automatically finding common bone names (Chest, Spine2, Spine1, UpperChest, Spine, chest).