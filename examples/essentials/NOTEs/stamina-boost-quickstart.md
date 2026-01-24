# Stamina Boost Potion - Quick Start

## What Was Built

A functional stamina boost potion system with:
1. **Trigger-based collection** - Walk into trigger volume to collect
2. **Server-side respawn** - Proper cooldown handling
3. **Stamina integration** - Boosts regeneration rate + restores 30% stamina
4. **Event system** - Emits events for debugging and extension

## How It Works

### Collection Flow
1. Player walks into AreaTrigger → `onTriggerEnter` fires (server)
2. Server checks if not on cooldown → calls `collectPotion()`
3. Queries player's current stamina/max → adds 30% immediately
4. Emits `stamina:boost:start` event → stamina system handles boost
5. Starts respawn timer (default 30s)

### Boost Flow
1. Stamina system receives `stamina:boost:start`
2. Sets `boostActive=true`, `boostAmount=30`, `boostTimer=10`
3. Changes stamina bar color to cyan
4. In update loop: `regenAmount += boostAmount * delta`
5. When timer expires: resets boost state, bar color

## Files

- `/examples/essentials/stamina-boost-potion.js` - Potion trigger logic
- `/examples/essentials/stamina-system.js` - Updated with boost support
- `/examples/ROMs/test-stamina-potion.js` - Debug/test logging
- `/examples/essentials/debug-trigger.js` - Test if triggers work

## Setup

### 1. Add Stamina System (once per world)
```javascript
// Add to world
world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    showStaminaBar: true,
    debugMode: false
  }
})
```

### 2. Create Potion Entity
Create .glb with:
- `Sphere` mesh (for visibility)
- `AreaTrigger` collider (for collection)
- Scale trigger larger than sphere

### 3. Add Potion Script
```javascript
// Add to potion entity
app.create('script', {
  src: '/examples/essentials/stamina-boost-potion.js',
  config: {
    boostAmount: 30,
    boostDuration: 10,
    respawnDelay: 30,
    debugMode: true
  }
})
```

## Testing

### Method 1: Use Debug Trigger
1. Add `debug-trigger.js` to any entity with AreaTrigger
2. Walk into trigger
3. Check console for "onTriggerEnter fired!"

### Method 2: Use Test Script
1. Add `test-stamina-potion.js` to player
2. Press P to spawn potions around you
3. Walk into potions
4. Watch console for collection and boost logs

### Method 3: Manual Testing
1. Place potion entity in world
2. Enable `debugMode: true` in config
3. Walk into potion
4. Check console logs:
   - "[Stamina Potion] Player X entered trigger"
   - "[Stamina System] Stamina boost activated: 30 per second for 10 seconds"
   - "[Stamina Test] ✓ POTION COLLECTED!"
   - "[Stamina Test] ✓ BOOST STARTED!"

## Debugging Tips

### If trigger doesn't fire:
- Verify AreaTrigger node exists in .glb
- Check trigger is marked as trigger (not solid)
- Ensure trigger is large enough to walk into
- Check server logs (trigger is server-side)

### If stamina doesn't boost:
- Verify stamina-system.js is in world
- Check console for "Stamina boost activated" message
- Query stamina directly: `app.stamina.isBoostActive()`
- Check boost timer: `app.stamina.getBoostTimeRemaining()`

### If respawn doesn't work:
- Verify `isCollected` flag resets after respawnDelay
- Check server update loop is running
- Enable debugMode for respawn logs

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| boostAmount | 30 | Additional stamina/sec while active |
| boostDuration | 10 | How long boost lasts (seconds) |
| respawnDelay | 30 | Time before respawn (seconds) |
| debugMode | false | Enable console logs |

## Events

### Emitted by Potion:
- `potion:collected` - When collected
- `stamina:add:${playerId}` - Immediate stamina restore
- `stamina:boost:start` - Start regeneration boost

### Emitted by Stamina System:
- `stamina:boost:started` - Confirm boost active
- `stamina:boost:end` - Boost expired
- `stamina:changed` - Stamina value updated
- `stamina:query-reply:${playerId}:${requestId}` - Query response

## Common Issues

**"Missing AreaTrigger" error**
→ Add AreaTrigger collider to .glb or disable rigidbody

**Potion collects multiple times**
→ Ensure `isCollected` check in trigger handler

**Boost doesn't apply**
→ Verify stamina-system.js is loaded before potion

**Bar doesn't change color**
→ Check `barFront` exists and has material

**Respawn doesn't work**
→ Move respawn logic to server-side update loop
