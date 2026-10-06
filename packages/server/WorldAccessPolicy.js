// An operator-owned verifier decides admission. Client metadata is never proof.
export function accessPolicyOptions(env = process.env) {
  if (!env.WORLD_ACCESS_POLICY_URL) return null
  const url = new URL(env.WORLD_ACCESS_POLICY_URL)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    !env.WORLD_ACCESS_POLICY_SECRET ||
    env.WORLD_ACCESS_POLICY_SECRET.length < 32 ||
    !env.ADMISSION_SECRET ||
    env.IDENTITY_REQUIRED !== 'true' ||
    env.IDENTITY_ALLOW_GUESTS === 'true' ||
    !env.WORLD_ID
  )
    throw new Error('access_policy_requires_authenticated_admission')
  return { url: url.href, secret: env.WORLD_ACCESS_POLICY_SECRET, worldId: env.WORLD_ID }
}

export class WorldAccessPolicy {
  constructor({ url, secret, worldId, fetch: request = fetch, now = Date.now, graceMs = 60000 }) {
    Object.assign(this, { url, secret, worldId, request, now, graceMs })
    this.sessions = new WeakMap()
  }

  async decide(identity) {
    if (
      !['evm', 'identity'].includes(identity?.authenticatedWith) ||
      !/^0x[0-9a-f]{40}$/i.test(identity.walletAddress || '') ||
      !Number.isFinite(identity.expiresAt) ||
      identity.expiresAt <= this.now()
    )
      return { allowed: false, reason: 'Wallet verification required' }
    try {
      const response = await this.request(this.url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${this.secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ worldId: this.worldId, walletAddress: identity.walletAddress.toLowerCase() }),
      })
      if (!response.ok) throw new Error('verifier_unavailable')
      const data = await response.json()
      const allowed = data.allowed === true && identity.expiresAt > this.now()
      return { allowed, reason: allowed ? '' : 'Token requirement not met' }
    } catch {
      return { allowed: false, reason: 'Access verification unavailable' }
    }
  }

  async admit(identity) {
    const decision = await this.decide(identity)
    if (!decision.allowed) throw new Error('world_access_denied')
  }

  async check(socket, isCurrent, revoke) {
    let state = this.sessions.get(socket)
    if (!state) {
      state = { pending: false, deniedAt: null }
      this.sessions.set(socket, state)
    }
    if (state.pending) return
    state.pending = true
    const identity = socket.identity
    try {
      const decision = await this.decide(identity)
      if (!isCurrent() || socket.identity !== identity) return
      if (decision.allowed) {
        if (state.deniedAt !== null) socket.send('worldAccess', { allowed: true, removeAt: null })
        state.deniedAt = null
      } else {
        state.deniedAt ??= this.now()
        const removeAt = state.deniedAt + this.graceMs
        socket.send('worldAccess', { allowed: false, removeAt, reason: decision.reason })
        if (this.now() >= removeAt) {
          socket.send('kick', 'world_access_denied')
          revoke()
        }
      }
    } finally {
      state.pending = false
    }
  }
}
