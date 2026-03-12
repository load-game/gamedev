# Games Sunset Plan

Last updated: 2026-03-12
Owner: Platform team
Status: Ready for implementation

## Scope

- Remove games prototype UX and compatibility shims from `runtime`.
- Keep this plan scoped to this repo only.
- Coordinate rollout with the `world-service` sunset so runtime stops depending on `/games/*` routes and `/internal/matches/complete`.
- Preserve generic `/worlds/*`, admin, bootstrap, and GameServer behavior.

## Non-Goals

- Do not remove generic slug-prefixed `/worlds/*` admin URL handling.
- Do not remove generic Agones idle shutdown support for ordinary worlds.
- Do not clean up lingering prototype-created `worlds` rows or historical data in this pass.
- Do not include `world-service` or infra cleanup steps in this plan.

## Implementation Checklist

### P0 - Dead Entry Point Removal

- [x] P0-01 (M, `runtime`): Remove the `Games` tab, its state, and its `/games` fetch flow from `src/client/components/ExploreMenu.js`.
  Deliverable: no runtime UI calls `GET /games`, displays games-specific counters, or links to `/games/:game`.

- [x] P0-02 (S, `runtime`): Remove the onboarding copy that still advertises games discovery.
  Deliverable: `src/client/components/MenuRow.js` no longer says "Explore worlds and games".

### P1 - `/games` Prefix Compatibility Removal

- [x] P1-01 (M, `runtime`): Narrow `src/server/forwardedPrefix.js` back to `/worlds/*` handling only.
  Deliverable: no `/games/:game/studio` or `/games/:game/matches/:matchId` prefix extraction remains.

- [x] P1-02 (S, `runtime`): Remove the `/games` app-server/admin URL compatibility cases from `test/integration/app-server-world-url.test.js`.
  Deliverable: test coverage keeps `/worlds/*` expectations and drops `/games/*` expectations.

- [x] P1-03 (S, `runtime`): Delete the dedicated `/games` forwarded-prefix test file.
  Deliverable: `test/integration/forwarded-prefix-games.test.js` is removed.

### P2 - Shared-Schema Runtime Gate Removal

- [x] P2-01 (M, `runtime`): Restore strict `WORLD_ID` vs DB `worldId` validation in `src/core/systems/ServerNetwork.js`.
  Deliverable: `src/server/worldIdMismatch.js` is removed and startup throws on mismatch again without a games-specific escape hatch.

- [x] P2-02 (S, `runtime`): Remove `ALLOW_WORLD_ID_CONFIG_MISMATCH` from `.env.example` and app-server docs.
  Deliverable: `.env.example` and `docs/App-server.md` no longer document the prototype mismatch flag.

- [x] P2-03 (S, `runtime`): Delete the dedicated mismatch tests.
  Deliverable: `test/integration/world-id-mismatch.test.js` is removed.

### P3 - Match Completion Hook Removal

- [x] P3-01 (S, `runtime`): Delete the client-side match completion helper and its test.
  Deliverable: `src/client/matchCompletion.js` and `test/integration/match-completion-payload.test.js` are removed.

- [x] P3-02 (M, `runtime`): Remove the runtime shutdown-time POST to `/internal/matches/complete`.
  Deliverable: `src/server/index.js` no longer computes `lobbyMatchCompletionUrl`, tracks `matchCompletionFinalized`, or sends a match completion callback before Agones shutdown.

- [x] P3-03 (S, `runtime`): Keep generic idle shutdown behavior intact while removing games-only completion coupling.
  Deliverable: ordinary world shutdown still works, but no runtime code depends on `world-service` match completion APIs.

### Deferred Until Data Pass

- [x] D1 (S, `runtime`): Remove the `game_match`-specific 60-second idle timeout behavior from `src/server/index.js`.
  Deliverable: `isGameMatchWorldType` and the shortened timeout branch are gone.

## Validation

- [x] V1: Run `npm run build`.
- [ ] V2: Run `npm test`.
- [ ] V3: Run repo-wide reference cleanup.
  Deliverable: no live code or active docs reference `/games`, `ALLOW_WORLD_ID_CONFIG_MISMATCH`, `return_world_url`, or `origin_lobby_slug`, except in historical commits or this sunset plan.

## Definition of Done

- No games-specific UI entry points remain in `runtime`.
- No runtime code assumes `/games/*` browser or admin prefixes.
- No shared-schema `WORLD_ID` mismatch escape hatch remains.
- Runtime no longer calls the `world-service` internal match completion endpoint during shutdown.
- No `game_match`-specific idle timeout branch remains in runtime.
