import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'

import { ADMIN_SHUTDOWN_COMMAND, handleRuntimeShutdownCommand } from '@gamedev/hosting/adminShutdown.js'
import { resolveAgonesShutdownUrl } from '@gamedev/server/adminShutdown.js'

test('command contract uses generic runtime_shutdown name', () => {
  assert.equal(ADMIN_SHUTDOWN_COMMAND, 'runtime_shutdown')
})

test('resolveAgonesShutdownUrl uses the default and configured Agones SDK ports', () => {
  assert.equal(resolveAgonesShutdownUrl({}), 'http://127.0.0.1:9358/shutdown')
  assert.equal(resolveAgonesShutdownUrl({ AGONES_SDK_HTTP_PORT: '1234' }), 'http://127.0.0.1:1234/shutdown')
})

test('runtime shutdown command denies callers without deploy capability', async () => {
  const result = await handleRuntimeShutdownCommand({
    canDeploy: false,
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'admin_required',
    reason: 'deploy_capability_required',
  })
})

test('runtime shutdown command saves before requesting hosting shutdown', async () => {
  const events = []

  const result = await handleRuntimeShutdownCommand({
    canDeploy: true,
    hosting: {
      shutdown: async () => {
        events.push('shutdown')
      },
    },
    beforeShutdown: async () => {
      events.push('save')
    },
  })

  assert.deepEqual(events, ['save', 'shutdown'])
  assert.deepEqual(result, {
    ok: true,
    requested: true,
  })
})

test('runtime shutdown command does not request hosting shutdown when saving fails', async () => {
  let requested = false

  const result = await handleRuntimeShutdownCommand({
    canDeploy: true,
    hosting: {
      shutdown: async () => {
        requested = true
      },
    },
    beforeShutdown: async () => {
      throw new Error('save_failed')
    },
  })

  assert.equal(requested, false)
  assert.deepEqual(result, {
    ok: false,
    error: 'shutdown_save_failed',
    reason: 'before_shutdown_failed',
  })
})

test('runtime shutdown command surfaces hosting shutdown request failures', async () => {
  const result = await handleRuntimeShutdownCommand({
    canDeploy: true,
    hosting: {
      shutdown: async () => {
        throw new Error('hosting_status_503')
      },
    },
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'shutdown_request_failed',
    reason: 'hosting_status_503',
  })
})

test('runtime shutdown command reports shutdown unavailable when hosting is disabled', async () => {
  const result = await handleRuntimeShutdownCommand({
    canDeploy: true,
    hosting: null,
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'shutdown_unavailable',
    reason: 'missing_shutdown_transport',
  })
})
