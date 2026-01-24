# Stamina Potion with heal.js Style Particles

## Added Particle Effects

The stamina potion now creates particle effects when collected, similar to `heal.js` but with green stamina-themed particles.

## Particle Configuration

### Collection Effect
When a player collects the potion, green particles spawn at the potion's location:

```javascript
const collectParticles = app.create('particles', {
  shape: ['circle', 2, 1],
  direction: 1,
  speed: '1',
  size: '0.05',
  rate: 30,
  life: '2',
  emissive: '200',
  color: '#00ff00', // Green for stamina
  alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
  velocityOrbital: new Vector3(0, 0.2, 0),  // Orbit around Y axis
  velocityLinear: new Vector3(0, 1, 0)      // Float upward
})
```

### Particle Properties
- **Shape**: Circle particles
- **Color**: Bright green (`#00ff00`)
- **Emissive**: 200 (glowing effect)
- **Speed**: 1 unit per second
- **Size**: 0.05 units
- **Rate**: 30 particles per second
- **Lifetime**: 2 seconds per particle
- **Movement**:
  - Orbital velocity: 0.2 around Y axis (swirling motion)
  - Linear velocity: 1 upward (floating up)

## Behavior

1. **Player walks into potion trigger**
2. **LOD mesh disappears** (potion collected)
3. **Green particles spawn** at potion location
4. **Particles:**
   - Orbit around the collection point
   - Float upward
   - Fade out over 2 seconds
   - Are automatically removed after 2 seconds
5. **Player receives unlimited stamina**
6. **Stamina bar glows bright green** (emissiveIntensity: 3.0)
7. **Potion respawns** after configured time

## Files Modified

- `/examples/essentials/stamina-potion-simple.js` - Added particle creation and cleanup

## Comparison with heal.js

### heal.js Particles
- Color: Green
- Purpose: Healing effect
- Emissive: 100
- Velocity: Orbital + Linear upward

### Stamina Potion Particles
- Color: Green (`#00ff00`)
- Purpose: Collection effect
- Emissive: 200 (brighter)
- Velocity: Same orbital + linear pattern
- Size: 0.05 (slightly larger for visibility)

## Benefits

1. **Visual Feedback**: Clear indication when potion is collected
2. **Consistent Style**: Matches heal.js particle effects
3. **Thematic**: Green color fits stamina theme
4. **Self-Cleaning**: Particles auto-remove after 2 seconds
5. **No Performance Impact**: Temporary effect, not continuous

## Testing

1. Add potion to world:
   ```javascript
   world.create('app', {
     src: '/examples/essentials/stamina-potion-simple.js',
     config: {
       boostDuration: 10,
       respawnTime: 30
     }
   })
   ```

2. Walk into potion trigger

3. Verify:
   - [ ] Potion disappears (LOD mesh)
   - [ ] Green particles appear at collection point
   - [ ] Particles orbit and float upward
   - [ ] Particles fade out after 2 seconds
   - [ ] Stamina bar glows bright green
   - [ ] Unlimited stamina active for duration
   - [ ] Potion respawns after respawn time

## Console Logs

When potion is collected:
```
[Stamina Potion] Collected, respawn in 30 seconds
```

When potion respawns:
```
[Stamina Potion] Respawned and visible again
```
