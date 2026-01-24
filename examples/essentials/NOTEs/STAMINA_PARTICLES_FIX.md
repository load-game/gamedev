# Stamina Particles - Debug & Fixes

## Issue: Particles Not Visible When Unlimited Stamina Active

### Root Cause Analysis

The particles weren't visible due to several potential issues:
1. Particles attached as child of barGroup (might not render properly)
2. Small particle size (0.02 → 0.1 was still too small)
3. Low emission rate (15 particles/sec might not be enough)
4. Position synchronization issues

### Fixes Implemented

#### 1. Changed Particle Attachment Method
**Before:**
```javascript
barGroup.add(staminaParticles)  // As child of barGroup
```

**After:**
```javascript
world.add(staminaParticles)  // Add directly to world
```

**Reason:** Particles attached as children of groups may not render properly in Hyperfy's engine.

#### 2. Increased Particle Visibility
**Before:**
```javascript
size: '0.02', rate: 15, emissive: '100'
```

**After:**
```javascript
size: '0.15', rate: 40, emissive: '300'
```

**Reason:** Made particles much larger, more numerous, and brighter for better visibility.

#### 3. Changed Coordinate Space
**Before:**
```javascript
space: 'world'
```

**After:**
```javascript
space: 'local'  // But manually positioned in world
```

**Reason:** Local space particles with manual positioning gives better control.

#### 4. Added Comprehensive Debug Logging
**New logging in multiple locations:**
- Config loading: Shows if particles are enabled
- Particle creation: Shows position, size, rate, emissive values
- Timer events: Confirms when unlimited mode starts/ends
- Expiration handling: Shows particle removal

```javascript
debugLog('Config - showUnlimitedParticles:', config.showUnlimitedParticles)
debugLog('✓ UNLIMITED STAMINA PARTICLES CREATED AND ACTIVE!')
debugLog('  Position:', x, y, z)
debugLog('  Rate:', 40, 'Size:', '0.15', 'Emissive:', '300')
```

#### 5. Added Test Script
Created `/examples/essentials/test-particles.js` to verify particle system works:
- Creates red particles at player position
- Auto-spawns after 1 second
- Removes after 5 seconds
- Helps isolate particle rendering issues from stamina logic

### Debug Testing Steps

#### Step 1: Verify Configuration
Check console for:
```
[Stamina System] Config - showUnlimitedParticles: true
```

If false, enable in config:
```javascript
config: {
  showUnlimitedParticles: true
}
```

#### Step 2: Collect Potion
Watch for logs:
```
[Stamina Potion] Potion collected by player X
[Stamina System] ✓ UNLIMITED STAMINA PARTICLES CREATED AND ACTIVE!
[Stamina System]   Position: 12.34 5.67 -8.90
[Stamina System]   Rate: 40 Size: 0.15 Emissive: 300
```

#### Step 3: Check Timer
During boost, should see:
```
[Stamina System] Boost timer: 4.567 → 4.456
```

#### Step 4: Verify Expiration
When boost ends:
```
[Stamina System] Removing unlimited stamina particles - boost expired
[Stamina System] ✓ Particles removed successfully
```

#### Step 5: Use Test Script
If particles still not visible, test with:
```javascript
world.create('app', {
  src: '/examples/essentials/test-particles.js'
})
```

Should see red particles at player position.

### Configuration

**Default Settings (Very Visible):**
```javascript
{
  showUnlimitedParticles: true,  // Enable particles
  size: '0.15',                  // Large particles
  rate: 40,                      // Many particles
  emissive: '300',               // Very bright
  color: '#00ff00'               // Green
}
```

**For Subtle Effect:**
```javascript
{
  showUnlimitedParticles: true,
  size: '0.05',                  // Smaller
  rate: 15,                      // Fewer particles
  emissive: '100'                // Less bright
}
```

### Troubleshooting

#### No "CREATED" Log
- Check `showUnlimitedParticles` is true
- Verify boost is actually starting (check for "Boost activated" logs)
- Ensure `unlimitedStamina` flag is true

#### "CREATED" Log But No Particles Visible
- Check if bar position is valid (look for "Bar position" logs)
- Verify camera rendering particles (test with test-particles.js)
- Particles might be too small - check size in logs
- Could be behind/in front of something (alpha issue)

#### Particles Visible But Not Following Player
- Check lateUpdate is running (look for "Updated particle position" logs)
- Verify player position is updating
- Particles should move with bar position

#### Particles Stay Forever
- Check boost timer is decrementing
- Verify "Particles removed" log appears
- Timer might be stuck (check debug logs)

### Visual Confirmation

When working correctly, you should see:
1. **Green glowing particles** orbiting around stamina bar
2. **40 particles** being emitted per second
3. **Orbit radius** roughly 0.5-1.0 units from bar center
4. **Fades in** over 0.2 seconds
5. **Fades out** just before removal
6. **Follows bar** as player moves

### Performance Notes

- **Particle count**: ~80 active at peak (40/sec * 2 sec life)
- **GPU cost**: Minimal - simple circles
- **CPU cost**: Position updates every frame
- **Memory**: Auto-pooled by Hyperfy

### Known Issues

1. **Particles may clip through objects** - No collision detection
2. **Can be hard to see in bright areas** - Use high emissive values
3. **Orbit speed is fixed** - Could make configurable
4. **Color is green** - Could make configurable

### Summary

The particles should now be VERY visible due to:
- ✅ Larger size (0.15 vs 0.02)
- ✅ Higher emission rate (40 vs 15)
- ✅ Brighter emissive (300 vs 100)
- ✅ Direct world attachment
- ✅ Manual position update
- ✅ Comprehensive debug logging

If still not visible, use test-particles.js to verify particle rendering works at all in your environment.
