import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyHostedRuntimeBootstrapPayload,
  buildRuntimeBootstrapAuthorization,
  buildRuntimeBootstrapId,
  clearBootstrapRuntimeBindingEnv,
  derivePublicWsUrlFromApiUrl,
  deriveRuntimeBootstrapAuthToken,
  derivePublicAdminUrl,
  parseRuntimeBootstrapPayload,
  resolveControlInternalBaseUrl,
  resolveControlInternalUrl,
  resolveRuntimeWorldDir,
  usesHostedRuntimeBootstrap,
  verifyRuntimeBootstrapAuthorization,
} from '../../src/server/runtimeBootstrap.js'

test('applyHostedRuntimeBootstrapPayload backfills hosted runtime world binding', () => {
  const env = {
    RUNTIME_BOOTSTRAP: '1',
    JWT_SECRET: 'secret',
    WORLD_ID: 'world-1',
  }

  const applied = applyHostedRuntimeBootstrapPayload(env, {
    bootstrapId: 'world-1:lobby-world-abc',
    world: {
      id: 'world-1',
      slug: 'demo-world',
      dbSchema: 'world_world_1',
      publicMaxUploadSize: 3,
      publicWorldMaxPlayers: 0,
      shutdownIdleSeconds: 120,
    },
    runtime: {
      instanceId: 'lobby-world-abc',
      publicApiUrl: 'https://gs.example.com:7000/api',
      publicWsUrl: 'wss://gs.example.com:7000/ws',
      publicAdminUrl: 'https://gs.example.com:7000/admin',
    },
    auth: {
      publicAuthUrl: 'https://dev.lobby.ws/api/identity',
      publicPrivyAppId: 'privy-app-id',
    },
    control: {
      internalBaseUrl: 'https://world-service.lobby.svc.cluster.local/api',
    },
  })

  assert.deepEqual(applied, [
    'WORLD_ID',
    'WORLD',
    'DB_SCHEMA',
    'PUBLIC_MAX_UPLOAD_SIZE',
    'PUBLIC_WORLD_MAX_PLAYERS',
    'SHUTDOWN_IDLE',
    'PUBLIC_API_URL',
    'PUBLIC_WS_URL',
    'PUBLIC_ADMIN_URL',
    'PUBLIC_AUTH_URL',
    'PUBLIC_PRIVY_APP_ID',
    'CONTROL_INTERNAL_BASE_URL',
  ])
  assert.equal(env.WORLD, '.runtime-worlds/demo-world')
  assert.equal(env.DB_SCHEMA, 'world_world_1')
  assert.equal(env.PUBLIC_MAX_UPLOAD_SIZE, '3')
  assert.equal(env.PUBLIC_WORLD_MAX_PLAYERS, '0')
  assert.equal(env.SHUTDOWN_IDLE, '120')
  assert.equal(env.PUBLIC_ADMIN_URL, 'https://gs.example.com:7000/admin')
  assert.equal(env.PUBLIC_API_URL, 'https://gs.example.com:7000/api')
  assert.equal(env.PUBLIC_WS_URL, 'wss://gs.example.com:7000/ws')
  assert.equal(env.PUBLIC_PRIVY_APP_ID, 'privy-app-id')
  assert.equal(env.CONTROL_INTERNAL_BASE_URL, 'https://world-service.lobby.svc.cluster.local/api')
})

test('usesHostedRuntimeBootstrap recognizes explicit bootstrap runtimes and startup inference', () => {
  assert.equal(usesHostedRuntimeBootstrap({ RUNTIME_BOOTSTRAP: '1', WORLD_ID: 'world-1' }), true)
  assert.equal(usesHostedRuntimeBootstrap({ RUNTIME_BOOTSTRAP_INSTANCE_ID: 'runtime-1' }), true)
  assert.equal(usesHostedRuntimeBootstrap({ WORLD_ID: 'local-world' }), false)
  assert.equal(
    usesHostedRuntimeBootstrap({
      WORLD_ID: 'local-world',
      RUNTIME_BOOTSTRAP_INSTANCE_ID: 'runtime-1',
    }),
    false
  )
})

test('clearBootstrapRuntimeBindingEnv removes world-bound config before standby bootstrap', () => {
  const env = {
    WORLD_ID: 'world-1',
    WORLD: '.runtime-worlds/world-1',
    DB_SCHEMA: 'world_world_1',
    PUBLIC_API_URL: 'https://runtime.example.com/api',
    PUBLIC_WS_URL: 'wss://runtime.example.com/ws',
    PUBLIC_ADMIN_URL: 'https://runtime.example.com/admin',
    PUBLIC_AUTH_URL: 'https://auth.example.com/api/identity',
    PUBLIC_PRIVY_APP_ID: 'privy-app-id',
    PUBLIC_MAX_UPLOAD_SIZE: '12',
    PUBLIC_WORLD_MAX_PLAYERS: '24',
    CONTROL_INTERNAL_BASE_URL: 'https://world-service.internal/api',
    SHUTDOWN_IDLE: '90',
    JWT_SECRET: 'secret',
  }

  clearBootstrapRuntimeBindingEnv(env)

  assert.deepEqual(env, {
    JWT_SECRET: 'secret',
  })
})

test('applyHostedRuntimeBootstrapPayload respects an explicit WORLD path and derives public urls from api url', () => {
  const env = {
    WORLD: '/tmp/custom-world',
  }

  const applied = applyHostedRuntimeBootstrapPayload(env, {
    world: {
      id: 'world-2',
      slug: 'demo-two',
      dbSchema: 'world_world_2',
      publicMaxUploadSize: 12,
      publicWorldMaxPlayers: 25,
      shutdownIdleSeconds: 0,
    },
    runtime: {
      instanceId: 'lobby-world-def',
      publicApiUrl: 'https://gs.example.com:9443/api',
      publicWsUrl: null,
    },
    auth: {},
    control: {
      internalBaseUrl: 'https://dev.lobby.ws/api',
    },
  })

  assert.ok(!applied.includes('WORLD'))
  assert.equal(env.WORLD, '/tmp/custom-world')
  assert.equal(env.PUBLIC_ADMIN_URL, 'https://gs.example.com:9443/admin')
  assert.equal(env.PUBLIC_WS_URL, 'wss://gs.example.com:9443/ws')
})

test('resolveRuntimeWorldDir falls back to a hosted runtime scratch directory', () => {
  const worldDir = resolveRuntimeWorldDir(
    {
      WORLD_ID: 'world-3',
    },
    '/srv/runtime'
  )

  assert.equal(worldDir, '/srv/runtime/.runtime-worlds/world-3')
  assert.equal(derivePublicWsUrlFromApiUrl('https://dev.lobby.ws/api'), 'wss://dev.lobby.ws/ws')
})

test('parseRuntimeBootstrapPayload normalizes the frozen binding shape', () => {
  const parsed = parseRuntimeBootstrapPayload({
    world: {
      id: 'world-4',
      slug: 'demo-four',
      dbSchema: 'world_world_4',
      publicMaxUploadSize: 6,
      publicWorldMaxPlayers: 10,
      shutdownIdleSeconds: 30,
    },
    runtime: {
      instanceId: 'lobby-world-ghi',
      publicApiUrl: 'https://gs.example.com:7443/api/',
      publicWsUrl: '',
    },
    auth: {
      publicAuthUrl: 'https://dev.lobby.ws/api/identity/',
    },
    control: {
      internalBaseUrl: 'https://world-service.lobby.svc.cluster.local/api/',
    },
  })

  assert.equal(parsed.bootstrapId, 'world-4:lobby-world-ghi')
  assert.equal(parsed.runtime.publicApiUrl, 'https://gs.example.com:7443/api')
  assert.equal(parsed.runtime.publicWsUrl, 'wss://gs.example.com:7443/ws')
  assert.equal(parsed.runtime.publicAdminUrl, 'https://gs.example.com:7443/admin')
  assert.equal(parsed.auth.publicAuthUrl, 'https://dev.lobby.ws/api/identity')
  assert.equal(parsed.control.internalBaseUrl, 'https://world-service.lobby.svc.cluster.local/api')
})

test('derivePublicAdminUrl prefers api urls and falls back to websocket urls', () => {
  assert.equal(
    derivePublicAdminUrl({
      publicApiUrl: 'https://runtime.example.com/api',
      publicWsUrl: 'wss://runtime.example.com/ws',
    }),
    'https://runtime.example.com/admin'
  )
  assert.equal(
    derivePublicAdminUrl({
      publicWsUrl: 'wss://runtime.example.com/ws',
    }),
    'https://runtime.example.com/admin'
  )
})

test('resolveControlInternalBaseUrl prefers explicit control url and falls back to legacy auth url', () => {
  assert.equal(
    resolveControlInternalBaseUrl({
      CONTROL_INTERNAL_BASE_URL: 'https://world-service.lobby.svc.cluster.local/api/',
      PUBLIC_AUTH_URL: 'https://dev.lobby.ws/api/identity',
    }),
    'https://world-service.lobby.svc.cluster.local/api'
  )
  assert.equal(
    resolveControlInternalBaseUrl({
      PUBLIC_AUTH_URL: 'https://dev.lobby.ws/api/identity',
    }),
    'https://dev.lobby.ws/api'
  )
  assert.equal(
    resolveControlInternalUrl('/internal/users/user-1', {
      CONTROL_INTERNAL_BASE_URL: 'https://world-service.lobby.svc.cluster.local/api',
    }),
    'https://world-service.lobby.svc.cluster.local/api/internal/users/user-1'
  )
})

test('verifyRuntimeBootstrapAuthorization uses the runtime instance hmac contract', () => {
  const env = {
    RUNTIME_BOOTSTRAP_INSTANCE_ID: 'lobby-world-abc',
    JWT_SECRET: 'shared-secret',
  }
  const token = deriveRuntimeBootstrapAuthToken('lobby-world-abc', 'shared-secret')

  assert.equal(token, deriveRuntimeBootstrapAuthToken('lobby-world-abc', 'shared-secret'))
  assert.equal(buildRuntimeBootstrapAuthorization('lobby-world-abc', 'shared-secret'), `Bearer ${token}`)
  assert.equal(buildRuntimeBootstrapId({ worldId: 'world-1', runtimeInstanceId: 'lobby-world-abc' }), 'world-1:lobby-world-abc')
  assert.equal(verifyRuntimeBootstrapAuthorization(`Bearer ${token}`, env), true)
  assert.equal(verifyRuntimeBootstrapAuthorization('Bearer bad-token', env), false)
})
