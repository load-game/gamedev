import { describe, expect, it } from 'vitest'
import * as THREE from '../../packages/core/extras/three.js'
import { createAvatarBlinkFactory } from '../../packages/core/extras/avatarBlink.js'

function fixture(version = 0, separate = false) {
  const scene = new THREE.Group()
  const group = new THREE.Group()
  scene.add(group)
  const geometry = new THREE.BoxGeometry()
  geometry.morphAttributes.position = [geometry.attributes.position.clone(), geometry.attributes.position.clone()]
  const eye = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  group.add(eye, glasses)
  const associations = new Map([
    [group, { nodes: 7 }],
    [eye, { meshes: 3, primitives: 0 }],
  ])
  let extensions
  if (version === 0) {
    const bind = index => ({ mesh: 3, index, weight: 100 })
    extensions = {
      VRM: {
        blendShapeMaster: {
          blendShapeGroups: separate
            ? [
                { presetName: 'blink_l', binds: [bind(0)] },
                { presetName: 'blink_r', binds: [bind(1)] },
              ]
            : [{ presetName: 'blink', binds: [bind(0), bind(1)] }],
        },
      },
    }
  } else {
    extensions = {
      VRMC_vrm: {
        expressions: {
          preset: {
            blink: {
              morphTargetBinds: [
                { node: 7, index: 0, weight: 1 },
                { node: 7, index: 1, weight: 0.8 },
              ],
            },
          },
        },
      },
    }
  }
  return { scene, eye, glasses, parser: { associations, json: { extensions } } }
}

describe('per-instance VRM eyelid animation', () => {
  it.each([0, 1])('opens, closes, and reopens VRM %s eyes without moving the frames', version => {
    const source = fixture(version)
    const clone = source.scene.clone(true)
    const controller = createAvatarBlinkFactory(source)(clone, () => 0.5)
    const [eye, glasses] = clone.children[0].children
    const before = glasses.geometry.attributes.position.array.slice()
    expect(eye.morphTargetInfluences).toEqual([0, 0])
    controller.update(2.295)
    expect(eye.morphTargetInfluences[0]).toBeCloseTo(0.5)
    controller.update(0.065)
    expect(eye.morphTargetInfluences).toEqual(version === 0 ? [1, 1] : [1, 0.8])
    controller.update(0.25)
    expect(eye.morphTargetInfluences).toEqual([0, 0])
    expect(glasses.geometry.attributes.position.array).toEqual(before)
    expect(source.eye.morphTargetInfluences).toEqual([0, 0])
  })

  it('clones blink independently, including when both use the same source', () => {
    const source = fixture(),
      create = createAvatarBlinkFactory(source)
    const a = source.scene.clone(true),
      b = source.scene.clone(true)
    const first = create(a, () => 0),
      second = create(b, () => 0.8)
    first.update(1.11)
    second.update(1.11)
    expect(a.children[0].children[0].morphTargetInfluences).toEqual([1, 1])
    expect(b.children[0].children[0].morphTargetInfluences).toEqual([0, 0])
    expect(source.eye.morphTargetInfluences).toEqual([0, 0])
  })

  it('supports separate left/right presets without applying both and a combined blink', () => {
    const source = fixture(0, true),
      clone = source.scene.clone(true)
    createAvatarBlinkFactory(source)(clone, () => 0).update(1.11)
    expect(clone.children[0].children[0].morphTargetInfluences).toEqual([1, 1])
  })

  it('recovers open after a suspended tab and ignores invalid deltas', () => {
    const source = fixture(),
      clone = source.scene.clone(true)
    const controller = createAvatarBlinkFactory(source)(clone, () => 0.5)
    controller.update(2.36)
    controller.update(90)
    for (const delta of [NaN, Infinity, -1, 0]) controller.update(delta)
    expect(clone.children[0].children[0].morphTargetInfluences).toEqual([0, 0])
    controller.update(4.21)
    expect(clone.children[0].children[0].morphTargetInfluences).toEqual([1, 1])
  })

  it('leaves avatars without valid blink bindings untouched', () => {
    const source = fixture()
    source.parser.json.extensions.VRM.blendShapeMaster.blendShapeGroups[0].binds = [
      { mesh: 3, index: 9, weight: 100 },
      { mesh: 3, index: 0, weight: NaN },
    ]
    expect(createAvatarBlinkFactory(source)).toBe(null)
    expect(createAvatarBlinkFactory({ scene: source.scene })).toBe(null)
  })
})
