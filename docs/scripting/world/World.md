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

Returns the current mid price.

#### `getBalance()`

Returns account value in USD.

#### `getPositions()`

Returns open positions:

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

Returns a sorted ticker list available for trading.

#### `subscribeMids(listener)`

Subscribes to live mids for all markets.

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeTrades({ ticker }, listener)`

Subscribes to live trade batches for a ticker.

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeOrderBook({ ticker, nSigFigs?, mantissa? }, listener)`

Subscribes to the live order book for a ticker. `nSigFigs` and `mantissa` use Hyperliquid's optional aggregation settings.

Returns:

```js
{ unsubscribe, failureSignal }
```

#### `subscribeCandles({ ticker, interval }, listener)`

Subscribes to live candle updates for a ticker and interval.

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

#### `buy(ticker, amount, slippage = 1)`

Places an IOC buy order.

#### `sell(ticker, amount, slippage = 1)`

Places an IOC sell order.

#### `closePosition(ticker, slippage = 1)`

Closes the full open position for a ticker.

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
