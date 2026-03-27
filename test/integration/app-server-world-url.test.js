import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorldAdminClient } from '../../app-server/WorldAdminClient.js'
import { joinUrl, normalizeWorldAdminBaseUrl, toWsUrl } from '../../app-server/helpers.js'

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
    captured.push(typeof input === 'string' ? input : input.toString())
    captured.push(init?.headers || null)
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

  assert.equal(captured[0], 'https://dev.lobby.ws/worlds/demo/admin/snapshot')
  assert.equal(captured[1]?.['X-Admin-Code'], 'secret')
})

test('WorldAdminClient snapshot request includes bearer auth when provided', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (input, init = {}) => {
    calls.push({
      url: typeof input === 'string' ? input : input.toString(),
      headers: init?.headers || null,
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
      authToken: 'runtime-token',
    })
    await client.getSnapshot()
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls[0]?.url, 'https://dev.lobby.ws/worlds/demo/admin/snapshot')
  assert.equal(calls[0]?.headers?.authorization, 'Bearer runtime-token')
})
