import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveAuthRuntimeConfig } from '../../src/server/authModes.js'

test('standalone runtimes use local identity and local rank', () => {
  assert.deepEqual(resolveAuthRuntimeConfig({}), {
    usesLobbyIdentity: false,
    usesLocalIdentity: true,
    usesControlPlaneRank: false,
    usesRuntimeLocalRank: true,
  })
})

test('self-hosted runtimes can use lobby identity without control-plane rank sync', () => {
  assert.deepEqual(
    resolveAuthRuntimeConfig({
      PUBLIC_AUTH_URL: 'https://dev.lobby.ws/api/identity',
      WORLD_ID: 'self-hosted-world',
    }),
    {
      usesLobbyIdentity: true,
      usesLocalIdentity: false,
      usesControlPlaneRank: false,
      usesRuntimeLocalRank: true,
    }
  )
})

test('bootstrapped runtimes use control-plane rank sync', () => {
  assert.deepEqual(
    resolveAuthRuntimeConfig({
      PUBLIC_AUTH_URL: 'https://dev.lobby.ws/api/identity',
      RUNTIME_BOOTSTRAP: '1',
    }),
    {
      usesLobbyIdentity: true,
      usesLocalIdentity: false,
      usesControlPlaneRank: true,
      usesRuntimeLocalRank: false,
    }
  )
})
