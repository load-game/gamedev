import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto'

export function authorizedAdmission(request, secret) {
  const value = Buffer.from(request.headers.authorization || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return !!secret && value.length === expected.length && timingSafeEqual(value, expected)
}

export class Admission {
  constructor({ capacity, graceMs = 60_000, ticketMs = 30_000, now = Date.now, requireIdentity = false } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('admission_invalid_capacity')
    Object.assign(this, { capacity, graceMs, ticketMs, now, requireIdentity })
    this.generation = randomUUID()
    this.seats = new Map()
    this.draining = false
  }

  expire() {
    for (const [id, seat] of this.seats) {
      if (seat.state !== 'connected' && seat.until <= this.now()) this.seats.delete(id)
    }
  }

  reserve(sessionId, identity) {
    if (
      this.requireIdentity &&
      (!identity ||
        identity.userId !== sessionId ||
        typeof identity.issuer !== 'string' ||
        !identity.issuer.startsWith('https://') ||
        typeof identity.name !== 'string' ||
        identity.name.length > 128 ||
        identity.authenticatedWith !== 'evm' ||
        !/^0x[0-9a-f]{40}$/i.test(identity.walletAddress || '') ||
        !Number.isFinite(identity.expiresAt) ||
        identity.expiresAt <= this.now())
    )
      throw new Error('admission_identity_required')
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(sessionId || '')) throw new Error('admission_invalid_session')
    this.expire()
    let seat = this.seats.get(sessionId)
    if (seat?.state === 'connected' || seat?.state === 'connecting') throw new Error('admission_already_connected')
    if (!seat) {
      if (this.draining) throw new Error('admission_draining')
      if (this.seats.size >= this.capacity) throw new Error('admission_full')
      seat = { sessionId, state: 'pending', until: this.now() + this.ticketMs }
      this.seats.set(sessionId, seat)
    }
    seat.identity = identity ? { ...identity } : null
    // Retries return the same ticket and do not prolong abandoned reservations.
    if (!seat.ticket) seat.ticket = randomBytes(32).toString('base64url')
    return { ticket: seat.ticket, sessionId, generation: this.generation, expiresAt: seat.until }
  }

  consume(ticket) {
    this.expire()
    const seat = [...this.seats.values()].find(s => s.ticket === ticket && typeof ticket === 'string')
    if (
      !seat ||
      (this.requireIdentity && (!seat.identity || seat.identity.expiresAt <= this.now())) ||
      !['pending', 'grace'].includes(seat.state)
    )
      throw new Error('admission_invalid_ticket')
    seat.previousState = seat.state
    seat.previousUntil = seat.until
    seat.until = Math.min(seat.until, this.now() + 15000)
    seat.state = 'connecting'
    seat.ticket = null
    return seat.sessionId
  }

  connected(sessionId) {
    this.expire()
    const seat = this.seats.get(sessionId)
    if (!seat || seat.state !== 'connecting') throw new Error('admission_invalid_transition')
    seat.state = 'connected'
    seat.until = null
  }

  failed(sessionId) {
    const seat = this.seats.get(sessionId)
    if (!seat || seat.state !== 'connecting') return
    if (seat.previousState === 'grace') {
      seat.state = 'grace'
      seat.until = seat.previousUntil
    } else this.seats.delete(sessionId)
  }

  disconnected(sessionId) {
    const seat = this.seats.get(sessionId)
    if (!seat) return
    seat.state = 'grace'
    seat.ticket = null
    seat.until = this.now() + this.graceMs
  }

  status() {
    this.expire()
    const count = state => [...this.seats.values()].filter(s => s.state === state).length
    return {
      generation: this.generation,
      draining: this.draining,
      capacity: this.capacity,
      used: this.seats.size,
      connected: count('connected'),
      pending: count('pending') + count('connecting'),
      grace: count('grace'),
    }
  }
}
