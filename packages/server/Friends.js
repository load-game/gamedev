import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const ADDRESS = /^0x[\da-f]{40}$/
const TTL = 30000
export const FRIENDS_PREFIX = 'engine:friends:'

export function signFriendJoin(value, secret) {
  if (!secret) throw new Error('friends_join_unavailable')
  const body = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
export function readFriendJoin(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 2048) throw new Error('friend_join_expired')
  const [body, signature, extra] = token.split('.')
  const expected = createHmac('sha256', secret)
    .update(body || '')
    .digest('base64url')
  if (
    extra ||
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new Error('friend_join_expired')
  const value = JSON.parse(Buffer.from(body, 'base64url').toString())
  if (value.v !== 1 || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + TTL)
    throw new Error('friend_join_expired')
  return value
}

// One document per wallet. Both sides of a relationship change in one CAS transaction.
export class Friends {
  constructor({ storage, auth, players, scope, worldId, generation = randomUUID(), secret, now = Date.now }) {
    Object.assign(this, { storage, auth, players, scope, worldId, generation, secret, now })
    this.prefix = `${FRIENDS_PREFIX}${encodeURIComponent(worldId)}:${encodeURIComponent(scope)}:`
    this.sessions = new Map()
    this.stopped = false
    this.tail = Promise.resolve()
  }
  serial(fn) {
    const job = this.tail.then(fn)
    this.tail = job.catch(() => {})
    return job
  }
  owner(id) {
    const address = this.auth.get(id)
    if (!address || !this.players().some(p => p.id === id)) throw new Error('friends_sign_in')
    return address
  }
  key(address) {
    return `${this.prefix}user:${address}`
  }
  presenceKey(address) {
    return `${this.prefix}presence:${address}`
  }
  async user(address) {
    const entry = await this.storage.getFreshEntry(this.key(address))
    return { entry, value: entry.value || { links: {}, requests: [] } }
  }
  async change(id, other, fn) {
    const owner = this.owner(id)
    if (typeof other !== 'string' || !ADDRESS.test(other) || other === owner) throw new Error('friends_invalid_player')
    for (let attempt = 0; attempt < 5; attempt++) {
      const [a, b] = await Promise.all([this.user(owner), this.user(other)])
      if (this.owner(id) !== owner) throw new Error('friends_sign_in')
      fn(a.value, b.value, owner)
      const result = await this.storage.commit(
        [a, b].map(({ entry, value }) => ({ key: entry.key, value, expectedUpdatedAt: entry.updatedAt }))
      )
      if (result.ok) return true
    }
    throw new Error('friends_busy')
  }
  async request(id, targetId) {
    const players = this.players(),
      a = players.find(p => p.id === id),
      b = players.find(p => p.id === targetId)
    const nearby = () => a && b && this.players().some(p => p.id === targetId) && a.position.distanceTo(b.position) <= 5
    if (!nearby()) throw new Error('friends_not_nearby')
    const other = this.auth.get(targetId)
    if (!other) throw new Error('friends_player_sign_in')
    return this.change(id, other, (mine, theirs) => {
      if (!nearby() || this.owner(targetId) !== other) throw new Error('friends_not_nearby')
      const owner = this.owner(id),
        link = mine.links[other]
      if (link?.state === 'blocked' || theirs.links[owner]?.state === 'blocked')
        throw new Error('friends_request_unavailable')
      if (link) return // Repeated and crossed requests are harmless; acceptance stays explicit.
      mine.requests = (mine.requests || []).filter(t => t > this.now() - 60000)
      if (mine.requests.length >= 10) throw new Error('friends_rate_limit')
      if (Object.keys(mine.links).length >= 200 || Object.keys(theirs.links).length >= 200)
        throw new Error('friends_limit')
      mine.requests.push(this.now())
      mine.links[other] = { state: 'outgoing', name: String(b.name || 'Player').slice(0, 48) }
      theirs.links[owner] = { state: 'incoming', name: String(a.name || 'Player').slice(0, 48) }
    })
  }
  act(id, address, action) {
    return this.change(id, address, (mine, theirs, owner) => {
      const a = mine.links[address],
        b = theirs.links[owner]
      if (action === 'accept') {
        if (a?.state !== 'incoming' || b?.state !== 'outgoing') throw new Error('friends_request_missing')
        a.state = b.state = 'friend'
      } else if (action === 'block') {
        if (!a) throw new Error('friends_request_missing')
        mine.links[address] = { state: 'blocked', name: a.name }
        if (b?.state !== 'blocked') delete theirs.links[owner]
      } else if (action === 'unblock') {
        if (a?.state === 'blocked') delete mine.links[address]
      } else if (['decline', 'cancel', 'remove'].includes(action)) {
        const state = { decline: 'incoming', cancel: 'outgoing', remove: 'friend' }[action]
        if (a?.state !== state) throw new Error('friends_request_missing')
        delete mine.links[address]
        if (b?.state !== 'blocked') delete theirs.links[owner]
      } else throw new Error('friends_invalid_action')
    })
  }
  async accepted(a, b) {
    const [one, two] = await Promise.all([this.user(a), this.user(b)])
    return one.value.links[b]?.state === 'friend' && two.value.links[a]?.state === 'friend'
  }
  async list(id) {
    const owner = this.owner(id),
      { value } = await this.user(owner)
    const rows = await Promise.all(
      Object.entries(value.links).map(async ([address, link]) => {
        let presence = null
        if (link.state === 'friend' && (await this.accepted(owner, address))) {
          presence = await this.storage.getFresh(this.presenceKey(address))
          if (!presence || presence.expiresAt <= this.now()) presence = null
          if (presence?.generation === this.generation && this.auth.get(presence.playerId) !== address) presence = null
        }
        return {
          address,
          name: presence?.name || link.name,
          state: link.state,
          online: !!presence,
          sameCity: presence?.generation === this.generation,
        }
      })
    )
    if (this.owner(id) !== owner) throw new Error('friends_sign_in')
    return rows.sort(
      (a, b) =>
        Number(b.online) - Number(a.online) || a.name.localeCompare(b.name) || a.address.localeCompare(b.address)
    )
  }
  sync() {
    return this.serial(() => this.syncNow())
  }
  async syncNow() {
    const live = new Map(this.stopped ? [] : this.players().map(p => [p.id, p]))
    for (const [id, session] of this.sessions) {
      if (live.has(id) && this.auth.get(id) === session.address) continue
      const entry = await this.storage.getFreshEntry(this.presenceKey(session.address))
      if (entry.value?.session === session.key)
        await this.storage.commit([{ key: entry.key, value: null, expectedUpdatedAt: entry.updatedAt }])
      this.sessions.delete(id)
    }
    for (const [id, player] of live) {
      const address = this.auth.get(id)
      if (!address) continue
      if (!this.sessions.has(id)) this.sessions.set(id, { address, key: randomUUID(), since: this.now() })
      const session = this.sessions.get(id)
      const entry = await this.storage.getFreshEntry(this.presenceKey(address))
      // Most recently verified session wins, rather than alternating every heartbeat.
      if (
        entry.value?.session !== session.key &&
        entry.value?.since >= session.since &&
        entry.value?.expiresAt > this.now()
      )
        continue
      if (this.auth.get(id) !== address || this.stopped) continue
      await this.storage.commit([
        {
          key: entry.key,
          expectedUpdatedAt: entry.updatedAt,
          value: {
            session: session.key,
            since: session.since,
            playerId: id,
            generation: this.generation,
            name: String(player.name || 'Player').slice(0, 48),
            expiresAt: this.now() + TTL,
          },
        },
      ])
    }
  }
  async join(id, address) {
    const owner = this.owner(id)
    if (!ADDRESS.test(address || '') || !(await this.accepted(owner, address))) throw new Error('friends_not_friends')
    const presence = await this.storage.getFresh(this.presenceKey(address))
    if (!presence || presence.expiresAt <= this.now()) throw new Error('friend_offline')
    if (presence.generation === this.generation) throw new Error('friend_same_city')
    if (this.owner(id) !== owner) throw new Error('friends_sign_in')
    return signFriendJoin(
      {
        v: 1,
        worldId: this.worldId,
        appId: this.scope,
        from: owner,
        to: address,
        sessionId: id,
        generation: presence.generation,
        playerId: presence.playerId,
        expiresAt: this.now() + TTL,
      },
      this.secret
    )
  }
  async authorizeJoin(token, sessionId) {
    const value = readFriendJoin(token, this.secret, this.now())
    if (
      value.worldId !== this.worldId ||
      value.appId !== this.scope ||
      value.generation !== this.generation ||
      value.sessionId !== sessionId
    )
      throw new Error('friend_join_expired')
    if (!(await this.accepted(value.from, value.to))) throw new Error('friends_not_friends')
    if (this.auth.get(value.playerId) !== value.to || !this.players().some(p => p.id === value.playerId))
      throw new Error('friend_offline')
  }
  dispose() {
    this.stopped = true
    return this.sync()
  }
}
