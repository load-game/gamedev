import { Friends } from './Friends.js'
import { resolveControlInternalUrl } from './runtimeBootstrap.js'

const SUBJECT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Identity owns relationships. Game storage holds only short-lived presence.
export class IdentityFriends extends Friends {
  constructor(options) {
    super(options)
    this.prefix = `engine:identity-friends:${encodeURIComponent(options.worldId)}:${encodeURIComponent(options.scope)}:`
    this.getIdentity = options.getIdentity
    this.auth = {
      get: id => {
        const identity = this.getIdentity(id)
        return identity?.expiresAt > this.now() && SUBJECT.test(identity.userId || '') ? identity.userId : null
      },
    }
  }
  async graph(subject, payload = {}) {
    const url = process.env.FRIENDS_GATEWAY_URL || resolveControlInternalUrl('/internal/friends')
    if (!url || !this.secret) throw new Error('friends_unavailable')
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.secret}`,
      },
      body: JSON.stringify({ subject, ...payload }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'friends_unavailable')
    if (data.subject !== subject || !Array.isArray(data.friends) || data.friends.length > 400)
      throw new Error('friends_unavailable')
    return data.friends
  }
  async status(id, targetId) {
    const owner = this.owner(id)
    const players = this.players(),
      a = players.find(p => p.id === id),
      b = players.find(p => p.id === targetId)
    if (!a || !b || a.position.distanceTo(b.position) > 5) throw new Error('friends_not_nearby')
    const other = this.auth.get(targetId)
    if (!other) throw new Error('friends_player_sign_in')
    if (owner === other) throw new Error('friends_invalid_player')
    const row = (await this.graph(owner)).find(row => row.profile.id === other)
    if (this.owner(id) !== owner || this.auth.get(targetId) !== other) throw new Error('friends_sign_in')
    return row ? { state: row.state, address: other } : { state: 'none' }
  }
  async request(id, targetId) {
    const status = await this.status(id, targetId)
    const owner = this.owner(id),
      other = this.auth.get(targetId)
    if (status.state !== 'none') return
    await this.graph(owner, { action: 'request', target: other })
  }
  async act(id, target, action, handle) {
    const owner = this.owner(id)
    const rows = await this.graph(owner, { target, action, handle })
    if (this.owner(id) !== owner) throw new Error('friends_sign_in')
    return rows
  }
  async accepted(a, b) {
    return (await this.graph(a)).some(row => row.profile.id === b && row.state === 'friend')
  }
  async list(id) {
    const owner = this.owner(id)
    const rows = await Promise.all(
      (await this.graph(owner)).map(async row => {
        let presence = row.state === 'friend' ? await this.storage.getFresh(this.presenceKey(row.profile.id)) : null
        if (!presence || presence.expiresAt <= this.now()) presence = null
        if (presence?.generation === this.generation && this.auth.get(presence.playerId) !== row.profile.id)
          presence = null
        return {
          address: row.profile.id,
          name: row.profile.displayName,
          handle: row.profile.handle,
          state: row.state,
          online: !!presence,
          sameCity: presence?.generation === this.generation,
        }
      })
    )
    if (this.owner(id) !== owner) throw new Error('friends_sign_in')
    return rows.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
  }
  async join(id, subject) {
    const owner = this.owner(id)
    if (!SUBJECT.test(subject || '') || !(await this.accepted(owner, subject))) throw new Error('friends_not_friends')
    // The inherited travel implementation validates a wallet-shaped key. Keep
    // the same signed ticket protocol while validating Identity subjects here.
    const presence = await this.storage.getFresh(this.presenceKey(subject))
    if (!presence || presence.expiresAt <= this.now()) throw new Error('friend_offline')
    if (presence.generation === this.generation) throw new Error('friend_same_city')
    if (this.owner(id) !== owner) throw new Error('friends_sign_in')
    const { signFriendJoin } = await import('./Friends.js')
    return signFriendJoin(
      {
        v: 1,
        worldId: this.worldId,
        appId: this.scope,
        from: owner,
        to: subject,
        sessionId: id,
        generation: presence.generation,
        playerId: presence.playerId,
        expiresAt: this.now() + 30000,
      },
      this.secret
    )
  }
}
