import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { ClientControls } from '../../packages/core/systems/ClientControls.js'

function wheel(ui, extra = {}) {
  const event = Object.assign(new Event('wheel', { cancelable: true }), {
    deltaY: 120,
    deltaX: 0,
    shiftKey: false,
    ...extra,
  })
  ui.dispatchEvent(event)
  return event
}

test('screen UI wheel input is opt-in, captured once, and excludes core UI', () => {
  const controls = new ClientControls({ emit() {} })
  controls.isMac = false
  controls.viewport = { contains: () => false }
  const ui = new EventTarget()
  controls.bindScreenUIScroll(ui)
  const app = controls.bind({ priority: 2 })
  app.scrollDelta.capture = false
  assert.equal(wheel(ui).defaultPrevented, false)
  assert.equal(controls.scroll.delta, 0)
  app.scrollDelta.capture = true
  assert.equal(wheel(ui).defaultPrevented, true)
  controls.preFixedUpdate()
  assert.equal(app.scrollDelta.value, -120)
  assert.equal(wheel(ui, { isCoreUI: true }).defaultPrevented, false)
  assert.equal(controls.scroll.delta, -120)
  controls.bindScreenUIScroll(ui)
  wheel(ui)
  assert.equal(controls.scroll.delta, -240)
  controls.unbindScreenUIScroll()
  assert.equal(wheel(ui).defaultPrevented, false)
  assert.equal(controls.scroll.delta, -240)
  app.release()
})

test('nested UI does not register a second wheel listener; releasing the app stops interception', () => {
  const controls = new ClientControls({ emit() {} })
  controls.isMac = false
  const ui = new EventTarget()
  controls.viewport = { contains: () => true }
  const app = controls.bind({ priority: 2 })
  app.scrollDelta.capture = true
  controls.bindScreenUIScroll(ui)
  assert.equal(wheel(ui).defaultPrevented, false)
  controls.viewport = { contains: () => false }
  controls.bindScreenUIScroll(ui)
  assert.equal(wheel(ui, { shiftKey: true, deltaX: 40 }).defaultPrevented, true)
  assert.equal(controls.scroll.delta, -40)
  app.release()
  assert.equal(wheel(ui).defaultPrevented, false)
  controls.unbindScreenUIScroll()
})
