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
| `command` | `{ playerId, cmd, value, args }` | fires when a player submits a slash command in chat, like `/tower goto BTC` |

#### Slash commands in app scripts

Slash commands entered through the chat UI are available to app scripts through `world.on('command', callback)`.

The payload shape is:

- `playerId`: the player who issued the command
- `cmd`: the first token after `/`
- `value`: the raw remainder of the command after `cmd`
- `args`: the tokenized command array, including `cmd` at `args[0]`

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

Gets the current cached value from world storage by key. Only available on the server.

This reads the runtime instance cache. It is fast, but it does not force a fresh read from the shared database.

### `.set(key, value)`

Sets a cached world storage value by key. Only available on the server. Values must be JSON-serializable.

This updates the local runtime cache immediately and persists shortly after. For cross-instance coordination, prefer `.setFresh(...)` or `.commitStorage(...)`.

### `.getFresh(key)`: Promise<Any>

Reads a key directly from persistent world storage and refreshes the local cache for that key.

Use this when another runtime instance may have written newer data.

### `.getFreshEntry(key)`: Promise<{ key, exists, value, createdAt, updatedAt }>

Like `.getFresh(key)`, but also returns row metadata and timestamps.

`updatedAt` is useful for compare-and-swap style writes with `.commitStorage(...)`.

### `.getFreshEntriesByPrefix(prefix = '')`: Promise<Array<{ key, exists, value, createdAt, updatedAt }>>

Reads every storage row whose key starts with `prefix` and refreshes those keys in the local cache.

This is useful for shared indexes, per-player keyspaces, and leaderboard scans.

### `.listStorageKeys(prefix = '')`: Promise<string[]>

Returns storage keys matching the given prefix.

### `.setFresh(key, value)`: Promise<Any>

Writes a key directly to persistent storage and refreshes the local cache immediately.

Use this for state that must be visible to other instances right away.

### `.commitStorage(operations)`: Promise<{ ok, conflicts, entries }>

Atomically writes multiple storage keys.

Each operation has the shape:

```js
{
  key: 'tycoon:town:layout:v2',
  value: nextValue,
  expectedUpdatedAt: currentUpdatedAtOrNull,
}
```

If `expectedUpdatedAt` is provided, the write succeeds only if the stored row still has that timestamp. On conflict, the result returns `ok: false` plus the conflicting fresh rows.

This is the primitive to use when many instances may update the same shared records.

### `.getQueryParam(key)`

Gets a query parameter value from the browsers url

### `.setQueryParam(key, value)`

Sets a query parameter in the browsers url

### `.open(url: string, newTab: ?Boolean)`

Opens a link, defaults to new tab.

### `.copy(value, options?)`

Copies content to the system clipboard on the client.

- Text: `await world.copy('0xabc...')`
- Image: `await world.copy(props.image?.url, { kind: 'image' })`

Returns `true` when the clipboard write succeeds, otherwise `false`.

### `.evm(chainId?)`

Returns the EVM helper API.

```js
const evm = world.evm()
const arbitrum = world.evm(42161)
```

The API is available on both client and server, but it is not identical in both places:

- On the client, it exposes wallet-backed read and write methods.
- On the server, it is read-only and backed by a public viem client.

If `chainId` is provided, the API is bound to that chain. On the client, write methods on a bound API will switch the wallet first when needed.

If `chainId` is omitted:

- On the client, it uses the active wallet chain when an EVM wallet is connected, otherwise Ethereum mainnet (`1`).
- On the server, it defaults to Ethereum mainnet (`1`).

Built-in supported chains:

- Ethereum mainnet (`1`)
- Optimism (`10`)
- Polygon (`137`)
- Arbitrum (`42161`)
- Base (`8453`)

`player.evm` is the replicated player wallet address, and `player.evmChainId` is the replicated active EVM chain id. On the local player, when an EVM wallet is connected, they typically match `world.evm().getAddress()` and `world.evm().getChainId()`.

#### `utils`

Shared EVM utility helpers, including address/units formatting helpers.

#### `abis`

Built-in ABI exports, including `erc20`.

#### `getAddress()`

Returns the local connected EVM wallet address, or `null`.

On the server this currently returns `null`.

#### `isConnected()`

Returns `true` when a local EVM wallet is connected.

On the server this currently returns `false`.

#### `getChainId()`

Returns the current target chain id for this EVM API instance.

#### `readContract(params)`

Calls a read-only contract method.

#### `waitForTransactionReceipt(params)`

Waits for a transaction receipt by hash.

#### `getNativeBalance(address?)`

Returns native token balance for the provided address as a number.

On the client, `address` defaults to the active wallet. On the server, you should pass an address explicitly.

#### `getTokenBalance(tokenAddress, address?, decimals = 18)`

Returns ERC-20 token balance as a number.

On the client, `address` defaults to the active wallet. On the server, you should pass an address explicitly.

#### `getUSDCBalance(address?)`

Returns USDC balance for the selected chain using the built-in token mapping.

On the client, `address` defaults to the active wallet. On the server, you should pass an address explicitly.

#### `sendTransaction(params)`

Client-only. Sends a raw transaction through the connected wallet.

#### `writeContract(params)`

Client-only. Sends a contract write through the connected wallet.

#### `switchChain(params)`

Client-only. Switches the connected wallet to a different chain.

On `world.evm(chainId)`, calling `switchChain()` with no args switches to the bound chain.

#### `transferNative(to, amount)`

Client-only. Sends native token to an address.

- `to`: recipient address
- `amount`: decimal amount as number or string

Returns:

```js
{ hash, receipt }
```

#### `transferToken(tokenAddress, to, amount, decimals = 18)`

Client-only. Sends ERC-20 tokens to an address.

Returns:

```js
{ hash, receipt }
```

#### `transferUSDC(to, amount)`

Client-only. Sends USDC for the selected chain using the built-in token mapping.

Returns:

```js
{ hash, receipt }
```

### `.hyperliquid(address?)`

Returns the Hyperliquid helper API.

- `world.hyperliquid()` targets the connected wallet and supports reads, streams, and trading.
- `world.hyperliquid(address)` targets an explicit EVM address for reads and account streaming.
- Address-bound runtimes are watch-only. They never trade on behalf of the connected wallet.
- On the server, Hyperliquid is available as a read-only helper for catalog, account, candle, order, and fills queries.

Market streams and account streams are client-only in this pass. Stream callbacks run from the runtime update loop, not directly from the websocket event handler. When the owning app script is destroyed, its listeners are cleaned up automatically. `unsubscribe()` is optional for destroy-time cleanup and is mainly for stopping a stream early.

```js
const localHl = world.hyperliquid()
const watchedHl = world.hyperliquid('0x1234...')
```

You can also watch another player when they expose an EVM address:

```js
const player = world.getPlayer(playerId)
if (player?.evm) {
  const remoteHl = world.hyperliquid(player.evm)
  await remoteHl.subscribeAccount(account => {
    console.log(account.positions)
  })
}
```

#### `getPrice(ticker)`

Returns the current mid price for core perps, spot pairs, and builder/HIP-3 perps.

#### `getBalance()`

Returns the connected account's combined readable balance:
- core perp account value
- builder perp account values
- spot USDC balance

#### `getPositions()`

Returns open positions across core perps, builder perps, and primary spot holdings:

```js
[
  {
    ticker: 'BTC',
    size: 0.001,
    entryPrice: 104000,
    unrealizedPnl: 5.25,
    liquidationPrice: 95000,
  },
]
```

#### `getAvailableTickers()`

Returns a sorted ticker list for the main perpetual venue.

#### `getPerpMarkets({ includeBuilderDexs = true }?)`

Returns normalized perpetual market metadata plus live context fields.

Core perps use plain tickers like `BTC`.
Builder perps use `DEX:ASSET` tickers like `test:ABC`.

```js
[
  {
    ticker: 'BTC',
    marketType: 'perp',
    venue: 'core',
    dex: null,
    maxLeverage: 50,
    markPrice: 104000,
    midPrice: 104010,
    funding: 0.0001,
    openInterest: 12345.67,
  },
  {
    ticker: 'test:ABC',
    marketType: 'perp',
    venue: 'builder',
    dex: 'test',
    dexLabel: 'Test Dex',
    markPrice: 1.23,
  },
]
```

#### `getSpotMarkets()`

Returns normalized spot market metadata plus live context fields.

Spot markets use `BASE/QUOTE` tickers like `HYPE/USDC`.

```js
[
  {
    ticker: 'HYPE/USDC',
    marketType: 'spot',
    venue: 'spot',
    pairId: '@107',
    baseToken: { name: 'HYPE' },
    quoteToken: { name: 'USDC' },
    markPrice: 21.4,
    midPrice: 21.41,
  },
]
```

#### `getMarketCatalog()`

Returns grouped markets:

```js
{
  corePerps: [...],
  builderPerps: [...],
  spot: [...],
  all: [...],
}
```

#### `getCandles({ ticker, interval, limit?, startTime?, endTime? })`

Returns normalized candle snapshots for a ticker and interval.

Works with perp, spot, and builder/HIP-3 market tickers.

If `startTime` is omitted, the runtime derives it from `limit`.

```js
[
  {
    t: 1710000000000,
    T: 1710000060000,
    s: 'BTC',
    i: '1m',
    o: 62100.2,
    c: 62140.5,
    h: 62155.1,
    l: 62098.8,
    v: 18.4,
    n: 124,
  },
]
```

#### `getOrderStatus({ oid | cloid, address? })`

Returns the normalized order status for the runtime target address.

```js
{
  status: 'order',
  order: {
    oid: 42,
    cloid: '0x1234...',
    ticker: 'BTC',
    side: 'buy',
    status: 'filled',
    statusTimestamp: 1700000000123,
  },
}
```

If the order is unknown, this returns:

```js
{ status: 'unknown' }
```

#### `getUserFills({ aggregateByTime? }?)`

Returns normalized recent fills for the runtime target address.

#### `getUserFillsByTime({ startTime, endTime?, aggregateByTime? })`

Returns normalized fills for the runtime target address within a time window.

#### `subscribeMids(listener)`

Subscribes to live mids for all markets.

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeTrades({ ticker }, listener)`

Subscribes to live trade batches for a ticker.

Works with:
- core perps like `BTC`
- spot pairs like `HYPE/USDC`
- builder perps like `xyz:XYZ100`

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeOrderBook({ ticker, nSigFigs?, mantissa? }, listener)`

Subscribes to the live order book for a ticker. `nSigFigs` and `mantissa` use Hyperliquid's optional aggregation settings.

Works with perp, spot, and builder/HIP-3 market tickers.

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeCandles({ ticker, interval }, listener)`

Subscribes to live candle updates for a ticker and interval.

Works with perp, spot, and builder/HIP-3 market tickers.

Supported intervals:
- `1m`, `3m`, `5m`, `15m`, `30m`
- `1h`, `2h`, `4h`, `8h`, `12h`
- `1d`, `3d`, `1w`, `1M`

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeAccount(listener)`

Subscribes to live account snapshots for the runtime target address.

- On `world.hyperliquid()`, this watches the connected wallet.
- On `world.hyperliquid(address)`, this watches that explicit address.
- This stream is client-only in this pass.

Listener payload:

```js
{
  address: '0x1234...',
  accountValue: 1234.56,
  withdrawable: 1200.12,
  totalMarginUsed: 34.44,
  totalNotionalPosition: 4567.89,
  positions: [
    {
      ticker: 'BTC',
      size: 0.001,
      entryPrice: 104000,
      unrealizedPnl: 5.25,
      liquidationPrice: 95000,
      marginUsed: 15.2,
      maxLeverage: 40,
      leverage: { type: 'cross', value: 5 },
    },
  ],
  timestamp: 1700000000000,
}
```

Returns:

```js
{ unsubscribe, failureSignal }
```

The methods below are only available on the default connected-wallet runtime. On `world.hyperliquid(address)`, they throw a watch-only error.

#### `buy(ticker, amount, slippage = 1, { cloid? }?)`

Places an IOC buy order for a core perp, spot pair, or builder/HIP-3 perp.

#### `sell(ticker, amount, slippage = 1, { cloid? }?)`

Places an IOC sell order for a core perp, spot pair, or builder/HIP-3 perp.

#### `closePosition(ticker, slippage = 1, { cloid? }?)`

Closes the full open position or spot holding for a ticker.

#### `updateLeverage(ticker, leverage, { type = 'cross' }?)`

Updates leverage for a perpetual market on the connected wallet runtime.

Notes:
- `ticker` must resolve to a perpetual market, not spot.
- `leverage` must be an integer greater than or equal to `1`.
- `type` may be `'cross'` or `'isolated'`.

#### `hasAgentKey()`

Returns whether an agent key is already stored for the connected wallet.

#### `setupAgentKey(name = 'HyperfyAgent')`

Creates and approves an agent key for trading.

#### `deposit(amount)`

Deposits Arbitrum USDC to Hyperliquid.

Notes:
- Minimum is 5 USDC.
- Uses Arbitrum USDC (`0xaf88...5831`).
- May require approval + transfer signatures.

#### `withdraw(amount, destination?)`

Withdraws USDC from Hyperliquid to Arbitrum.

Notes:
- Uses main wallet signature (not agent key).
- Defaults to connected wallet address when `destination` is omitted.


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

### Custom development chains

Self-hosted runtimes can opt into an additional EVM chain with `LOCAL_EVM_RPC_URL`
(server) and `PUBLIC_LOCAL_EVM_RPC_URL` (browser and wallet). Set the matching
`LOCAL_EVM_CHAIN_ID` / `PUBLIC_LOCAL_EVM_CHAIN_ID` to a positive safe integer;
both default to 31337 for existing projects. Optional `LOCAL_EVM_CHAIN_NAME` /
`PUBLIC_LOCAL_EVM_CHAIN_NAME` supplies the wallet label. Public RPC URLs must be
reachable by the browser. These settings take effect when the runtime starts.

`world.evm(chainId)` uses that configured RPC for reads. `switchChain()` offers
configured metadata to an injected wallet only when it reports unknown chain
(error 4902), then verifies the selected chain. Rejections are propagated.

Client EVM runtimes also expose `connect()`, `disconnect()` and
`getWalletState()`. Connection requests wallet access; disconnection clears the
runtime wallet binding until explicitly connected again, without revoking the
wallet extension permission or logging out the world identity. `getWalletState()`
refreshes `{address, connected, chainId, source}` from the wallet. Recheck it
before each signature when an operation spans multiple transactions.

`getBlock`, `getBalance` (integer wei), `getTransactionReceipt`, `simulateContract`
and `estimateContractGas` accept the corresponding viem public-client arguments
and use the bound chain's public RPC. None requests a signature.

### Browser preferences

`world.getBrowserPreferences()` returns `{colorScheme: 'light' | 'dark',
reducedMotion: boolean}` on the client, or null on the server. Read again to
observe system preference changes. `world.getPreference(key)` and
`world.setPreference(key, value)` persist small JSON values locally, scoped to
the current blueprint. Values are limited to 4096 serialized characters.

`evm.getRpcChainId()` asks the selected public RPC for its actual chain ID.
Use it to validate deployment configuration; the existing `getChainId()` on a
bound runtime returns the configured chain ID and is not an RPC health check.

`evm.onWalletChange(listener)` subscribes to wallet binding snapshots and returns
an unsubscribe function. Register that function with the app's destroy handler.
Injected provider account, chain and disconnect events invalidate the binding
immediately, before asynchronous reads establish the replacement state. Polling
also detects changes for providers that do not implement events.

### Scoped furniture and moving rooms

`world.furnishing()` returns an app-scoped capability. `validate(room, item,
transform, placed)` runs on both client and server and uses engine OBB geometry.
A room has `size: [width, clearance, depth]`; its local origin is the floor center.
An item declares `size`, optional local `center`, `surfaces`, optional allowed
`orientations` in radians, and `collision: 'solid' | 'overlap'`. Transforms contain
`position`, `yaw`, and `surface: 'floor' | 'wall'`. Rugs can allow overlap. Wall
pieces must touch an actual room wall. Invalid numbers, bounds and surfaces fail.

`toWorld(frame, point)`, `toLocal(frame, point)` and `contains(frame, size, point)`
use `{position: [x,y,z], yaw}`. `moveRoom(node, previousFrame, nextFrame, size)`
requires a node owned by this app. It updates the room and carries occupants while
preserving local position and yaw. Kinematic room colliders and registered snap
nodes follow the normal engine transform updates. On clients only the local player
is teleported; other players replicate their own movement.

Client `begin({room, frame, node, item, transform, placed, authorized, onPreview,
onCommit, onEnd})` creates one edit session per capability. `frame` and `placed`
are functions, so a moving room and concurrent authoritative layout remain current.
The engine captures camera and movement input and uses stage pointer raycasts and
registered snap points. Native touch buttons can call `nudge`, `rotate`, `undo`,
`redo`, `confirm`, and `dispose`; these are the same controls used on desktop.
`setGrid(0)` disables translation snapping; positive values up to two metres enable
it. History retains 32 changes. `preview(transform)` reports provisional validity.

`authorized()` must reflect the current authenticated lease. The server must
independently validate item ownership, room policy and layout revision. `onCommit`
must await durable server acceptance. Failed saves cancel the preview and release
controls. Revocation, explicit disposal and app destruction also release controls.
Returning an item to inventory is an authoritative game operation; remove its node
after the server acknowledges it. This API never grants admin entity mutation.

### Wallet proof for app ownership

Server `world.walletAuth()` exposes `challenge(playerId, address)`,
`verify(playerId, signature)`, `get(playerId)` and `revoke(playerId)`. A challenge
expires after 120 seconds and binds the app, world, socket, player, address and a
random nonce. Verification consumes the nonce once. Leave, socket replacement,
revocation and app destruction invalidate the binding, including in-flight checks.
Use client `world.evm().signMessage({account, message})` to sign the exact returned
message. This requests a message signature, with no transaction or token approval.
The app owns its duplicate-session and explicit handoff policy.

Server `player.kick(reason)` disconnects a player with a reason. Ordinary scripts
must not treat a client-supplied address as proof or accept lifecycle event names
as remote commands. Entity event packets cannot invoke engine lifecycle handlers.

### Native inputs in screen UI

`uiinput` supports both world-space and screen-space `ui` parents. Screen inputs
participate in Yoga layout and engine pointer capture, and support the same native
button and text behavior. Removal cleans up their DOM element and focus handlers.
World scripts create nodes through `app.create`; they do not inject browser UI.

Script globals expose `Date.now()` and `Date.parse(isoTimestamp)`. The scripting
Date is a limited object, not a constructor. Use timestamp arithmetic for age.

### Wallet friends

On the server, call `const friends = world.friends(auth)` with this app's
`world.walletAuth()` instance. The app must authenticate the caller and pass the
actual sending player ID, never an ID supplied inside the client payload.

- `friends.request(playerId, nearbyPlayerId)` requires both verified wallets and
  positions within five metres. There is no request-by-address operation.
- `friends.act(playerId, address, action)` accepts `accept`, `decline`, `cancel`,
  `remove`, `block`, or `unblock`. Only the recipient can accept a request.
- `friends.list(playerId)` returns the caller's relationships, names, addresses,
  `online` and `sameCity`. Presence is visible only to accepted friends.
- `friends.sync()` immediately updates presence after verification or revocation.
  The engine also renews it every ten seconds and expires it after thirty seconds.
- `friends.join(playerId, address)` issues a thirty-second join authorization for
  an accepted friend in another instance. Pass it to client-side
  `await world.joinFriend(token)`. The client reserves before leaving, retains the
  assignment only in the current tab, and reloads into the destination's normal
  spawn. Errors leave the current city connected.

Records are scoped by world ID and app entity ID. Keep those IDs identical across
instances. `engine:friends:` records automatically use configured shared storage.
No wallet key, on-chain transaction or platform account is required. A wallet
change creates a different identity. When a wallet has several verified sessions,
its most recently verified live session supplies its location. Basic limits are
200 relationships per wallet and ten new requests per minute.

Cross-instance joining requires the fixed-game gateway's friend join support and
its shared `ADMISSION_SECRET`. The gateway binds authorizations to its signed
session cookie and tab. The destination checks the friendship and live recipient
again before applying the normal admission capacity limit.

### Player context menu input

`world.playerContext({ enabled, onOpen })` is a client-only, opt-in handler for
right-clicking another player. `onOpen({ playerId, x, y })` runs on release after
a click with at most six pixels of movement. Coordinates are viewport pixels;
locked-pointer selection uses the reticle and screen center. Stage geometry
occludes players. Native UI, cancelled gestures, and right-drags do not open a
menu. Right-drag rotates the camera. `enabled()` gates the handler for modal or
editing states. The returned `dispose()` releases input and listeners; app
destruction also disposes it. The world owns menu presentation and distance rules.

On the server, `friends.status(playerId, targetId)` returns `none`, `incoming`,
`outgoing`, `friend`, or `blocked` for a verified nearby player. A wallet address
is included only for an existing relationship, for use with `friends.act()`.
