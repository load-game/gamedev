import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { privateKeyToAccount } from 'viem/accounts'
import { Companions } from '../../packages/server/Companions.js'
import { AgentControl } from '../../packages/core/systems/AgentControl.js'
import { ClientCompanions } from '../../packages/core/systems/ClientCompanions.js'
import * as THREE from 'three'
import { findAgentPath } from '../../packages/core/agentNavigation.js'
const owner = privateKeyToAccount('0x' + '11'.repeat(32))
function setup(options = {}) {
  const agent = { id: 'agent', player: { data: { name: 'Companion' } } },
    human = { id: 'human' },
    guest = { id: 'guest' }
  const network = { worldId: 'test-world', sockets: new Map([agent, human, guest].map(s => [s.id, s])), send() {} }
  return { agent, human, guest, network, service: new Companions(network, options) }
}
test('address claim is unverified; signature binds only its human, agent, and live session', async () => {
  const f = setup(),
    s = f.service
  await s.request(f.agent, { action: 'register', owner: owner.address })
  assert.equal(s.list()[0].ownerPlayerId, null)
  const c = await s.request(f.human, { action: 'challenge', agentId: 'agent' })
  const signature = await owner.signMessage({ message: c.message })
  await assert.rejects(s.request(f.guest, { action: 'authorize', agentId: 'agent', signature }), /challenge_expired/)
  await s.request(f.human, { action: 'authorize', agentId: 'agent', signature })
  assert.equal(s.list()[0].ownerPlayerId, 'human')
  assert.equal(s.list()[0].generation, 1)
  await assert.rejects(s.request(f.human, { action: 'authorize', agentId: 'agent', signature }), /challenge_expired/)
  await assert.rejects(s.request(f.guest, { action: 'revoke', agentId: 'agent' }), /owner_required/)
  await s.request(f.human, { action: 'revoke', agentId: 'agent' })
  assert.equal(s.list()[0].ownerPlayerId, null)
})
test('disconnect during signature verification cannot establish a stale owner', async () => {
  let finish
  const f = setup({
    verify: () =>
      new Promise(resolve => {
        finish = resolve
      }),
  })
  await f.service.request(f.agent, { action: 'register', owner: owner.address })
  await f.service.request(f.human, { action: 'challenge', agentId: 'agent' })
  const pending = f.service.request(f.human, { action: 'authorize', agentId: 'agent', signature: '0x00' })
  f.network.sockets.delete('human')
  f.service.leave(f.human)
  finish(true)
  await assert.rejects(pending, /invalid_signature/)
  assert.equal(f.service.list()[0].ownerPlayerId, null)
})
test('expiry, wrong signature, and companion self-pairing are rejected', async () => {
  let time = 0
  const f = setup({ now: () => time })
  await f.service.request(f.agent, { action: 'register', owner: owner.address })
  await assert.rejects(f.service.request(f.agent, { action: 'challenge', agentId: 'agent' }), /human_player_required/)
  const c = await f.service.request(f.human, { action: 'challenge', agentId: 'agent' })
  time = 120001
  await assert.rejects(
    f.service.request(f.human, {
      action: 'authorize',
      agentId: 'agent',
      signature: await owner.signMessage({ message: c.message }),
    }),
    /challenge_expired/
  )
  const newer = await f.service.request(f.human, { action: 'challenge', agentId: 'agent' })
  const wrong = await privateKeyToAccount('0x' + '22'.repeat(32)).signMessage({ message: newer.message })
  await assert.rejects(
    f.service.request(f.human, { action: 'authorize', agentId: 'agent', signature: wrong }),
    /invalid_signature/
  )
})
test('owner departure revokes control; agent departure removes registration', async () => {
  const f = setup({ verify: async () => true })
  await f.service.request(f.agent, { action: 'register', owner: owner.address })
  await f.service.request(f.human, { action: 'challenge', agentId: 'agent' })
  await f.service.request(f.human, { action: 'authorize', agentId: 'agent', signature: '0x00' })
  f.service.leave(f.human)
  assert.equal(f.service.list()[0].ownerPlayerId, null)
  assert.equal(f.service.list()[0].generation, 2)
  f.service.leave(f.agent)
  assert.deepEqual(f.service.list(), [])
})
test('navigation routes around an obstacle instead of crossing it', () => {
  const step = (a, b) => {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[2] + (b[2] - a[2]) * t
      if (x > 1 && x < 4 && Math.abs(z) < 2) return null
    }
    return b
  }
  const start = [0, 0, 0],
    goal = [5, 0, 0]
  const path = findAgentPath(start, goal, step)
  assert.ok(path && path.some(p => Math.abs(p[2]) >= 2))
  for (let i = 0; i < path.length; i++) assert.ok(step(i ? path[i - 1] : start, path[i]))
  assert.deepEqual(path.at(-1), goal)
})
test('unreachable and far destinations never create fallback teleport paths', () => {
  assert.equal(
    findAgentPath([0, 0, 0], [5, 0, 0], () => null),
    null
  )
  assert.equal(
    findAgentPath([0, 0, 0], [100, 0, 0], (_, b) => b),
    null
  )
})

test('revocation stops controller input and cancels a held interaction immediately', async () => {
  let triggered = 0,
    cancelled = 0
  const node = {
    worldPos: new THREE.Vector3(),
    distance: 3,
    duration: 1,
    onStart() {},
    onTrigger() {
      triggered++
    },
    onCancel() {
      cancelled++
    },
  }
  const player = { base: { position: new THREE.Vector3() }, data: { id: 'agent' } }
  const world = {
    network: { id: 'agent' },
    events: { emit() {} },
    entities: { player },
    actions: { nodes: [node] },
    physics: { raycast() {} },
  }
  world.agentControl = new AgentControl(world)
  world.agentControl.enabled = true
  world.agentControl.direction = new THREE.Vector3(1, 0, 0)
  world.agentControl.actionIds.set(node, 'test-action')
  const pending = world.agentControl.interact('test-action')
  const companions = new ClientCompanions(world)
  companions.agents = [{ id: 'agent', ownerPlayerId: 'owner', generation: 1 }]
  companions.setState([{ id: 'agent', ownerPlayerId: null, generation: 2 }])
  assert.deepEqual(await pending, { cancelled: true })
  world.agentControl.update(2)
  assert.equal(triggered, 0)
  assert.equal(cancelled, 1)
  assert.equal(world.agentControl.direction.length(), 0)
})
