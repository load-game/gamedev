import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DirectAppServer } from '../../app-server/direct.js'
import { WorldAdminClient } from '../../app-server/WorldAdminClient.js'
import {
  buildWorldAdminHeaders,
  joinUrl,
  normalizeWorldAdminBaseUrl,
  resolveWorldAdminAuth,
  toWsUrl,
} from '../../app-server/helpers.js'

function buildTestJwt(payload) {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.')
}

test('normalizeWorldAdminBaseUrl strips trailing /admin suffixes', () => {
  assert.equal(
    normalizeWorldAdminBaseUrl('https://dev.lobby.ws/worlds/demo/admin/'),
    'https://dev.lobby.ws/worlds/demo'
  )
  assert.equal(
    normalizeWorldAdminBaseUrl('https://dev.lobby.ws/worlds/demo/admin?x=1#section'),
    'https://dev.lobby.ws/worlds/demo'
  )
  assert.equal(
    normalizeWorldAdminBaseUrl('https://dev.lobby.ws/worlds/demo'),
    'https://dev.lobby.ws/worlds/demo'
  )
})

test('joinUrl and toWsUrl preserve slug path prefixes', () => {
  assert.equal(
    joinUrl('https://dev.lobby.ws/worlds/demo', '/admin/snapshot'),
    'https://dev.lobby.ws/worlds/demo/admin/snapshot'
  )
  assert.equal(
    toWsUrl('https://dev.lobby.ws/worlds/demo'),
    'wss://dev.lobby.ws/worlds/demo'
  )
})

test('WorldAdminClient derives admin endpoints from slug world URLs', () => {
  const client = new WorldAdminClient({
    worldUrl: 'https://dev.lobby.ws/worlds/demo/admin/',
    adminCode: 'secret',
  })

  assert.equal(client.httpBase, 'https://dev.lobby.ws/worlds/demo')
  assert.equal(client.wsBase, 'wss://dev.lobby.ws/worlds/demo')
  assert.equal(client.wsAdminUrl, 'wss://dev.lobby.ws/worlds/demo/admin')
})

test('WorldAdminClient snapshot request uses slug-prefixed admin route', async () => {
  const originalFetch = globalThis.fetch
  const captured = []
  globalThis.fetch = async (input, init = {}) => {
    captured.push({
      url: typeof input === 'string' ? input : input.toString(),
      headers: init.headers || {},
    })
    return new Response(
      JSON.stringify({
        worldId: 'demo-world',
        assetsUrl: 'https://assets.lobby.ws/demo',
        settings: {},
        spawn: {},
        blueprints: [],
        entities: [],
        players: [],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    )
  }

  try {
    const client = new WorldAdminClient({
      worldUrl: 'https://dev.lobby.ws/worlds/demo',
      adminCode: 'secret',
    })
    await client.getSnapshot()
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(captured[0].url, 'https://dev.lobby.ws/worlds/demo/admin/snapshot')
  assert.equal(captured[0].headers['X-Admin-Code'], 'secret')
})

test('resolveWorldAdminAuth prefers world auth token over admin code', () => {
  assert.deepEqual(
    resolveWorldAdminAuth({
      adminCode: 'secret',
      authToken: 'session-token',
    }),
    {
      kind: 'player_token',
      tokenBacked: true,
      authToken: 'session-token',
      adminCode: null,
    }
  )
})

test('buildWorldAdminHeaders uses bearer auth for token-backed sessions', () => {
  assert.deepEqual(
    buildWorldAdminHeaders({
      adminCode: 'secret',
      authToken: 'session-token',
    }),
    {
      authorization: 'Bearer session-token',
    }
  )
})

test('WorldAdminClient omits admin code from websocket auth when token-backed', () => {
  const client = new WorldAdminClient({
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    adminCode: 'secret',
    authToken: 'session-token',
  })

  assert.deepEqual(client.buildAdminAuthPayload(), {
    authToken: 'session-token',
    subscriptions: { snapshot: false, players: false, runtime: false },
  })
})

test('WorldAdminClient maps admin endpoint authorization failures to explicit codes', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: 'admin_required' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })

  try {
    const client = new WorldAdminClient({
      worldUrl: 'https://dev.lobby.ws/worlds/demo',
      authToken: buildTestJwt({ exp: 4102444800, worldId: 'demo-world' }),
    })
    await assert.rejects(() => client.getSnapshot(), err => err?.code === 'forbidden')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('WorldAdminClient rejects expired world auth tokens before requesting snapshot', async () => {
  const client = new WorldAdminClient({
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    authToken: buildTestJwt({ exp: 1, worldId: 'demo-world' }),
  })

  await assert.rejects(() => client.getSnapshot(), err => err?.code === 'expired_session')
})

test('DirectAppServer preserves WORLD_ID validation with an explicit mismatch code', () => {
  const originalWorldId = process.env.WORLD_ID
  process.env.WORLD_ID = 'local-world'

  try {
    const server = new DirectAppServer({
      worldUrl: 'https://dev.lobby.ws/worlds/demo',
    })
    assert.throws(
      () => server._validateWorldId('remote-world'),
      err => err?.code === 'world_id_mismatch' && err?.localWorldId === 'local-world' && err?.remoteWorldId === 'remote-world'
    )
  } finally {
    process.env.WORLD_ID = originalWorldId
  }
})
