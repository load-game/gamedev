import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createAgonesIdleController, resolveAgonesIdleControllerEnabled } from '../../src/server/agonesIdleShutdown.js'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createSilentLogger() {
  return {
    info() {},
    warn() {},
  }
}

test('resolveAgonesIdleControllerEnabled only depends on SHUTDOWN_IDLE', () => {
  assert.equal(resolveAgonesIdleControllerEnabled({ SHUTDOWN_IDLE: 'true' }), true)
  assert.equal(
    resolveAgonesIdleControllerEnabled({
      SHUTDOWN_IDLE: 'true',
      PUBLIC_AUTH_URL: '',
    }),
    true
  )
  assert.equal(
    resolveAgonesIdleControllerEnabled({
      SHUTDOWN_IDLE: 'false',
      PUBLIC_AUTH_URL: 'https://lobby.example/identity',
    }),
    false
  )
})

test('agones idle controller requests shutdown once the world is idle', async () => {
  const requests = []
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 10,
    shutdownUrl: 'http://127.0.0.1:9358/shutdown',
    getActiveSessionCount: () => 0,
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        status: 200,
      }
    },
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  await sleep(40)

  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0], {
    url: 'http://127.0.0.1:9358/shutdown',
    options: { method: 'POST' },
  })
})

test('agones idle controller cancels a pending shutdown when sessions return', async () => {
  let activeSessions = 0
  const requests = []
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 25,
    shutdownUrl: 'http://127.0.0.1:9358/shutdown',
    getActiveSessionCount: () => activeSessions,
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        status: 200,
      }
    },
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  activeSessions = 1
  controller.reconcileIdleShutdown('player_joined')
  await sleep(60)

  assert.equal(requests.length, 0)
  controller.clearIdleShutdownTimer('test_cleanup')
})
