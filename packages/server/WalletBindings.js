import { randomBytes } from 'node:crypto'
import { verifyMessage } from 'viem'

// Authentication is scoped to a script instance and live socket. Display metadata is never proof.
export class WalletBindings {
  constructor(network, { now = Date.now, verify = verifyMessage } = {}) {
    this.network = network
    this.now = now
    this.verify = verify
  }
  forApp(entity) {
    const challenges = new Map(),
      bindings = new Map(),
      generations = new Map()
    const live = id => this.network.sockets.get(id)
    const clear = id => {
      generations.set(id, (generations.get(id) || 0) + 1)
      challenges.delete(id)
      bindings.delete(id)
    }
    const leave = ({ playerId }) => clear(playerId)
    entity.onWorldEvent('leave', leave)
    entity.on('destroy', () => {
      challenges.clear()
      bindings.clear()
      generations.clear()
    })
    return {
      challenge: (playerId, address) => {
        const socket = live(playerId)
        if (!socket || typeof address !== 'string' || !/^0x[\da-f]{40}$/i.test(address))
          throw new Error('invalid_identity')
        if (socket.identity && socket.identity.walletAddress.toLowerCase() !== address.toLowerCase())
          throw new Error('identity_wallet_mismatch')
        clear(playerId)
        const nonce = randomBytes(24).toString('hex'),
          expires = this.now() + 120000
        const message = `Sign in to ${this.network.worldId}\nApp: ${entity.data.id}\nPlayer: ${playerId}\nWallet: ${address.toLowerCase()}\nNonce: ${nonce}\nExpires: ${new Date(expires).toISOString()}\nThis does not authorize any transaction.`
        challenges.set(playerId, {
          address: address.toLowerCase(),
          message,
          expires,
          socket,
          generation: generations.get(playerId),
        })
        return { message, expires }
      },
      verify: async (playerId, signature) => {
        const c = challenges.get(playerId)
        challenges.delete(playerId)
        if (
          !c ||
          c.expires < this.now() ||
          c.socket !== live(playerId) ||
          typeof signature !== 'string' ||
          signature.length > 2048
        )
          throw new Error('challenge_expired')
        const ok = await this.verify({ address: c.address, message: c.message, signature })
        if (!ok || c.expires < this.now() || c.socket !== live(playerId) || c.generation !== generations.get(playerId))
          throw new Error('invalid_signature')
        const binding = { address: c.address, socket: c.socket }
        bindings.set(playerId, binding)
        return binding.address
      },
      get: playerId => {
        const b = bindings.get(playerId)
        const socket = live(playerId)
        if (b && b.socket === socket) return b.address
        const identity = socket?.identity
        return identity?.authenticatedWith === 'evm' && identity.expiresAt > this.now() ? identity.walletAddress : null
      },
      revoke: clear,
    }
  }
}
