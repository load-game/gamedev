# Floating Stamina Potion with Bobbing Animation

## Added Bobbing Effect

The AreaTrigger now has a gentle bobbing animation that makes the potion appear to float in the air when visible.

## Animation Setup

### Variables
```javascript
let bobTime = 0                      // Tracks animation time
const bobAmplitude = 0.05            // Bob up/down by 5cm
const bobSpeed = 1.5                 // 1.5 cycles per second
const initialY = body.position.y     // Starting Y position
```

### Animation Logic
```javascript
app.on('update', (dt) => {
  // Bobbing animation for AreaTrigger when potion is visible
  if (!isCollected && body.position) {
    bobTime += dt * bobSpeed
    const bobOffset = Math.sin(bobTime) * bobAmplitude
    body.position.y = initialY + bobOffset
  }
})
```

## How It Works

1. **Math.sin()** creates a smooth up/down motion
2. **bobTime** increments every frame based on delta time
3. **bobSpeed** controls how fast it bobs (1.5 = 1.5 cycles per second)
4. **bobAmplitude** controls how high/low it moves (0.05 = ±5cm)
5. **Only bobs when potion is visible** (`!isCollected`)
6. **Stops bobbing when collected**
7. **Resumes bobbing when respawns**

## Visual Effect

- Creates a floating/wobbling effect
- Makes the potion feel more alive/organic
- Gentle movement draws attention without being distracting
- Matches common video game collectible animations

## Comparison to fireball.js

fireball.js uses a more complex bobbing system:
```javascript
// fireball.js approach
const bobOffset = Math.sin(time * CONFIG.ANIMATION.BOB_SPEED) * CONFIG.ANIMATION.BOB_AMP
animationNode.position.y = CONFIG.ANIMATION.BASE_HEIGHT + bobOffset
```

Stamina potion uses a simpler version:
```javascript
// stamina-potion-simple.js approach
bobTime += dt * bobSpeed
const bobOffset = Math.sin(bobTime) * bobAmplitude
body.position.y = initialY + bobOffset
```

## Testing

1. Add potion to world:
   ```javascript
   world.create('app', {
     src: '/examples/essentials/stamina-potion-simple.js'
   })
   ```

2. Observe:
   - [ ] Potion gently bobs up/down when visible
   - [ ] Bobbing stops when collected
   - [ ] Bobbing resumes when potion respawns
   - [ ] Movement is smooth and natural

## Customization

To adjust the bobbing:
- **Faster bobbing**: Increase `bobSpeed` (try 2.0 or 3.0)
- **Slower bobbing**: Decrease `bobSpeed` (try 0.5 or 1.0)
- **Higher bob**: Increase `bobAmplitude` (try 0.1 or 0.15)
- **Lower bob**: Decrease `bobAmplitude` (try 0.02 or 0.03)

Example:
```javascript
const bobAmplitude = 0.1   // Bob 10cm up/down
const bobSpeed = 2.0       // 2 cycles per second (faster)
```

## Performance

- **Negligible impact**: Only updates position when visible
- **Simple math**: Single sin() calculation per frame
- **No memory allocation**: Uses existing variables

## Summary

The stamina potion now features:
1. ✅ **heal.js style particles** on collection
2. ✅ **LOD visibility toggling** for hide/show
3. ✅ **Bobbing animation** when visible
4. ✅ **Respawn timer** for re-collection
5. ✅ **Unlimited stamina boost** for player
