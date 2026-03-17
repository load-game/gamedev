# Agones Integration Plan

## Goal

Capture the highest operational-value Agones integrations that can be added to this runtime with a small implementation surface and low rollout risk.

This plan prioritizes:

1. `Ready`
2. Player tracking (`SetPlayerCapacity`, `PlayerConnect`, `PlayerDisconnect`)

These are the best next steps because they improve startup correctness and live occupancy visibility without requiring control-plane changes.

The Agones health loop is intentionally deferred and tracked separately in [`docs/Agones-health-loop-plan.md`](./Agones-health-loop-plan.md).

## Current State

Today the runtime uses Agones only for shutdown:

- Manual admin shutdown posts to the local Agones SDK HTTP server.
- Idle shutdown posts to the same endpoint after the runtime is empty and the world has been saved.
- Hosted bootstrap can set `SHUTDOWN_IDLE`, which enables idle-triggered Agones shutdown.

Relevant code paths:

- `src/server/adminShutdown.js`
- `src/server/agonesIdleShutdown.js`
- `src/server/index.js`
- `src/server/runtimeBootstrap.js`

What is not integrated today:

- No `Ready`
- No `Health`
- No player tracking
- No Agones Node client dependency
- No `GetGameServer` / `WatchGameServer`
- No `Allocate` / `Reserve`

## Integration Strategy

For the first wave, keep the current transport model:

- Continue using the local Agones SDK sidecar over loopback HTTP.
- Do not introduce `@google-cloud/agones-sdk` yet.
- Centralize Agones calls behind one small server-side adapter so endpoint details live in one place.
- Enable Agones lifecycle behavior only for hosted runtimes, using `RUNTIME_BOOTSTRAP_URL` as the existing gate.

Recommended adapter surface:

- `ready()`
- `setPlayerCapacity(capacity)`
- `playerConnect(playerId)`
- `playerDisconnect(playerId)`
- `shutdown()`

Recommended new module:

- `src/server/agonesSdkHttp.js`

This keeps `src/server/index.js`, `src/server/adminShutdown.js`, and `src/server/agonesIdleShutdown.js` focused on runtime behavior rather than Agones transport details.

## Guardrails

Before adding startup lifecycle calls, reuse the existing hosted-runtime bootstrap guard.

Recommended enablement rule:

- Agones lifecycle integration is enabled when `RUNTIME_BOOTSTRAP_URL` is set.
- In code, use `usesHostedRuntimeBootstrap(process.env)` as the switch.
- Keep `AGONES_SDK_HTTP_PORT` as the existing optional override for the local SDK HTTP server.

Why this matters:

- The current shutdown-only integration is request-driven, so a missing sidecar is tolerable.
- `Ready` runs automatically during startup.
- Using the existing hosted-runtime gate keeps local dev and self-hosted environments free of avoidable connection failures and noisy logs.

## Priority 1: Ready

### Operational Benefit

- Prevents traffic from reaching a runtime before the world is actually initialized.
- Reduces cold-start connection failures and partial-start behavior.
- Makes pod readiness line up with application readiness.

### Implementation

Call Agones `Ready` once all of the following are true:

- World init completed
- HTTP server is listening
- Direct WSS server, if enabled, is listening
- Startup bootstrap fetch, if enabled, has already completed

Current hook point:

- `src/server/index.js`

Recommended placement:

- After the runtime has finished startup and immediately before or after the existing startup log/registry registration block.
- Do not call `Ready` before listeners are accepting traffic.

### Acceptance Criteria

- `Ready` is sent exactly once per process start.
- If Agones is disabled, the runtime behaves exactly as it does today.
- If Agones is enabled and `Ready` fails, log the failure clearly and exit non-zero so orchestration can restart the pod.

### Tests

- Unit test for the Agones adapter `ready()` call.
- Startup integration test that verifies `Ready` is invoked after startup completes.
- Negative-path test that startup fails fast when `Ready` is enabled but cannot be delivered.

## Priority 2: Player Tracking

### Operational Benefit

- Exposes real occupancy to Agones.
- Makes GameServer state more useful for dashboards, debugging, and future autoscaling/draining logic.
- Aligns actual runtime usage with the control plane instead of relying on indirect metrics.

### Existing Repo Hooks

Stable player lifecycle events already exist:

- `src/core/systems/ServerNetwork.js` emits `playerJoined` with `id: user.id`
- `src/core/systems/ServerNetwork.js` emits `playerLeft` with `id`

Player-cap sources already exist:

- World setting `playerLimit`
- Hosted/runtime env `PUBLIC_WORLD_MAX_PLAYERS`
- Helper: `src/server/worldLimits.js`

### Implementation

#### A. Publish player capacity

Set Agones player capacity at startup using the runtime's effective player cap:

1. `world.settings.playerLimit` when it is a positive integer
2. Otherwise `PUBLIC_WORLD_MAX_PLAYERS` when it is a positive integer
3. Otherwise skip publishing capacity for now

Also update capacity whenever `playerLimit` changes at runtime.

Recommended hook points:

- Startup in `src/server/index.js`
- Settings change subscription via `world.settings.on('change', ...)` or `world.network.on('settingsModified', ...)`

#### B. Publish player connect/disconnect

Wire the existing events directly into Agones:

- On `playerJoined`, call `playerConnect(playerId)`
- On `playerLeft`, call `playerDisconnect(playerId)`

Recommended hook point:

- Existing player lifecycle listeners in `src/server/index.js`

### Acceptance Criteria

- Agones receives capacity updates when the effective player cap changes.
- Agones receives connect/disconnect events for stable player IDs.
- Duplicate disconnects or missing players are handled idempotently and logged at low severity.
- Admin connections do not count as players.

### Tests

- Unit tests for effective capacity resolution.
- Integration test that `playerJoined` calls `playerConnect`.
- Integration test that `playerLeft` calls `playerDisconnect`.
- Integration test that player-limit updates trigger `setPlayerCapacity`.

## Rollout Order

Implement in this order:

1. Add `src/server/agonesSdkHttp.js` and gate it with `usesHostedRuntimeBootstrap(process.env)`.
2. Move existing shutdown calls onto the adapter with no behavior change.
3. Add `Ready`.
4. Add player tracking.
5. Implement the deferred health loop plan in `docs/Agones-health-loop-plan.md`.

This order keeps the first change mostly mechanical, then adds lifecycle behavior one step at a time.

## Implementation Checklist

- [x] Add `src/server/agonesSdkHttp.js` and gate it with `usesHostedRuntimeBootstrap(process.env)`.
- [x] Move existing shutdown calls onto the adapter.
- [ ] Add `Ready`.
- [ ] Add player tracking.
- [ ] Implement the deferred health loop plan in `docs/Agones-health-loop-plan.md`.

## Success Metrics

After rollout, the expected operational improvements are:

- Fewer failed first-join attempts during pod startup
- Better visibility into live player occupancy per GameServer
- Cleaner future path for Agones-aware autoscaling, draining, and placement work

## Out of Scope for This Wave

These can wait until the first wave is stable:

- Health loop integration, tracked separately in `docs/Agones-health-loop-plan.md`
- `Allocate`
- `Reserve`
- `GetGameServer` / `WatchGameServer`
- Labels and annotations
- Counters, lists, and metadata features
- Replacing the HTTP transport with `@google-cloud/agones-sdk`

## Recommended Follow-up

If only one document from this plan turns into work items, the ticket split should be:

1. Add Agones adapter and hosted-bootstrap guard
2. Add `Ready`
3. Add player tracking
4. Implement the deferred health loop plan

That sequence delivers the biggest operational gains with the least coordination cost.
