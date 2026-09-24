import { randomBytes } from 'node:crypto'
import { verifyMessage } from 'viem'

// Pairing grants control of one live companion to one live human connection.
// The configured address is only a claim until that wallet signs this challenge.
export class Companions {
  constructor(network, { verify = verifyMessage, now = Date.now } = {}) {
    this.network = network
    this.verify = verify
    this.now = now
    this.agents = new Map()
    this.challenges = new Map()
  }

  list() {
    return [...this.agents.values()].map(({ socket, ...agent }) => ({
      ...agent,
      name: String(socket.player?.data?.name || 'Companion').slice(0, 64),
    }))
  }

  publish() {
    this.network.send('companionState', this.list())
  }

  async request(socket, data) {
    if (this.network.sockets.get(socket.id) !== socket) throw new Error('connection_closed')
    const { action, agentId } = data || {}
    if (action === 'register') {
      if (typeof data.owner !== 'string' || !/^0x[\da-f]{40}$/i.test(data.owner)) throw new Error('invalid_owner')
      if (this.agents.has(socket.id)) throw new Error('already_registered')
      const agent = { id: socket.id, owner: data.owner.toLowerCase(), ownerPlayerId: null, generation: 0, socket }
      this.agents.set(socket.id, agent)
      this.publish()
      return this.list()
    }
    const agent = this.agents.get(agentId)
    if (!agent || this.network.sockets.get(agentId) !== agent.socket) throw new Error('companion_offline')
    if (socket.id === agentId || this.agents.has(socket.id)) throw new Error('human_player_required')
    if (action === 'challenge') {
      const previous = this.challenges.get(socket.id)
      if (previous && previous.expires > this.now() + 115000) throw new Error('try_again_shortly')
      const expires = this.now() + 120000
      const message = `Pair a LOAD companion\nWorld: ${this.network.worldId}\nCompanion: ${agentId}\nOwner player: ${socket.id}\nOwner wallet: ${agent.owner}\nGeneration: ${agent.generation}\nNonce: ${randomBytes(24).toString('hex')}\nExpires: ${new Date(expires).toISOString()}\nAllow this companion to follow your spoken world commands for this connection. This does not authorize transactions or wallet access.`
      this.challenges.set(socket.id, { socket, agent, generation: agent.generation, expires, message })
      return { message, expires, owner: agent.owner }
    }
    if (action === 'authorize') {
      const challenge = this.challenges.get(socket.id)
      this.challenges.delete(socket.id)
      const current = () =>
        challenge &&
        challenge.agent === agent &&
        challenge.socket === socket &&
        challenge.generation === agent.generation &&
        challenge.expires > this.now() &&
        this.network.sockets.get(socket.id) === socket &&
        this.agents.get(agentId) === agent &&
        this.network.sockets.get(agentId) === agent.socket
      if (!current() || typeof data.signature !== 'string' || data.signature.length > 2048)
        throw new Error('challenge_expired')
      if (
        !(await this.verify({ address: agent.owner, message: challenge.message, signature: data.signature })) ||
        !current()
      )
        throw new Error('invalid_signature')
      agent.ownerPlayerId = socket.id
      agent.generation++
      this.publish()
      return this.list()
    }
    if (action === 'revoke') {
      if (agent.ownerPlayerId !== socket.id) throw new Error('owner_required')
      agent.ownerPlayerId = null
      agent.generation++
      this.publish()
      return this.list()
    }
    throw new Error('unknown_companion_action')
  }

  leave(socket) {
    this.challenges.delete(socket.id)
    let changed = this.agents.delete(socket.id)
    for (const agent of this.agents.values()) {
      if (agent.ownerPlayerId === socket.id) {
        agent.ownerPlayerId = null
        agent.generation++
        changed = true
      }
    }
    if (changed) this.publish()
  }
}
