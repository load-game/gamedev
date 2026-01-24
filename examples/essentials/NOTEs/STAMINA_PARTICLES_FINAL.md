# Stamina Particles - Final Implementation

## Changes Made

### 1. Fixed Particle Positioning (Now Follows Bar)

**Problem:** Particles were staying at the initial location where the potion was collected, not moving with the stamina bar.

**Solution:** Changed particle attachment from world space to local space as child of barGroup.

```javascript
// Before:
world.add(staminaParticles)
staminaParticles.position.copy(barGroup.position)
// Particles stayed at initial world position

// After:
barGroup.add(staminaParticles)
staminaParticles.position.set(0, 0, 0)  // Relative to barGroup
// Particles automatically follow barGroup position
```

**How it works:**
- Particles are now children of `barGroup`
- When barGroup moves (in lateUpdate), particles move with it automatically
- No manual position updates needed
- Works in local coordinate space

### 2. Reduced Particle Size (Now Subtle)

**Problem:** Particles were too large (0.15) and visually overwhelming.

**Solution:** Made particles much smaller and more elegant.

**Size Reduction:**
```javascript
// Before:
size: '0.15'  // Very large
rate: 40      // Too many particles
emissive: '300'  // Too bright

// After:
size: '0.02'  // Small and subtle
rate: 15      // Fewer particles
emissive: '150'  // Moderate brightness
```

**Visual Characteristics:**
- **Size**: 0.02 units (very small dots)
- **Rate**: 15 particles per second (subtle emission)
- **Emissive**: 150 (moderate glow)
- **Effect**: Elegant green sparkles around the bar

## Final Configuration

```javascript
staminaParticles = app.create('particles', {
  shape: ['circle', 2, 1],
  direction: 0,
  speed: '0',      // String (required by Hyperfy)
  size: '0.02',    // Small size for subtle effect
  rate: 15,        // Moderate emission rate
  life: '2',       // 2 second lifespan per particle
  emissive: '150', // Moderate brightness
  color: '#00ff00', // Green color
  alphaOverLife: '0,0|0.1,1|0.9,1|1,0',  // Fade in/out
  space: 'local',  // Local space (attached to barGroup)
  looping: true    // Continuous emission
})

// Attach as child of barGroup
barGroup.add(staminaParticles)
staminaParticles.position.set(0, 0, 0)  // Centered on bar
```

## Behavior

### When Unlimited Stamina Activates:
1. ✅ Green particles spawn at stamina bar position
2. ✅ Particles orbit continuously (2-second life, 15/sec rate)
3. ✅ Particles follow bar as player moves
4. ✅ Visual effect is subtle and elegant

### When Unlimited Stamina Expires:
1. ✅ Particles stop emitting
2. ✅ Existing particles fade out naturally
3. ✅ Particles are removed from barGroup
4. ✅ Effect cleans up automatically

### During Unlimited Mode:
- Particles remain centered on stamina bar
- Orbit radius is automatic based on particle system
- Position updates automatically with bar movement
- No manual position synchronization needed

## Files Modified

- `/examples/essentials/stamina-system.js`
  - Line 513-535: Particle creation (smaller, attached to barGroup)
  - Line 344-351: Particle removal (using barGroup.remove)
  - Removed manual position updates (no longer needed)

## Configuration Option

Particles can be disabled if not desired:

```javascript
world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    showUnlimitedParticles: false  // Disable particles
  }
})
```

## Visual Design

The particle effect is designed to be:
- **Subtle**: Small particles (0.02) don't distract from gameplay
- **Elegant**: Moderate emission rate (15/sec) looks natural
- **Informative**: Green color matches unlimited stamina mode
- **Functional**: Automatically follows bar position
- **Efficient**: Minimal GPU/CPU overhead

## Troubleshooting

### Particles Not Following Bar
- Ensure particles are attached to barGroup (not world)
- Check that barGroup is updating position correctly
- Verify particles are created after barGroup exists

### Particles Too Small/Large
- Adjust `size` parameter (try '0.01' to '0.03')
- Size is in world units
- '0.02' = 2cm diameter at default scale

### Particles Not Visible
- Check `showUnlimitedParticles` config is true
- Verify `emissive` is high enough (try '200' to '300')
- Ensure particles aren't clipped by camera near plane
- Check alphaOverLife for proper fading

### Performance Issues
- Reduce `rate` (try 10 to 20)
- Reduce `life` (try 1.0 to 1.5)
- Decrease `size` (try '0.01')
- Disable particles in config

## Summary

✅ Particles now follow stamina bar correctly (attached to barGroup)
✅ Particles are much smaller (0.02 vs 0.15)
✅ Effect is subtle and elegant
✅ Automatically cleans up when boost ends
✅ Configurable via showUnlimitedParticles option

The particle effect now works correctly and looks great!
