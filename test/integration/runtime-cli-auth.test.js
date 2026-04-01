import assert from 'node:assert/strict'
import net from 'node:net'
import { test } from 'node:test'
import WebSocket from 'ws'

import { readPacket, writePacket } from '../../src/core/packets.js'
import { buildRuntimeBootstrapAuthorization } from '../../src/server/runtimeBootstrap.js'
import { fetchJson, startStandbyRuntimeServer, startWorldServer, waitFor } from './helpers.js'

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

async function connectAdminSocket(worldUrl, authToken) {
  const ws = new WebSocket(`${worldUrl.replace(/^http/, 'ws')}/admin`, {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
  })

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      ws.close()
      reject(new Error('timeout'))
    }, 5000)

    const cleanup = () => {
      clearTimeout(timeout)
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('message', onMessage)
      ws.removeEventListener('error', onError)
      ws.removeEventListener('close', onClose)
    }

    const onOpen = () => {
      ws.send(
        writePacket('adminAuth', {
          authToken,
          subscriptions: { snapshot: false, players: false, runtime: false },
        })
      )
    }

    const onMessage = event => {
      const [method, data] = readPacket(event.data)
      if (method === 'onAdminAuthOk') {
        cleanup()
        resolve({ ws, data })
        return
      }
      if (method === 'onAdminAuthError') {
        cleanup()
        ws.close()
        reject(new Error(data?.error || 'auth_error'))
      }
    }

    const onError = err => {
      cleanup()
      reject(err instanceof Error ? err : new Error('ws_error'))
    }

    const onClose = () => {
      cleanup()
      reject(new Error('ws_closed'))
    }

    ws.addEventListener('open', onOpen)
    ws.addEventListener('message', onMessage)
    ws.addEventListener('error', onError)
    ws.addEventListener('close', onClose)
  })
}

function buildManagedBinding({ worldId, runtimeInstanceId, worldUrl }) {
  return {
    bootstrapId: `${worldId}:${runtimeInstanceId}`,
    world: {
      id: worldId,
      slug: 'managed-world',
      dbSchema: 'world_managed_world',
      publicMaxUploadSize: 12,
      publicWorldMaxPlayers: 32,
      shutdownIdleSeconds: 0,
    },
    runtime: {
      instanceId: runtimeInstanceId,
      publicApiUrl: `${worldUrl}/api`,
    },
    auth: {},
    control: {},
  }
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

test('standalone open-admin mode accepts guest cli tokens on /admin even before rank elevation', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const world = await startWorldServer({ adminCode: '' })
  t.after(async () => {
    await world.stop()
  })

  const guest = await fetchJson(`${world.worldUrl}/api/auth/cli/guest`, {
    method: 'POST',
  })
  assert.equal(guest.res.status, 200)
  assert.equal(typeof guest.data?.token, 'string')
  assert.equal(guest.data?.user?.rank, 0)

  const status = await fetchJson(`${world.worldUrl}/api/auth/cli/status`, {
    authToken: guest.data.token,
  })
  assert.equal(status.res.status, 200)
  assert.deepEqual(status.data?.capabilities, {
    builder: true,
    deploy: true,
  })

  const snapshot = await fetchJson(`${world.worldUrl}/admin/snapshot`, {
    authToken: guest.data.token,
  })
  assert.equal(snapshot.res.status, 200)
  assert.equal(snapshot.data?.worldId, world.worldId)

  const { ws, data } = await connectAdminSocket(world.worldUrl, guest.data.token)
  try {
    assert.equal(data?.ok, true)
    assert.deepEqual(data?.capabilities, {
      builder: true,
      deploy: true,
    })
  } finally {
    ws.close()
  }
})

test('cli auth session flow completes on the world server without a loopback callback', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const world = await startWorldServer({ adminCode: 'secret-code' })
  t.after(async () => {
    await world.stop()
  })

  const created = await fetchJson(`${world.worldUrl}/api/auth/cli/session`, {
    method: 'POST',
    body: {
      worldId: world.worldId,
      requiredCapability: 'auth',
    },
  })
  assert.equal(created.res.status, 200)
  assert.equal(created.data?.status, 'pending')
  assert.equal(typeof created.data?.sessionId, 'string')
  assert.equal(created.data?.worldId, world.worldId)
  assert.equal(created.data?.requiredCapability, 'auth')

  const page = await fetch(`${world.worldUrl}/auth/cli?session=${encodeURIComponent(created.data.sessionId)}`)
  const html = await page.text()
  assert.equal(page.status, 200)
  assert.match(html, /Authorize CLI Access/)
  assert.match(html, new RegExp(created.data.sessionId))

  const guest = await fetchJson(`${world.worldUrl}/api/auth/cli/guest`, {
    method: 'POST',
  })
  assert.equal(guest.res.status, 200)
  assert.equal(typeof guest.data?.token, 'string')

  const insufficient = await fetchJson(`${world.worldUrl}/api/auth/cli/session`, {
    method: 'POST',
    body: {
      worldId: world.worldId,
      requiredCapability: 'deploy',
    },
  })
  assert.equal(insufficient.res.status, 200)

  const insufficientComplete = await fetchJson(
    `${world.worldUrl}/api/auth/cli/session/${encodeURIComponent(insufficient.data.sessionId)}`,
    {
      method: 'POST',
      body: {
        worldUrl: world.worldUrl,
        authToken: guest.data.token,
      },
    }
  )
  assert.equal(insufficientComplete.res.status, 409)
  assert.equal(insufficientComplete.data?.error, 'capability_required')

  const completed = await fetchJson(`${world.worldUrl}/api/auth/cli/session/${encodeURIComponent(created.data.sessionId)}`, {
    method: 'POST',
    body: {
      worldUrl: world.worldUrl,
      authToken: guest.data.token,
    },
  })
  assert.equal(completed.res.status, 200)
  assert.equal(completed.data?.ok, true)
  assert.equal(completed.data?.status, 'complete')

  const polled = await fetchJson(`${world.worldUrl}/api/auth/cli/session/${encodeURIComponent(created.data.sessionId)}`)
  assert.equal(polled.res.status, 200)
  assert.equal(polled.data?.status, 'complete')
  assert.equal(polled.data?.result?.authToken, guest.data.token)
  assert.equal(polled.data?.result?.worldId, world.worldId)
  assert.deepEqual(polled.data?.result?.capabilities, {
    builder: false,
    deploy: false,
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

test('invalid websocket auth tokens fall back to a guest snapshot in lobby identity mode', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const world = await startWorldServer({
    env: {
      PUBLIC_AUTH_URL: 'https://auth.example.test/identity',
    },
  })
  t.after(async () => {
    await world.stop()
  })

  const { ws, snapshot } = await connectWorldSocket(`${world.wsUrl}?authToken=expired-token`)
  try {
    assert.equal(snapshot?.authToken, null)
    const player = Array.isArray(snapshot?.entities)
      ? snapshot.entities.find(entity => entity?.type === 'player' && entity?.owner === snapshot?.id)
      : null
    assert.equal(player?.name, 'Anonymous')
  } finally {
    ws.close()
  }
})

test('bootstrapped worlds disable admin-code auth for admin endpoints and in-world escalation', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
  }

  const server = await startStandbyRuntimeServer({
    env: {
      ADMIN_CODE: 'secret-code',
      RUNTIME_BOOTSTRAP: '1',
    },
  })
  t.after(async () => {
    await server.stop()
  })

  const worldId = `world-${server.runtimeInstanceId}`
  const binding = buildManagedBinding({
    worldId,
    runtimeInstanceId: server.runtimeInstanceId,
    worldUrl: server.worldUrl,
  })
  const bootstrapRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret),
    },
    body: JSON.stringify(binding),
  })
  assert.equal(bootstrapRes.status, 200)

  const adminSnapshot = await fetchJson(`${server.worldUrl}/admin/snapshot`, {
    adminCode: 'secret-code',
  })
  assert.equal(adminSnapshot.res.status, 403)
  assert.equal(adminSnapshot.data?.error, 'admin_required')

  const guest = await fetchJson(`${server.worldUrl}/api/auth/cli/guest`, {
    method: 'POST',
  })
  assert.equal(guest.res.status, 200)
  assert.equal(typeof guest.data?.token, 'string')

  const before = await fetchJson(`${server.worldUrl}/api/auth/cli/status`, {
    authToken: guest.data.token,
  })
  assert.equal(before.res.status, 200)
  assert.equal(before.data?.hasAdminCode, true)
  assert.equal(before.data?.adminCodeAuthSupported, false)
  assert.deepEqual(before.data?.capabilities, {
    builder: false,
    deploy: false,
  })

  const wsUrl = `${server.worldUrl.replace(/^http/, 'ws')}/ws`
  const { ws, snapshot } = await connectWorldSocket(`${wsUrl}?authToken=${encodeURIComponent(guest.data.token)}`)
  try {
    assert.equal(snapshot?.hasAdminCode, true)
    assert.equal(snapshot?.adminCodeAuthSupported, false)
    ws.send(
      writePacket('command', {
        cmd: 'admin',
        value: 'secret-code',
        args: ['/admin', 'secret-code'],
      })
    )
    await new Promise(resolve => setTimeout(resolve, 300))
  } finally {
    ws.close()
  }

  const after = await fetchJson(`${server.worldUrl}/api/auth/cli/status`, {
    authToken: guest.data.token,
  })
  assert.equal(after.res.status, 200)
  assert.equal(after.data?.adminCodeAuthSupported, false)
  assert.deepEqual(after.data?.capabilities, {
    builder: false,
    deploy: false,
  })
})
