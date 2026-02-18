import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { test } from 'node:test'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { runAppCommand } from '../../app-server/commands.js'
import { readPacket, writePacket } from '../../src/core/packets.js'
import { createTempDir } from './helpers.js'

async function canListenOnLoopback() {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

function makeSnapshot(worldId) {
  return {
    worldId,
    assetsUrl: 'http://127.0.0.1/assets',
    maxUploadSize: '12',
    settings: {},
    spawn: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
    blueprints: [],
    entities: [],
    players: [],
    hasAdminCode: false,
    adminUrl: null,
  }
}

test('app deploy dry-run works via pretty world URL admin proxy', async t => {
  if (!(await canListenOnLoopback())) {
    t.skip('loopback sockets are unavailable in this environment')
    return
  }

  const worldId = `pretty-${Date.now()}`
  const slug = 'pretty-world'
  const app = Fastify({ logger: false })
  await app.register(websocket)

  const requestCounts = {
    snapshot: 0,
    changes: 0,
    wsAuth: 0,
  }

  app.get('/worlds/:slug/admin/snapshot', async (request, reply) => {
    if ((request.params || {}).slug !== slug) {
      return reply.code(404).send({ error: 'not_found' })
    }
    requestCounts.snapshot += 1
    return makeSnapshot(worldId)
  })

  app.get('/worlds/:slug/admin/changes', async () => {
    requestCounts.changes += 1
    return {
      cursor: 0,
      headCursor: 0,
      operations: [],
      hasMore: false,
    }
  })

  app.get('/worlds/:slug/admin', { websocket: true }, (socket) => {
    socket.on('message', raw => {
      const [method, data] = readPacket(raw)
      if (method === 'adminAuth') {
        requestCounts.wsAuth += 1
        socket.send(writePacket('adminAuthOk', { ok: true, capabilities: { builder: true, deploy: true } }))
        return
      }
      if (method === 'adminCommand') {
        socket.send(writePacket('adminResult', { ok: true, requestId: data?.requestId }))
      }
    })
  })

  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const worldUrl = `http://127.0.0.1:${port}/worlds/${slug}`

  const rootDir = await createTempDir('hyperfy-pretty-url-')
  const appDir = path.join(rootDir, 'apps', 'PrettyApp')
  await fs.mkdir(appDir, { recursive: true })
  await fs.writeFile(
    path.join(appDir, 'PrettyApp.json'),
    JSON.stringify(
      {
        id: 'PrettyApp',
        scope: 'pretty-scope',
        name: 'Pretty App',
        props: {},
      },
      null,
      2
    ) + '\n',
    'utf8'
  )
  await fs.writeFile(
    path.join(appDir, 'index.js'),
    'export default (world, app) => { app.state.ready = true }\n',
    'utf8'
  )
  await fs.writeFile(
    path.join(rootDir, 'world.json'),
    JSON.stringify(
      {
        formatVersion: 2,
        settings: {},
        spawn: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
        blueprints: [],
        entities: [],
      },
      null,
      2
    ) + '\n',
    'utf8'
  )

  const savedEnv = {
    WORLD_URL: process.env.WORLD_URL,
    WORLD_ID: process.env.WORLD_ID,
    ADMIN_CODE: process.env.ADMIN_CODE,
  }

  process.env.WORLD_URL = worldUrl
  process.env.WORLD_ID = worldId
  process.env.ADMIN_CODE = ''

  try {
    const exitCode = await runAppCommand({
      command: 'deploy',
      args: ['PrettyApp', '--dry-run'],
      rootDir,
    })
    assert.equal(exitCode, 0)
    assert.ok(requestCounts.snapshot >= 1)
    assert.ok(requestCounts.wsAuth >= 1)
  } finally {
    process.env.WORLD_URL = savedEnv.WORLD_URL
    process.env.WORLD_ID = savedEnv.WORLD_ID
    process.env.ADMIN_CODE = savedEnv.ADMIN_CODE
    await app.close()
  }
})
