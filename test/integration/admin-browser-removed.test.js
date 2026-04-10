import assert from 'node:assert/strict'
import net from 'node:net'
import { test } from 'node:test'

import { fetchJson, startWorldServer } from './helpers.js'

async function canListenOnLoopback() {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

test('runtime no longer serves a standalone /admin browser experience', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const world = await startWorldServer()
  t.after(async () => {
    await world.stop()
  })

  const adminPage = await fetch(`${world.worldUrl}/admin`)
  const adminPageBody = await adminPage.text()
  assert.equal(adminPage.status, 404)
  assert.equal(adminPageBody, '')

  const snapshot = await fetchJson(`${world.worldUrl}/admin/snapshot`, {
    adminCode: 'admin',
  })
  assert.equal(snapshot.res.status, 200)
  assert.equal(typeof snapshot.data?.settings, 'object')
})
