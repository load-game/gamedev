import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import {
  createLocalLabelStyleState,
  createPlayerLabelNodes,
  normalizeLocalLabelStyle,
} from '../../packages/core/extras/localLabelStyle.js'

const image = 'data:image/png;base64,aGVsbG8='
const style = () => ({
  nameTag: { image, color: '#ffffff' },
  chat: { image, color: '#ffffff', compactImage: image, compactLeftImage: image, compactRightImage: image },
})

test('compact icons are bounded inline copies and malformed updates retain the current override', () => {
  const owner = {},
    state = createLocalLabelStyleState(() => {}),
    input = style()
  state.set(owner, input)
  input.chat.compactLeftImage = 'https://example.test/icon.png'
  assert.equal(state.value.chat.compactLeftImage, image)
  assert.ok(Object.isFrozen(state.value.chat))
  const current = state.value
  for (const key of ['compactLeftImage', 'compactRightImage']) {
    for (const invalid of [null, 3, 'https://example.test/icon.png', 'data:image/png;base64,' + 'x'.repeat(200001)]) {
      const next = style()
      next.chat[key] = invalid
      assert.throws(() => state.set(owner, next))
      assert.equal(state.value, current)
    }
  }
})

test('speech icons stay square when text wraps and release all owned image sources', () => {
  const node = (type, data = {}) => ({
    type,
    ...data,
    position: { y: 0 },
    children: [],
    add(child) {
      this.children.push(child)
    },
    remove(child) {
      this.children = this.children.filter(n => n !== child)
    },
  })
  const released = []
  const player = {
    aura: node('group'),
    nametag: { position: { y: 1.3 } },
    data: { name: 'Test' },
    world: { loader: { releaseAsset: (kind, url) => released.push([kind, url]) } },
  }
  const labels = createPlayerLabelNodes(node, player, normalizeLocalLabelStyle(style()))
  const box = labels.speech.children[0]
  const icons = box.children.filter(child => child.type === 'uiview').map(holder => holder.children[0])
  assert.equal(icons.length, 2)
  assert.equal(labels.speech.width, 328)
  assert.equal(box.padding, 10)
  labels.say('A message long enough to wrap across several lines. '.repeat(8))
  for (const icon of icons) {
    assert.equal(icon.width, icon.height)
    assert.equal(icon.objectFit, 'contain')
    assert.match(icon.src, /^blob:/)
  }
  labels.destroy()
  assert.deepEqual(player.aura.children, [])
  assert.equal(new Set(released.map(([, url]) => url)).size, 4)
  assert.ok(released.every(([kind]) => kind === 'image'))
})
