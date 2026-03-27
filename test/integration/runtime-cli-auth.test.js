import assert from 'node:assert/strict'
import net from 'node:net'
import { test } from 'node:test'
import WebSocket from 'ws'

import { readPacket, writePacket } from '../../src/core/packets.js'
import { fetchJson, startWorldServer, waitFor } from './helpers.js'

async function canListenOnLoopback() {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function connectWorldSocket(wsUrl) {
  const ws = new WebSocket(wsUrl)
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      ws.close()
      reject(new Error('timeout'))
    }, 5000)

    const cleanup = () => {
      clearTimeout(timeout)
      ws.removeEventListener('message', onMessage)
      ws.removeEventListener('error', onError)
      ws.removeEventListener('close', onClose)
    }

    const onMessage = event => {
      const [method, data] = readPacket(event.data)
      if (method !== 'snapshot') return
      cleanup()
      resolve({ ws, snapshot: data })
    }

    const onError = err => {
      cleanup()
      reject(err instanceof Error ? err : new Error('ws_error'))
    }

    const onClose = () => {
      cleanup()
      reject(new Error('ws_closed'))
    }

    ws.addEventListener('message', onMessage)
    ws.addEventListener('error', onError)
    ws.addEventListener('close', onClose)
  })
}

test('cli auth guest bootstrap creates a reusable world token that /admin can elevate', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const world = await startWorldServer({ adminCode: 'secret-code' })
  t.after(async () => {
    await world.stop()
  })

  const guest = await fetchJson(`${world.worldUrl}/api/auth/cli/guest`, {
    method: 'POST',
  })
  assert.equal(guest.res.status, 200)
  assert.equal(typeof guest.data?.token, 'string')
  assert.equal(typeof guest.data?.user?.id, 'string')

  const before = await fetchJson(`${world.worldUrl}/api/auth/cli/status`, {
    authToken: guest.data.token,
  })
  assert.equal(before.res.status, 200)
  assert.equal(before.data?.authenticated, true)
  assert.deepEqual(before.data?.capabilities, {
    builder: false,
    deploy: false,
  })

  const { ws } = await connectWorldSocket(`${world.wsUrl}?authToken=${encodeURIComponent(guest.data.token)}`)
  try {
    ws.send(
      writePacket('command', {
        cmd: 'admin',
        value: 'secret-code',
        args: ['/admin', 'secret-code'],
      })
    )

    await waitFor(async () => {
      const result = await fetchJson(`${world.worldUrl}/api/auth/cli/status`, {
        authToken: guest.data.token,
      })
      if (result.res.status !== 200) return false
      return result.data?.capabilities?.deploy ? result.data : false
    })
  } finally {
    ws.close()
  }

  const after = await fetchJson(`${world.worldUrl}/api/auth/cli/status`, {
    authToken: guest.data.token,
  })
  assert.equal(after.res.status, 200)
  assert.equal(after.data?.authenticated, true)
  assert.deepEqual(after.data?.capabilities, {
    builder: true,
    deploy: true,
  })
})

test('cli auth status rejects invalid bearer tokens', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const world = await startWorldServer({ adminCode: 'secret-code' })
  t.after(async () => {
    await world.stop()
  })

  const missing = await fetchJson(`${world.worldUrl}/api/auth/cli/status`)
  assert.equal(missing.res.status, 401)
  assert.equal(missing.data?.error, 'auth_required')

  const invalid = await fetchJson(`${world.worldUrl}/api/auth/cli/status`, {
    authToken: 'invalid-token',
  })
  assert.equal(invalid.res.status, 401)
  assert.equal(invalid.data?.error, 'invalid_token')
})
