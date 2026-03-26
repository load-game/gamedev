import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveInitialAdminAuthFromEnv } from '../../src/client/adminAuth.js'
import { readPacket } from '../../src/core/packets.js'
import { storage } from '../../src/core/storage.js'
import { AdminClient } from '../../src/core/systems/AdminClient.js'
import { AdminNetwork } from '../../src/core/systems/AdminNetwork.js'

function createAdminClient() {
  return new AdminClient({
    emit() {},
    network: { id: 'network-test' },
  })
}

function createAdminNetwork() {
  return new AdminNetwork({
    emit() {},
    on() {},
    entities: {
      player: null,
      players: new Map(),
      remove() {},
    },
    settings: {
      deserialize() {},
      setAuthMetadata() {},
    },
    blueprints: {
      destroy() {},
    },
  })
}

async function withStoredCredentials(values, fn) {
  const savedAdminCode = storage.get('adminCode')
  const savedAuthToken = storage.get('authToken')
  storage.set('adminCode', values.adminCode ?? null)
  storage.set('authToken', values.authToken ?? null)
  try {
    await fn()
  } finally {
    storage.set('adminCode', savedAdminCode)
    storage.set('authToken', savedAuthToken)
  }
}

test('hosted root /admin initializes with player-token auth and no code prompt', () => {
  const auth = resolveInitialAdminAuthFromEnv({
    PUBLIC_AUTH_URL: 'https://auth.example.com/api/identity',
  })

  assert.deepEqual(auth, {
    usesLobbyIdentity: true,
    usesLocalIdentity: false,
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  })

  const client = createAdminClient()
  client.setAuthMetadata(auth)
  assert.equal(client.shouldShowAdminCodePrompt(), false)
  assert.equal(client.getCredentialHelpMessage(), 'Player session required. Sign in to this hosted world first.')
})

test('standalone root /admin keeps the admin-code prompt surface', () => {
  assert.equal(resolveInitialAdminAuthFromEnv({}), null)

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

  assert.equal(client.shouldShowAdminCodePrompt(), true)
  assert.equal(client.getCredentialHelpMessage(), 'Admin code required. Use /admin <code>.')
})

test('hosted admin client prefers stored runtime session tokens over admin codes', async () => {
  await withStoredCredentials({ adminCode: 'secret-code', authToken: 'session-token' }, async () => {
    const client = createAdminClient()
    client.setAuthMetadata({
      usesLobbyIdentity: true,
      usesLocalIdentity: false,
      admin: {
        kind: 'player_token',
        codeConfigured: false,
        openAccess: false,
      },
    })

    assert.equal(client.code, null)
    assert.deepEqual(client.getDeployHeaders(), {
      authorization: 'Bearer session-token',
    })

    let packet = null
    client.sendPacket = (name, payload) => {
      packet = { name, payload }
    }
    client.onOpen()
    assert.deepEqual(packet, {
      name: 'adminAuth',
      payload: {
        authToken: 'session-token',
        subscriptions: { snapshot: false, players: false, runtime: false },
        networkId: 'network-test',
      },
    })
  })
})

test('standalone admin clients keep the admin-code path even when auth tokens exist in storage', async () => {
  await withStoredCredentials({ adminCode: 'secret-code', authToken: 'session-token' }, async () => {
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

    assert.equal(client.code, 'secret-code')
    assert.deepEqual(client.getDeployHeaders(), {
      'X-Admin-Code': 'secret-code',
    })

    const network = createAdminNetwork()
    network.init({
      adminUrl: 'https://runtime.example.com',
      auth: {
        usesLobbyIdentity: false,
        usesLocalIdentity: true,
        admin: {
          kind: 'admin_code',
          codeConfigured: true,
          openAccess: false,
        },
      },
    })

    let sent = null
    network.ws = {
      send(data) {
        sent = readPacket(data)
      },
    }
    network.onOpen()

    assert.deepEqual(sent, [
      'onAdminAuth',
      {
        code: 'secret-code',
        subscriptions: { snapshot: true, players: false, runtime: false },
        networkId: network.id,
      },
    ])
  })
})
