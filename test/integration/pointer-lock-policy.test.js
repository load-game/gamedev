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

test('captured app Tab navigates the app without toggling build mode, and release restores it', () => {
  const world = { emit() {}, entities: { player: { isXR: false } }, ui: { state: {} } }
  const controls = new ClientControls(world)
  world.controls = controls
  const builder = Object.create(ClientBuilder.prototype)
  builder.world = world
  builder.updateActions = () => {}
  let toggles = 0,
    navigations = 0
  builder.toggle = () => {
    toggles++
  }
  builder.start()
  void builder.control.tab
  const app = controls.bind({ priority: 2 })
  app.tab.onPress = () => {
    navigations++
  }
  const press = () => {
    controls.simulateButton('tab', true)
    builder.update(1 / 60)
    controls.simulateButton('tab', false)
    controls.postLateUpdate()
  }
  press()
  assert.equal(toggles, 1)
  assert.equal(navigations, 1)
  app.tab.capture = true
  press()
  assert.equal(toggles, 1)
  assert.equal(navigations, 2)
  app.tab.capture = false
  press()
  assert.equal(toggles, 2)
  app.tab.capture = true
  app.release()
  press()
  assert.equal(toggles, 3)
  builder.control.release()
})
