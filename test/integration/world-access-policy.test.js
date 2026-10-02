import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { WorldAccessPolicy, accessPolicyOptions } from '../../packages/server/WorldAccessPolicy.js'
import { ServerNetwork } from '@gamedev/server/ServerNetwork.js'
import { Admission } from '../../packages/server/Admission.js'

const identity = { authenticatedWith: 'evm', walletAddress: '0x' + 'a'.repeat(40), expiresAt: 1000000 }
function fixture() {
  let now = 1000,
    allowed = true,
    unavailable = false
  const messages = [],
    requests = []
  const p = new WorldAccessPolicy({
    url: 'http://127.0.0.1:5331/internal/access/room1',
    secret: 's'.repeat(32),
    worldId: 'room1',
    now: () => now,
    fetch: async (url, opts) => {
      requests.push({ url, ...opts })
      if (unavailable) throw new Error('offline')
      return { ok: true, json: async () => ({ allowed }) }
    },
  })
  const socket = { identity, send: (...args) => messages.push(args) }
  let revoked = 0,
    current = true
  return {
    p,
    socket,
    messages,
    requests,
    now: n => (now = n),
    allow: v => (allowed = v),
    outage: v => (unavailable = v),
    stale: () => (current = false),
    check: () =>
      p.check(
        socket,
        () => current,
        () => revoked++
      ),
    revoked: () => revoked,
  }
}

test('access policy cannot start with guests, untrusted transport or missing admission configuration', () => {
  assert.equal(accessPolicyOptions({}), null)
  const env = {
    WORLD_ACCESS_POLICY_URL: 'http://127.0.0.1:5331/check',
    WORLD_ACCESS_POLICY_SECRET: 's'.repeat(32),
    ADMISSION_SECRET: 'a',
    IDENTITY_REQUIRED: 'true',
    WORLD_ID: 'room1',
  }
  assert.equal(accessPolicyOptions(env).worldId, 'room1')
  for (const change of [
    { IDENTITY_ALLOW_GUESTS: 'true' },
    { IDENTITY_REQUIRED: 'false' },
    { ADMISSION_SECRET: '' },
    { WORLD_ID: '' },
    { WORLD_ACCESS_POLICY_URL: 'http://example.com/check' },
  ])
    assert.throws(() => accessPolicyOptions({ ...env, ...change }))
})

test('admission requires fresh verified wallet identity and an explicit allow from the fixed verifier', async () => {
  const f = fixture()
  await f.p.admit(identity)
  assert.equal(JSON.parse(f.requests[0].body).walletAddress, identity.walletAddress)
  assert.equal(JSON.parse(f.requests[0].body).worldId, 'room1')
  assert.equal(f.requests[0].redirect, 'error')
  await assert.rejects(f.p.admit(null), /denied/)
  await assert.rejects(f.p.admit({ ...identity, expiresAt: NaN }), /denied/)
  f.allow('true')
  await assert.rejects(f.p.admit(identity), /denied/)
  f.outage(true)
  await assert.rejects(f.p.admit(identity), /denied/)
})

test('falling below the gate warns immediately and removes after sixty seconds', async () => {
  const f = fixture()
  await f.check()
  assert.equal(f.messages.length, 0)
  f.allow(false)
  await f.check()
  assert.deepEqual(f.messages[0], [
    'worldAccess',
    { allowed: false, removeAt: 61000, reason: 'Token requirement not met' },
  ])
  f.now(60999)
  await f.check()
  assert.equal(f.revoked(), 0)
  f.now(61000)
  await f.check()
  assert.equal(f.revoked(), 1)
  assert.deepEqual(f.messages.at(-1), ['kick', 'world_access_denied'])
})

test('recovery cancels removal and outages cannot prolong the original grace deadline', async () => {
  const f = fixture()
  f.allow(false)
  await f.check()
  f.now(60000)
  f.allow(true)
  await f.check()
  assert.deepEqual(f.messages.at(-1), ['worldAccess', { allowed: true, removeAt: null }])
  f.now(61000)
  f.allow(false)
  await f.check()
  f.now(70000)
  f.outage(true)
  await f.check()
  assert.equal(f.messages.at(-1)[1].removeAt, 121000)
  f.now(121000)
  await f.check()
  assert.equal(f.revoked(), 1)
})

test('late decisions cannot affect a replacement socket or switched identity', async () => {
  let resolve
  const p = new WorldAccessPolicy({ worldId: 'room', now: () => 1000, fetch: () => new Promise(r => (resolve = r)) })
  const sent = [],
    socket = { identity, send: (...args) => sent.push(args) }
  let revoked = false
  const pending = p.check(
    socket,
    () => true,
    () => (revoked = true)
  )
  socket.identity = { ...identity, walletAddress: '0x' + 'b'.repeat(40) }
  resolve({ ok: true, json: async () => ({ allowed: false }) })
  await pending
  assert.equal(sent.length, 0)
  assert.equal(revoked, false)
  const f = fixture()
  f.stale()
  f.allow(false)
  await f.check()
  assert.equal(f.messages.length, 0)
})

test('denied wallet gets no player, DB write, snapshot or voice credentials, and releases its reservation', async () => {
  let touched = 0,
    closed = 0
  const unexpected = () => {
    touched++
    throw new Error('admission leaked')
  }
  const network = new ServerNetwork({
    settings: { playerLimit: 16 },
    livekit: { serialize: unexpected },
    entities: { add: unexpected },
  })
  network.db = unexpected
  network.admission = new Admission({ capacity: 16, requireIdentity: true })
  const sessionId = 'wallet_' + 'a'.repeat(40)
  const proof = {
    ...identity,
    expiresAt: Date.now() + 3600000,
    userId: sessionId,
    issuer: 'https://wallet.test',
    name: 'Wallet',
  }
  const { ticket } = network.admission.reserve(sessionId, proof)
  const f = fixture()
  f.allow(false)
  network.accessPolicy = f.p
  const error = console.error
  console.error = () => {}
  try {
    await network.onConnection({ send: unexpected, close: () => closed++, readyState: 1 }, { admissionTicket: ticket })
    assert.equal(touched, 0)
    assert.equal(closed, 1)
    assert.equal(network.admission.status().used, 0)
    assert.equal(network.pendingAdmissions, 0)
  } finally {
    console.error = error
    network.destroy()
  }
})

test('voice token renewal is denied when eligibility has lapsed', async () => {
  let removed = 0,
    generated = 0
  const network = new ServerNetwork({
    livekit: { removeParticipant: async () => removed++, generateToken: async () => generated++ },
  })
  const f = fixture()
  f.allow(false)
  network.accessPolicy = f.p
  try {
    await network.onLivekitLeave({ id: 'a', identity, player: { data: { id: 'a' } } })
    assert.equal(removed, 1)
    assert.equal(generated, 0)
  } finally {
    network.destroy()
  }
})
