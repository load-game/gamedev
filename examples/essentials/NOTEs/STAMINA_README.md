# Stamina System Implementation Summary

## Overview

A complete stamina system for Hyperfy that provides:
- Visual stamina bar above players using prim boxes
- Event-driven communication between apps
- Configurable stamina consumption for actions
- Automatic regeneration with delay
- Integration with ROM apps (Dash & Sprint)

## Files Created/Modified

### Core System
- `/examples/essentials/stamina-system.js` - Main stamina system app
- `/examples/essentials/STAMINA_API.md` - Complete API documentation

### ROM Integrations
- `/examples/ROMs/romDash.js` - Added stamina consumption for dashes
- `/examples/ROMs/romSprint.js` - Added stamina drain for super-sprinting

## How It Works

### Event-Based Communication

The stamina system uses Hyperfy's event system for communication:

```
Requesting App → world.emit() → Stamina System → world.emit() → Reply
```

**Why Events?**
- No direct coupling between apps
- Follows Hyperfy patterns (like elemental system)
- Works across client/server boundaries
- No shared state or globals needed

### Event Flow

#### Try Consume (All-or-Nothing)
```javascript
// Request
world.emit(`stamina:try-consume:${playerId}`, {
  amount: 30,
  requestId: 'abc123'
})

// Response
world.on(`stamina:try-consume-reply:${playerId}:abc123`, ({ success, remaining }) => {
  // Handle result
})
```

#### Consume (Partial)
```javascript
// Request up to amount
world.emit(`stamina:consume:${playerId}`, {
  amount: 15,
  requestId: 'xyz789'
})

// Response tells how much was actually consumed
world.on(`stamina:consume-reply:${playerId}:xyz789`, ({ consumed, remaining }) => {
  // Handle result
})
```

## Pattern: Reply Handlers

**WRONG** (world.once doesn't exist):
```javascript
world.once(`event:reply`, handler)  // ❌ Doesn't work!
```

**CORRECT** (world.on + world.off):
```javascript
const replyHandler = (data) => {
  world.off(`event:reply`, replyHandler)  // Remove listener
  // Handle response
}

world.emit(`event:request`, { ... })
world.on(`event:reply`, replyHandler)    // Add listener
```

## Integration Examples

### Adding Stamina to a New App

1. **Create the app** (e.g., `my-action.js`)
```javascript
app.configure([
  {
    key: 'staminaCost',
    type: 'number',
    label: 'Stamina Cost',
    initial: 20,
  },
])

if (world.isClient) {
  function performAction() {
    const playerId = world.getPlayer().id
    const requestId = Math.random().toString(36).substr(2, 9)

    const replyHandler = ({ success, remaining }) => {
      world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
      if (success) {
        // Success - perform action
        console.log(`Action performed! Stamina left: ${remaining}`)
      } else {
        // Not enough stamina
        console.log('Not enough stamina!')
      }
    }

    world.emit(`stamina:try-consume:${playerId}`, {
      amount: config.staminaCost || 20,
      requestId,
    })

    world.on(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
  }
}
```

2. **Add stamina system to your world**
   - Upload `/examples/essentials/stamina-system.js` to your world
   - The stamina system will automatically initialize for each player

3. **Add your app to the world**
   - Upload `my-action.js`
   - Configure stamina cost in the app settings

That's it! The stamina system will handle everything else.

## Stamina Behavior

### Regeneration
- **Max Stamina**: 100 points
- **Regen Rate**: 15 points/second
- **Regen Delay**: 2 seconds after last stamina use
- **Bar Visibility**: Auto-shows when consuming or <20%

### Visual Bar
- **Color Coding**:
  - Green: >50% stamina
  - Yellow: 25-50% stamina
  - Red: <25% stamina
- **Fade Animation**: Smooth fade in/out
- **Position**: 1.8m above player, follows rotation

## Testing

### Manual Test Steps

1. **Setup**
   ```
   - Add stamina-system.js to world
   - Add romDash.js to world
   - Add romSprint.js to world
   ```

2. **Test Dash**
   ```
   - Walk around normally (no stamina used)
   - Press dash key (F by default)
   - See stamina bar appear and decrease
   - Try dashing when empty (should fail)
   - Wait for regeneration
   ```

3. **Test Sprint**
   ```
   - Hold W + Shift (or joystick forward)
   - Wait 0.5s for activation
   - See continuous stamina drain
   - Release to stop draining
   - Bar fades out when full
   ```

## Configuration

### Stamina System Config
```javascript
showStaminaBar: boolean  // Toggle bar visibility
```

### ROM Dash Config
```javascript
staminaCost: number  // Stamina per dash (default: 30)
```

### ROM Sprint Config
```javascript
staminaDrainRate: number  // Stamina/sec while active (default: 25)
```

## Event Reference

See `/examples/essentials/STAMINA_API.md` for complete event documentation.

### Quick Reference

| Event | Description |
|-------|-------------|
| `stamina:consume:${playerId}` | Consume up to amount |
| `stamina:try-consume:${playerId}` | Consume exact amount or fail |
| `stamina:query:${playerId}` | Get status without consuming |
| `stamina:set:${playerId}` | Set stamina value |
| `stamina:add:${playerId}` | Add stamina |
| `stamina:changed` | Broadcast changes |

## Troubleshooting

### Stamina bar not showing?
- Check `showStaminaBar` config is true
- Verify stamina-system.js is added to world
- Check console for errors

### Actions not consuming stamina?
- Verify event names are correct (include playerId)
- Check requestId is unique per call
- Ensure reply handler calls world.off

### Regeneration not working?
- Check lastStaminaUse is being updated
- Verify STAMINA_REGEN_DELAY time
- Ensure delta time is being passed correctly

## Architecture Notes

### Why Events vs Direct API?

**Events (Current Implementation):**
✓ Decoupled - apps don't depend on stamina system
✓ Flexible - can swap stamina system implementation
✓ Follows Hyperfy patterns
✓ Works across network boundaries
✓ No shared state issues

**Direct API (Not Supported in Hyperfy):**
✗ Requires app.import() which doesn't work
✗ Creates hard dependencies
✗ Doesn't follow Hyperfy architecture

### Request ID Pattern

Unique request IDs ensure:
- Replies match the correct requests
- Multiple concurrent requests don't conflict
- Handlers can be cleaned up properly

```javascript
const requestId = Math.random().toString(36).substr(2, 9)
```

## Future Enhancements

Possible additions:
- [ ] Server-side stamina validation
- [ ] Stamina potions/items
- [ ] Different regeneration rates per player
- [ ] Stamina buffs/debuffs
- [ ] Custom bar positions/sizes
- [ ] Bar styling options

## Credits

Pattern inspired by:
- Elemental system's event patterns
- World UI examples for visual components
- ROM apps for movement mechanics

## Support

For issues or questions:
1. Check console for error messages
2. Verify event names include playerId
3. Ensure reply handlers call world.off
4. See STAMINA_API.md for detailed examples
