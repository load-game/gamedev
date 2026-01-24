# Pistol Position & Scale Adjustment Guide

## ✅ New Features Added

You can now adjust the pistol's appearance in real-time through the app config panel!

### **New Configuration Options:**

#### **Position & Scale Section:**
- **Scale** - Overall size multiplier (default: 1.0)
- **Offset X** - Left/Right position (negative = left, positive = right)
- **Offset Y** - Up/Down position (negative = down, positive = up)
- **Offset Z** - Forward/Back position (negative = back, positive = forward)
- **Rotation X** - Pitch rotation in radians
- **Rotation Y** - Yaw rotation in radians
- **Rotation Z** - Roll rotation in radians

## 🎯 How to Adjust

### **Step 1: Open the Pistol App Config**
1. Enter build mode
2. Click on the pistol app
3. Open the config panel
4. Scroll to the "Position & Scale" section

### **Step 2: Adjust Values in Real-Time**
The changes apply immediately - you'll see the pistol update as you type!

### **Common Adjustments:**

#### **If the pistol is too big:**
```
Scale: 0.5 (or lower)
```

#### **If the pistol is too small:**
```
Scale: 1.5 (or higher)
```

#### **If the pistol is in the wrong hand position:**
```
Offset X: 0.05 (move right) or -0.05 (move left)
Offset Y: -0.02 (move down) or 0.02 (move up)
Offset Z: 0.03 (move forward) or -0.03 (move back)
```

#### **If the pistol angle is wrong:**
```
Rotation X: 0.5 (tilt up) or -0.5 (tilt down)
Rotation Y: 0.3 (rotate right) or -0.3 (rotate left)
Rotation Z: 0.2 (roll clockwise) or -0.2 (roll counter-clockwise)
```

## 📐 Understanding Coordinates

### **Position Offsets** (in meters):
- **X-axis**: Left (-) to Right (+)
- **Y-axis**: Down (-) to Up (+)
- **Z-axis**: Back (-) to Forward (+)

These are applied **relative to the hand orientation**, so:
- Offset X always moves left/right from the hand's perspective
- Offset Y always moves up/down from the hand's perspective
- Offset Z always moves forward/back from the hand's perspective

### **Rotation** (in radians):
- **1 radian** ≈ 57.3 degrees
- **π/2 (1.57)** = 90 degrees
- **π (3.14)** = 180 degrees

Common rotation values:
- Small tilt: ±0.1 to ±0.3
- Medium rotation: ±0.5 to ±1.0
- Large rotation: ±1.5 to ±3.0

## 🔧 Example Configurations

### **Realistic Pistol Grip:**
```
Scale: 1.0
Offset X: 0.02
Offset Y: -0.01
Offset Z: 0.05
Rotation X: 0.2
Rotation Y: 0.0
Rotation Z: 0.0
```

### **Large Sci-Fi Pistol:**
```
Scale: 1.5
Offset X: 0.0
Offset Y: 0.0
Offset Z: 0.1
Rotation X: 0.0
Rotation Y: 0.0
Rotation Z: 0.0
```

### **Compact Sidearm:**
```
Scale: 0.7
Offset X: 0.03
Offset Y: -0.02
Offset Z: 0.02
Rotation X: 0.3
Rotation Y: 0.1
Rotation Z: 0.0
```

## 💡 Tips for Adjustment

1. **Start with Scale** - Get the size right first
2. **Then Position** - Adjust X, Y, Z offsets to place it in the hand
3. **Finally Rotation** - Fine-tune the angle for a natural grip
4. **Small Increments** - Use 0.01 steps for position, 0.1 for rotation
5. **Test While Moving** - Walk around and see how it looks from different angles
6. **Test While Aiming** - Right-click to lock pointer and see how it looks when aiming

## 🎮 Testing Workflow

1. **Give yourself the pistol** - Click "Give to Local Player"
2. **Adjust one value at a time** - See the immediate effect
3. **Walk around** - Check from different angles
4. **Fire the weapon** - Make sure muzzle flash looks right
5. **Fine-tune** - Keep adjusting until it looks perfect

## 🐛 Troubleshooting

### **Pistol doesn't move when I change values:**
- Make sure you've given yourself the pistol first
- Try dropping and re-equipping it
- Refresh the page if values seem stuck

### **Pistol is spinning wildly:**
- Reset all rotation values to 0
- Adjust one rotation axis at a time
- Use smaller values (0.1 to 0.5 range)

### **Pistol is way off in the distance:**
- Reset all offset values to 0
- Start with small offsets (0.01 to 0.05)
- Remember offsets are in meters, not pixels

### **Changes don't persist:**
- The values are saved in the app config
- They'll persist across reloads
- Each player sees the same adjustments

## 📊 Default Values

All defaults are set to neutral (no adjustment):
```
Scale: 1.0
Offset X: 0.0
Offset Y: 0.0
Offset Z: 0.0
Rotation X: 0.0
Rotation Y: 0.0
Rotation Z: 0.0
```

## 🎯 Recommended Starting Points

Based on your GLB structure, try these first:

### **If using CombatPistolSkin:**
```
Scale: 0.8
Offset Y: -0.03
Offset Z: 0.05
Rotation X: 0.3
```

### **If using simple mesh:**
```
Scale: 1.0
Offset X: 0.02
Offset Y: 0.0
Offset Z: 0.03
```

## 📝 Notes

- **All adjustments are in local space** - They rotate with the hand
- **Scale affects everything** - Including muzzle flash position
- **Offsets are additive** - They add to the hand bone position
- **Rotations are multiplicative** - They rotate after hand rotation
- **Changes are immediate** - No need to reload or re-equip

Once you find values you like, they're saved in the app config and will work for all players!
