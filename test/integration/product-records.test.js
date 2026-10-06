import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { admittedIdentity, requestProductRecords } from '../../packages/server/productRecords.js'
test('product records derive the actor from a live socket, bind responses and discard account changes', async () => {
  const previous = {
    fetch: globalThis.fetch,
    url: process.env.PRODUCT_RECORDS_GATEWAY_URL,
    secret: process.env.PRODUCT_RECORDS_SECRET,
  }
  const identity = { userId: 'alice', expiresAt: Date.now() + 60000 },
    network = { sockets: new Map([['player', { identity }]]) }
  process.env.PRODUCT_RECORDS_GATEWAY_URL = 'https://pool.test/internal/product-records'
  process.env.PRODUCT_RECORDS_SECRET = 'private-bridge'
  let change = false,
    wrong = false
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://pool.test/internal/product-records')
    assert.equal(options.headers.authorization, 'Bearer private-bridge')
    assert.equal(JSON.parse(options.body).subject, 'alice')
    if (change) network.sockets.get('player').identity = { ...identity, userId: 'bob' }
    return Response.json({ subject: wrong ? 'spoofed' : 'alice', scope: 'game.test', records: [] })
  }
  try {
    assert.equal(admittedIdentity(network, 'guest'), null)
    await assert.rejects(requestProductRecords(network, 'guest', {}), /Sign in/)
    assert.deepEqual(
      (await requestProductRecords(network, 'player', { subject: 'spoofed', scope: 'game.test' })).records,
      []
    )
    wrong = true
    await assert.rejects(requestProductRecords(network, 'player', { scope: 'game.test' }), /Invalid/)
    wrong = false
    change = true
    await assert.rejects(requestProductRecords(network, 'player', { scope: 'game.test' }), /Account changed/)
    network.sockets.get('player').identity.expiresAt = 0
    await assert.rejects(requestProductRecords(network, 'player', {}), /Sign in/)
  } finally {
    globalThis.fetch = previous.fetch
    for (const [key, value] of [
      ['PRODUCT_RECORDS_GATEWAY_URL', previous.url],
      ['PRODUCT_RECORDS_SECRET', previous.secret],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
