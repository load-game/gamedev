import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ADMIN_SHUTDOWN_COMMAND,
  handleAdminShutdownCommand,
  resolveAgonesShutdownUrl,
} from '../../src/server/adminShutdown.js'

test('command contract uses agones_shutdown name', () => {
  assert.equal(ADMIN_SHUTDOWN_COMMAND, 'agones_shutdown')
})

test('resolveAgonesShutdownUrl uses the default and configured Agones SDK ports', () => {
  assert.equal(resolveAgonesShutdownUrl({}), 'http://127.0.0.1:9358/shutdown')
  assert.equal(resolveAgonesShutdownUrl({ AGONES_SDK_HTTP_PORT: '1234' }), 'http://127.0.0.1:1234/shutdown')
})

test('admin shutdown command denies callers without deploy capability', async () => {
  const result = await handleAdminShutdownCommand({
    canDeploy: false,
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'admin_required',
    reason: 'deploy_capability_required',
  })
})

test('admin shutdown command saves before requesting Agones shutdown', async () => {
  const events = []

  const result = await handleAdminShutdownCommand({
    canDeploy: true,
    agones: {
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

test('admin shutdown command does not request Agones shutdown when saving fails', async () => {
  let requested = false

  const result = await handleAdminShutdownCommand({
    canDeploy: true,
    agones: {
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

test('admin shutdown command surfaces Agones shutdown request failures', async () => {
  const result = await handleAdminShutdownCommand({
    canDeploy: true,
    agones: {
      shutdown: async () => {
        throw new Error('agones_sdk_status_503')
      },
    },
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'shutdown_request_failed',
    reason: 'agones_sdk_status_503',
  })
})

test('admin shutdown command reports shutdown unavailable when Agones is disabled', async () => {
  const result = await handleAdminShutdownCommand({
    canDeploy: true,
    agones: null,
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'shutdown_unavailable',
    reason: 'missing_shutdown_transport',
  })
})
