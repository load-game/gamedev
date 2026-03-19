import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

import { readPacket } from '../../src/core/packets.js'
import { buildRuntimeControlAuthorization } from '../../src/core/utils-server.js'
import { buildRuntimeBootstrapAuthorization } from '../../src/server/runtimeBootstrap.js'
import { createTempDir, startStandbyRuntimeServer, waitFor } from './helpers.js'

function toWsUrl(httpUrl) {
  if (httpUrl.startsWith('https://')) return `wss://${httpUrl.slice('https://'.length)}`
  if (httpUrl.startsWith('http://')) return `ws://${httpUrl.slice('http://'.length)}`
  return httpUrl
}

async function canListenOnLoopback() {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function startControlPlaneStub({ issuer } = {}) {
  const requests = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization || null,
        body,
      })

      if (req.url === '/api/identity/exchange/verify' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          valid: true,
          claims: {
            typ: 'identity_exchange',
            aud: 'runtime:exchange',
            userId: 'user-1',
            sub: 'user-1',
            iss: issuer,
            name: 'Runtime User',
          },
        }))
        return
      }

      if (req.url === '/api/internal/users/user-1' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ role: 'builder' }))
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not_found' }))
    })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    baseUrl: `http://127.0.0.1:${port}/api`,
    requests,
    async stop() {
      await new Promise(resolve => server.close(resolve))
    },
  }
}

function buildStandbyBinding({ worldId, runtimeInstanceId, worldUrl, auth = {}, controlInternalBaseUrl = 'http://world-service.internal/api' } = {}) {
  return {
    bootstrapId: `${worldId}:${runtimeInstanceId}`,
    world: {
      id: worldId,
      slug: 'standby-world',
      publicMaxUploadSize: 12,
      shutdownIdleSeconds: 0,
    },
    runtime: {
      instanceId: runtimeInstanceId,
      publicApiUrl: `${worldUrl}/api`,
    },
    auth,
    control: {
      internalBaseUrl: controlInternalBaseUrl,
    },
  }
}

function getStructuredRuntimeEvents(server) {
  return `${server.getStdout()}\n${server.getStderr()}`
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(entry => entry?.component === 'runtime')
}

async function waitForRuntimeEvent(server, event, matcher = () => true) {
  return waitFor(() => {
    const logEvent = getStructuredRuntimeEvents(server).find(entry => entry.event === event && matcher(entry))
    return logEvent || false
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

test('runtime boots into standby with pre-init bootstrap status', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const healthzRes = await fetch(`${server.worldUrl}/healthz`)
  const healthz = await healthzRes.json()
  assert.equal(healthzRes.status, 200)
  assert.equal(healthz.ok, true)
  assert.equal(healthz.state, 'standby')

  const healthRes = await fetch(`${server.worldUrl}/health`)
  const health = await healthRes.json()
  assert.equal(healthRes.status, 503)
  assert.equal(health.ok, false)
  assert.equal(health.state, 'standby')

  const statusRes = await fetch(`${server.worldUrl}/internal/bootstrap/status`)
  const status = await statusRes.json()
  assert.equal(statusRes.status, 200)
  assert.equal(status.state, 'standby')
  assert.equal(status.runtime.instanceId, server.runtimeInstanceId)
  assert.equal(status.world.id, null)
})

test('runtime gates gameplay and admin entrypoints until bootstrap is ready', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  for (const [method, route] of [
    ['GET', '/admin'],
    ['GET', '/env.js'],
    ['GET', '/api/upload-check'],
  ]) {
    const response = await fetch(`${server.worldUrl}${route}`, { method })
    const payload = await response.json()
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('retry-after'), '1')
    assert.equal(payload.error, 'runtime_not_ready')
    assert.equal(payload.state, 'standby')
    assert.equal(payload.retryable, true)
  }
})

test('runtime does not expose /ws as a plain HTTP route', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const response = await fetch(`${server.worldUrl}/ws`)
  assert.equal(response.status, 404)
})

test('runtime accepts bootstrap push and transitions to ready', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const worldId = `world-${server.runtimeInstanceId}`
  const authorization = buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret)

  const response = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(buildStandbyBinding({
      worldId,
      runtimeInstanceId: server.runtimeInstanceId,
      worldUrl: server.worldUrl,
    })),
  })
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.ok, true)
  assert.equal(payload.status.state, 'ready')
  assert.equal(payload.status.world.id, worldId)
  assert.equal(payload.status.runtime.publicWsUrl, `${toWsUrl(server.worldUrl)}/ws`)
  assert.equal(payload.status.runtime.publicAdminUrl, `${server.worldUrl}/admin`)

  await waitFor(async () => {
    const res = await fetch(`${server.worldUrl}/health`)
    return res.ok
  })

  const runtimeStatusRes = await fetch(`${server.worldUrl}/status`)
  const runtimeStatus = await runtimeStatusRes.json()
  assert.equal(runtimeStatusRes.status, 200)
  assert.equal(runtimeStatus.ok, true)
  assert.equal(runtimeStatus.state, 'ready')
  assert.equal(runtimeStatus.worldId, worldId)

  const bootstrapStatusRes = await fetch(`${server.worldUrl}/internal/bootstrap/status`)
  const bootstrapStatus = await bootstrapStatusRes.json()
  assert.equal(bootstrapStatusRes.status, 200)
  assert.equal(bootstrapStatus.state, 'ready')
  assert.equal(bootstrapStatus.world.id, worldId)
  assert.equal(bootstrapStatus.runtime.publicAdminUrl, `${server.worldUrl}/admin`)
  assert.equal(bootstrapStatus.control.internalBaseUrl, 'http://world-service.internal/api')

  const envJsRes = await fetch(`${server.worldUrl}/env.js`)
  const envJs = await envJsRes.text()
  assert.equal(envJsRes.status, 200)
  assert.match(envJs, /PUBLIC_ADMIN_URL/)
  assert.match(envJs, new RegExp(`${server.worldUrl}/admin`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('runtime accepts websocket guest connections without query params after bootstrap', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const worldId = `world-${server.runtimeInstanceId}`
  const authorization = buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret)

  const bootstrapRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(buildStandbyBinding({
      worldId,
      runtimeInstanceId: server.runtimeInstanceId,
      worldUrl: server.worldUrl,
      auth: {
        publicAuthUrl: 'http://127.0.0.1:3001/identity',
      },
    })),
  })
  assert.equal(bootstrapRes.status, 200)

  const { ws, snapshot } = await connectWorldSocket(`${toWsUrl(server.worldUrl)}/ws`)
  t.after(() => {
    ws.close()
  })

  assert.equal(typeof snapshot?.id, 'string')
  assert.equal(snapshot?.authToken, null)
  assert.equal(snapshot?.apiUrl, `${server.worldUrl}/api`)
})

test('runtime treats duplicate bootstrap for the same binding as idempotent', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const worldId = `world-${server.runtimeInstanceId}`
  const authorization = buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret)
  const binding = buildStandbyBinding({
    worldId,
    runtimeInstanceId: server.runtimeInstanceId,
    worldUrl: server.worldUrl,
  })

  const firstRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(binding),
  })
  assert.equal(firstRes.status, 200)

  const secondRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(binding),
  })
  const secondPayload = await secondRes.json()
  assert.equal(secondRes.status, 200)
  assert.equal(secondPayload.ok, true)
  assert.equal(secondPayload.idempotent, true)
  assert.deepEqual(secondPayload.appliedKeys, [])
  assert.equal(secondPayload.status.state, 'ready')
  assert.equal(secondPayload.status.bootstrapId, binding.bootstrapId)
})

test('runtime rejects bootstrap rebinding after a successful push', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const worldId = `world-${server.runtimeInstanceId}`
  const authorization = buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret)

  const initialRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(buildStandbyBinding({
      worldId,
      runtimeInstanceId: server.runtimeInstanceId,
      worldUrl: server.worldUrl,
    })),
  })
  assert.equal(initialRes.status, 200)

  const rebindRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify({
      bootstrapId: `other-world:${server.runtimeInstanceId}`,
      world: {
        id: 'other-world',
        slug: 'other-world',
        publicMaxUploadSize: 5,
        shutdownIdleSeconds: 0,
      },
      runtime: {
        instanceId: server.runtimeInstanceId,
        publicApiUrl: `${server.worldUrl}/api`,
      },
      auth: {},
      control: {
        internalBaseUrl: 'http://world-service.internal/api',
      },
    }),
  })
  const rebindPayload = await rebindRes.json()
  assert.equal(rebindRes.status, 409)
  assert.equal(rebindPayload.error, 'rebind_rejected')
  assert.equal(rebindPayload.expectedBootstrapId, `${worldId}:${server.runtimeInstanceId}`)
  assert.equal(rebindPayload.receivedBootstrapId, `other-world:${server.runtimeInstanceId}`)
  assert.equal(rebindPayload.status.state, 'ready')
  assert.equal(rebindPayload.status.world.id, worldId)
})

test('runtime uses bound control callbacks with world-scoped auth after bootstrap', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const issuer = 'https://auth.example.com/api/identity'
  const controlPlane = await startControlPlaneStub({ issuer })
  t.after(async () => {
    await controlPlane.stop()
  })

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const worldId = `world-${server.runtimeInstanceId}`
  const authorization = buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret)

  const bootstrapRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(buildStandbyBinding({
      worldId,
      runtimeInstanceId: server.runtimeInstanceId,
      worldUrl: server.worldUrl,
      auth: {
        publicAuthUrl: issuer,
      },
      controlInternalBaseUrl: controlPlane.baseUrl,
    })),
  })
  assert.equal(bootstrapRes.status, 200)

  const exchangeRes = await fetch(`${server.worldUrl}/api/auth/exchange`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token: 'exchange-token' }),
  })
  const exchangePayload = await exchangeRes.json()
  assert.equal(exchangeRes.status, 200)
  assert.equal(exchangePayload.user.id, 'user-1')

  const expectedAuthorization = buildRuntimeControlAuthorization({
    worldId,
    jwtSecret: server.jwtSecret,
  })
  const verifyRequest = controlPlane.requests.find(request => request.url === '/api/identity/exchange/verify')
  const roleRequest = controlPlane.requests.find(request => request.url === '/api/internal/users/user-1')

  assert.ok(verifyRequest)
  assert.ok(roleRequest)
  assert.equal(verifyRequest.authorization, expectedAuthorization)
  assert.equal(roleRequest.authorization, expectedAuthorization)
  assert.match(verifyRequest.body, /exchange-token/)
})

test('runtime emits structured standby, bootstrap success, and rebind rejection logs', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const server = await startStandbyRuntimeServer()
  t.after(async () => {
    await server.stop()
  })

  const standbyEvent = await waitForRuntimeEvent(server, 'standby', entry => entry.state === 'standby')
  assert.equal(standbyEvent.mode, 'push')
  assert.equal(standbyEvent.runtimeInstanceId, server.runtimeInstanceId)

  const worldId = `world-${server.runtimeInstanceId}`
  const authorization = buildRuntimeBootstrapAuthorization(server.runtimeInstanceId, server.jwtSecret)
  const binding = buildStandbyBinding({
    worldId,
    runtimeInstanceId: server.runtimeInstanceId,
    worldUrl: server.worldUrl,
  })

  const bootstrapRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(binding),
  })
  assert.equal(bootstrapRes.status, 200)

  const bootstrapStartEvent = await waitForRuntimeEvent(
    server,
    'bootstrap_start',
    entry => entry.bootstrapId === binding.bootstrapId && entry.worldId === worldId && entry.state === 'bootstrapping'
  )
  assert.equal(bootstrapStartEvent.source, 'push')

  const bootstrapSuccessEvent = await waitForRuntimeEvent(
    server,
    'bootstrap_success',
    entry => entry.bootstrapId === binding.bootstrapId && entry.worldId === worldId && entry.state === 'ready'
  )
  assert.equal(bootstrapSuccessEvent.source, 'push')

  const rebindBootstrapId = `other-world:${server.runtimeInstanceId}`
  const rebindRes = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify({
      ...buildStandbyBinding({
        worldId: 'other-world',
        runtimeInstanceId: server.runtimeInstanceId,
        worldUrl: server.worldUrl,
      }),
      bootstrapId: rebindBootstrapId,
    }),
  })
  assert.equal(rebindRes.status, 409)

  const rebindEvent = await waitForRuntimeEvent(
    server,
    'rebind_rejected',
    entry =>
      entry.expectedBootstrapId === binding.bootstrapId
      && entry.receivedBootstrapId === rebindBootstrapId
      && entry.state === 'ready'
  )
  assert.equal(rebindEvent.worldId, worldId)
})

test('runtime emits structured bootstrap failure logs', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const worldRoot = await createTempDir('hyperfy-bootstrap-failed-')
  const blockedWorldPath = path.join(worldRoot, 'blocked-world')
  await fsPromises.writeFile(blockedWorldPath, 'blocked')
  t.after(async () => {
    await fsPromises.rm(worldRoot, { recursive: true, force: true }).catch(() => {})
  })

  const runtimeInstanceId = 'runtime-bootstrap-failed'
  const jwtSecret = 'bootstrap-failed-secret'
  const server = await startStandbyRuntimeServer({
    env: {
      JWT_SECRET: jwtSecret,
      RUNTIME_BOOTSTRAP_INSTANCE_ID: runtimeInstanceId,
      WORLD: blockedWorldPath,
    },
  })
  t.after(async () => {
    await server.stop().catch(() => {})
  })

  const worldId = `world-${runtimeInstanceId}`
  const binding = buildStandbyBinding({
    worldId,
    runtimeInstanceId,
    worldUrl: server.worldUrl,
  })
  const authorization = buildRuntimeBootstrapAuthorization(runtimeInstanceId, jwtSecret)

  const response = await fetch(`${server.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(binding),
  })
  const payload = await response.json()
  assert.equal(response.status, 500)
  assert.equal(payload.error, 'bootstrap_failed')

  const failureEvent = await waitForRuntimeEvent(
    server,
    'bootstrap_failed',
    entry => entry.bootstrapId === binding.bootstrapId && entry.worldId === worldId && entry.state === 'failed'
  )
  assert.match(failureEvent.error, /already exists|EEXIST|not a directory/i)
  assert.ok(failureEvent.errorStack)
})

test('runtime restart returns to standby and accepts re-bootstrap', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const worldDir = await createTempDir('hyperfy-standby-world-')
  const runtimeInstanceId = 'runtime-restart-rebootstrap'
  const jwtSecret = 'restart-bootstrap-secret'
  const worldId = `world-${runtimeInstanceId}`

  t.after(async () => {
    await fsPromises.rm(worldDir, { recursive: true, force: true }).catch(() => {})
  })

  const firstServer = await startStandbyRuntimeServer({
    env: {
      JWT_SECRET: jwtSecret,
      RUNTIME_BOOTSTRAP_INSTANCE_ID: runtimeInstanceId,
      WORLD: worldDir,
    },
  })
  t.after(async () => {
    await firstServer.stop().catch(() => {})
  })

  const authorization = buildRuntimeBootstrapAuthorization(runtimeInstanceId, jwtSecret)
  const firstBinding = buildStandbyBinding({
    worldId,
    runtimeInstanceId,
    worldUrl: firstServer.worldUrl,
  })

  const firstBootstrapRes = await fetch(`${firstServer.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(firstBinding),
  })
  assert.equal(firstBootstrapRes.status, 200)

  await firstServer.stop()

  const restartedServer = await startStandbyRuntimeServer({
    env: {
      JWT_SECRET: jwtSecret,
      RUNTIME_BOOTSTRAP_INSTANCE_ID: runtimeInstanceId,
      WORLD: worldDir,
    },
  })
  t.after(async () => {
    await restartedServer.stop().catch(() => {})
  })

  const standbyStatusRes = await fetch(`${restartedServer.worldUrl}/internal/bootstrap/status`)
  const standbyStatus = await standbyStatusRes.json()
  assert.equal(standbyStatusRes.status, 200)
  assert.equal(standbyStatus.state, 'standby')
  assert.equal(standbyStatus.world.id, null)

  const restartedBinding = buildStandbyBinding({
    worldId,
    runtimeInstanceId,
    worldUrl: restartedServer.worldUrl,
  })
  const secondBootstrapRes = await fetch(`${restartedServer.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify(restartedBinding),
  })
  const secondBootstrapPayload = await secondBootstrapRes.json()
  assert.equal(secondBootstrapRes.status, 200)
  assert.equal(secondBootstrapPayload.ok, true)
  assert.equal(secondBootstrapPayload.status.state, 'ready')
  assert.equal(secondBootstrapPayload.status.world.id, worldId)
  assert.equal(secondBootstrapPayload.status.runtime.publicApiUrl, `${restartedServer.worldUrl}/api`)

  const runtimeStatusRes = await fetch(`${restartedServer.worldUrl}/status`)
  const runtimeStatus = await runtimeStatusRes.json()
  assert.equal(runtimeStatusRes.status, 200)
  assert.equal(runtimeStatus.state, 'ready')
  assert.equal(runtimeStatus.worldId, worldId)
})
