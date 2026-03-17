import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import { setImmediate as setImmediatePromise } from 'node:timers/promises'
import { test } from 'node:test'

import {
  createAgonesPlayerTracker,
  resolveEffectivePlayerCapacity,
} from '../../src/server/agonesPlayerTracking.js'

function createLogger() {
  const messages = {
    info: [],
    warn: [],
  }

  return {
    logger: {
      info(message) {
        messages.info.push(message)
      },
      warn(message) {
        messages.warn.push(message)
      },
    },
    messages,
  }
}

function createWorld(playerLimit = null) {
  const settings = new EventEmitter()
  settings.playerLimit = playerLimit
  const network = new EventEmitter()
  return {
    settings,
    network,
  }
}

test('resolveEffectivePlayerCapacity prefers world playerLimit and falls back to PUBLIC_WORLD_MAX_PLAYERS', () => {
  assert.equal(resolveEffectivePlayerCapacity({ playerLimit: 24, env: { PUBLIC_WORLD_MAX_PLAYERS: '32' } }), 24)
  assert.equal(resolveEffectivePlayerCapacity({ playerLimit: 0, env: { PUBLIC_WORLD_MAX_PLAYERS: '32' } }), 32)
  assert.equal(resolveEffectivePlayerCapacity({ playerLimit: null, env: { PUBLIC_WORLD_MAX_PLAYERS: '0' } }), null)
  assert.equal(resolveEffectivePlayerCapacity({ playerLimit: '18', env: {} }), 18)
})

test('createAgonesPlayerTracker wires playerJoined and playerLeft events into Agones player tracking', async () => {
  const world = createWorld(20)
  const events = []
  const { logger, messages } = createLogger()
  const tracker = createAgonesPlayerTracker({
    world,
    env: {},
    logger,
    agones: {
      async setPlayerCapacity(capacity) {
        events.push(['capacity', capacity])
      },
      async playerConnect(playerId) {
        events.push(['connect', playerId])
        return true
      },
      async playerDisconnect(playerId) {
        events.push(['disconnect', playerId])
        return false
      },
    },
  })

  assert.equal(tracker.start(), true)

  world.network.emit('playerJoined', { id: 'player-1' })
  world.network.emit('playerLeft', { id: 'player-1' })
  await setImmediatePromise()

  assert.deepEqual(events, [
    ['connect', 'player-1'],
    ['disconnect', 'player-1'],
  ])
  assert.deepEqual(messages.warn, [])
  assert.deepEqual(messages.info, ['[agones] player disconnect ignored for player-1 (not connected)'])
})

test('createAgonesPlayerTracker publishes startup capacity and playerLimit updates', async () => {
  const world = createWorld(null)
  const capacities = []
  const { logger, messages } = createLogger()
  const tracker = createAgonesPlayerTracker({
    world,
    env: {
      PUBLIC_WORLD_MAX_PLAYERS: '40',
    },
    logger,
    agones: {
      async setPlayerCapacity(capacity) {
        capacities.push(capacity)
      },
      async playerConnect() {
        return true
      },
      async playerDisconnect() {
        return true
      },
    },
  })

  tracker.start()
  await tracker.publishCapacity('startup')

  world.settings.playerLimit = 18
  world.settings.emit('change', {
    playerLimit: { prev: null, value: 18 },
  })
  await setImmediatePromise()

  world.settings.playerLimit = 18
  world.settings.emit('change', {
    playerLimit: { prev: 18, value: 18 },
  })
  await setImmediatePromise()

  assert.deepEqual(capacities, [40, 18])
  assert.deepEqual(messages.warn, [])
  assert.deepEqual(messages.info, [
    '[agones] updated player capacity to 40 (startup)',
    '[agones] updated player capacity to 18 (player_limit_changed)',
  ])
})
