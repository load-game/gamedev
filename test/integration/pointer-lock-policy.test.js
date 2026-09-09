import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { ClientControls } from '../../packages/core/systems/ClientControls.js'
import { ClientBuilder } from '../../packages/core/systems/ClientBuilder.js'

test('free-cursor app can receive the first world click; releasing it restores automatic lock', () => {
  const world = { emit() {} },
    controls = new ClientControls(world)
  world.controls = controls
  let locks = 0,
    clicks = 0
  controls.lockPointer = () => {
    locks++
    return true
  }
  const builder = Object.create(ClientBuilder.prototype)
  builder.world = world
  builder.updateActions = () => {}
  builder.start()
  const app = controls.bind({ priority: 2 })
  app.mouseLeft.onPress = () => {
    clicks++
  }
  const press = () => {
    for (const c of controls.controls) {
      const b = c.entries.mouseLeft
      if (b && (b.onPress?.() || b.capture)) break
    }
  }
  press()
  assert.equal(locks, 1)
  assert.equal(clicks, 0)
  app.pointer.lockOnClick = false
  press()
  assert.equal(locks, 1)
  assert.equal(clicks, 1)
  app.pointer.lock()
  assert.equal(locks, 2)
  app.pointer.lockOnClick = true
  press()
  assert.equal(locks, 3)
  app.pointer.lockOnClick = false
  app.release()
  press()
  assert.equal(locks, 4)
  builder.control.release()
})
