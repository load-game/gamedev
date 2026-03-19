import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { test } from 'node:test'

import { buildRuntimeControlAuthorization } from '../../src/core/utils-server.js'
import { buildRuntimeBootstrapAuthorization } from '../../src/server/runtimeBootstrap.js'
import { getAvailablePort, startPullRuntimeServer, startStandbyRuntimeServer } from './helpers.js'

function toWsUrl(httpUrl) {
  if (httpUrl.startsWith('https://')) return `wss://${httpUrl.slice('https://'.length)}`
  if (httpUrl.startsWith('http://')) return `ws://${httpUrl.slice('http://'.length)}`
  return httpUrl
}

function normalizeRuntimeUrl(value, worldUrl) {
  if (typeof value !== 'string' || !value) return value || null
  return value.replace(toWsUrl(worldUrl), '<runtime>').replace(worldUrl, '<runtime>')
}

function normalizeBootstrapStatus(status, worldUrl) {
  return {
    state: status.state,
    bootstrapId: status.bootstrapId,
    world: status.world,
    runtime: {
      instanceId: status.runtime.instanceId,
      publicApiUrl: normalizeRuntimeUrl(status.runtime.publicApiUrl, worldUrl),
      publicWsUrl: normalizeRuntimeUrl(status.runtime.publicWsUrl, worldUrl),
      publicAdminUrl: normalizeRuntimeUrl(status.runtime.publicAdminUrl, worldUrl),
    },
    auth: status.auth,
    control: status.control,
  }
}

async function readManagedPublicEnv(worldUrl) {
  const response = await fetch(`${worldUrl}/env.js`)
  assert.equal(response.status, 200)
  const body = await response.text()
  const match = body.match(/globalThis\.env = (\{[\s\S]*\})/)
  assert.ok(match, 'env.js did not expose globalThis.env')
  const envs = JSON.parse(match[1])
  return {
    PUBLIC_ADMIN_URL: normalizeRuntimeUrl(envs.PUBLIC_ADMIN_URL, worldUrl),
    PUBLIC_API_URL: normalizeRuntimeUrl(envs.PUBLIC_API_URL, worldUrl),
    PUBLIC_AUTH_URL: envs.PUBLIC_AUTH_URL || null,
    PUBLIC_MAX_UPLOAD_SIZE: envs.PUBLIC_MAX_UPLOAD_SIZE || null,
    PUBLIC_PRIVY_APP_ID: envs.PUBLIC_PRIVY_APP_ID || null,
    PUBLIC_WORLD_MAX_PLAYERS: envs.PUBLIC_WORLD_MAX_PLAYERS || null,
    PUBLIC_WS_URL: normalizeRuntimeUrl(envs.PUBLIC_WS_URL, worldUrl),
  }
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

function buildManagedBinding({ worldId, runtimeInstanceId, worldUrl }) {
  return {
    bootstrapId: `${worldId}:${runtimeInstanceId}`,
    world: {
      id: worldId,
      slug: 'managed-world',
      dbSchema: 'world_managed_world',
      publicMaxUploadSize: 18,
      publicWorldMaxPlayers: 32,
      shutdownIdleSeconds: 0,
    },
    runtime: {
      instanceId: runtimeInstanceId,
      publicApiUrl: `${worldUrl}/api`,
    },
    auth: {
      publicAuthUrl: 'https://auth.example.com/api/identity',
      publicPrivyAppId: 'privy-managed-app',
    },
    control: {
      internalBaseUrl: 'https://world-service.internal/api',
    },
  }
}

async function startBootstrapStub({ payload, requests }) {
  const server = http.createServer((req, res) => {
    requests.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization || null,
    })

    if (req.method === 'GET' && req.url === '/api/internal/runtime/bootstrap') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(payload))
      return
    }

    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not_found' }))
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    url: `http://127.0.0.1:${port}/api/internal/runtime/bootstrap`,
    async stop() {
      await new Promise(resolve => server.close(resolve))
    },
  }
}

test('pull and push managed bootstrap expose the same bound runtime config', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const runtimeInstanceId = 'runtime-managed-parity'
  const worldId = 'world-managed-parity'
  const jwtSecret = 'runtime-managed-secret'

  const pullPort = await getAvailablePort()
  const pullWorldUrl = `http://127.0.0.1:${pullPort}`
  const pullRequests = []
  const pullBinding = buildManagedBinding({
    worldId,
    runtimeInstanceId,
    worldUrl: pullWorldUrl,
  })
  const bootstrapStub = await startBootstrapStub({
    payload: pullBinding,
    requests: pullRequests,
  })
  t.after(async () => {
    await bootstrapStub.stop()
  })

  const pullServer = await startPullRuntimeServer({
    env: {
      PORT: String(pullPort),
      JWT_SECRET: jwtSecret,
      RUNTIME_BOOTSTRAP_INSTANCE_ID: runtimeInstanceId,
      RUNTIME_BOOTSTRAP_URL: bootstrapStub.url,
      WORLD_ID: worldId,
    },
  })
  t.after(async () => {
    await pullServer.stop()
  })

  const pushPort = await getAvailablePort()
  const pushWorldUrl = `http://127.0.0.1:${pushPort}`
  const pushBinding = buildManagedBinding({
    worldId,
    runtimeInstanceId,
    worldUrl: pushWorldUrl,
  })
  const pushServer = await startStandbyRuntimeServer({
    env: {
      PORT: String(pushPort),
      JWT_SECRET: jwtSecret,
      RUNTIME_BOOTSTRAP_INSTANCE_ID: runtimeInstanceId,
      RUNTIME_BOOTSTRAP_MODE: 'push',
    },
  })
  t.after(async () => {
    await pushServer.stop()
  })

  const pushBootstrapRes = await fetch(`${pushServer.worldUrl}/internal/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: buildRuntimeBootstrapAuthorization(runtimeInstanceId, jwtSecret),
    },
    body: JSON.stringify(pushBinding),
  })
  assert.equal(pushBootstrapRes.status, 200)

  const [pullStatusRes, pushStatusRes] = await Promise.all([
    fetch(`${pullServer.worldUrl}/internal/bootstrap/status`),
    fetch(`${pushServer.worldUrl}/internal/bootstrap/status`),
  ])
  const [pullStatus, pushStatus] = await Promise.all([
    pullStatusRes.json(),
    pushStatusRes.json(),
  ])

  assert.equal(pullStatusRes.status, 200)
  assert.equal(pushStatusRes.status, 200)
  assert.deepEqual(
    normalizeBootstrapStatus(pullStatus, pullServer.worldUrl),
    normalizeBootstrapStatus(pushStatus, pushServer.worldUrl)
  )

  const [pullEnv, pushEnv] = await Promise.all([
    readManagedPublicEnv(pullServer.worldUrl),
    readManagedPublicEnv(pushServer.worldUrl),
  ])
  assert.deepEqual(pullEnv, pushEnv)

  assert.deepEqual(pullRequests, [
    {
      method: 'GET',
      url: '/api/internal/runtime/bootstrap',
      authorization: buildRuntimeControlAuthorization({
        worldId,
        jwtSecret,
      }),
    },
  ])
})
