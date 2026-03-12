import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ServerNetwork } from '../../src/core/systems/ServerNetwork.js'
import { getMaxUploadSizeBytes, getMaxUploadSizeMb, getWorldMaxPlayers } from '../../src/server/worldLimits.js'

function withEnv(overrides, run) {
  const previous = {}
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key]
    if (overrides[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = overrides[key]
    }
  }

  const restore = () => {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previous[key]
      }
    }
  }

  try {
    const result = run()
    if (result && typeof result.then === 'function') {
      return result.finally(restore)
    }
    restore()
    return result
  } catch (err) {
    restore()
    throw err
  }
}

test('world limits use defaults when env vars are missing', () => {
  withEnv({
    PUBLIC_MAX_UPLOAD_SIZE: undefined,
    PUBLIC_WORLD_MAX_PLAYERS: undefined,
  }, () => {
    assert.equal(getMaxUploadSizeMb(), 12)
    assert.equal(getMaxUploadSizeBytes(), 12 * 1024 * 1024)
    assert.equal(getWorldMaxPlayers(), 0)
  })
})

test('world limits parse configured values', () => {
  withEnv({
    PUBLIC_MAX_UPLOAD_SIZE: '4',
    PUBLIC_WORLD_MAX_PLAYERS: '3',
  }, () => {
    assert.equal(getMaxUploadSizeMb(), 4)
    assert.equal(getMaxUploadSizeBytes(), 4 * 1024 * 1024)
    assert.equal(getWorldMaxPlayers(), 3)
  })
})

test('world limits clamp invalid or non-positive values', () => {
  withEnv({
    PUBLIC_MAX_UPLOAD_SIZE: '0',
    PUBLIC_WORLD_MAX_PLAYERS: '-5',
  }, () => {
    assert.equal(getMaxUploadSizeMb(), 12)
    assert.equal(getWorldMaxPlayers(), 0)
  })
})

test('server network rejects WORLD_ID mismatches against config worldId', async () => {
  const db = table => {
    assert.equal(table, 'config')
    return {
      where({ key }) {
        return {
          async first() {
            if (key === 'spawn') {
              return {
                value: '{ "position": [0, 0, 0], "quaternion": [0, 0, 0, 1] }',
              }
            }
            if (key === 'worldId') {
              return { value: 'studio-world' }
            }
            return null
          },
        }
      },
    }
  }

  await withEnv({ WORLD_ID: 'match-world' }, async () => {
    const network = new ServerNetwork({})
    network.init({ db })
    try {
      await assert.rejects(network.start(), /WORLD_ID mismatch: env=match-world db=studio-world/)
    } finally {
      network.destroy()
    }
  })
})
