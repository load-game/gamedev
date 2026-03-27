import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildProjectAuthKey,
  readProjectAuthEntry,
  removeProjectAuthEntry,
  writeProjectAuthEntry,
} from '../../app-server/projectAuth.js'
import { createTempDir } from './helpers.js'

test('project auth store persists per-world bearer tokens', async t => {
  const rootDir = await createTempDir('hyperfy-project-auth-')
  t.after(async () => {
    // temp dir cleanup is handled by OS in these integration tests
  })

  const entry = writeProjectAuthEntry(rootDir, {
    worldUrl: 'https://dev.lobby.ws/worlds/demo/admin/',
    worldId: 'world-demo',
    authToken: 'token-123',
    userId: 'user-1',
    userName: 'Builder',
  })

  assert.deepEqual(entry, {
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    worldId: 'world-demo',
    authToken: 'token-123',
    userId: 'user-1',
    userName: 'Builder',
    updatedAt: entry.updatedAt,
  })

  const key = buildProjectAuthKey({
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    worldId: 'world-demo',
  })
  assert.equal(key, 'world-demo::https://dev.lobby.ws/worlds/demo')

  const loaded = readProjectAuthEntry(rootDir, {
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    worldId: 'world-demo',
  })
  assert.deepEqual(loaded, {
    key,
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    worldId: 'world-demo',
    authToken: 'token-123',
    userId: 'user-1',
    userName: 'Builder',
    updatedAt: entry.updatedAt,
  })

  const removed = removeProjectAuthEntry(rootDir, {
    worldUrl: 'https://dev.lobby.ws/worlds/demo',
    worldId: 'world-demo',
  })
  assert.equal(removed, true)
  assert.equal(
    readProjectAuthEntry(rootDir, {
      worldUrl: 'https://dev.lobby.ws/worlds/demo',
      worldId: 'world-demo',
    }),
    null
  )
})
