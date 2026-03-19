# Runtime Push Bootstrap Plan

Status: Proposed
Last updated: 2026-03-17

## Goal

Refactor `runtime/` so a managed runtime can boot in `standby`, accept a one-shot
bootstrap push from `world-service`, and only initialize world state after that bind succeeds.

## Checklist

### 1. Freeze The Runtime-Side Contract

- [x] Update `runtime/src/server/runtimeBootstrap.js` to represent the pushed binding shape explicitly, including `world`, `runtime`, `auth`, `control`, and any remaining per-world admin/runtime fields. Size: 0.5 day.
- [x] Add runtime-side support for an explicit `control.internalBaseUrl` and mark all internal callback URL derivation from `PUBLIC_AUTH_URL` as legacy-to-remove. Files: `runtime/src/server/index.js`, `runtime/src/core/utils-server.js`. Size: 0.5 day.
- [x] Implement the chosen bootstrap auth verification scheme in runtime startup/control code so bootstrap requests can be authenticated before `worldId` is bound. Files: `runtime/src/server/index.js`, `runtime/src/server/runtimeBootstrap.js`. Size: 0.5 day.
- [x] Document the runtime split between static pod env and pushed world-binding config in `runtime/.env.example`. Size: 0.25 day.

Definition of done:

- runtime has a fixed pushed payload shape
- runtime knows how bootstrap auth is verified before bind
- internal control URL usage is separated from `PUBLIC_AUTH_URL`

Notes captured in this step:

- Runtime now expects the binding shape `bootstrapId + { world, runtime, auth, control }`.
- `control.internalBaseUrl` maps to `CONTROL_INTERNAL_BASE_URL`; `PUBLIC_AUTH_URL` remains client-facing auth data only.
- Legacy control-plane fallback still derives from `PUBLIC_AUTH_URL` and logs a startup warning until every managed runtime receives `control.internalBaseUrl`.
- Bootstrap auth is `Bearer HMAC_SHA256(secret, "runtime-bootstrap:<runtimeInstanceId>")`, where `secret` is `RUNTIME_BOOTSTRAP_AUTH_SECRET` or `JWT_SECRET`, and `runtimeInstanceId` comes from `RUNTIME_BOOTSTRAP_INSTANCE_ID`.

### 2. Add Standby Startup Mode

- [x] Refactor `runtime/src/server/index.js` so the process can start without `WORLD_ID`, `DB_SCHEMA`, public runtime URLs, upload limits, or idle timeout and remain in `standby`. Size: 1 day.
- [x] Add pre-init control endpoints:
  - `POST /internal/bootstrap`
  - `GET /internal/bootstrap/status`
  - `GET /healthz`
  Files: `runtime/src/server/index.js` and supporting helpers. Size: 1 day.
- [x] Defer DB, assets, storage, and world initialization until after a successful bootstrap request applies the bound config. Files: `runtime/src/server/index.js`, `runtime/src/server/db.js`, `runtime/src/server/Storage.js`, `runtime/src/server/assets*.js`. Size: 1 day.
- [x] Keep standby runtimes from arming idle shutdown until they are bound to a world. Files: `runtime/src/server/index.js`, `runtime/src/server/agonesIdleShutdown.js`. Size: 0.25 day.
- [x] Add state transitions for `standby`, `bootstrapping`, `ready`, and `failed`, and expose them via bootstrap status. Files: `runtime/src/server/index.js`. Size: 0.5 day.

Definition of done:

- a managed runtime can boot with only infra/static env
- no world initialization happens before bootstrap
- control-plane status is observable before gameplay becomes available

### 3. Make Bootstrap One-Shot And Traffic-Safe

- [x] Make bootstrap idempotent for the same `bootstrapId` and reject rebinding attempts with a different binding after success. Files: `runtime/src/server/index.js`, `runtime/src/server/runtimeBootstrap.js`. Size: 0.5 day.
- [x] Gate gameplay/admin entrypoints until bootstrap status is `ready`, returning retryable not-ready responses during `standby` and `bootstrapping`. Files: `runtime/src/server/index.js`, `runtime/src/server/admin.js`. Size: 0.5 day.
- [x] Ensure world-specific runtime values that currently live in env can be applied before init from the pushed binding, including auth/control/public URL fields and limits. Files: `runtime/src/server/index.js`, `runtime/src/server/runtimeBootstrap.js`. Size: 0.5 day.
- [x] Make post-bind runtime callbacks use the pushed control URL and derive per-world runtime auth only after `worldId` is bound. Files: `runtime/src/server/index.js`, `runtime/src/core/utils-server.js`. Size: 0.5 day.

Definition of done:

- the runtime can only be bound once
- clients cannot hit partially configured gameplay/admin surfaces
- runtime callbacks no longer depend on `PUBLIC_AUTH_URL` hacks

### 4. Cut Over From Pull Mode

- [x] Add a runtime rollout switch for `pull|push` bootstrap modes so managed runtimes can migrate incrementally. Files: `runtime/src/server/index.js`, `runtime/.env.example`. Size: 0.5 day.
- [x] Keep pull and push modes behaviorally aligned long enough to add parity tests for the required managed-world config set. Files: `runtime/test/integration/*.test.js`. Size: 0.5 day.
- [x] Remove the old startup pull-bootstrap path after push mode is stable in canary. Files: `runtime/src/server/index.js`, `runtime/src/server/runtimeBootstrap.js`. Size: 0.5 day.

Definition of done:

- runtime can be rolled over safely per environment
- push mode no longer depends on the old startup pull path

### 5. Runtime Tests And Operability

- [x] Add targeted integration tests for:
  - booting into `standby`
  - successful bootstrap
  - duplicate bootstrap with same binding
  - rejected rebind with different binding
  - runtime restart followed by re-bootstrap
  Files: `runtime/test/integration/*.test.js`. Size: 1 day.
- [x] Add structured runtime logs for `standby`, `bootstrap_start`, `bootstrap_success`, `bootstrap_failed`, and `rebind_rejected`. Files: `runtime/src/server/index.js`. Size: 0.5 day.
- [x] Add runtime-side canary/rollback notes to `runtime/docs/` once the flag exists. Files: `runtime/docs/push-bootstrap-plan.md`. Size: 0.25 day.
- [x] After V1 is stable, define the runtime-side reset/scrub requirements needed for any future warm standby pool. Files: `runtime/docs/push-bootstrap-plan.md`, `runtime/src/server/*`. Size: 1 day research.

Definition of done:

- runtime behavior is covered by targeted tests
- runtime-side rollout and failure signals are operationally obvious

## Suggested Execution Order

1. Freeze the runtime-side contract
2. Add standby startup mode
3. Make bootstrap one-shot and traffic-safe
4. Cut over from pull mode behind a flag
5. Add tests and operability

## Canary And Rollback Notes

### Push-Mode Canary

1. Roll out `RUNTIME_BOOTSTRAP_MODE=push` to a single managed runtime slice first. Keep `RUNTIME_BOOTSTRAP_INSTANCE_ID` and `RUNTIME_BOOTSTRAP_AUTH_SECRET` (or `JWT_SECRET`) pod-static, and leave world-bound values sourced only from the pushed binding.
2. Before sending any bootstrap, verify the pod reports `200 GET /healthz` with `state=standby`, `503 GET /health`, and `200 GET /internal/bootstrap/status` with `world.id = null`.
3. Push one binding from `world-service` and verify `GET /internal/bootstrap/status` transitions `standby -> bootstrapping -> ready`. Gameplay and admin routes should stay on retryable `503 runtime_not_ready` responses until `ready`.
4. Require the runtime logs to show `standby`, `bootstrap_start`, and `bootstrap_success` for the canary pod. Treat `bootstrap_failed` or `rebind_rejected` as rollout blockers until the underlying cause is fixed.
5. Re-post the same binding once to confirm idempotency, then confirm world callbacks are using the pushed `control.internalBaseUrl` rather than any `PUBLIC_AUTH_URL` fallback.

### Rollback

1. Flip the affected deployment back to `RUNTIME_BOOTSTRAP_MODE=pull` and redeploy with `WORLD_ID` plus `RUNTIME_BOOTSTRAP_URL` populated again for that environment.
2. Replace any push-mode pod that reached `failed` or bound the wrong world. The runtime intentionally rejects rebinding in-process, so rollback is done by pod replacement rather than a second `/internal/bootstrap` with different data.
3. After rollback, verify the replacement pod reaches `GET /health = 200`, the bound world metadata is present on `GET /status`, and the reverted pool is no longer emitting `bootstrap_failed` or `rebind_rejected` events.

## Future Warm Standby Reset And Scrub Requirements

V1 does not support recycling a `ready` runtime back into `standby`. Any future warm standby pool needs an explicit reset path that does all of the following before the pod can accept a new bootstrap:

1. Quiesce traffic first: block new gameplay/admin connections, close existing sockets, and stop any direct WSS listener so the runtime cannot serve the old world during the scrub window.
2. Persist and destroy the bound world: run `world.network.save()`, close `world.storage`, destroy the world instance, and tear down any timers/listeners hanging off the current `runtimeState.resources.world`.
3. Release persistence handles cleanly: close `runtimeState.resources.storage`, add an explicit Knex teardown for `src/server/db.js`, and ensure no sqlite or postgres connection survives into the next world bind.
4. Reset runtime-bound process env and lifecycle state together: clear `WORLD_ID`, `DB_SCHEMA`, world-scoped `PUBLIC_*` values, `CONTROL_INTERNAL_BASE_URL`, `SHUTDOWN_IDLE`, and the in-memory `runtimeState.lifecycle.{binding,bindingKey,worldId,worldSlug,source,readyAt,failedAt,error}` fields before reporting `standby` again.
5. Reset background controllers and registry state: clear idle-shutdown timers, reset the Agones idle controller back to the noop controller, clear registry verification tokens/timeouts, and zero any admin connection counters that were accumulated for the prior world.
6. Scrub per-world filesystem state deliberately: either delete the previous world directory or guarantee a fresh directory for the next bind so `.runtime-worlds/*`, `db.sqlite`, uploaded assets, and generated metadata cannot leak across worlds.
7. Re-run the cold-standby contract after scrub: `GET /healthz` should return `state=standby`, `GET /internal/bootstrap/status` should show no bound world, and only then should the runtime accept the next bootstrap payload.

Current code gaps to account for if this is implemented later:

1. `shutdown()` currently saves network/storage state, but it does not destroy `runtimeState.resources.world` or close the shared Knex handle.
2. `getDB()` keeps a process-global `db` singleton today, so warm reuse needs either connection reset support or a non-singleton DB lifecycle.
3. `runtimeState`, deferred world proxies, and admin connection counters are initialized once per process today; a reset path will need explicit scrub hooks for each of them rather than relying on process restart.
