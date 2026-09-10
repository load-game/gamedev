import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { validatePlacement, transformPoint, snapScalar } from '../../packages/core/extras/furnishing.js'
import { WalletBindings } from '../../packages/server/WalletBindings.js'
import { privateKeyToAccount } from 'viem/accounts'
const room = { size: [12, 3.6, 12] },
  chair = { size: [1, 1, 1], surfaces: ['floor'], collision: 'solid' }
const t = (position = [0, 0, 0], yaw = 0, surface = 'floor') => ({ position, yaw, surface })
test('room-local transform round trips translated rotated room', () => {
  const frame = { position: [54, 40, -18], yaw: Math.PI / 2 },
    p = [1, 0, 2]
  const world = transformPoint(frame, p)
  assert.deepEqual(world, [56, 40, -19])
  const local = transformPoint(frame, world, true)
  local.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-10))
  assert.equal(snapScalar(1.26, 0.5), 1.5)
})
test('placement rejects nonfinite, invalid surfaces and rotated bounds', () => {
  assert.equal(validatePlacement(room, chair, t()).ok, true)
  for (const p of [
    [NaN, 0, 0],
    [Infinity, 0, 0],
    [0, 1, 0],
    [5.9, 0, 0],
  ])
    assert.equal(validatePlacement(room, chair, t(p)).ok, false)
  assert.equal(validatePlacement(room, chair, t([5.4, 0, 0], Math.PI / 4)).ok, false)
  assert.equal(validatePlacement(room, chair, t([0, 0, 0], 0, 'wall')).ok, false)
})
test('solid furniture collides; rugs may overlap couches', () => {
  const placed = [{ id: 'other', item: chair, transform: t() }]
  assert.equal(validatePlacement(room, chair, t(), placed).reason, 'collision')
  assert.equal(validatePlacement(room, { ...chair, collision: 'overlap' }, t(), placed).ok, true)
  assert.equal(validatePlacement(room, chair, t([2, 0, 0]), placed).ok, true)
})
test('wall mount requires an actual room wall and stays within vertical bounds', () => {
  const art = { size: [1.8, 1.2, 0.08], surfaces: ['wall'], collision: 'solid', orientations: [0, Math.PI / 2] }
  assert.equal(validatePlacement(room, art, t([0, 1, -5.96], 0, 'wall')).ok, true)
  assert.equal(validatePlacement(room, art, t([5.96, 1, 0], Math.PI / 2, 'wall')).ok, true)
  assert.equal(validatePlacement(room, art, t([0, 1, 0], 0, 'wall')).ok, false)
  assert.equal(validatePlacement(room, art, t([0, 3, -5.96], 0, 'wall')).ok, false)
})
function identityFixture(options = {}) {
  const socket = {},
    network = { worldId: 'test-world', sockets: new Map([['p', socket]]) },
    listeners = {}
  const entity = { data: { id: 'app' }, onWorldEvent: (n, f) => (listeners[n] = f), on: (n, f) => (listeners[n] = f) }
  return { auth: new WalletBindings(network, options).forApp(entity), network, listeners }
}
const account = privateKeyToAccount('0x' + '1'.repeat(64))
test('signed challenge binds only its live player and cannot replay', async () => {
  const { auth } = identityFixture(),
    c = auth.challenge('p', account.address),
    signature = await account.signMessage({ message: c.message })
  assert.equal(await auth.verify('p', signature), account.address.toLowerCase())
  assert.equal(auth.get('p'), account.address.toLowerCase())
  await assert.rejects(auth.verify('p', signature), /expired/)
  auth.revoke('p')
  assert.equal(auth.get('p'), null)
})
test('forged owner, expiry, reconnect and disconnect revoke wallet proof', async () => {
  let now = 100
  const { auth, network, listeners } = identityFixture({ now: () => now })
  const other = privateKeyToAccount('0x' + '2'.repeat(64))
  let c = auth.challenge('p', account.address)
  await assert.rejects(auth.verify('p', await other.signMessage({ message: c.message })), /signature/)
  c = auth.challenge('p', account.address)
  now += 120001
  await assert.rejects(auth.verify('p', await account.signMessage({ message: c.message })), /expired/)
  c = auth.challenge('p', account.address)
  network.sockets.set('p', {})
  await assert.rejects(auth.verify('p', await account.signMessage({ message: c.message })), /expired/)
  c = auth.challenge('p', account.address)
  await auth.verify('p', await account.signMessage({ message: c.message }))
  listeners.leave({ playerId: 'p' })
  assert.equal(auth.get('p'), null)
})
test('revocation during asynchronous signature verification cannot restore old authority', async () => {
  let finish
  const waiting = new Promise(r => (finish = r))
  const { auth } = identityFixture({ verify: () => waiting })
  auth.challenge('p', account.address)
  const pending = auth.verify('p', '0x1234')
  auth.revoke('p')
  finish(true)
  await assert.rejects(pending, /signature/)
  assert.equal(auth.get('p'), null)
})

test('engine edit session cancels, bounds history and releases controls after rejection', async () => {
  const { createFurnishingAPI } = await import('../../packages/core/extras/furnishing.js')
  const THREE = await import('../../packages/core/extras/three.js')
  let released = 0,
    authorized = true
  const listeners = new Map()
  const control = new Proxy(
    {
      pointer: { unlock() {} },
      camera: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() },
      release() {
        released++
      },
    },
    {
      get(t, k) {
        return (t[k] ||= {})
      },
    }
  )
  const entity = {
    world: { network: { isClient: true }, controls: { bind: () => control } },
    on: (n, f) => listeners.set(n, f),
    off: n => listeners.delete(n),
  }
  const node = { ctx: { entity }, position: new THREE.Vector3(1, 0, 1), rotation: new THREE.Euler() }
  const api = createFurnishingAPI(entity)
  const options = {
    room,
    frame: () => ({ position: [54, 10, 0], yaw: Math.PI / 2 }),
    node,
    item: chair,
    transform: t([1, 0, 1]),
    placed: () => [],
    authorized: () => authorized,
    onCommit: async () => {
      throw new Error('disk full')
    },
  }
  const session = api.begin(options)
  session.nudge(1, 0)
  assert.deepEqual(node.position.toArray(), [2, 0, 1])
  session.undo()
  assert.deepEqual(node.position.toArray(), [1, 0, 1])
  session.redo()
  assert.deepEqual(node.position.toArray(), [2, 0, 1])
  await assert.rejects(session.confirm(), /disk full/)
  assert.deepEqual(node.position.toArray(), [1, 0, 1])
  assert.equal(released, 1)
  assert.throws(() => session.nudge(1, 0), /revoked/)
  const second = api.begin({ ...options, onCommit: async () => {} })
  authorized = false
  listeners.get('update')()
  assert.equal(released, 2)
  assert.throws(() => second.rotate(), /revoked/)
})

test('moving a translated room carries only occupants and preserves local coordinates', async () => {
  const { createFurnishingAPI } = await import('../../packages/core/extras/furnishing.js')
  const THREE = await import('../../packages/core/extras/three.js')
  const moved = [],
    frame = { position: [54, 10, 0], yaw: Math.PI / 2 },
    next = { position: [54, 30, 0], yaw: Math.PI / 2 }
  const players = [
    { data: { id: 'inside' }, base: { position: new THREE.Vector3(56, 10, -1), rotation: { y: 1 } } },
    { data: { id: 'outside' }, base: { position: new THREE.Vector3(0, 0, 0), rotation: { y: 0 } } },
  ]
  const entity = {
    world: { network: { isServer: true }, entities: { players: new Map(players.map(p => [p.data.id, p])) } },
    on() {},
    getPlayerProxy: id => ({ teleport: p => moved.push([id, p.toArray()]) }),
  }
  const node = { ctx: { entity }, position: new THREE.Vector3().fromArray(frame.position), rotation: new THREE.Euler() }
  createFurnishingAPI(entity).moveRoom(node, frame, next, room.size)
  assert.deepEqual(moved, [['inside', [56, 30, -1]]])
  assert.deepEqual(node.position.toArray(), next.position)
  assert.throws(
    () => createFurnishingAPI(entity).moveRoom({ ...node, ctx: { entity: {} } }, frame, next, room.size),
    /scope/
  )
})
