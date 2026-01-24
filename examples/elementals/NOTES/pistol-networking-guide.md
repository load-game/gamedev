# Pistol Animation Networking Implementation

## Current State
- Server processes hit detection and damage authoritatively ✓
- Client fires and plays local animations/sounds immediately ✓
- Server broadcasts projectile data to all clients ✓
- **MISSING:** Other players don't see the shooter's animations or hear their sounds

## What Needs to Be Networked

### 1. Player Firing Animation
- Other players should see the shooter's recoil animation
- Plays on all clients when someone fires

### 2. Muzzle Flash Effect
- Particle burst at the shooter's muzzle position
- Visible to all nearby players

### 3. Gunshot Sound
- 3D spatial audio so others can hear direction
- Volume based on distance

### 4. Shell Casing Ejection
- Visual effect only (no gameplay impact)
- Adds realism for observers

## Implementation Plan

### Server Changes (server:fire)

Add broadcast after processing hit detection:

```javascript
// Broadcast fire event to all clients (except shooter)
app.send('player-fired', {
  playerId: player.id,
  origin: data.origin,
  direction: data.dir
})
```

### Client Changes (client)

Add listener for remote player fire events:

```javascript
// In createItem function
app.on('player-fired', (data) => {
  // Ignore our own fire events
  if (data.playerId === player.id) return

  // Get the remote player who fired
  const remotePlayer = world.getPlayer(data.playerId)
  if (!remotePlayer) return

  // Play animations and effects for remote player
  // ... implementation here
})
```

### Networking Flow

```
Player A fires (client)
  ↓
Client A plays local animations immediately
  ↓
Client A sends 'fire' event to server
  ↓
Server processes hit detection
  ↓
Server broadcasts 'player-fired' to all clients
  ↓
Client B, C, D receive broadcast
  ↓
Each client plays animations for Player A
```

## Code Implementation

### Server-Side (in server:fire)

```javascript
server: {
  fire(data) {
    // ... existing hit detection code ...

    // After processing hit:

    // Broadcast fire event to all OTHER players
    // Player receives their own animation via local client
    app.send('player-fired', {
      playerId: player.id,
      origin: data.origin,
      direction: data.dir
    })
  }
}
```

### Client-Side (in createItem, world.isClient section)

```javascript
if (world.isClient) {
  // ... existing code ...

  // Listen for remote player fire events
  app.on('player-fired', (data) => {
    const remotePlayer = world.getPlayer(data.playerId)
    if (!remotePlayer) return

    // Find the pistol instance for this remote player
    const remoteInstance = instances.get(data.playerId)
    if (!remoteInstance) return

    // Get the remote player's pistol skin and bones
    const remotePistol = remoteInstance.client.pistolSkin
    const remoteMuzzle = remoteInstance.client.muzzleBone

    // Play muzzle flash (if close enough to see)
    if (remoteMuzzle && isWithinViewDistance(remotePlayer)) {
      createRemoteMuzzleFlash(remoteMuzzle.matrixWorld)
    }

    // Play sound (spatial, from remote player's position)
    playRemoteFireSound(new Vector3().fromArray(data.origin))

    // Note: Pistol recoil animation is handled by the remote client's
    // animation system - we just need to trigger it
    if (remotePlayer.avatar && remotePlayer.avatar.setEmote) {
      remotePlayer.avatar.setEmote('PistolFire', { duration: 0.3 })
    }
  })
}
```

## Performance Considerations

1. **Rate Limiting:** Only broadcast if player actually fires (not dry fire)
2. **Distance Culling:** Don't send to players too far away to see/hear
3. **Priority:** Use unreliable channel for visual effects (not critical)
4. **Batching:** Group with projectile data if possible to reduce messages

## Testing Checklist

- [ ] Player A fires - Player A sees their own muzzle flash/hears their own sound
- [ ] Player A fires - Player B sees Player A's muzzle flash
- [ ] Player A fires - Player B hears sound from correct direction
- [ ] Multiple players firing - All effects play correctly
- [ ] Distance - Sound inaudible beyond maxDistance
- [ ] Performance - No noticeable lag when many players fire

## Summary

The key is to have the server **broadcast** a 'player-fired' event to all clients after processing the shot. Each client then plays the appropriate animations for the remote player, creating a synchronized experience where everyone can see and hear when someone shoots.
