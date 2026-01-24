# Stamina Boost Potion

A consumable area trigger that temporarily increases stamina recovery rate for players who enter it.

## Features

- **Area Trigger**: Players collect by entering the trigger volume
- **Temporary Boost**: Increases stamina regeneration rate for a configurable duration
- **Immediate Benefit**: Restores 30% of max stamina instantly when collected
- **Respawn System**: Automatically respawns after a cooldown period
- **Visual Effects**: Pulsing sphere animation
- **Configurable**: Multiple options for boost amount, duration, and behavior

## Node Requirements

The potion requires these nodes in the .glb:
- `Sphere` - The visible potion mesh
- `LOD` - Level of detail (optional)
- `AreaTrigger` - Trigger volume for collection

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `boostAmount` | number | 30 | Additional stamina per second while active (0-100) |
| `boostDuration` | number | 10 | How long the boost lasts in seconds (1-60) |
| `respawnDelay` | number | 30 | Time before potion respawns in seconds (5-300) |
| `collectSound` | file | - | Audio to play when collected |
| `sphereColor` | text | '#0088ff' | Color of the potion sphere (hex) |
| `sphereOpacity` | number | 0.6 | Transparency of the sphere (0.1-1) |
| `pulseSpeed` | number | 2 | Animation speed (0.5-10) |
| `debugMode` | toggle | false | Enable console debugging |

## How It Works

1. **Trigger Entry**: Player walks into the AreaTrigger volume
2. **Immediate Effect**: Restores 30% of max stamina instantly
3. **Boost Effect**: Increases stamina regeneration rate by configured amount
4. **Duration**: Boost lasts for configured duration (default 10 seconds)
5. **Respawn**: Potion disappears and respawns after cooldown

## Integration with Stamina System

The potion integrates seamlessly with the stamina system and will:

- **Change bar color** to cyan when boost is active
- **Increase regeneration** by the boost amount per second
- **Show bar** when boost is active (even if stamina is full)
- **Emit events** for other systems to react to

## Events

### Emitted Events

- `stamina:boost:start` - When boost begins
- `stamina:boost:started` - Confirmation boost started
- `stamina:boost:end` - When boost ends
- `potion:collected` - When a potion is collected

### Event Format

```javascript
// Boost start event
world.emit('stamina:boost:start', {
  playerId: 'player_123',
  boostAmount: 30,
  duration: 10
})

// Boost started confirmation
world.on('stamina:boost:started', ({ playerId, boostAmount, duration }) => {
  console.log(`Player ${playerId} has ${boostAmount} stamina regen boost for ${duration}s`)
})

// Boost end event
world.on('stamina:boost:end', ({ playerId }) => {
  console.log(`Player ${playerId} stamina boost ended`)
})

// Potion collected
world.on('potion:collected', ({ playerId, boostAmount, duration, position }) => {
  console.log(`Potion collected at ${position}`)
})
```

## Stamina System API

The stamina system exposes these boost-related methods:

```javascript
// Check if boost is active
const isBoosted = app.stamina.isBoostActive()

// Get current boost amount
const boostAmount = app.stamina.getBoostAmount()

// Get time remaining on boost
const timeLeft = app.stamina.getBoostTimeRemaining()
```

## Setup Instructions

1. Create a .glb with:
   - Sphere mesh named "Sphere"
   - Area trigger collider named "AreaTrigger"
   - (Optional) LOD named "LOD"

2. Add `stamina-system.js` to your world (only needed once)

3. Add `stamina-boost-potion.js` to the potion entity

4. Configure settings in Hyperfy editor

## Usage Examples

### Basic Setup

1. Add `stamina-system.js` to your world (only needed once)
2. Place potion entities with Sphere + AreaTrigger nodes
3. Add `stamina-boost-potion.js` to each potion
4. Configure settings in the Hyperfy editor

### Advanced Configuration

Create a high-powered potion with:
- 50 stamina/sec boost
- 15 second duration
- 60 second respawn
- Faster pulse animation

```javascript
// Configuration in Hyperfy editor
{
  sphereColor: '#ff00ff',
  boostAmount: 50,
  boostDuration: 15,
  respawnDelay: 60,
  pulseSpeed: 4
}
```

### Testing

Use the included test script:

```javascript
// Spawn a test potion at player position
const potion = world.create('app', {
  src: '/examples/essentials/stamina-boost-potion.js',
  config: {
    boostAmount: 40,
    boostDuration: 15,
    respawnDelay: 10,
    sphereColor: '#00ffff',
    debugMode: true,
  },
  position: [
    player.position.x + 2,
    player.position.y,
    player.position.z + 2
  ]
})
world.add(potion)
```

## Files

- `/examples/essentials/stamina-boost-potion.js` - Main potion script
- `/examples/essentials/stamina-system.js` - Core stamina system (updated with boost support)
- `/examples/ROMs/test-stamina-potion.js` - Test script for development

## Compatibility

- Requires `stamina-system.js` v2.0 or higher
- Works with all existing stamina-consuming apps (dash, sprint, wall hang)
- Compatible with both client and server environments

## Performance

- Minimal overhead when not active
- Event-driven architecture for efficiency
- Automatic cleanup on destroy
- Optimized update loops

## Differences from ROM Version

This version uses the area trigger pattern instead of ROM pattern:
- **No ROM UI** - Cleaner look without ROM label
- **Trigger-based** - Collect by entering volume, not clicking
- **Sphere mesh** - Uses Sphere node instead of ROM mesh
- **Simpler configuration** - Focused on potion-specific settings
