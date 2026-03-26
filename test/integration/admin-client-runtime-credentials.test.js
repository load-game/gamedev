import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writePacket } from '../../src/core/packets.js'
import {
  AdminClient,
  ADMIN_SHUTDOWN_COMMAND,
  RUNTIME_CREDENTIAL_COMMAND,
  buildSdkSetupData,
} from '../../src/core/systems/AdminClient.js'

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
        adminAuthKind: 'admin_code',
        hasAdminCode: true,
        adminCode: 'secret-code',
      },
    }
  }

  const credentials = await client.getRuntimeCredentials()

  assert.deepEqual(payload, { type: RUNTIME_CREDENTIAL_COMMAND })
  assert.deepEqual(credentials, {
    worldId: 'world-123',
    adminAuthKind: 'admin_code',
    hasAdminCode: true,
    adminCode: 'secret-code',
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
        adminAuthKind: 'admin_code',
        hasAdminCode: true,
        adminCode: 'secret-code',
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
        adminAuthKind: 'admin_code',
        hasAdminCode: true,
        adminCode: `code-${calls}`,
      },
    }
  }

  const first = await client.getRuntimeCredentials()
  const second = await client.getRuntimeCredentials({ forceRefresh: true })

  assert.equal(calls, 2)
  assert.deepEqual(first, {
    worldId: 'world-1',
    adminAuthKind: 'admin_code',
    hasAdminCode: true,
    adminCode: 'code-1',
  })
  assert.deepEqual(second, {
    worldId: 'world-2',
    adminAuthKind: 'admin_code',
    hasAdminCode: true,
    adminCode: 'code-2',
  })
})

test('runtime credential cache clears on disconnect and auth error', () => {
  const client = createAdminClient()
  client.runtimeCredentials = {
    worldId: 'world-123',
    adminAuthKind: 'admin_code',
    hasAdminCode: true,
    adminCode: 'secret',
  }

  client.disconnect()
  assert.equal(client.runtimeCredentials, null)

  client.runtimeCredentials = {
    worldId: 'world-123',
    adminAuthKind: 'admin_code',
    hasAdminCode: true,
    adminCode: 'secret',
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

test('buildSdkSetupData returns token-backed hosted setup output', () => {
  const setupData = buildSdkSetupData({
    credentials: {
      worldId: 'world-123',
      adminAuthKind: 'player_token',
      adminCode: null,
    },
    authToken: 'session-token',
  })

  assert.deepEqual(setupData, {
    worldId: 'world-123',
    adminAuthKind: 'player_token',
    worldAuthToken: 'session-token',
    adminCode: null,
  })
})

test('getSdkSetupData returns WORLD_AUTH_TOKEN for hosted runtimes', async () => {
  const client = createAdminClient()
  client.setAuthMetadata({
    usesLobbyIdentity: true,
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  })
  client.refreshAuthToken = () => 'session-token'
  client.request = async () => ({
    credentials: {
      worldId: 'world-123',
      adminAuthKind: 'player_token',
      hasAdminCode: false,
      adminCode: null,
    },
  })

  const setupData = await client.getSdkSetupData()

  assert.deepEqual(setupData, {
    worldId: 'world-123',
    adminAuthKind: 'player_token',
    adminCode: null,
    worldAuthToken: 'session-token',
  })
})

test('getSdkSetupData keeps ADMIN_CODE for standalone runtimes', async () => {
  const client = createAdminClient()
  client.setAuthMetadata({
    usesLobbyIdentity: false,
    usesLocalIdentity: true,
    admin: {
      kind: 'admin_code',
      codeConfigured: true,
      openAccess: false,
    },
  })
  client.request = async () => ({
    credentials: {
      worldId: 'world-123',
      adminAuthKind: 'admin_code',
      hasAdminCode: true,
      adminCode: 'secret-code',
    },
  })

  const setupData = await client.getSdkSetupData()

  assert.deepEqual(setupData, {
    worldId: 'world-123',
    adminAuthKind: 'admin_code',
    worldAuthToken: null,
    adminCode: 'secret-code',
  })
})

test('getSdkSetupData rejects hosted setup when the runtime session token is missing', async () => {
  const client = createAdminClient()
  client.setAuthMetadata({
    usesLobbyIdentity: true,
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  })
  client.refreshAuthToken = () => null
  client.request = async () => ({
    credentials: {
      worldId: 'world-123',
      adminAuthKind: 'player_token',
      hasAdminCode: false,
      adminCode: null,
    },
  })

  await assert.rejects(() => client.getSdkSetupData(), err => err?.code === 'player_session_missing')
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
