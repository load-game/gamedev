import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { ClientUI } from '../../packages/core/systems/ClientUI.js'
import { validateMenuTheme } from '../../packages/core/extras/MenuTheme.js'

test('menu themes accept bounded presentation tokens and reject CSS or executable URLs', () => {
  assert.deepEqual(
    validateMenuTheme({
      panel: '#111111cc',
      text: 'url(https://bad.example)',
      radius: 300,
      buttonDepth: -4,
      fontUrl: 'javascript:alert(1)',
      textOutline: Infinity,
      css: 'position: fixed',
      uppercase: true,
    }),
    { panel: '#111111cc', radius: 24, buttonDepth: 0, uppercase: true }
  )
  assert.deepEqual(validateMenuTheme({ fontUrl: 'asset://abc.ttf' }), { fontUrl: 'asset://abc.ttf' })
  assert.deepEqual(validateMenuTheme({ fontUrl: '/fonts/menu.ttf' }), { fontUrl: '/fonts/menu.ttf' })
  assert.equal(validateMenuTheme(null), null)
})

test('removing an app theme restores the previous world theme without clearing another app', () => {
  const events = []
  const ui = new ClientUI({ emit: (...event) => events.push(event) })
  const lobby = {},
    other = {},
    unrelated = {}
  ui.setMenuTheme(lobby, { panel: '#111' })
  ui.setMenuTheme(other, { panel: '#222' })
  ui.setMenuTheme(unrelated, null)
  assert.equal(events.length, 2)
  assert.equal(ui.state.menuTheme.panel, '#222')
  ui.setMenuTheme(other, null)
  assert.equal(ui.state.menuTheme.panel, '#111')
  ui.setMenuTheme(lobby, null)
  assert.equal(ui.state.menuTheme, null)
  assert.deepEqual(events.at(-1), ['menu-theme', null])
})
