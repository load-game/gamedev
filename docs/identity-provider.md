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
Identity flow; successful sign-in closes the guest connection and reloads into
the account session before any wallet action can continue.

Client world scripts can call `world.account()` to read their current verified
account. It returns null for guests and worlds without authenticated admission. The
account contains `userId`, `issuer`, `name`, `walletAddress`,
`authenticatedWith: 'evm'`, and `expiresAt`. It is sent only in that client's
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
world connection, invalidates the gateway session and reloads to guest entry.
If logout fails, the client retries it before joining on the next page load.
Signing out through the engine ends the gateway session. Social login and contract-wallet authentication are future provider
work, not enabled by this change. Standalone worlds retain their existing
behavior unless this mode is configured.
