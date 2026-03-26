import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Ranks } from '../../src/core/extras/ranks.js'
import { Settings } from '../../src/core/systems/Settings.js'
import { AdminClient } from '../../src/core/systems/AdminClient.js'

function createAdminClient() {
  return new AdminClient({
    emit() {},
    network: { id: 'network-test' },
  })
}

test('settings only grant implicit admin rank for explicit standalone open access', () => {
  const settings = new Settings({})
  settings.rank = Ranks.VISITOR

  settings.setAuthMetadata({
    usesLobbyIdentity: true,
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  })
  assert.equal(settings.adminAuthKind, 'player_token')
  assert.equal(settings.effectiveRank, Ranks.VISITOR)

  settings.setAuthMetadata({
    usesLocalIdentity: true,
    admin: {
      kind: 'admin_code',
      codeConfigured: false,
      openAccess: true,
    },
  })
  assert.equal(settings.adminAuthKind, 'admin_code')
  assert.equal(settings.adminOpenAccess, true)
  assert.equal(settings.effectiveRank, Ranks.ADMIN)
})

test('admin client requires a player session when auth metadata says player_token', async () => {
  const client = createAdminClient()
  client.adminUrl = 'https://runtime.example.com'
  client.setAuthMetadata({
    usesLobbyIdentity: true,
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  })
  client.refreshAuthToken = () => null

  await assert.rejects(() => client.request({ type: 'noop' }), err => err?.code === 'player_session_missing')
})
