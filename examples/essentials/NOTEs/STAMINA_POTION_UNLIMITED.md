# Stamina Potion - Unlimited Mode Implementation

## Changes Made

### Core Functionality
Changed stamina boost from "regeneration increase" to "unlimited stamina mode":
- **Before**: Potion increased stamina regeneration rate (+30/sec)
- **After**: Potion fills stamina to 100% and prevents depletion for duration

### Files Modified

1. **`stamina-system.js`**
   - Added `unlimitedStamina` flag
   - Modified consume/tryConsume handlers to skip deduction when unlimited
   - Green bar color indicates unlimited mode (vs cyan for regen boost)
   - Maintains stamina at 100% during unlimited mode

2. **`stamina-boost-potion.js`**
   - Now hides sphere on collection: `sphere.visible = false`
   - Sets stamina to 100%: `world.emit('stamina:set', { value: 100 })`
   - Activates unlimited mode: `world.emit('stamina:boost:start', { unlimited: true })`

## How Unlimited Mode Works

### Collection
1. Player enters AreaTrigger → `onTriggerEnter` fires
2. Server checks: not on cooldown + player exists
3. Sets `isCollected = true`
4. **Hides sphere**: `sphere.visible = false`
5. Emits `stamina:set` → sets stamina to MAX
6. Emits `stamina:boost:start` → enables unlimited mode

### Unlimited Mode
1. **Consume requests**: Return success=true but don't deduct stamina
2. **Try-consume**: Always succeeds, stamina stays at MAX
3. **Bar color**: Green (#00ff00) indicates unlimited mode
4. **Bar stays full**: Stamina locked at 100%
5. **Timer counts down**: Boost timer decrements each frame

### Expiration
1. Timer reaches 0 → `unlimitedStamina = false`
2. Bar color resets to normal
3. Stamina consumption resumes normal behavior
4. Potion respawns after cooldown

## Testing Results

### Console Logs to Expect

**On Collection:**
```
[Stamina Potion] Potion collected by player player_123
[Stamina System] Unlimited stamina activated for 10 seconds
[Stamina Test] ✓ POTION COLLECTED!
[Stamina Test] ✓ BOOST STARTED!
```

**During Unlimited Mode:**
```
[Stamina Test] Status - Stamina: 100.0/100.0 UNLIMITED STAMINA (Time left: 8.5s)
```

**After Expiration:**
```
[Stamina System] Stamina boost ended
[Stamina Test] ✓ Boost ended
```

## Usage

### Adding Potion to World
```javascript
const potion = world.create('app', {
  src: '/examples/essentials/stamina-boost-potion.js',
  config: {
    boostDuration: 10,  // Unlimited stamina for 10 seconds
    respawnDelay: 30,   // Respawns after 30 seconds
    debugMode: true     // Enable console logs
  }
})
world.add(potion)
```

### Adding Test Script to Player
```javascript
const testScript = world.create('app', {
  src: '/examples/ROMs/test-stamina-potion.js'
})
world.getPlayer().add(testScript) // or appropriate method
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| boostDuration | number | 10 | Seconds of unlimited stamina |
| respawnDelay | number | 30 | Seconds before respawn |
| debugMode | boolean | false | Enable console logging |

## API Access

```javascript
// Check if unlimited stamina is active
const isUnlimited = app.stamina.isBoostActive() && app.stamina.getBoostTimeRemaining() > 0

// Get remaining time
const timeLeft = app.stamina.getBoostTimeRemaining()

// Stamina will always return 100 during unlimited mode
const currentStamina = app.stamina.get() // Always 100
```

## Events

### Collection Events
```javascript
world.on('potion:collected', ({ playerId, duration, position }) => {
  console.log(`Potion at ${position} collected for ${duration}s`)
})
```

### Boost Events
```javascript
world.on('stamina:boost:started', ({ playerId, duration, unlimited }) => {
  if (unlimited) {
    console.log('Unlimited stamina activated!')
  }
})

world.on('stamina:boost:end', ({ playerId }) => {
  console.log('Unlimited stamina ended')
})
```

## Visual Feedback

- **Green bar** = Unlimited stamina active
- **Bar stays at 100%** during unlimited mode
- **Potion disappears** when collected
- **Potion reappears** after respawn delay

## Troubleshooting

**Potion doesn't disappear**
→ Ensure sphere node is named "Sphere" in .glb

**Stamina still depletes**
→ Verify unlimited mode: `app.stamina.isBoostActive()`
→ Check boost timer: `app.stamina.getBoostTimeRemaining()`

**Potion collects multiple times**
→ Verify `isCollected` flag set to true
→ Check respawn timer resets properly

## Implementation Notes

The unlimited stamina is implemented by:
1. Setting `unlimitedStamina = true` in stamina system
2. In consume handlers, checking this flag before deducting
3. If true: return success but don't modify stamina value
4. Keep stamina locked at 100% for visual consistency
5. Reset flag when boost timer expires

This ensures all existing code (dash, sprint, wall hang) works without modification - they just get "free" stamina during the unlimited period.
