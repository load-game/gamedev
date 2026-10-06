# Authenticated wallet worlds

A fixed-game gateway can publish `PUBLIC_IDENTITY_URL` to enable the client's
wallet sign-in overlay. The engine requests a signature through its injected EVM
provider and sends it to that gateway. The gateway owns provider verification
and the HttpOnly product session. No confidential credential enters the engine
client or world script.

Set `IDENTITY_REQUIRED=true` on the game server along with its private
`ADMISSION_SECRET`. Reservations must include a matching user ID, issuer,
name, verified EVM address and expiry. An admission ticket carries those fields
through the server's reservation state. The server uses the verified subject
as its player ID and the verified name instead of a connection-supplied name.
For the browser overlay, also set `IDENTITY_ALLOW_GUESTS=true` on both gateway
and game server. The browser must be able to enter the world before showing
the account panel. Without that setting, the admission API remains restricted
to authenticated reservations. Malformed or expired identity is always rejected.

With guest entry enabled, the engine restores a valid account session or enters
as a guest before showing the account overlay. The world keeps running behind
the panel. Choosing Continue as guest dismisses it and stores that preference
for future visits. The account button can reopen it anytime. Audio still needs
the browser's first user gesture. Any `world.evm().connect()` call uses the same
Identity flow. Successful sign-in replaces the guest connection and local player
using verified admission, then resumes the wallet action. It preserves the
browser document, renderer, asset cache, audio context, and unchanged city apps.
The gateway prefers the current instance. If capacity requires another instance,
the engine replaces its entities while retaining the renderer and asset cache.

Client world scripts can call `world.account()` to read their current verified
account. It returns null for guests and worlds without authenticated admission. The
account contains `userId`, `issuer`, `name`, `walletAddress`,
`authenticatedWith: 'evm' | 'identity'`, and `expiresAt`. It is sent only in that client's
snapshot. This is presentation data on the client; the server remains the
authority for all privileged actions.

`world.walletAuth().get(playerId)` reuses the verified admission wallet for
server scripts. An app can open an existing wallet-owned home without a second
login signature. Challenges in an authenticated world reject a different
wallet address. Guests in Identity worlds cannot use legacy per-app wallet
challenges to bypass login. On-chain balances, ownership and transaction signatures still
need the usual product checks. The transaction adapter cannot fall back to an
unrelated injected wallet when Identity has bound the session to another one.

The current wallet-only client ends its game session when the connected account
changes or disconnects, including while visiting as a guest. It closes the live
world connection, invalidates the gateway session, replaces the account player
with a guest, and reopens the overlay without a page reload. Signing out through
the engine or a world wallet-disconnect action uses the same path. Failed
connections offer Retry connection. Failed logout must succeed before rejoining,
including if the user manually refreshes. A verification response already in
flight finishes before logout, preventing a late response from restoring the
old account cookie. Contract-wallet authentication remains unavailable. Standalone worlds retain their existing
behavior unless this mode is configured.

## Session lifecycle for scripts

`world.on('session-changing', callback)` runs after the old socket is detached.
Clear private menus, cached account data, pending requests, and edit sessions in
that callback. The engine clears its packet queue, wallet cache, player proxies,
voice session, and companion requests. It releases the old local player's
controls, physics body, and scene nodes. Delayed voice and microphone requests
cannot attach to the replacement identity.

`world.on('session-changed', callback)` runs once the new local player is ready.
Its payload contains `playerId` and `account`, with null account for guests.
Use `world.getPlayer()` again rather than retaining the previous player proxy.
The new server admission snapshot remains the identity authority. Changed or
removed entities are reconciled without duplicating players; unchanged apps
keep running and receive current server state and subsequent events.


## Linked identities and hosted sign-in

The account panel lists fresh provider-verified EVM wallets, Solana wallets and
social credentials. Link Solana wallet requests an injected Solana wallet signature
inside the game. The gateway derives the subject from its HttpOnly session and
forwards the proof to Identity's confidential `/v1/wallet-links/challenges` and
`/v1/wallet-links/verify` endpoints. Deploy the Identity endpoints before enabling
this client flow. Wallet linking never grants token approval.

Each configured social provider that is not already linked gets a Link button. Authorization opens in
a popup through a subject-bound handoff. The game polls the authenticated gateway
for completion, so OAuth opener isolation does not interrupt it. Completion
refreshes provider-verified credentials without navigating or reconnecting the
world. The panel offers cancellation and explains blocked popups. The gateway
rejects expired, replayed and signed-out handoffs and never trusts a browser-supplied
subject or linked address.

When the gateway enables hosted sign-in, Sign in with Peezy Identity uses the
provider's OAuth authorization-code flow with PKCE, browser-bound state and a
signed ID-token nonce. A person can sign in with Solana or a supported social
account without an EVM wallet. The game receives the stable Identity subject,
not a wallet-derived player ID. Registration availability remains provider-owned.

`walletAddress` is optional for a hosted identity. EVM-backed actions request a
connected EVM wallet, and the gateway accepts it only when freshly linked to that
same subject. This updates authenticated admission before allowing the action.
A Solana address cannot substitute for an EVM wallet in token ownership or stake
checks. `world.requestSignIn()` opens the account overlay for Identity actions
that need no EVM transaction. No account-link operation is a token approval.

Closing the account panel cancels its pending attempt. Canceling social linking
invalidates the gateway handoff and closes the popup without signing out. Wallet
approval is stopped before submission if the selected wallet or game session
changes. Refresh linked accounts reloads credentials and available providers.
