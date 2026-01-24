# Stamina Bar Particle Effects

Added visual particle effects to the stamina bar that activate when unlimited stamina mode is active.

## Features

- **Green Orbiting Particles**: Circular particles that orbit around the stamina bar
- **Automatic Activation**: Particles appear when unlimited stamina is activated
- **Automatic Cleanup**: Particles are removed when stamina boost expires
- **Configurable**: Can be disabled in configuration settings
- **Performance Optimized**: Uses efficient particle system with pooling

## Visual Design

The particle effects are inspired by `examples/vfx/heal.js` and include:

- **Green color** (`#00ff00`) - Matches unlimited stamina bar color
- **Emissive glow** (intensity: 100) - Makes particles glow even in low light
- **Orbital motion** - Particles circle around the bar
- **Fade in/out** - Smooth alpha transitions at start/end

## Configuration

New configuration option added:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showUnlimitedParticles` | toggle | true | Show particle effects when unlimited stamina is active |

To disable particles:
```javascript
world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    showUnlimitedParticles: false
  }
})
```

## How It Works

### Particle Creation

When unlimited stamina mode is activated:

```javascript
// In stamina-system.js - stamina:boost:start handler
if (unlimitedStamina && !particleActive && config.showUnlimitedParticles) {
  staminaParticles = app.create('particles', {
    shape: ['circle', 2, 1],
    direction: 0,
    speed: 0,
    size: '0.02',
    rate: 15,
    life: '2',
    emissive: '100',
    color: '#00ff00',
    alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
    velocityOrbital: new Vector3(0, 0.3, 0),
    space: 'world',
    looping: true
  })
  barGroup.add(staminaParticles)
  particleActive = true
}
```

### Particle Properties

- **Shape**: Circle (2D, 2x1 aspect ratio)
- **Speed**: 0 (particles don't move linearly)
- **Size**: 0.02 units (very small)
- **Rate**: 15 particles per second
- **Life**: 2 seconds per particle
- **Emissive**: 100 (bright glow)
- **Color**: Green (#00ff00)
- **Alpha**: Fades in (0→1), stays visible (90%), fades out (1→0)
- **Orbital Velocity**: 0.3 units/second around Y axis
- **Space**: World space (follows bar position)
- **Looping**: Continuous emission while active

### Particle Destruction

When stamina boost expires:

```javascript
// In stamina-system.js - timer expiration
if (boostTimer <= 0) {
  if (particleActive && staminaParticles) {
    barGroup.remove(staminaParticles)
    staminaParticles = null
    particleActive = false
  }
  // ... deactivation logic
}
```

### Position Tracking

Particles automatically follow the stamina bar position:

```javascript
// In lateUpdate loop
if (particleActive && staminaParticles) {
  staminaParticles.position.copy(barGroup.position)
}
```

## Visual States

### Unlimited Stamina Active
- Bar color: GREEN (#00ff00)
- Emissive: GREEN
- Particles: Green orbiting circles
- Scale/Position: Particles match bar position

### Normal Stamina
- Bar color: GREEN/YELLOW/RED (based on percentage)
- Emissive: Based on percentage
- Particles: None (removed)

## Performance Considerations

- **Particle Count**: ~30 particles active at once (15/sec * 2 sec life)
- **Update Rate**: Position updates every frame (60fps)
- **Render Cost**: Minimal - simple circles with standard materials
- **Memory**: Particles auto-pool in Hyperfy engine

## Troubleshooting

### Particles Not Visible

1. **Check if unlimited stamina is active**
   ```javascript
   app.stamina.isBoostActive()  // Should return true
   app.stamina.getBoostTimeRemaining()  // Should be > 0
   ```

2. **Verify particles are enabled**
   ```javascript
   config.showUnlimitedParticles  // Should be true
   ```

3. **Check if bar is visible**
   - Bar must be visible for particles to appear
   - Particles are child of barGroup

4. **Enable debug mode**
   - Look for "Creating unlimited stamina particles" logs
   - Look for "Removing unlimited stamina particles" logs

### Particles Not Following Bar

- Ensure particle system uses `space: 'world'` (not local)
- Check lateUpdate is running
- Verify staminaParticles.position is being updated

### Particles Too Bright/Dim

- Adjust `emissive` property (currently 100)
- Range: 0-100, higher = brighter glow
- Or adjust `color` to different shade of green

## Customization

### Change Particle Count

Modify rate in particle creation:
```javascript
rate: 30  // Double the particles
```

### Change Orbital Speed

Modify velocityOrbital:
```javascript
velocityOrbital: new Vector3(0, 0.5, 0)  // Faster orbit
```

### Change Particle Size

Modify size parameter:
```javascript
size: '0.04'  // Larger particles
```

### Change Color

Modify color parameter:
```javascript
color: '#00ffff'  // Cyan instead of green
```

## Files Modified

- `/examples/essentials/stamina-system.js`
  - Added particle system variables
  - Added particle creation in boost start handler
  - Added particle removal in boost timer expiration
  - Added particle position sync in lateUpdate
  - Added `showUnlimitedParticles` config option

## Integration with Stamina Boost Potion

Particles activate automatically when collecting stamina potions:

```javascript
// When potion is collected
world.emit('stamina:boost:start', {
  playerId,
  duration: config.boostDuration,  // e.g., 10 seconds
  unlimited: true
})

// Particles automatically:
// 1. Spawn around stamina bar
// 2. Orbit continuously
// 3. Stop when boost ends
// 4. Get cleaned up automatically
```

No additional configuration needed!
