# Hyperliquid Market Streams Plan

Status: Proposed
Owner: Codex + user
Last updated: 2026-03-11

## Goal

Add client-side Hyperliquid market stream subscriptions to `world.hyperliquid()` so app scripts can react to live market data without polling.

## Decisions Locked In

- Client-side only for this pass.
- Market streams first.
- No server-side Hyperliquid system yet.
- No new player replication.
- `player.evm` remains the account identity for future account-bound work.
- Keep write methods (`buy`, `sell`, `deposit`, `withdraw`, `setupAgentKey`) client-only and unchanged in behavior.
- Deliver websocket events from the system `update()` loop, not directly from raw socket callbacks.
- App scripts should not need to manually unsubscribe on destroy; runtime-owned cleanup is required.

## Out Of Scope

- Account streams (`userEvents`, `clearinghouseState`, balance/position subscriptions).
- Address-bound `world.hyperliquid(address?)` runtime factory.
- Admin/runtime network replication for Hyperliquid state.
- UI work beyond existing script/runtime APIs.

## Target API

```js
const hl = world.hyperliquid()

const mids = await hl.subscribeMids(data => {
  console.log(data.mids.BTC)
})

const trades = await hl.subscribeTrades({ ticker: 'BTC' }, data => {
  console.log(data)
})

const book = await hl.subscribeOrderBook({ ticker: 'ETH' }, data => {
  console.log(data.levels)
})

const candles = await hl.subscribeCandles({ ticker: 'SOL', interval: '1m' }, data => {
  console.log(data.c)
})
```

Each subscription returns:

```js
{ unsubscribe, failureSignal }
```

`unsubscribe()` is for stopping early. App-destroy cleanup should be automatic.

## Files Expected To Change

- `src/core/systems/HyperliquidClient.js`
- `docs/scripting/world/World.md`
- `test/integration/hyperliquid-client.test.js`

## Checklist

- [x] 1. Refactor `world.hyperliquid()` into a stable runtime API factory in `src/core/systems/HyperliquidClient.js`.
  - Add a `getRuntimeAPI(owner = null)` method instead of returning a new inline object from `init()`.
  - Cache runtime APIs so repeated `world.hyperliquid()` calls from the same owner are stable.
  - Preserve all existing read/write methods on the runtime object.
  - Acceptance: existing call sites continue to work with no API regressions.

- [x] 2. Add websocket market-stream infrastructure to `src/core/systems/HyperliquidClient.js`.
  - Import `WebSocketTransport` and `SubscriptionClient` from `@nktkas/hyperliquid`.
  - Add lazy initialization for one shared websocket transport and one shared subscription client.
  - Add teardown logic so transport can be closed from `destroy()`.
  - Acceptance: transport is created only on first subscription attempt and can be fully closed.

- [x] 3. Add internal stream registries and queues.
  - Add a registry for active upstream subscriptions keyed by normalized stream key.
  - Add listener registries per stream entry.
  - Add pending-event queues for per-frame delivery.
  - Acceptance: the system can represent one upstream stream with many local listeners.

- [x] 4. Normalize stream parameters and keys.
  - Add ticker normalization for `subscribeTrades`, `subscribeOrderBook`, and `subscribeCandles`.
  - Add interval validation for candles.
  - Add order book key normalization for `nSigFigs` and `mantissa`.
  - Define deterministic keys:
    - `allMids`
    - `trades:${ticker}`
    - `l2Book:${ticker}:${nSigFigs}:${mantissa}`
    - `candle:${ticker}:${interval}`
  - Acceptance: equivalent calls map to the same key every time.

- [x] 5. Implement `subscribeMids(listener)`.
  - Reuse one upstream `allMids` subscription across all listeners.
  - Queue incoming events instead of invoking callbacks directly from the websocket.
  - Coalesce mids to the latest payload per frame.
  - Acceptance: multiple listeners share one upstream mids subscription.

- [x] 6. Implement `subscribeTrades({ ticker }, listener)`.
  - Normalize `ticker` to the Hyperliquid `coin` parameter.
  - Reuse one upstream trades subscription per ticker.
  - Preserve arrival order for trade batches when flushing.
  - Acceptance: trades for the same ticker share one upstream stream and flush in order.

- [ ] 7. Implement `subscribeOrderBook({ ticker, nSigFigs?, mantissa? }, listener)`.
  - Normalize ticker and optional aggregation params.
  - Reuse one upstream order book subscription per normalized key.
  - Coalesce order book updates to the latest payload per frame.
  - Acceptance: order book listeners receive the most recent snapshot once per flush.

- [ ] 8. Implement `subscribeCandles({ ticker, interval }, listener)`.
  - Validate interval against supported Hyperliquid candle intervals.
  - Reuse one upstream candle subscription per ticker+interval.
  - Coalesce candle updates to the latest payload per frame.
  - Acceptance: repeated subscriptions for the same ticker/interval reuse one upstream stream.

- [ ] 9. Track listener ownership and dead-script cleanup.
  - Capture the calling app entity when `world.hyperliquid()` is used from scripts.
  - Store the owner's dead hook with each listener registration.
  - Skip and prune listeners whose owner is dead before callback delivery.
  - Make runtime-owned cleanup the default for script callers.
  - Acceptance: destroyed/rebuilt apps stop receiving stream callbacks without any script-level unsubscribe code.

- [ ] 10. Deliver events from `update()` instead of raw socket callbacks.
  - Add a per-frame flush pass in `HyperliquidClient.update()`.
  - For snapshot-style streams (`mids`, `orderBook`, `candles`), flush only the latest pending payload.
  - For trades, flush queued batches in arrival order.
  - Wrap listener invocation so one listener failure does not break stream dispatch for others.
  - Acceptance: no app callback is invoked directly from the websocket event handler.

- [ ] 11. Return subscription handles with idempotent unsubscribe behavior.
  - Return `{ unsubscribe, failureSignal }` from each subscribe method.
  - Make `unsubscribe()` safe to call multiple times.
  - Treat `unsubscribe()` as an early-stop control, not a required destroy-time cleanup step.
  - Remove listener entries immediately on unsubscribe.
  - If the last listener is removed, tear down the upstream subscription and delete the stream entry.
  - Acceptance: early unsubscribe works, and destroy-time cleanup does not depend on user code.

- [ ] 12. Preserve existing Hyperliquid trading behavior.
  - Keep wallet binding behavior in `bind()` intact.
  - Keep `buy`, `sell`, `closePosition`, `deposit`, `withdraw`, `hasAgentKey`, and `setupAgentKey` behavior unchanged.
  - Avoid entangling market-stream lifecycle with exchange-client lifecycle beyond shared system ownership.
  - Acceptance: existing trading tests still pass after streaming changes.

- [ ] 13. Document the new market stream API in `docs/scripting/world/World.md`.
  - Add the four new subscription methods under `.hyperliquid()`.
  - Document return shape: `{ unsubscribe, failureSignal }`.
  - State clearly that streaming is client-only for now.
  - Explain that callbacks are delivered on the runtime update loop and are auto-cleaned when app scripts are destroyed.
  - State that `unsubscribe()` is optional for destroy-time cleanup and is mainly for stopping a stream early.
  - Acceptance: world scripting docs cover both discrete reads and market streams.

- [ ] 14. Add integration tests in `test/integration/hyperliquid-client.test.js`.
  - Test that injected runtime exposes the four subscription methods.
  - Test that duplicate subscriptions reuse one upstream stream.
  - Test that unsubscribing the final listener tears down the upstream subscription.
  - Test that mids/order book/candle streams coalesce to the latest pending event per flush.
  - Test that trades flush in arrival order.
  - Test that dead owner listeners are pruned automatically.
  - Test that `destroy()` unsubscribes streams and closes the websocket transport.
  - Re-run existing Hyperliquid deposit/referrer tests to confirm no regressions.
  - Acceptance: streaming behavior is covered without relying on live network access.

- [ ] 15. Final verification pass.
  - Run targeted Hyperliquid integration tests.
  - Review for leaks: orphan listeners, orphan upstream subscriptions, unclosed transport.
  - Review docs for final API wording consistency (`ticker` externally, Hyperliquid `coin` internally).
  - Acceptance: implementation is stable, documented, and test-backed.

## Done Criteria

- App scripts can subscribe to market streams through `world.hyperliquid()`.
- Multiple listeners for the same stream share one upstream websocket subscription.
- Stream callbacks are delivered during system `update()`, not directly from websocket handlers.
- Dead app scripts are pruned automatically and do not leak subscriptions, without requiring manual unsubscribe-on-destroy code.
- Existing Hyperliquid trading behavior remains unchanged.
