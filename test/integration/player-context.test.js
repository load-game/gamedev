import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { Vector3 } from 'three'
import { createPlayerContext } from '../../packages/core/extras/playerContext.js'

test('player context picks visible players on release, rejects drags and cleans up input', () => {
  const oldWindow = globalThis.window
  const listeners = new Map()
  globalThis.window = { addEventListener: (n, f) => listeners.set(n, f), removeEventListener: n => listeners.delete(n) }
  try {
    let enabled = true,
      opened = [],
      released = false,
      destroyed
    const local = { isPlayer: true },
      remote = { isPlayer: true, data: { id: 'remote' } }
    let hits = [{ getEntity: () => remote }]
    const control = {
      mouseRight: {},
      pointer: { position: new Vector3(45, 60), locked: false, unlock() {} },
      screen: { width: 800, height: 600 },
      release() {
        released = true
      },
    }
    const world = {
      network: { isClient: true },
      entities: { player: local },
      controls: { pointer: {}, bind: () => control },
      stage: { raycastPointer: () => hits, raycastReticle: () => hits },
      pointer: {},
    }
    const api = createPlayerContext(
      {
        world,
        on: (name, fn) => {
          destroyed = fn
        },
      },
      { enabled: () => enabled, onOpen: v => opened.push(v) }
    )
    control.mouseRight.onPress()
    listeners.get('pointerup')({ button: 2 })
    assert.deepEqual(opened, [{ playerId: 'remote', x: 45, y: 60 }])
    control.mouseRight.onPress()
    listeners.get('pointermove')({ movementX: 8 })
    assert.equal(world.controls.pointer.rightDragging, true)
    listeners.get('pointerup')({ button: 2 })
    assert.equal(opened.length, 1)
    assert.equal(world.controls.pointer.rightDragging, false)
    hits = [{ getEntity: () => ({ isApp: true }) }, { getEntity: () => remote }]
    control.mouseRight.onPress()
    listeners.get('pointerup')({ button: 2 })
    assert.equal(opened.length, 1)
    hits = [{ getEntity: () => remote }]
    enabled = false
    control.mouseRight.onPress()
    listeners.get('pointerup')({ button: 2 })
    assert.equal(opened.length, 1)
    enabled = true
    control.mouseRight.onPress()
    listeners.get('blur')()
    listeners.get('pointerup')({ button: 2 })
    assert.equal(opened.length, 1)
    world.pointer.screenHit = {}
    control.mouseRight.onPress()
    listeners.get('pointerup')({ button: 2 })
    assert.equal(opened.length, 1)
    world.pointer.screenHit = null
    control.pointer.locked = true
    control.mouseRight.onPress()
    listeners.get('pointerup')({ button: 2 })
    assert.deepEqual(opened[1], { playerId: 'remote', x: 400, y: 300 })
    destroyed()
    api.dispose()
    assert.equal(listeners.size, 0)
    assert.equal(released, true)
  } finally {
    globalThis.window = oldWindow
  }
})
