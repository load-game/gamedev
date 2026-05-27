import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'

import { resolveAuthRuntimeConfig } from '@gamedev/server/authModes.js'

test('standalone runtimes use local identity and local rank', () => {
  assert.deepEqual(resolveAuthRuntimeConfig({}), {
    usesExternalIdentity: false,
    usesLobbyIdentity: false,
    usesLocalIdentity: true,
    usesControlPlaneRank: false,
    usesRuntimeLocalRank: true,
  })
})

test('self-hosted runtimes can use external identity without runtime-control rank sync', () => {
  assert.deepEqual(
    resolveAuthRuntimeConfig({
      RUNTIME_AUTH_PROVIDER: 'external',
      RUNTIME_AUTH_URL: 'https://auth.example.test/api/identity',
      WORLD_ID: 'self-hosted-world',
    }),
    {
      usesExternalIdentity: true,
      usesLobbyIdentity: true,
      usesLocalIdentity: false,
      usesControlPlaneRank: false,
      usesRuntimeLocalRank: true,
    }
  )
})

test('bootstrapped runtimes use runtime-control rank sync', () => {
  assert.deepEqual(
    resolveAuthRuntimeConfig({
      RUNTIME_AUTH_URL: 'https://auth.example.test/api/identity',
      RUNTIME_BOOTSTRAP: '1',
    }),
    {
      usesExternalIdentity: true,
      usesLobbyIdentity: true,
      usesLocalIdentity: false,
      usesControlPlaneRank: true,
      usesRuntimeLocalRank: false,
    }
  )
})
