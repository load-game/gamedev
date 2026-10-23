import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import {
  normalizeLocalLabelStyle,
  createLocalLabelStyleState,
  localMessageFrame,
  createPlayerLabelNodes,
} from '../../packages/core/extras/localLabelStyle.js'

const style = color => ({
  nameTag: { image: 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E', color },
  chat: { image: 'data:image/png;base64,aGVsbG8=', color },
})

test('local label overrides restore the preceding app and do not retain caller mutation', () => {
  const changes = [],
    first = {},
    second = {},
    input = style('#ffffff')
  const state = createLocalLabelStyleState(value => changes.push(value))
  state.set(first, input)
  input.chat.color = '#000000'
  assert.equal(state.value.chat.color, '#ffffff')
  state.set(second, style('#999999'))
  state.remove(first)
  assert.equal(state.value.chat.color, '#999999')
  state.set(first, style('#eeeeee'))
  state.set(first, null)
  assert.equal(state.value.chat.color, '#999999')
  state.remove(second)
  assert.equal(state.value, null)
  assert.equal(changes.length, 6)
})

test('malformed image and CSS inputs cannot replace an active style', () => {
  const state = createLocalLabelStyleState(() => {}),
    owner = {}
  state.set(owner, style('#ffffff'))
  for (const input of [
    undefined,
    {},
    { ...style('#ffffff'), chat: { image: 'javascript:alert(1)', color: '#ffffff' } },
    style('url(https://example.test/)'),
    { ...style('#ffffff'), nameTag: { image: 'data:image/png;base64,' + 'x'.repeat(200001), color: '#ffffff' } },
  ]) {
    assert.throws(() => state.set(owner, input))
    assert.equal(state.value.chat.color, '#ffffff')
  }
  assert.equal(normalizeLocalLabelStyle(null), null)
})

test('only messages with the actual local player ID receive the local chat frame', () => {
  const input = normalizeLocalLabelStyle(style('#ffffff'))
  assert.equal(localMessageFrame(input, { from: 'Me', fromId: 'other' }, 'local'), null)
  assert.equal(localMessageFrame(input, { body: 'system' }, 'local'), null)
  assert.equal(localMessageFrame(input, { fromId: 'local' }, 'local'), input.chat)
  assert.equal(localMessageFrame(input, { fromId: null }, null), null)
})

test('native labels follow the avatar head, retain identity and cleanly remove both nodes', () => {
  const node = (type, data = {}) => ({
    type,
    ...data,
    position: { y: 0 },
    children: [],
    add(n) {
      this.children.push(n)
    },
    remove(n) {
      this.children = this.children.filter(c => c !== n)
    },
  })
  const player = { aura: node('group'), nametag: { position: { y: 1.3 } }, data: { name: 'Anonymous' } }
  const labels = createPlayerLabelNodes(node, player, normalizeLocalLabelStyle(style('#ffffff')))
  assert.match(labels.name.children[0].src, /^blob:/)
  assert.match(labels.speech.children[0].children[0].src, /^blob:/)
  assert.equal(player.aura.children.length, 2)
  assert.equal(labels.speech.active, false)
  player.nametag.position.y = 2.2
  labels.update()
  assert.ok(labels.name.position.y > 2.2)
  const text = labels.name.children[1].children[0]
  player.data.name = 'A'.repeat(70)
  labels.update()
  assert.equal(Array.from(text.value).length, 24)
  assert.equal(player.data.name.length, 70)
  labels.say('x'.repeat(200))
  assert.equal(labels.speech.active, true)
  assert.equal(labels.speech.children[0].children[1].value.length, 200)
  labels.destroy()
  assert.deepEqual(player.aura.children, [])
})
