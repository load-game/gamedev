# Auth Smoke Checklist

Last updated: 2026-02-26

## Setup

1. Configure runtime with world-service auth:
   - `PUBLIC_AUTH_URL=<world-service-origin>/api/identity`
   - Keep `PUBLIC_PRIVY_APP_ID` unset for non-Privy path.
2. Start runtime client build/dev server.
3. Use a browser with:
   - Ethereum wallet extension (for SIWE).
   - Solana wallet extension (for SIWS).

## Non-Privy Wallet Popover

1. Open runtime as guest.
2. Click wallet/user button.
3. Verify popover options are shown:
   - `Ethereum`
   - `Solana`

## SIWE Regression

1. Choose `Ethereum`.
2. Complete SIWE signature.
3. Verify:
   - Session is created and world connects authenticated.
   - Refresh keeps session.
   - Disconnect logs out and returns to guest.

## SIWS Mainnet

1. Choose `Solana`.
2. Complete SIWS signature.
3. Verify:
   - Session is created and world connects authenticated.
   - Wallet metadata includes `type=solana`, `solana_network=mainnet`.
   - Changing/disconnecting the active Solana wallet invalidates the session.

## Guest Fallback

1. Clear auth session.
2. Load runtime without signing in.
3. Verify:
   - Runtime still connects as guest.
   - No forced auth redirect.

## Scripted Smoke Matrix

Run:

```bash
npm run smoke:matrix
```

Optional env overrides:

- `SMOKE_RUNTIME_API_URL`
- `SMOKE_WORLD_SERVICE_API_URL`
- `SMOKE_LOBBY_SESSION_COOKIE`
- `SMOKE_TIMEOUT_MS`
