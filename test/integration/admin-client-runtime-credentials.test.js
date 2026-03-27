import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writePacket } from '../../src/core/packets.js'
import { AdminClient, ADMIN_SHUTDOWN_COMMAND, RUNTIME_CREDENTIAL_COMMAND } from '../../src/core/systems/AdminClient.js'

function createAdminClient() {
  return new AdminClient({
    emit() {},
    network: { id: 'network-test' },
  })
}

test('runtime credentials API uses runtime_credentials_get command', async () => {
  const client = createAdminClient()
  let payload = null
  client.request = async requestPayload => {
    payload = requestPayload
    return {
      credentials: {
        worldId: 'world-123',
        hasAdminCode: true,
        adminCode: null,
      },
    }
  }

  const credentials = await client.getRuntimeCredentials()

  assert.deepEqual(payload, { type: RUNTIME_CREDENTIAL_COMMAND })
  assert.deepEqual(credentials, {
    worldId: 'world-123',
    hasAdminCode: true,
    adminCode: null,
  })
})

test('runtime credentials API caches response in memory', async () => {
  const client = createAdminClient()
  let calls = 0
  client.request = async () => {
    calls += 1
    return {
      credentials: {
        worldId: 'world-123',
        hasAdminCode: true,
        adminCode: null,
      },
    }
  }

  const first = await client.getRuntimeCredentials()
  const second = await client.getRuntimeCredentials()

  assert.equal(calls, 1)
  assert.strictEqual(first, second)
})

test('runtime credentials API force refresh bypasses cache', async () => {
  const client = createAdminClient()
  let calls = 0
  client.request = async () => {
    calls += 1
    return {
      credentials: {
        worldId: `world-${calls}`,
        hasAdminCode: true,
        adminCode: null,
      },
    }
  }

  const first = await client.getRuntimeCredentials()
  const second = await client.getRuntimeCredentials({ forceRefresh: true })

  assert.equal(calls, 2)
  assert.deepEqual(first, {
    worldId: 'world-1',
    hasAdminCode: true,
    adminCode: null,
  })
  assert.deepEqual(second, {
    worldId: 'world-2',
    hasAdminCode: true,
    adminCode: null,
  })
})

test('runtime credential cache clears on disconnect and auth error', () => {
  const client = createAdminClient()
  client.runtimeCredentials = {
    worldId: 'world-123',
    hasAdminCode: true,
    adminCode: null,
  }

  client.disconnect()
  assert.equal(client.runtimeCredentials, null)

  client.runtimeCredentials = {
    worldId: 'world-123',
    hasAdminCode: true,
    adminCode: null,
  }
  client.onMessage({
    data: writePacket('adminAuthError', { error: 'invalid_code' }),
  })
  assert.equal(client.runtimeCredentials, null)
})

test('runtime credentials API rejects invalid payloads', async () => {
  const client = createAdminClient()
  client.request = async () => ({ ok: true })
  await assert.rejects(() => client.getRuntimeCredentials(), err => err?.code === 'invalid_response')
})

test('admin shutdown API uses agones_shutdown command', async () => {
  const client = createAdminClient()
  let payload = null
  client.request = async requestPayload => {
    payload = requestPayload
    return { ok: true }
  }

  const response = await client.requestAgonesShutdown()

  assert.deepEqual(payload, { type: ADMIN_SHUTDOWN_COMMAND })
  assert.deepEqual(response, { ok: true })
})
