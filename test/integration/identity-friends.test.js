import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { Vector3 } from 'three'
import { IdentityFriends } from '../../packages/server/IdentityFriends.js'
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'

test('walletless Identity friends share presence across cities and revoked relationships invalidate travel', async () => {
  const values = new Map()
  const storage = {
    getFresh: async key => values.get(key),
    getFreshEntry: async key => ({ key, value: values.get(key), updatedAt: null }),
    commit: async entries => {
      for (const entry of entries) values.set(entry.key, entry.value)
      return { ok: true }
    },
  }
  let now = 1000000,
    accepted = true
  const identities = new Map([
    [alice, { userId: alice, expiresAt: now + 60000 }],
    [bob, { userId: bob, expiresAt: now + 60000 }],
  ])
  const options = {
    storage,
    getIdentity: id => identities.get(id),
    worldId: 'game',
    scope: 'social',
    secret: 'shared-admission-secret',
    now: () => now,
  }
  const a = new IdentityFriends({
    ...options,
    generation: 'city-a',
    players: () => [{ id: alice, name: 'Alice', position: new Vector3() }],
  })
  const b = new IdentityFriends({
    ...options,
    generation: 'city-b',
    players: () => [{ id: bob, name: 'Bob', position: new Vector3() }],
  })
  for (const service of [a, b])
    service.graph = async subject =>
      accepted ? [{ state: 'friend', profile: { id: subject === alice ? bob : alice, displayName: 'Friend' } }] : []
  await b.sync()
  assert.equal((await a.list(alice))[0].online, true)
  const token = await a.join(alice, bob)
  await b.authorizeJoin(token, alice)
  await assert.rejects(b.authorizeJoin(token, bob), /expired/)
  accepted = false
  await assert.rejects(b.authorizeJoin(token, alice), /not_friends/)
  accepted = true
  now += 31000
  await assert.rejects(a.join(alice, bob), /offline/)
  now += 30000
  await assert.rejects(a.list(alice), /sign_in/)
})

test('guests cannot access account friendships and nearby targets must have live Identity sessions', async () => {
  const players = [
    { id: alice, position: new Vector3() },
    { id: bob, position: new Vector3(6, 0, 0) },
  ]
  const service = new IdentityFriends({
    storage: {},
    getIdentity: id => (id === alice ? { userId: alice, expiresAt: Date.now() + 60000 } : null),
    players: () => players,
    worldId: 'game',
    scope: 'social',
  })
  await assert.rejects(service.list(bob), /sign_in/)
  await assert.rejects(service.status(alice, bob), /not_nearby/)
  players[1].position.x = 0
  await assert.rejects(service.status(alice, bob), /player_sign_in/)
})
