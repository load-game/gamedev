import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'

import { completeRuntimeStartup } from '@gamedev/hosting/runtimeStartup.js'

function createLogger() {
  const messages = {
    info: [],
    error: [],
  }

  return {
    logger: {
      info(message) {
        messages.info.push(message)
      },
      error(message) {
        messages.error.push(message)
      },
    },
    messages,
  }
}

test('completeRuntimeStartup requests hosting Ready before idle reconciliation', async () => {
  const events = []
  const { logger, messages } = createLogger()

  await completeRuntimeStartup({
    hosting: {
      name: 'test-hosting',
      ready: async () => {
        events.push('ready')
      },
    },
    idleControllerEnabled: true,
    idleController: {
      reconcileIdleShutdown: reason => {
        events.push(`idle:${reason}`)
      },
    },
    idleTimeoutMs: 15000,
    logger,
  })

  assert.deepEqual(events, ['ready', 'idle:startup'])
  assert.deepEqual(messages.error, [])
  assert.deepEqual(messages.info, [
    '[test-hosting] requested runtime Ready',
    '[test-hosting-idle] enabled with timeout=15s',
  ])
})

test('completeRuntimeStartup fails fast when hosting Ready cannot be delivered', async () => {
  const events = []
  const { logger, messages } = createLogger()

  await assert.rejects(
    completeRuntimeStartup({
      hosting: {
        name: 'test-hosting',
        ready: async () => {
          events.push('ready')
          throw new Error('fetch failed')
        },
      },
      idleControllerEnabled: true,
      idleController: {
        reconcileIdleShutdown: reason => {
          events.push(`idle:${reason}`)
        },
      },
      logger,
    }),
    /fetch failed/
  )

  assert.deepEqual(events, ['ready'])
  assert.deepEqual(messages.info, [])
  assert.deepEqual(messages.error, ['[test-hosting] failed to request runtime Ready (fetch failed)'])
})

test('completeRuntimeStartup skips hosting Ready when requestHostingReady is false', async () => {
  const events = []
  const { logger, messages } = createLogger()

  await completeRuntimeStartup({
    hosting: {
      name: 'test-hosting',
      ready: async () => {
        events.push('ready')
      },
    },
    idleControllerEnabled: true,
    idleController: {
      reconcileIdleShutdown: reason => {
        events.push(`idle:${reason}`)
      },
    },
    idleTimeoutMs: 15000,
    requestHostingReady: false,
    logger,
  })

  assert.deepEqual(events, ['idle:startup'])
  assert.deepEqual(messages.error, [])
  assert.deepEqual(messages.info, ['[test-hosting-idle] enabled with timeout=15s'])
})
