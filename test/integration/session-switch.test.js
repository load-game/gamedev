import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { ClientNetwork } from '../../packages/core/systems/ClientNetwork.js'
import { PlayerLocal } from '../../packages/core/entities/PlayerLocal.js'

function fixture() {
  const removed = [],
    events = [],
    items = new Map()
  const entities = {
    items,
    player: null,
    get: id => items.get(id),
    add(data) {
      const entity = {
        data: structuredClone(data),
        isPlayer: data.type === 'player',
        modify(value) {
          Object.assign(this.data, value)
        },
      }
      items.set(data.id, entity)
      return entity
    },
    remove(id) {
      removed.push(id)
      items.delete(id)
      if (this.player?.data.id === id) this.player = null
    },
  }
  const world = {
    entities,
    events: { emit: name => events.push(name) },
    emit: name => events.push(name),
    livekit: { resetSession() {} },
  }
  const network = new ClientNetwork(world)
  network.activeInstance = network.nextInstance = 'city'
  return { network, entities, events, removed }
}

test('session suspension detaches the old socket and player but retains city apps', () => {
  const f = fixture()
  const city = f.entities.add({ id: 'city-app', type: 'app', blueprint: 'city' })
  city.playerProxies = new Map([['guest', {}]])
  f.entities.player = f.entities.add({ id: 'guest', type: 'player' })
  let detached = 0
  f.network.ws = {
    readyState: 3,
    removeEventListener() {
      detached++
    },
  }
  f.network.queue.push(['onEntityAdded', { id: 'stale' }])
  f.network.suspendSession()
  assert.equal(detached, 4)
  assert.equal(f.network.ws, null)
  assert.equal(f.network.queue.length, 0)
  assert.equal(f.entities.player, null)
  assert.equal(f.entities.get('city-app'), city)
  assert.equal(city.playerProxies.size, 0)
  assert.ok(f.events.includes('session-changing'))
})

test('fresh snapshot replaces players and removed entities without rebuilding unchanged city apps', () => {
  const f = fixture()
  const city = f.entities.add({ id: 'city-app', type: 'app', blueprint: 'city', state: { count: 1 } })
  f.entities.add({ id: 'guest', type: 'player' })
  f.entities.add({ id: 'removed-app', type: 'app' })
  f.network.reconcileEntities([
    { id: 'city-app', type: 'app', blueprint: 'city', state: { count: 2 } },
    { id: 'identity-user', type: 'player' },
  ])
  assert.equal(f.entities.get('city-app'), city)
  assert.deepEqual(city.data.state, { count: 2 })
  assert.equal(f.entities.get('guest'), undefined)
  assert.equal(f.entities.get('removed-app'), undefined)
  assert.equal(f.entities.items.size, 2)
  f.network.nextInstance = 'another-city'
  f.network.reconcileEntities([{ id: 'city-app', type: 'app', blueprint: 'city' }])
  assert.notEqual(f.entities.get('city-app'), city)
})

test('local player teardown releases controls, physics, scene nodes and listeners exactly once', () => {
  const calls = []
  const release = name => () => calls.push(name)
  const player = {
    data: { id: 'guest' },
    world: {
      off: release('listener'),
      setHot: release('ticks'),
      events: { emit: release('leave') },
      camera: { parent: null },
    },
    control: { release: release('controls') },
    capsuleHandle: { destroy: release('physics-handle') },
    capsule: { release: release('capsule') },
    capsuleShape: { release: release('shape') },
    material: { release: release('material') },
    base: { deactivate: release('model') },
    aura: { deactivate: release('aura') },
    xrRig: { removeFromParent: release('xr') },
  }
  PlayerLocal.prototype.destroy.call(player)
  const once = calls.slice()
  PlayerLocal.prototype.destroy.call(player)
  assert.equal(player.destroyed, true)
  assert.deepEqual(calls, once)
  for (const name of [
    'controls',
    'physics-handle',
    'capsule',
    'shape',
    'material',
    'model',
    'aura',
    'listener',
    'ticks',
    'leave',
  ])
    assert.ok(calls.includes(name))
})
