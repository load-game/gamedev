# World

The global `world` variable is always available within the app scripting runtime.

### `.networkId`: String

A unique ID for the current server or client.

### `.isServer`: Boolean

Whether the script is currently executing on the server.

### `.isClient`: Boolean

Whether the script is currently executing on the client.

### `.add(node)`

Adds a node into world-space, outside of the apps local hierarchy.

### `.remove(node)`

Removes a node from world-space, outside of the apps local hierarchy.

### `.attach(node)`

Adds a node into world-space, maintaining its current world transform.

### `.load(type, url)`: Promise\<Node\>

Asynchronously loads an asset and returns a node tree that can be added to the app or world.

**Supported types:**
- `'model'` - Loads a GLB/GLTF model file
- `'avatar'` - Loads a VRM avatar file
- `'splat'` - Loads a gaussian splat file (.spz)

**Example:**
```javascript
// Load a model
const model = await world.load('model', props.modelFile?.url)
app.add(model)

// Load a splat
const splat = await world.load('splat', props.splatFile?.url)
app.add(splat)

// Traverse loaded nodes
model.traverse(node => {
  if (node.name === 'mesh') {
    // do something with mesh nodes
  }
})
```

### `.on(event, callback)`

Subscribes to both engine events (eg when players `enter` or `leave` the world) and custom events emitted by other apps (via `app.emit()`)

**Engine events:**

| event | data | notes |
|---|---|---|
| `enter` | `{ playerId }` | fires when a player joins; avatar is not yet loaded |
| `leave` | `{ playerId }` | fires when a player leaves |
| `avatarLoaded` | `{ playerId }` | fires when a remote player's avatar finishes loading and is ready (eg. safe to call `player.ragdoll()`) |

### `.off(event, callback)`

Unsubscribes from world events.

### `.raycast(origin: Vector3, direction: Vector3, maxDistance: ?Number, layerMask: ?Number, opts: ?Object)`

Raycasts the physics scene.
If `maxDistance` is not specified, max distance is infinite.
If `layerMask` is not specified, it will hit anything.

**opts fields:**
- `ignoreLocalPlayer`: Boolean — if `true`, ignores the local player's capsule collider
- `ignorePlayerId`: String — ignores the capsule collider of the player with this ID

### `.createLayerMask(...groups)`

Creates a bitmask to be used in `world.raycast()`.
Currently the only groups available are `environment` and `player`.

### `.getPlayer(playerId)`: Player

Returns a player. If no `playerId` is provided it returns the local player.

### `.getPlayers()`: [...Player]

Returns an array of all players.

### `.get(key)`: Any

Gets a value from persistent world storage by key. Only available on the server.

### `.set(key, value)`

Sets a value in persistent world storage by key. Only available on the server. Values must be JSON-serializable.

### `.getQueryParam(key)`

Gets a query parameter value from the browsers url

### `.setQueryParam(key, value)`

Sets a query parameter in the browsers url

### `.open(url: string, newTab: ?Boolean)`

Opens a link, defaults to new tab.

### `.setReticle(options: ?Object)`

Customizes the center-screen reticle. Pass `null` to reset to default.

Top-level fields:

- `spread`: Number (0–64) — offset all layers outward from center
- `color`: String — default hex color for all layers, e.g. `"#FFFFFF"`
- `opacity`: Number (0–1)
- `layers`: Array — up to 32 shape primitives (see below)

Each layer is an object with a `shape` and shape-specific fields. Every layer can also override `color`, `outlineColor`, `outlineWidth` (0–4), and `opacity` (0–1).

**Shapes:**

| shape | fields |
|---|---|
| `line` | `length` (1–64), `gap` (0–32), `angle` (0–360 degrees), `thickness` (0.5–8) |
| `circle` | `radius` (1–64), `thickness` (0.5–8) |
| `dot` | `radius` (0.5–16) |
| `rect` | `width` (1–64), `height` (1–64), `rx` (0–32), `thickness` (0.5–8) |
| `arc` | `radius` (1–64), `startAngle` (-360–360), `endAngle` (-360–360), `thickness` (0.5–8) |

Example — gap crosshair with center dot:

```js
world.setReticle({
  color: '#FFFFFF',
  layers: [
    { shape: 'line', length: 6, gap: 3, angle: 0 },
    { shape: 'line', length: 6, gap: 3, angle: 90 },
    { shape: 'line', length: 6, gap: 3, angle: 180 },
    { shape: 'line', length: 6, gap: 3, angle: 270 },
    { shape: 'dot', radius: 1.5 },
  ],
})
```
