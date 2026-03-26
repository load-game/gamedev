# Runtime Slug-World SDK Auth Plan

Status: Proposed
Last updated: 2026-03-26

## Goal

Refactor `runtime/` so hosted slug worlds use player-derived runtime sessions for
SDK/admin access and no longer depend on `ADMIN_CODE`.

Final state:

- Slug worlds with Lobby identity enabled (`PUBLIC_AUTH_URL` set) accept runtime
  session tokens for SDK/admin traffic.
- `ADMIN_CODE` is ignored for hosted slug worlds.
- Standalone runtimes without external identity keep `ADMIN_CODE` as the admin
  credential.
- Runtime/client/app-server surfaces expose that split explicitly instead of
  inferring behavior from `hasAdminCode`.

## Checklist

### 1. Freeze The Runtime Auth Contract

- [x] Add one runtime auth descriptor helper in `runtime/src/server/authModes.js` that resolves the final admin auth kind from env:
  - hosted slug world: `player_token`
  - standalone runtime: `admin_code`
  Thread that descriptor through startup, runtime snapshots, and admin snapshots. Files: `runtime/src/server/authModes.js`, `runtime/src/server/index.js`, `runtime/src/server/admin.js`, `runtime/src/core/systems/ServerNetwork.js`. Size: 0.5 day.
- [x] Replace `hasAdminCode` payloads and client state with explicit auth metadata. Remove `Settings.hasAdminCode` / `effectiveRank` behavior that currently treats `ADMIN_CODE` absence as implicit admin. Files: `runtime/src/core/systems/Settings.js`, `runtime/src/core/systems/ClientNetwork.js`, `runtime/src/core/systems/AdminNetwork.js`, `runtime/src/core/systems/AdminClient.js`. Size: 0.75 day.
- [x] Normalize hosted-vs-standalone admin error handling and messaging so clients talk about token/session auth for slug worlds and admin code for standalone runtimes only. Files: `runtime/src/core/systems/AdminClient.js`, `runtime/src/client/admin-client.js`, `runtime/src/client/components/sidebar/World.js`, `runtime/src/core/systems/ClientBuilder.js`. Size: 0.5 day.

Definition of done:

- runtime reports one explicit admin auth kind
- clients do not infer auth behavior from `hasAdminCode`
- `ADMIN_CODE` absence no longer makes hosted worlds effectively admin-open

### 2. Make Hosted Runtime Admin Auth Token-Only

- [x] Update runtime admin capability resolution so Lobby-identity runtimes ignore `ADMIN_CODE` for HTTP and WebSocket admin auth and only accept runtime session tokens. Standalone runtimes keep the current admin-code path. Files: `runtime/src/server/admin.js`, `runtime/src/server/authModes.js`. Size: 0.75 day.
- [x] Restrict `/admin <code>` chat escalation and any runtime-side admin-code grant/revoke flow to standalone runtimes only. Hosted worlds should never elevate from chat via `ADMIN_CODE`. Files: `runtime/src/core/systems/ServerNetwork.js`, `runtime/docs/commands.md`. Size: 0.5 day.
- [x] Remove hosted-world admin-code reveal behavior from the runtime admin command surface. `runtime_credentials_get` should be standalone-only or be replaced by a non-secret standalone setup response; hosted worlds should not expose `adminCode` at all. Files: `runtime/src/server/admin.js`, `runtime/src/server/adminCredentials.js`, `runtime/test/integration/admin-credentials-command.test.js`, `runtime/test/integration/admin-client-runtime-credentials.test.js`. Size: 0.5 day.
- [x] Keep root-host `/admin` code-entry UX as a standalone-only surface. Hosted slug-world UX should not prompt for admin code. Files: `runtime/src/client/admin-client.js`, `runtime/src/core/createAdminWorld*`, runtime admin tests/docs. Size: 0.5 day.

Definition of done:

- hosted slug runtimes only authorize admin traffic from runtime session tokens
- standalone runtimes still support `ADMIN_CODE`
- no hosted runtime surface reveals or asks for `ADMIN_CODE`

### 3. Teach The SDK/App-Server To Use Runtime Session Tokens

- [x] Add `WORLD_AUTH_TOKEN` env/config plumbing to the app-server CLI and direct sync path. Files: `runtime/app-server/commands.js`, `runtime/app-server/direct.js`, `runtime/.env.example`. Size: 0.5 day.
- [x] Extend `WorldAdminClient` so token-backed SDK sessions use `Authorization: Bearer <token>` for HTTP requests and `authToken` for WebSocket `adminAuth`, omitting `code` when token-backed. Files: `runtime/app-server/WorldAdminClient.js`, `runtime/app-server/helpers.js`, `runtime/test/integration/app-server-world-url.test.js`. Size: 0.75 day.
- [x] Keep `WORLD_ID` validation from `/admin/snapshot`, but make token-backed auth failures explicit in CLI and app-server output (`unauthorized`, `forbidden`, `expired_session`, `world_id_mismatch`). Files: `runtime/app-server/direct.js`, `runtime/app-server/commands.js`. Size: 0.5 day.
- [x] Update browser admin client state so hosted worlds prefer the stored runtime session token and standalone worlds keep the code-entry path. Files: `runtime/src/core/systems/AdminClient.js`, `runtime/src/core/systems/AdminNetwork.js`, `runtime/src/client/admin-client.js`. Size: 0.5 day.

Definition of done:

- SDK/app-server can connect to `/worlds/:slug/admin/*` using `WORLD_AUTH_TOKEN`
- token-backed WebSocket and HTTP admin paths behave the same as browser admin
- standalone SDK usage still works with `ADMIN_CODE`

### 4. Replace Hosted-World SDK Setup UX

- [x] Replace the world-sidebar setup flow so hosted worlds request tokenized SDK setup data and copy `WORLD_URL`, `WORLD_ID`, and `WORLD_AUTH_TOKEN`. Standalone worlds keep `WORLD_URL`, `WORLD_ID`, and `ADMIN_CODE`. Files: `runtime/src/client/components/sidebar/World.js`, `runtime/src/core/systems/AdminClient.js`. Size: 0.75 day.
- [x] Remove hosted-world references to `ADMIN_CODE` from runtime docs and examples, while keeping standalone instructions explicit. Files: `runtime/README.md`, `runtime/docs/App-server.md`, `runtime/docs/commands.md`, `runtime/.env.example`. Size: 0.5 day.
- [x] Replace tests that assert hosted `hasAdminCode` behavior with tests around explicit auth kind and token-backed setup output. Files: runtime client/unit/integration tests under `runtime/test/integration/`. Size: 0.5 day.

Definition of done:

- hosted SDK setup no longer references `ADMIN_CODE`
- standalone docs still document `ADMIN_CODE`
- runtime UI reflects the final hosted-vs-standalone split

### 5. Runtime Tests And Operability

- [x] Add targeted runtime admin auth tests covering:
  - hosted runtime accepts runtime session token over HTTP admin
  - hosted runtime accepts runtime session token over WebSocket admin
  - hosted runtime rejects `ADMIN_CODE`
  - standalone runtime accepts `ADMIN_CODE`
  - `/admin <code>` only works in standalone
  Files: `runtime/test/integration/*.test.js`. Size: 1 day.
- [x] Add SDK/app-server tests covering:
  - `WORLD_AUTH_TOKEN` HTTP requests
  - `WORLD_AUTH_TOKEN` WebSocket admin auth
  - slug-world deploy/snapshot flow without `X-Admin-Code`
  - standalone app-server path with `ADMIN_CODE`
  Files: `runtime/test/integration/*.test.js`, `runtime/app-server/*`. Size: 1 day.
- [ ] Add structured runtime/admin logs that make the final auth path obvious (`admin_auth_kind`, token auth accepted/rejected, hosted admin-code rejected). Files: `runtime/src/server/admin.js`, `runtime/src/server/index.js`, `runtime/src/core/systems/ServerNetwork.js`. Size: 0.5 day.

Definition of done:

- hosted-vs-standalone admin auth behavior is covered by tests
- token-backed SDK use is covered end to end
- runtime logs make auth-path debugging straightforward

## Suggested Execution Order

1. Freeze the runtime auth contract
2. Make hosted runtime admin auth token-only
3. Teach the SDK/app-server to use runtime session tokens
4. Replace hosted-world SDK setup UX
5. Add tests and operability
