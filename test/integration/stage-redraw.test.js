import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { Node } from '../../packages/core/nodes/Node.js'
import { Stage } from '../../packages/core/systems/Stage.js'

test('a child commit can request a second parent draw without stranding the dirty flag', () => {
  const stage = { dirtyNodes: new Set() }
  const parent = new Node()
  const child = new Node()
  parent.add(child)
  parent.activate({ world: { stage } })
  let draws = 0
  let rebuilt = false
  parent.commit = () => {
    draws++
  }
  child.commit = () => {
    if (!rebuilt) {
      rebuilt = true
      parent.setDirty()
    }
  }
  parent.setDirty()
  child.setDirty()
  Stage.prototype.clean.call(stage)
  assert.equal(draws, 2)
  assert.equal(parent.isDirty, false)
  assert.equal(child.isDirty, false)
  assert.equal(stage.dirtyNodes.size, 0)
  parent.setDirty()
  Stage.prototype.clean.call(stage)
  assert.equal(draws, 3)
  parent.deactivate()
})
