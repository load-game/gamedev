# World companions

The client and server advertise companion protocol 1 in the initial snapshot.
Companions are ordinary live players. `AgentControl` supplies walk, follow, face,
stop, observation, camera access through the client, and nearby action controls.
Movement feeds `PlayerLocal` input so physics, animation and replication apply.
A bounded local A* search samples collision clearance, ground and slopes. It
stops on blocked paths, lost targets, timeout, or owner revocation. It does not
provide teleportation, global navigation, or autonomous transaction signing.

The headless bridge uses `?audio=external` to consume the server's voice token
without also connecting the renderer to LiveKit under the same identity. That
flag does not change voice permissions or moderation.

## Pairing

`companionRequest` carries `requestId`, `action`, and action parameters.
`companionResult` returns `value` or `error`; `companionState` broadcasts bindings.
A client registers itself with an owner address. The claim grants no authority.
A human client requests a challenge for `agentId`, signs its message with the
configured EVM wallet, and authorizes with the signature. The challenge binds the
world, agent connection, human connection, generation, nonce and two-minute
expiry. Verification supports EOA message signatures. Contract wallets need a
separate on-chain verification integration.

The owner may revoke. Either connection leaving invalidates the binding. Every
successful authorization or revocation advances its generation. Async signature
verification rechecks the connections and generation before committing. Agents
must check the current owner player ID and generation before each action, and
must keep guest audio outside any model context capable of actions. This engine
binding authenticates a player connection, not the person speaking into its mic.

## World scripting

Client scripts use `world.companions().list()` and `.request(action, params)` for
pairing UI. Listen for `world.on('companions', ...)` to refresh it.
`world.agentLandmark({id,label,position,description,approach})` registers a named
scene location for perception. IDs are scoped to the app entity. Use
`world.clearAgentLandmarks()` when rebuilding a scene; destruction clears them.
Descriptions are untrusted content. Observation limits them to visible locations
within 30 meters. Register useful visible points and reachable approach points,
not hidden ownership or financial information.

`world.on('agentControl', ...)` lets world UI close welcome panels for a rendered
agent. The ordinary native UI remains available to human players.
