import assert from 'node:assert/strict'
import path from 'path'
import { test } from 'node:test'
import Knex from 'knex'
import jwt from 'jsonwebtoken'
import { Ranks } from '../../src/core/extras/ranks.js'
import { AdminWsClient, fetchJson, startWorldServer } from './helpers.js'

async function createRuntimeAdminToken(world, { userId = 'hosted-admin', rank = Ranks.ADMIN } = {}) {
  const db = Knex({
    client: 'better-sqlite3',
    connection: {
      filename: path.join(world.worldDir, 'db.sqlite'),
    },
    useNullAsDefault: true,
  })
  try {
    const createdAt = new Date().toISOString()
    await db('users')
      .insert({
        id: userId,
        name: 'Hosted Admin',
        createdAt,
        rank,
      })
      .onConflict('id')
      .merge()
  } finally {
    await db.destroy()
  }

  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      typ: 'runtime_session',
      iss: world.worldUrl,
      aud: 'runtime:ws',
      userId,
      worldId: world.worldId,
      iat: now,
      exp: now + 60 * 60,
    },
    world.jwtSecret
  )
}

test('hosted runtimes ignore ADMIN_CODE for HTTP admin auth and accept runtime session tokens', async () => {
  const world = await startWorldServer({
    adminCode: 'secret-code',
    env: {
      PUBLIC_AUTH_URL: 'https://auth.example.com/api/identity',
    },
  })
  try {
    const denied = await fetchJson(`${world.worldUrl}/admin/snapshot`, {
      adminCode: 'secret-code',
    })
    assert.equal(denied.res.status, 403)
    assert.deepEqual(denied.data, { error: 'admin_required' })

    const authToken = await createRuntimeAdminToken(world)
    const authed = await fetchJson(`${world.worldUrl}/admin/snapshot`, {
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    })
    assert.equal(authed.res.status, 200)
    assert.equal(authed.data?.auth?.admin?.kind, 'player_token')
  } finally {
    await world.stop()
  }
})

test('hosted runtimes ignore ADMIN_CODE for WebSocket admin auth and accept runtime session tokens', async () => {
  const world = await startWorldServer({
    adminCode: 'secret-code',
    env: {
      PUBLIC_AUTH_URL: 'https://auth.example.com/api/identity',
    },
  })
  try {
    await assert.rejects(
      async () => {
        const denied = new AdminWsClient({
          worldUrl: world.worldUrl,
          adminCode: 'secret-code',
        })
        try {
          await denied.connect()
        } finally {
          denied.close()
        }
      },
      err => err?.code === 'unauthorized'
    )

    const authToken = await createRuntimeAdminToken(world)
    const client = new AdminWsClient({
      worldUrl: world.worldUrl,
      authToken,
    })
    try {
      await client.connect()
    } finally {
      client.close()
    }
  } finally {
    await world.stop()
  }
})
