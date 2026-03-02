# Player

Represents a player. An instance of Player can be retrived via [World.getPlayer](/docs/scripting/world/World.md)

## Properties

### `.id`: String

The players unique ID. This is always the same for the same player, even when they leave and come back.

### `.name`: String

The players name.

### `.local`: Boolean

Whether the player is local to this client.

### `.admin`: Boolean

Whether the player is an admin in this world.

### `.position`: Vector3

The players position in the world.

### `.quaternion`: Quaternion

The players rotation in the world.

### `.rotation`: Euler

The players rotation in the world.

## Methods

### `.teleport(position, rotationY)`

Teleports the player instantly to the new position. The `rotationY` value is in radians, and if omitted the player will continue facing their current direction.

### `.push(force)`

Applies a short, impulse-like push to the local player in world-space. Multiple pushes accumulate vectorially and decay over time with high drag.

- **force**: A direction/impulse vector. Accepts a `Vector3`.

Behavior:
- Adds the impulse to the player’s current push; subsequent calls add to the existing push rather than replacing it.
- Can only be called on a local player.

Example:
```js
// Dash forward relative to camera yaw
const FORWARD = new Vector3(0, 0, -1)
const euler = new Euler(0, 0, 0, 'YXZ')
const quat = new Quaternion()

euler.setFromQuaternion(world.getPlayer().quaternion)
euler.x = 0; euler.z = 0
quat.setFromEuler(euler)

const dir = FORWARD.clone().applyQuaternion(quat).normalize()
world.getPlayer().push(dir.multiplyScalar(30)) // short forward burst
```

### `.firstPerson(value = true)`

Forces the local player into first-person view while `value` is `true`. When set back to `false`, the camera returns to the previous third-person zoom distance that was active when the force began.

Only works on the local player and must be called on the client.

Example:
```js
const player = world.getPlayer()
player.firstPerson(true)
setTimeout(() => player.firstPerson(false), 1500)
```

### `.replaceAnimations(newEmotes, reset = false)`

Replaces the local player's locomotion animation set (idle/walk/run/etc) with custom clips.

This is useful for style packs, themed movement, or swapping to project-specific mocap clips at runtime.

Only works on the local player and must be called on the client.

- **newEmotes**: object map of animation slots to clip URLs.
- **reset**: when `true`, reset all slots to defaults first, then apply `newEmotes`.

Supported slots:
- `idle`
- `walk`
- `walkLeft`
- `walkRight`
- `walkBack`
- `run`
- `runLeft`
- `runRight`
- `runBack`
- `jump`
- `fall`
- `fly`
- `talk`

Legacy uppercase slot names are also accepted (`IDLE`, `WALK`, `RUN`, etc).

Changes are network-synced, so other players will see your updated locomotion set.

Example:
```js
const player = world.getPlayer()

// Replace locomotion with custom local/project assets
player.replaceAnimations(
  {
    idle: 'asset://stand-idle.glb',
    walk: 'asset://walk-forward.glb',
    walkBack: 'asset://walk-backward.glb',
    walkLeft: 'asset://strafe-left-walk.glb',
    walkRight: 'asset://strafe-right-walk.glb',
    run: 'asset://run-forward.glb',
    runBack: 'asset://run-backwards.glb',
    runLeft: 'asset://strafe-left-run.glb',
    runRight: 'asset://strafe-right-run.glb',
  },
  true
)

// Later, restore default locomotion clips
player.replaceAnimations({}, true)
```

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

See [Avatar](/docs/scripting/nodes/types/Avatar.md) for full details.

### `.damage(amount)`

Removes health from the player. Health cannot go below zero.

### `.heal(amount)`

Adds health to the player. Health cannot go above 100.

### `.applyEffect({ anchor, emote, snare, freeze, turn, duration, cancellable, onEnd })`

Applies an effect to the player. If the player already has an effect, it is replaced. If this function is called with `null` it removes any active effect.

All options are optional.

**anchor**: an [Anchor](/docs/scripting/nodes/types/Anchor.md) to attach the player to

**emote**: a url to an emote to play while this effect is active

**snare**: a multiplier from 0 to 1 that reduces movement speed, where zero means no snaring and one means entirely snared. when snared, players can still turn and attempt to move.

**freeze**: when true, the player is frozen in place and all movement keys are ignored.

**turn**: when true, the player will continually face the direction the camera is looking in.

**duration**: how long this effect should last in seconds.

**cancellable**: whether any movement keys will cancel the effect. if enabled, freeze is ignored.

**onEnd**: a function that should be called either at the end of the `duration` or when the player moves if `cancellable`.

### `.screenshare(screenId)`

Can only be called on a local player.

Prompts the player to share their screen, and then casts it to all video nodes that have a matching `.screenId` property.

### `.setAvatar(url)`

Sets the player's persistent avatar, saved to the database. Pass `null` to clear and revert to the world default.

Can be called from server scripts on any player, or from client scripts on the local player only.

### `.setSessionAvatar(url)`

Temporarily overrides the player's avatar for the current session. The session avatar takes priority over the player's default avatar.

- **url**: A URL to a VRM avatar file. Pass `null` to clear the session avatar and revert to the player's default avatar.

This change is synced across the network to all clients.


### `.setVoiceLevel(level)`

Overrides the players voice chat level to `disabled`, `spatial` or `global`.

By default all players have the voice level defined in the world settings menu, but `.setVoiceLevel` allows apps to override it using any logic needed.

Calling `player.setVoiceLevel(null)` removes the current apps override and reverting to the world setting (unless another app is overriding it).

**NOTE:** Changes stack with priority, so if two apps have set a voice level, the higher priority level takes precendence. Global is the highest priority.

Must be called on the server for security reasons.

### `.ragdoll(enable, force?, opts?)`

Enables or disables ragdoll physics on the player. When enabled, the player's avatar collapses into a fully dynamic physics simulation — all animations are suppressed and the body falls under gravity with realistic joint constraints. When disabled, normal animation and movement resume.

- **enable**: `true` to activate ragdoll, `false` to deactivate.
- **force**:  optional Vector3 applied as initial velocity to all body segments on activation, useful for knockback direction
- **opts**: optional ragdoll tuning object:
  - `stiffness` (`Number`, default `1`): scales active-ragdoll joint drive strength. `0` is fully limp.
  - `damping` (`Number`, default `1`): scales linear/angular damping on ragdoll bodies.
  - `bounce` (`Number`, default material value): restitution override, clamped to `0..1`.
  - `gravity` (`Number`, default `1`): gravity scale. `0` = zero gravity, `2` = 2x gravity.
  - `duration` (`Number`, default `null`): auto-disable ragdoll after this many seconds.
  - `flailDuration` (`Number`, default `1.2`): how long the initial arm/head flail impulses are applied.
  - `muscleFadeDuration` (`Number`, default `3.5`): how long active ragdoll muscle stiffness takes to decay.

Can be called on:
- **Server**: applies ragdoll to the target player and syncs to all clients.
- **Client (local player only)**: applies ragdoll locally for that client only (not network-synced).

Example:
```js
// Enable ragdoll with an upward impulse.
player.ragdoll(true, new Vector3(0, 4, 0), {
  stiffness: 0.6,
  damping: 0.25,
  gravity: 1.2,
  bounce: 0.15,
  flailDuration: 1.8,
  muscleFadeDuration: 0.4,
  duration: 2,
})

// Later, reset back to normal control/animation.
player.ragdoll(false)
```
