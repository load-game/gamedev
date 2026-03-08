# Solana Port Plan

Status: complete

Last updated: 2026-03-08

## Scope

Port the old Hyperfy Solana gameplay and economy integration into this runtime without adding any new dependencies.

Phase 1 restores the core engine, network, wallet-connect, and deposit/withdraw flows using the dependencies already in this repo.

Phase 2 expands the integration beyond the first working path and adds higher-level wallet and UX features.

## Constraints

- Use only the Solana packages already present in this repo: `@solana/kit`, `@solana-program/system`, `@solana-program/token`, `@solana-program/memo`, and the existing `@privy-io/react-auth` package surface.
- Do not add or reintroduce `@solana/web3.js`, wallet-adapter packages, `@solana/spl-token`, `tweetnacl`, or `bs58`.
- Keep Solana wallet connectivity separate from runtime auth/session state in `src/client/index.js` and `src/client/components/useWalletAuth.js`.
- Do not spend time on feature flags, staged rollout, or production gating in this plan.

## Decisions Locked For This Plan

- Canonical runtime system key: `world.solana`.
- Canonical player field: `player.data.solanaWallet`.
- Canonical script/event naming: `solanaWallet` rather than generic `wallet`.
- Phase 1 wallet source: Privy-backed Solana standard wallets only.
- Server-side signature verification should use `@solana/kit` re-exports instead of legacy `tweetnacl`/`bs58`.
- Client transaction/message building should use `@solana/kit` plus `@solana-program/*`.
- Follow the existing bind-style client chain pattern used by `src/core/systems/EVMClient.js` and `src/core/systems/HyperliquidClient.js`.

## Phase 1

Goal: restore a working Solana engine path for connect, disconnect, wallet state sync, and token deposit/withdraw using existing Privy-backed Solana wallets.

### Slice 1. Restore Solana world systems and packet plumbing

Files:

- `src/core/systems/ClientSolana.js`
- `src/core/systems/ServerSolana.js`
- `src/core/createClientWorld.js`
- `src/core/createServerWorld.js`
- `src/core/packets.js`
- `src/core/systems/ClientNetwork.js`
- `src/core/systems/ServerNetwork.js`

Checklist:

- [x] Add `src/core/systems/ClientSolana.js` as the client entry point for Solana wallet state, message signing, and transaction signing.
- [x] Add `src/core/systems/ServerSolana.js` as the server entry point for challenge issuance, wallet verification, and token transfer orchestration.
- [x] Register `world.solana` in `src/core/createClientWorld.js`.
- [x] Register `world.solana` in `src/core/createServerWorld.js`.
- [x] Extend `src/core/packets.js` with the Solana packet names required for phase 1.
- [x] Wire packet handlers into `src/core/systems/ClientNetwork.js`.
- [x] Wire packet handlers into `src/core/systems/ServerNetwork.js`.
- [x] Keep packet names explicit enough to support a nonce challenge flow instead of reusing the older static-signature-only behavior.

Done when:

- [x] `world.solana` exists on both client and server worlds.
- [x] No Solana packet produces an unknown-packet error on either side.

### Slice 2. Add the Solana player data model and script surface

Files:

- `src/core/systems/ServerNetwork.js`
- `src/core/extras/createPlayerProxy.js`
- `src/core/entities/PlayerLocal.js`
- `src/core/entities/PlayerRemote.js`

Checklist:

- [x] Add `solanaWallet` to the player data sent from the server in snapshots and incremental entity updates.
- [x] Ensure local and remote player entities can carry `solanaWallet` with no side effects.
- [x] Add `player.solanaWallet` to `src/core/extras/createPlayerProxy.js`.
- [x] Add `player.connectSolana()` to `src/core/extras/createPlayerProxy.js`.
- [x] Add `player.disconnectSolana()` to `src/core/extras/createPlayerProxy.js`.
- [x] Add `player.depositTokens(amount)` to `src/core/extras/createPlayerProxy.js`.
- [x] Add `player.withdrawTokens(amount)` to `src/core/extras/createPlayerProxy.js`.
- [x] Emit a world-level `solanaWallet` change event so scripts can react to wallet changes without polling.
- [x] Do not overload the generic runtime auth state or current EVM wallet state with Solana player-wallet data.

Done when:

- [x] A script can read `player.solanaWallet`.
- [x] A script can invoke connect, disconnect, deposit, and withdraw methods against `world.solana`.

### Slice 3. Add a Privy-backed Solana wallet bridge on the client

Files:

- `src/client/world-client.js`
- `src/client/index.js`
- `src/client/components/UserMenu.js`

Checklist:

- [x] Add a client bridge component in `src/client/world-client.js` so the bridge can bind directly to the `world` instance created there.
- [x] Read the active Solana wallet through the existing Privy Solana hooks rather than introducing wallet-adapter code.
- [x] Normalize the selected Solana wallet into a `bind(...)` shape for `world.solana`, similar to `world.evm.bind(...)` and `world.hyperliquid.bind(...)`.
- [x] Support at least: `address`, `connected`, `signMessage`, and `signTransaction` in the bound wallet interface.
- [x] Leave runtime auth and the existing `__runtimeAuth` flow unchanged.
- [x] Keep Solana wallet connect/disconnect UI separate from the existing runtime auth buttons in `src/client/components/UserMenu.js`.

Done when:

- [x] The client can detect an active Privy Solana wallet and bind it to `world.solana`.
- [x] Disconnecting the Solana wallet clears only Solana state, not the runtime auth session.

### Slice 4. Replace the old connect flow with a nonce challenge

Files:

- `src/core/systems/ClientSolana.js`
- `src/core/systems/ServerSolana.js`
- `src/core/systems/ClientNetwork.js`
- `src/core/systems/ServerNetwork.js`

Checklist:

- [x] Define a server-issued connect challenge with a nonce, issue time, and expiry.
- [x] Add a client request path that asks the server for a challenge before wallet binding is accepted.
- [x] Sign the challenge bytes on the client with the bound Solana wallet.
- [x] Verify the signed challenge on the server using `@solana/kit` re-exports for address/public-key/signature handling.
- [x] Reject replayed, expired, malformed, or mismatched signatures.
- [x] Persist the verified address to `player.data.solanaWallet`.
- [x] Broadcast the updated `solanaWallet` field to other clients.
- [x] Implement disconnect so it clears `player.data.solanaWallet` and emits the same update/event flow as connect.

Done when:

- [x] The server never accepts a static cached signature as proof of wallet ownership.
- [x] Connect and disconnect update both script-visible state and remote clients.

### Slice 5. Rebuild deposit and withdraw with `@solana/kit` and `@solana-program/*`

Files:

- `src/core/systems/ClientSolana.js`
- `src/core/systems/ServerSolana.js`
- `.env.example`

Checklist:

- [x] Add or restore Solana server envs in `.env.example`: `RPC_URL`, `WORLD_PUBLIC_KEY`, `WORLD_PRIVATE_KEY`, and `WORLD_TOKEN_MINT_ADDRESS`.
- [x] Build a Solana RPC client in `src/core/systems/ServerSolana.js` using `@solana/kit`.
- [x] Use `@solana-program/token` helpers to derive token accounts and create token instructions.
- [x] Implement deposit transaction construction on the server.
- [x] Implement withdraw transaction construction on the server.
- [x] Send unsigned transaction bytes to the client for signing.
- [x] Sign transactions on the client through the bound Solana wallet interface.
- [x] Return signed transaction bytes to the server and complete submission/confirmation there.
- [x] Verify that the signed transaction still matches the expected player, mint, source/destination accounts, and amount before final submission.
- [x] Remove the legacy `Transaction.from(...)` and `serialize(...)` assumptions from the old `web3.js` version.
- [x] Replace the old withdraw-path bug pattern entirely instead of porting it forward.

Done when:

- [x] The server can request a deposit signature from the client and confirm the submitted transaction.
- [x] The server can request a withdraw signature from the client, add the world signer where required, and confirm the submitted transaction.

### Slice 6. Add a minimal Solana UI path for manual testing and developer use

Files:

- `src/client/components/UserMenu.js`
- `src/client/components/Sidebar.js`
- `src/client/components/editor/EditorLayout.js`

Checklist:

- [x] Add a Solana-specific account section in `src/client/components/UserMenu.js`.
- [x] Show current Solana wallet address and connection state there.
- [x] Add connect and disconnect controls there that talk to `world.solana`.
- [x] Keep the existing runtime auth controls in `src/client/components/Sidebar.js` and `src/client/components/editor/EditorLayout.js` dedicated to runtime auth.
- [x] Do not merge Solana connect into the current `walletAuth` state object.

Done when:

- [x] A developer can manually connect and disconnect a Solana wallet without touching runtime auth state.

### Slice 7. Add tests and docs for the phase 1 port

Files:

- `test/integration/`
- `docs/scripting/README.md`
- `docs/scripting/Networking.md`
- `docs/world-entities.md`

Checklist:

- [x] Add an integration test for packet plumbing and client/server wallet connect flow.
- [x] Add an integration test for invalid challenge replay or expired challenge rejection.
- [x] Add an integration test for deposit request/response validation with mocked or stubbed RPC edges.
- [x] Add an integration test for withdraw request/response validation with mocked or stubbed RPC edges.
- [x] Document `player.solanaWallet`, `player.connectSolana()`, `player.disconnectSolana()`, `player.depositTokens()`, and `player.withdrawTokens()`.
- [x] Document required Solana envs and the fact that phase 1 depends on Privy-backed Solana wallets.

Done when:

- [x] The phase 1 path is documented in the current docs tree.
- [x] The key failure cases have automated coverage.

## Phase 2

Goal: expand Solana support beyond the first working Privy path and bring the Solana client surface closer to the maturity of the existing EVM and Hyperliquid integrations.

### Slice 1. Add non-Privy injected Solana wallet support

Files:

- `src/client/world-client.js`
- `src/client/index.js`
- `src/core/systems/ClientSolana.js`

Checklist:

- [x] Add an injected-wallet discovery path for worlds that do not use Privy.
- [x] Support the common provider shape exposed through `window.solana` and compatible injected providers.
- [x] Normalize injected providers into the same `world.solana.bind(...)` interface used by the Privy path.
- [x] Preserve the phase 1 client API so server code and scripts do not care where the signer came from.

Done when:

- [x] A Solana wallet can be connected in a non-Privy world without adding any new dependency.

### Slice 2. Add first-class client Solana utilities

Files:

- `src/core/systems/ClientSolana.js`
- `src/client/components/UserMenu.js`

Checklist:

- [x] Add `getAddress()` and `isConnected()` helpers to `world.solana`.
- [x] Add native SOL balance lookup.
- [x] Add SPL token balance lookup for the configured world token mint.
- [x] Add a small amount/decimal normalization layer similar in spirit to `src/core/systems/EVMClient.js`.
- [x] Surface these values in the Solana account UI.

Done when:

- [x] `world.solana` can answer basic address and balance queries from scripts and UI.

### Slice 3. Add a richer Solana transfer UX

Files:

- `src/client/components/UserMenu.js`
- `src/client/components/CoreUI.js`
- `src/core/systems/ClientSolana.js`

Checklist:

- [x] Add a deposit form in the client UI for the configured world token.
- [x] Add a withdraw form in the client UI for the configured world token.
- [x] Show pending, signed, confirmed, and failed states in the UI.
- [x] Link submitted signatures to an explorer URL derived from the configured cluster.
- [x] Keep the richer transfer UX layered on top of the existing phase 1 API instead of bypassing it.

Done when:

- [x] A user can initiate deposit and withdraw flows from the UI without custom scripting.

### Slice 4. Add optional swap and token conversion UX

Files:

- `src/client/components/`
- `src/core/systems/ClientSolana.js`

Checklist:

- [x] Re-evaluate whether the older swap modal concept still belongs in this runtime.
- [x] Do not port the older swap modal in this runtime; keep phase 2 focused on wallet connect plus world-token deposit/withdraw.
- [x] Keep swap code isolated from runtime auth and from the core Solana connect path.
- [x] Treat swap as additive UX, not a dependency for wallet connect or world-token transfer.

Decision:

Swap support is intentionally dropped for this port. The restored runtime path now covers wallet connect, wallet sync, and world-token deposit/withdraw without reintroducing a larger conversion UI surface.

Done when:

- [x] Swap support is either intentionally dropped or ported onto the new Solana foundation.

### Slice 5. Expand docs and test coverage to cover the full Solana surface

Files:

- `test/integration/`
- `docs/scripting/README.md`
- `docs/world-entities.md`
- `docs/commands.md`

Checklist:

- [x] Add integration coverage for the non-Privy injected wallet path.
- [x] Add integration coverage for balance queries and client utility methods.
- [x] Add end-to-end transfer tests around the richer UI flow where practical.
- [x] Add final docs for the stable Solana scripting API and any user-facing commands or menus introduced in phase 2.

Done when:

- [x] The expanded Solana surface is documented and covered beyond the initial connect/deposit/withdraw path.

## Explicitly Out Of Scope

- Feature flags
- Staged rollout
- Production migration sequencing
- Replacing the existing runtime auth/session model with Solana auth
