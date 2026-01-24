# Stamina System API

The stamina system provides a reusable stamina bar and consumption mechanism for player actions using world events.

## How It Works

The stamina system uses **world event signals** to communicate between apps. The stamina system app listens for stamina events and responds with replies.

## Setting Up

1. Add the stamina system app to your world
2. Configure stamina consumption in your app
3. Emit stamina events to consume/query stamina

## Architecture: Hybrid Sync/Async Pattern

The stamina system uses a hybrid approach to avoid race conditions in game loops:

### Local State Cache
Each app maintains a local copy of stamina for immediate synchronous checks:

```javascript
let currentStamina = 100  // Local cache

// Sync check before action
if (currentStamina < cost) {
  console.log('Not enough stamina!')
  return
}

// Action happens immediately
performAction()

// Consume stamina via event (async)
world.emit(`stamina:consume:${playerId}`, { amount: cost, requestId })
```

### State Synchronization
Apps listen for stamina changes to update their cache:

```javascript
world.on('stamina:changed', ({ playerId, stamina }) => {
  if (playerId === myPlayerId) {
    currentStamina = stamina  // Update cache
  }
})
```

### Event Pattern
For consumption/replies, all stamina events follow this pattern:
```javascript
// Emit a request
world.emit(`stamina:action:${playerId}`, {
  amount: 10,        // For consume actions
  requestId: '...'   // Unique request ID for matching replies
})

// Listen for the reply (use world.on + world.off)
const replyHandler = (data) => {
  world.off(`stamina:action-reply:${playerId}:${requestId}`, replyHandler)
  // Handle the response
}
world.on(`stamina:action-reply:${playerId}:${requestId}`, replyHandler)
```

## Using Stamina in Your App

### Quick Start Template

```javascript
if (world.isClient) {
  const player = world.getPlayer()
  let currentStamina = 100  // Local cache
  const playerId = player.id

  // Listen for stamina changes
  const staminaChangedHandler = ({ playerId: changedId, stamina }) => {
    if (changedId === playerId) {
      currentStamina = stamina
    }
  }
  world.on('stamina:changed', staminaChangedHandler)

  // Cleanup on destroy
  app.on('destroy', () => {
    world.off('stamina:changed', staminaChangedHandler)
  })

  // Use currentStamina for sync checks
  function performAction() {
    const cost = 30
    if (currentStamina < cost) {
      console.log('Not enough stamina!')
      return
    }

    // Perform action immediately
    doAction()

    // Consume stamina (async)
    const requestId = Math.random().toString(36).substr(2, 9)
    world.emit(`stamina:try-consume:${playerId}`, {
      amount: cost,
      requestId,
    })

    const replyHandler = ({ success }) => {
      world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
      // Reply confirms consumption
    }
    world.on(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
  }
}
```

## Using Stamina in Your App

### Instant Actions (like Dash)

For actions that consume a fixed amount of stamina:

```javascript
app.configure([
  {
    key: 'staminaCost',
    type: 'number',
    label: 'Stamina Cost',
    initial: 30,
    min: 0,
    max: 100,
  },
])

if (world.isClient) {
  const player = world.getPlayer()
  let currentStamina = 100
  const playerId = player.id

  // Sync stamina state
  world.on('stamina:changed', ({ playerId: changedId, stamina }) => {
    if (changedId === playerId) currentStamina = stamina
  })

  function performAction() {
    const staminaCost = config.staminaCost || 30

    // Sync check - immediate feedback
    if (currentStamina < staminaCost) {
      console.log('Not enough stamina!')
      return
    }

    // Perform action immediately
    dash()

    // Consume stamina (async)
    const requestId = Math.random().toString(36).substr(2, 9)
    const replyHandler = ({ success }) => {
      world.off(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
    }

    world.emit(`stamina:try-consume:${playerId}`, {
      amount: staminaCost,
      requestId,
    })
    world.on(`stamina:try-consume-reply:${playerId}:${requestId}`, replyHandler)
  }
}
```

### Continuous Actions (like Sprint)

For actions that drain stamina over time:

```javascript
app.configure([
  {
    key: 'staminaDrainRate',
    type: 'number',
    label: 'Stamina Drain Rate',
    hint: 'Stamina consumed per second',
    initial: 25,
    min: 0,
    max: 100,
  },
])

if (world.isClient) {
  const player = world.getPlayer()
  let currentStamina = 100
  let isActive = false
  const staminaDrainRate = config.staminaDrainRate || 25
  const playerId = player.id

  // Sync stamina state
  world.on('stamina:changed', ({ playerId: changedId, stamina }) => {
    if (changedId === playerId) currentStamina = stamina
  })

  app.on('update', (dt) => {
    const shouldBeActive = checkIfShouldActivate()  // Your logic here

    // Activate if conditions met and not already active
    if (shouldBeActive && !isActive && currentStamina > 0) {
      isActive = true
      startContinuousAction()
    }

    // Deactivate if conditions not met
    if (!shouldBeActive && isActive) {
      isActive = false
      stopContinuousAction()
    }

    // If active, consume stamina each frame
    if (isActive) {
      // Sync check before consuming
      if (currentStamina <= 0) {
        isActive = false
        stopContinuousAction()
        return
      }

      const requestId = Math.random().toString(36).substr(2, 9)
      const replyHandler = ({ success, consumed }) => {
        world.off(`stamina:consume-reply:${playerId}:${requestId}`, replyHandler)
        if (!success || consumed < staminaDrainRate * dt * 0.9) {
          // Stamina depleted
          isActive = false
          stopContinuousAction()
        }
      }

      // Consume stamina for this frame
      world.emit(`stamina:consume:${playerId}`, {
        amount: staminaDrainRate * dt,
        requestId,
      })
      world.on(`stamina:consume-reply:${playerId}:${requestId}`, replyHandler)

      // Perform continuous action
      continueAction()
    }
  })
}
```

### Query Stamina Status

To get current stamina value (usually from your local cache):

```javascript
// Best practice: Use your local cache
console.log(`Stamina: ${currentStamina}`)

// Or query directly if needed
const playerId = world.getPlayer().id
const requestId = Math.random().toString(36).substr(2, 9)

const replyHandler = ({ stamina, maxStamina, percent }) => {
  world.off(`stamina:query-reply:${playerId}:${requestId}`, replyHandler)
  console.log(`Stamina: ${stamina}/${maxStamina} (${Math.round(percent * 100)}%)`)
}

world.emit(`stamina:query:${playerId}`, { requestId })
world.on(`stamina:query-reply:${playerId}:${requestId}`, replyHandler)
```

### Modify Stamina

To add or set stamina:

```javascript
const playerId = world.getPlayer().id

// Add stamina (up to max)
world.emit(`stamina:add:${playerId}`, { amount: 50 })

// Set stamina to specific value
world.emit(`stamina:set:${playerId}`, { value: 75 })
```

## Event Reference

### Consumption Events

#### `stamina:consume:${playerId}`
Consume up to the specified amount of stamina.

**Request:**
```javascript
{
  amount: number,    // Amount to consume
  requestId: string  // Unique ID for matching reply
}
```

**Reply (`stamina:consume-reply:${playerId}:${requestId}`):**
```javascript
{
  success: boolean,  // True if any stamina was consumed
  consumed: number,  // Actual amount consumed
  remaining: number  // Stamina remaining
}
```

#### `stamina:try-consume:${playerId}`
Try to consume the exact amount (all-or-nothing).

**Request:**
```javascript
{
  amount: number,    // Exact amount needed
  requestId: string  // Unique ID for matching reply
}
```

**Reply (`stamina:try-consume-reply:${playerId}:${requestId}`):**
```javascript
{
  success: boolean,  // True if stamina was consumed
  remaining: number  // Stamina remaining
}
```

### Query Events

#### `stamina:query:${playerId}`
Get current stamina status without consuming it.

**Request:**
```javascript
{
  requestId: string  // Unique ID for matching reply
}
```

**Reply (`stamina:query-reply:${playerId}:${requestId}`):**
```javascript
{
  stamina: number,    // Current stamina
  maxStamina: number, // Maximum stamina (100)
  percent: number     // Normalized 0-1
}
```

### Modification Events (No Replies)

#### `stamina:add:${playerId}`
Add stamina to the player (up to max).

```javascript
{
  amount: number  // Amount to add
}
```

#### `stamina:set:${playerId}`
Set stamina to a specific value.

```javascript
{
  value: number  // Value to set (0-100)
}
```

### Monitoring Events (Broadcast)

#### `stamina:changed`
Broadcast when stamina changes (emitted regardless of consumption method).

```javascript
{
  playerId: string,  // Player whose stamina changed
  stamina: number,   // New stamina value
  maxStamina: number,// Maximum stamina (100)
  percent: number,   // Normalized 0-1
  delta: number      // Change amount (+/-)
}
```

## Examples

### Complete Dash Example

See `/examples/ROMs/romDash.js` for a complete implementation showing:
- Local stamina cache (`currentStamina` variable)
- Sync check before dashing
- Event-based consumption
- State synchronization

### Complete Sprint Example

See `/examples/ROMs/romSprint.js` for a complete implementation showing:
- Continuous stamina drain over time
- Activation/deactivation logic
- Frame-by-frame consumption
- Depletion handling

## Stamina System Behavior

- **Max Stamina**: 100 points
- **Regeneration**: 15 points/second after 2 seconds of no stamina use
- **Visual Bar**: 3D bar above player, fades in/out automatically
- **Bar Colors**:
  - Green: >50% stamina
  - Yellow: 25-50% stamina
  - Red: <25% stamina

The stamina bar appears automatically when:
- Stamina is being consumed
- Stamina is below 20%

It fades out after 1 second when stamina is full and not being used.
