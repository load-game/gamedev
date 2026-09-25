# Authenticated wallet worlds

A fixed-game gateway can publish `PUBLIC_IDENTITY_URL` to enable the client's
wallet login gate. The engine requests a signature through its injected EVM
provider and sends it to that gateway. The gateway owns provider verification
and the HttpOnly product session. No confidential credential enters the engine
client or world script.

Set `IDENTITY_REQUIRED=true` on the game server along with its private
`ADMISSION_SECRET`. Reservations must include a matching user ID, issuer,
name, verified EVM address and expiry. An admission ticket carries those fields
through the server's reservation state. The server uses the verified subject
as its player ID and the verified name instead of a connection-supplied name.
Missing or expired identity cannot become a guest connection in this mode.

Client world scripts can call `world.account()` to read their current verified
account. It returns null in worlds without authenticated admission. The
account contains `userId`, `issuer`, `name`, `walletAddress`,
`authenticatedWith: 'evm'`, and `expiresAt`. It is sent only in that client's
snapshot. This is presentation data on the client; the server remains the
authority for all privileged actions.

`world.walletAuth().get(playerId)` reuses the verified admission wallet for
server scripts. An app can open an existing wallet-owned home without a second
login signature. Challenges in an authenticated world reject a different
wallet address. On-chain balances, ownership and transaction signatures still
need the usual product checks. The transaction adapter cannot fall back to an
unrelated injected wallet when Identity has bound the session to another one.

The current wallet-only client ends its game session when the connected account
changes or disconnects. Signing out through the engine ends the gateway
session. Social login and contract-wallet authentication are future provider
work, not enabled by this change. Standalone worlds retain their existing
behavior unless this mode is configured.
