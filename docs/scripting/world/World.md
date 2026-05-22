# World

The global `world` variable is always available within the app scripting runtime.

### `.networkId`: String

Requires a network plugin (`gamedev/plugins/network/client`, `gamedev/plugins/network/server`, or `gamedev/plugins/network/admin`).

A unique ID for the current server or client.

### `.isServer`: Boolean

Requires a network plugin.

Whether the script is currently executing on the server.

### `.isClient`: Boolean

Requires a network plugin.

Whether the script is currently executing on the client.

### `.add(node)`

Adds a node into world-space, outside of the apps local hierarchy.

### `.remove(node)`

Removes a node from world-space, outside of the apps local hierarchy.

### `.attach(node)`

Adds a node into world-space, maintaining its current world transform.

### `.load(type, url)`: Promise\<Node\>

Requires a loader registry plugin (`gamedev/plugins/loader/client` or `gamedev/plugins/loader/server`) plus a handler plugin that provides the requested asset type, such as `gamedev/plugins/loader/client-handlers` or `gamedev/plugins/loader/server-handlers`.

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
Requires the spatial plugin (`gamedev/plugins/spatial`).
If `maxDistance` is not specified, max distance is infinite.
If `layerMask` is not specified, it will hit anything.

**opts fields:**
- `ignoreLocalPlayer`: Boolean — if `true`, ignores the local player's capsule collider
- `ignorePlayerId`: String — ignores the capsule collider of the player with this ID

### `.createLayerMask(...groups)`

Creates a bitmask to be used in `world.raycast()`.
Requires the spatial plugin (`gamedev/plugins/spatial`).
Currently the only groups available are `environment` and `player`.

### `.overlapSphere(radius: Number, origin: Vector3, layerMask: ?Number)`

Returns physics proxies overlapping a sphere.
Requires the spatial plugin (`gamedev/plugins/spatial`).

### `.getPlayer(playerId)`: Player

Requires the player entities plugin (`gamedev/plugins/entities/player`) or a preset that includes it.

Returns a player. If no `playerId` is provided it returns the local player.

### `.getPlayers()`: [...Player]

Requires the player entities plugin (`gamedev/plugins/entities/player`) or a preset that includes it.

Returns an array of all players.

### `.get(key)`: Any

Requires the storage plugin (`gamedev/plugins/storage`). The default server preset includes it.

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
Requires the browser client plugin (`gamedev/plugins/browser/client`).

### `.setQueryParam(key, value)`

Sets a query parameter in the browsers url
Requires the browser client plugin (`gamedev/plugins/browser/client`).

### `.open(url: string, newTab: ?Boolean)`

Opens a link, defaults to new tab.
Requires the browser client plugin (`gamedev/plugins/browser/client`).

### `.copy(value, options?)`

Copies content to the system clipboard on the client.
Requires the browser client plugin (`gamedev/plugins/browser/client`).

- Text: `await world.copy('0xabc...')`
- Image: `await world.copy(props.image?.url, { kind: 'image' })`

Returns `true` when the clipboard write succeeds, otherwise `false`.

### `.evm(chainId?)`

Requires the EVM plugin (`gamedev/plugins/evm`).

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

Requires the Hyperliquid plugin (`gamedev/plugins/hyperliquid`).

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

Requires the UI plugin (`gamedev/plugins/ui/client`).

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
