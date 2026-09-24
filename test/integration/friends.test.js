import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import Knex from 'knex'
import { Vector3 } from 'three'
import { Friends, readFriendJoin } from '../../packages/server/Friends.js'
import { Storage } from '../../packages/server/Storage.js'
import { reserveFriendTravel, takeFriendTravel } from '../../packages/core/friendTravel.js'
const alice = '0x' + 'a'.repeat(40),
  bob = '0x' + 'b'.repeat(40),
  eve = '0x' + 'e'.repeat(40)
async function fixture() {
  const db = Knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
  await db.schema.createTable('world_storage', t => {
    t.string('key').primary()
    t.text('value')
    t.text('createdAt')
    t.text('updatedAt')
  })
  const storage = new Storage(db),
    bindings = new Map([
      ['alice', alice],
      ['bob', bob],
      ['eve', eve],
    ])
  const players = ['alice', 'bob', 'eve'].map(id => ({ id, name: id, position: new Vector3() }))
  let now = 1000000
  const options = {
    storage,
    auth: { get: id => bindings.get(id) },
    players: () => players,
    scope: 'socialLobby',
    worldId: 'test',
    generation: 'city-a',
    secret: 'test-secret',
    now: () => now,
  }
  const a = new Friends(options),
    b = new Friends({ ...options, generation: 'city-b' })
  return {
    a,
    b,
    db,
    storage,
    bindings,
    players,
    options,
    advance: n => {
      now += n
    },
    close: () => db.destroy(),
  }
}
test('nearby requests require verified wallets and mutual acceptance; survive service recreation', async () => {
  const f = await fixture()
  try {
    f.players[1].position.x = 6
    await assert.rejects(f.a.request('alice', 'bob'), /not_nearby/)
    f.players[1].position.x = 0
    f.bindings.delete('bob')
    await assert.rejects(f.a.request('alice', 'bob'), /player_sign_in/)
    f.bindings.set('bob', bob)
    await assert.rejects(f.a.request('alice', 'alice'), /invalid_player/)
    await f.a.request('alice', 'bob')
    await f.b.request('bob', 'alice')
    assert.equal((await f.a.list('alice'))[0].state, 'outgoing')
    await assert.rejects(f.a.act('alice', bob, 'accept'), /request_missing/)
    await f.b.act('bob', alice, 'accept')
    assert.equal((await new Friends(f.options).list('alice'))[0].state, 'friend')
    assert.deepEqual(await f.a.list('eve'), [])
  } finally {
    await f.close()
  }
})
test('racing acceptance/cancellation stays consistent; blocking prevents further requests', async () => {
  const f = await fixture()
  try {
    await f.a.request('alice', 'bob')
    await Promise.allSettled([f.a.act('alice', bob, 'cancel'), f.b.act('bob', alice, 'accept')])
    const a = await f.a.list('alice'),
      b = await f.b.list('bob')
    assert.equal(a.length, b.length)
    if (!a.length) {
      await f.a.request('alice', 'bob')
      await f.b.act('bob', alice, 'accept')
    }
    await f.b.act('bob', alice, 'block')
    assert.deepEqual(await f.a.list('alice'), [])
    await assert.rejects(f.a.request('alice', 'bob'), /request_unavailable/)
    await f.b.act('bob', alice, 'unblock')
    await f.a.request('alice', 'bob')
    await f.b.act('bob', alice, 'decline')
    assert.deepEqual(await f.a.list('alice'), [])
  } finally {
    await f.close()
  }
})
test('joins check session, destination, live wallet, friendship, signature and expiry', async () => {
  const f = await fixture()
  try {
    await f.a.request('alice', 'bob')
    await f.b.act('bob', alice, 'accept')
    await f.b.sync()
    assert.equal((await f.a.list('alice'))[0].online, true)
    assert.equal((await f.a.list('alice'))[0].sameCity, false)
    const token = await f.a.join('alice', bob)
    await f.b.authorizeJoin(token, 'alice')
    await assert.rejects(f.b.authorizeJoin(token, 'eve'), /expired/)
    await assert.rejects(f.a.authorizeJoin(token, 'alice'), /expired/)
    await assert.rejects(f.a.join('eve', bob), /not_friends/)
    assert.throws(() => readFriendJoin(token + 'x', 'test-secret', 1000000), /expired/)
    f.bindings.delete('bob')
    await assert.rejects(f.b.authorizeJoin(token, 'alice'), /offline/)
    f.bindings.set('bob', bob)
    await f.b.act('bob', alice, 'remove')
    await assert.rejects(f.b.authorizeJoin(token, 'alice'), /not_friends/)
    await f.a.request('alice', 'bob')
    await f.b.act('bob', alice, 'accept')
    f.advance(30001)
    assert.equal((await f.a.list('alice'))[0].online, false)
    await assert.rejects(f.a.join('alice', bob), /offline/)
    await assert.rejects(f.b.authorizeJoin(token, 'alice'), /expired/)
  } finally {
    await f.close()
  }
})
test('wallet changes and disposal clear only the owning session presence', async () => {
  const f = await fixture()
  try {
    await f.a.sync()
    f.advance(1)
    await f.b.sync()
    await f.a.dispose()
    assert.equal((await f.storage.getFresh(f.a.presenceKey(bob))).generation, 'city-b')
    f.bindings.set('bob', eve)
    await f.b.sync()
    assert.equal(await f.storage.getFresh(f.a.presenceKey(bob)), null)
    await f.b.dispose()
    assert.equal(await f.storage.getFresh(f.a.presenceKey(alice)), null)
  } finally {
    await f.close()
  }
})
test('rate limits survive recreation', async () => {
  const f = await fixture()
  try {
    for (let i = 0; i < 10; i++) {
      await f.a.request('alice', 'bob')
      await f.b.act('bob', alice, 'decline')
    }
    await assert.rejects(new Friends(f.options).request('alice', 'bob'), /rate_limit/)
    f.advance(60001)
    await f.a.request('alice', 'bob')
  } finally {
    await f.close()
  }
})
test('client keeps current city after failed reservation and consumes success once', async () => {
  const storage = new Map([['lobbyTab', 'tab']])
  const env = {
    env: { PUBLIC_JOIN_URL: 'https://game.test/join' },
    sessionStorage: {
      getItem: k => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k),
    },
    fetch: async () => Response.json({ error: 'admission_full' }, { status: 503 }),
  }
  await assert.rejects(reserveFriendTravel('proof', env), /admission_full/)
  assert.equal(storage.has('friendAssignment'), false)
  const assignment = { ticket: 'private', wsUrl: 'wss://game.test/instances/b/ws', expiresAt: Date.now() + 30000 }
  env.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init.body).friendToken, 'proof')
    return Response.json(assignment)
  }
  await reserveFriendTravel('proof', env)
  assert.deepEqual(takeFriendTravel(env), assignment)
  assert.equal(takeFriendTravel(env), null)
})

test.skipIf(!process.env.TEST_POSTGRES_URL)(
  'two PostgreSQL instances persist friendships and resolve conflicting updates',
  async () => {
    const { createAppStorage } = await import('../../packages/server/sharedStorage.js')
    const f = await fixture()
    const schema = `friends_${crypto.randomUUID().replaceAll('-', '')}`
    const env = {
      SHARED_STORAGE_DB_URI: process.env.TEST_POSTGRES_URL,
      SHARED_STORAGE_SCHEMA: schema,
      SHARED_STORAGE_PREFIXES: 'social:home:',
    }
    const aStore = await createAppStorage(f.db, env),
      bStore = await createAppStorage(f.db, env)
    const a = new Friends({ ...f.options, storage: aStore })
    const b = new Friends({ ...f.options, storage: bStore, generation: 'city-b' })
    try {
      await a.request('alice', 'bob')
      await b.act('bob', alice, 'accept')
      await b.sync()
      assert.equal((await a.list('alice'))[0].online, true)
      await b.authorizeJoin(await a.join('alice', bob), 'alice')
      await Promise.allSettled([a.act('alice', bob, 'remove'), b.act('bob', alice, 'block')])
      assert.deepEqual(await a.list('alice'), [])
      assert.equal(await a.accepted(alice, bob), false)
      assert.equal((await aStore.local.getFreshEntry(a.key(alice))).exists, false)
    } finally {
      await aStore.shared.db.raw('DROP SCHEMA ?? CASCADE', [schema])
      await aStore.shared.db.destroy()
      await bStore.shared.db.destroy()
      await f.close()
    }
  }
)
