import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createAgonesIdleController, resolveAgonesIdleShutdownTimeoutMs } from '../../src/server/agonesIdleShutdown.js'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createSilentLogger() {
  return {
    info() {},
    warn() {},
  }
}

test('resolveAgonesIdleShutdownTimeoutMs returns 0 when the env is missing, invalid, or non-positive', () => {
  assert.equal(resolveAgonesIdleShutdownTimeoutMs({}), 0)
  assert.equal(resolveAgonesIdleShutdownTimeoutMs({ SHUTDOWN_IDLE: '' }), 0)
  assert.equal(resolveAgonesIdleShutdownTimeoutMs({ SHUTDOWN_IDLE: '0' }), 0)
  assert.equal(resolveAgonesIdleShutdownTimeoutMs({ SHUTDOWN_IDLE: '-5' }), 0)
  assert.equal(resolveAgonesIdleShutdownTimeoutMs({ SHUTDOWN_IDLE: 'invalid' }), 0)
  assert.equal(resolveAgonesIdleShutdownTimeoutMs({ SHUTDOWN_IDLE: '15' }), 15000)
})

test('agones idle controller stays on when the timeout is disabled', async () => {
  const requests = []
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 0,
    agones: {
      shutdown: async () => {
        requests.push('shutdown')
      },
    },
    getActiveSessionCount: () => 0,
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  await sleep(25)

  assert.equal(requests.length, 0)
})

test('agones idle controller saves before requesting shutdown once the world is idle', async () => {
  const events = []
  const requests = []
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 10,
    agones: {
      shutdown: async () => {
        events.push('shutdown')
        requests.push('shutdown')
      },
    },
    getActiveSessionCount: () => 0,
    beforeShutdown: async () => {
      events.push('save')
    },
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  await sleep(40)

  assert.equal(requests.length, 1)
  assert.deepEqual(events, ['save', 'shutdown'])
})

test('agones idle controller does not request shutdown when saving the world fails', async () => {
  const requests = []
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 10,
    agones: {
      shutdown: async () => {
        requests.push('shutdown')
      },
    },
    getActiveSessionCount: () => 0,
    beforeShutdown: async () => {
      throw new Error('save_failed')
    },
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  await sleep(40)

  assert.equal(requests.length, 0)
  controller.clearIdleShutdownTimer('test_cleanup')
})

test('agones idle controller cancels a pending shutdown when sessions return', async () => {
  let activeSessions = 0
  const requests = []
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 25,
    agones: {
      shutdown: async () => {
        requests.push('shutdown')
      },
    },
    getActiveSessionCount: () => activeSessions,
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  activeSessions = 1
  controller.reconcileIdleShutdown('player_joined')
  await sleep(60)

  assert.equal(requests.length, 0)
  controller.clearIdleShutdownTimer('test_cleanup')
})

test('agones idle controller is inert when Agones is unavailable', async () => {
  const controller = createAgonesIdleController({
    enabled: true,
    timeoutMs: 10,
    agones: null,
    getActiveSessionCount: () => 0,
    logger: createSilentLogger(),
  })

  controller.reconcileIdleShutdown('startup')
  await sleep(40)

  assert.equal(typeof controller.requestAgonesShutdown, 'function')
})
