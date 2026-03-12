# Hyperliquid Account Streams Plan

Status: In Progress
Owner: Codex + user
Last updated: 2026-03-12

## Goal

Add client-side Hyperliquid account stream subscriptions to `world.hyperliquid(address?)` so app scripts can watch live perpetual account state and positions for the connected wallet or any arbitrary EVM address without polling.

## Decisions Locked In

- Client-side only for this pass.
- `world.hyperliquid()` continues to target the connected wallet.
- `world.hyperliquid(address)` will target an explicit EVM address for watch-only reads and streams.
- Address-bound runtimes should still participate in app-owned auto-cleanup.
- Use only Hyperliquid `clearinghouseState` as the upstream account feed in v1.
- Expose a smaller normalized scripting surface instead of raw Hyperliquid websocket payloads.
- Keep `getBalance()` and `getPositions()` pull-based for now.
- Add a TODO in code to revisit reading from the latest streamed snapshot later.
- Deliver stream callbacks from the system `update()` loop, not directly from websocket handlers.
- App scripts should not need to manually unsubscribe on destroy.
- Existing trading behavior on the default runtime should remain unchanged.

## Out Of Scope

- Server-side Hyperliquid account streams.
- New replication for account state.
- Open-order watching in v1.
- Raw account websocket methods (`userEvents`, `orderUpdates`, `notification`, `webData2`, etc.).
- Making `world.hyperliquid(address)` write on behalf of arbitrary addresses.
- Changing the behavior of existing `getBalance()` / `getPositions()` reads.

## Recommended Target API

```js
const localHl = world.hyperliquid()
const watchedHl = world.hyperliquid('0x1234...')

const sub = await watchedHl.subscribeAccount(account => {
  console.log(account.address)
  console.log(account.positions)
})
```

This is also the intended scripting surface for remote players when an address is available:

```js
const player = world.getPlayer(playerId)
if (player?.evm) {
  const remoteHl = world.hyperliquid(player.evm)
  await remoteHl.subscribeAccount(account => {
    console.log(account.positions)
  })
}
```

Each subscription returns:

```js
{ unsubscribe, failureSignal }
```

`unsubscribe()` is for stopping early. App-destroy cleanup should be automatic.

### Normalized Account Payload

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

## Files Expected To Change

- `src/core/systems/HyperliquidClient.js`
- `docs/scripting/world/World.md`
- `index.d.ts`
- `test/integration/hyperliquid-client.test.js`

## Checklist

- [x] 1. Refactor the runtime factory to separate owner cleanup from target address binding.
  - Replace the current positional `world.hyperliquid(owner)` assumption with a user-facing `world.hyperliquid(address?)`.
  - Internally split `owner` and `address` so app-owned cleanup still works for both default and address-bound runtimes.
  - Cache runtime APIs by owner+normalized-address pair.
  - Acceptance: `world.hyperliquid()` and `world.hyperliquid(address)` are both stable per owner/address combination.

- [x] 2. Generalize the existing market-stream internals into shared Hyperliquid stream infrastructure.
  - Rename narrow `marketStream*` internals or otherwise expand them so account streams can reuse the same transport, subscription client, registries, and listener lifecycle.
  - Keep one lazy websocket transport and one lazy subscription client shared across market and account streams.
  - Acceptance: market streams continue to work unchanged while account streams can reuse the same infrastructure.

- [x] 3. Normalize watched addresses and stream keys.
  - Normalize address inputs with the same checksum and canonical rules used elsewhere in the runtime.
  - Define a deterministic key for v1 account streams:
    - `clearinghouseState:${address}`
  - Acceptance: equivalent address inputs reuse the same upstream stream.

- [x] 4. Add account snapshot normalization helpers.
  - Convert Hyperliquid `clearinghouseState` payloads into a smaller scripting payload with numeric fields and normalized position objects.
  - Reuse the existing `getPositions()` shape where it makes sense, then extend it with the additional position metadata needed from the stream.
  - Keep the raw Hyperliquid payload out of the default scripting API for this pass.
  - Acceptance: script listeners receive a stable, app-friendly account snapshot.

- [x] 5. Implement the upstream `clearinghouseState` subscription per address.
  - Create one upstream subscription per normalized address.
  - Queue incoming snapshots and flush only the latest payload per frame.
  - Share the upstream subscription across all local listeners for the same address.
  - Acceptance: repeated subscriptions to the same watched address reuse one upstream feed.

- [x] 6. Implement `subscribeAccount(listener)`.
  - Add the method to the runtime API returned by `world.hyperliquid(address?)`.
  - Return `{ unsubscribe, failureSignal }`.
  - Use runtime-owned cleanup just like market streams.
  - Acceptance: scripts can watch local or arbitrary-address account state through one normalized API.

- [x] 7. Guard write methods on addressed runtimes.
  - Preserve existing write behavior on the default connected-wallet runtime.
  - On address-bound runtimes, throw a clear error for `buy`, `sell`, `closePosition`, `deposit`, `withdraw`, `hasAgentKey`, and `setupAgentKey`.
  - Acceptance: `world.hyperliquid(address)` is explicitly watch-only and never silently acts on the connected wallet.

- [x] 8. Keep existing pull reads unchanged, with a TODO for later convergence.
  - Leave `getBalance()` and `getPositions()` as request/response helpers backed by `infoClient`.
  - Add a TODO near those methods noting that a future pass could serve them from the latest streamed snapshot when available.
  - Acceptance: no behavior change today, but the future direction is documented in code.

- [x] 9. Document the addressed runtime and account stream API.
  - Update `docs/scripting/world/World.md` to document `world.hyperliquid(address?)`.
  - Document that account streaming is client-only.
  - Document addressed runtimes as watch-only.
  - Acceptance: scripting docs clearly explain local-wallet vs watched-address usage.

- [ ] 10. Update the public typings.
  - Extend `index.d.ts` for `world.hyperliquid(address?)`.
  - Add the normalized account snapshot type and `subscribeAccount`.
  - Acceptance: the public scripting types reflect the new API.

- [ ] 11. Add integration tests.
  - Test runtime caching across owner+address pairs.
  - Test address normalization into deterministic keys.
  - Test duplicate subscriptions sharing one upstream `clearinghouseState` stream.
  - Test coalescing to the latest snapshot per update flush.
  - Test dead-owner listener cleanup.
  - Test addressed-runtime write guards.
  - Re-run existing market-stream tests to confirm the generalized stream infrastructure does not regress them.
  - Acceptance: account-stream behavior is covered without live network access.

- [ ] 12. Final verification pass.
  - Review for leaks: orphan listeners, orphan upstream subscriptions, unclosed shared transport.
  - Verify docs and typings stay aligned on `world.hyperliquid(address?)` semantics.
  - Acceptance: the plan lands without changing existing trading behavior on the default runtime.

## Conclusion

We are not blocked on websocket infrastructure. The two real implementation tasks are:

- separating runtime ownership from watched-address targeting
- generalizing the current market-only stream internals into shared Hyperliquid stream plumbing

With those in place, a `clearinghouseState`-backed normalized `subscribeAccount` API is a narrow, coherent first step that satisfies the immediate goal of watching positions.

## Paths After V1

- Path A, recommended: ship only `subscribeAccount` backed by `clearinghouseState`. Lowest complexity, enough to watch positions, and keeps the scripting surface tight.
- Path B: add `subscribeOpenOrders` later on top of `openOrders` when scripts need pending exits, entries, or TP/SL visibility alongside positions.
- Path C: move to a richer aggregate feed such as `webData2` later if the product needs a broader account dashboard. This reduces the number of upstream subscriptions but increases payload size, coupling, and surface area.

## Done Criteria

- App scripts can call `world.hyperliquid(address?)`.
- `world.hyperliquid()` remains the connected-wallet runtime.
- `world.hyperliquid(address)` provides watch-only account streaming for arbitrary EVM addresses.
- Multiple listeners for the same watched address share one upstream subscription.
- Callbacks are delivered from `update()`, not raw websocket handlers.
- Dead app scripts are pruned automatically without required manual unsubscribe code.
- Existing default-runtime trading behavior remains unchanged.
