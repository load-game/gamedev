import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveInitialAdminAuthFromEnv } from '../../src/client/adminAuth.js'
import { AdminClient } from '../../src/core/systems/AdminClient.js'

function createAdminClient() {
  return new AdminClient({
    emit() {},
    network: { id: 'network-test' },
  })
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
