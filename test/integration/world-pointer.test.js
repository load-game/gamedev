import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { ClientControls } from '../../packages/core/systems/ClientControls.js'
import { ClientPointer } from '../../packages/core/systems/ClientPointer.js'
import { ClientBuilder } from '../../packages/core/systems/ClientBuilder.js'

test('world UI consumes a free-cursor click before mouse-look, once, and receives release', () => {
  const oldDocument = globalThis.document
  globalThis.document = { body: { style: {} } }
  let hits = [],
    locks = 0,
    downs = 0,
    ups = 0
  const world = { emit() {}, stage: { raycastPointer: () => hits } }
  const controls = new ClientControls(world)
  world.controls = controls
  controls.lockPointer = () => {
    locks++
    return true
  }
  const builder = Object.create(ClientBuilder.prototype)
  builder.world = world
  builder.updateActions = () => {}
  builder.start()
  const pointer = new ClientPointer(world)
  pointer.start()
  const screen = {
    onPointerDown: () => {
      downs++
    },
    onPointerUp: () => {
      ups++
    },
    cursor: 'pointer',
  }
  const cycle = () => {
    controls.simulateButton('mouseLeft', true)
    pointer.update(1 / 60)
    controls.postLateUpdate()
    controls.simulateButton('mouseLeft', false)
    pointer.update(1 / 60)
    controls.postLateUpdate()
  }
  try {
    // The plot resolves to a child; pointer events bubble to its screen.
    hits = [{ node: { parent: screen } }]
    cycle()
    assert.equal(downs, 1)
    assert.equal(ups, 1)
    assert.equal(locks, 0)
    assert.equal(document.body.style.cursor, 'pointer')
    // An opaque world object in front must block the screen behind it.
    hits = [{ node: {} }, { node: screen }]
    cycle()
    assert.equal(downs, 1)
    assert.equal(locks, 1)
    // Screen-space UI takes priority over world-space UI.
    const overlay = {
      onPointerDown: () => {
        downs += 10
      },
    }
    hits = [{ node: screen }]
    pointer.setScreenHit({ node: overlay })
    cycle()
    assert.equal(downs, 11)
    assert.equal(locks, 1)
    pointer.setScreenHit(null)
    hits = []
    cycle()
    assert.equal(locks, 2)
  } finally {
    pointer.destroy()
    builder.control.release()
    if (oldDocument === undefined) delete globalThis.document
    else globalThis.document = oldDocument
  }
})
