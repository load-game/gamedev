import * as THREE from '../core/math/three.js'
import { definePlugin } from '../core/plugins.js'

export function installView(world) {
  if (!world.rig) {
    world.rig = new THREE.Object3D()
  }

  if (!world.camera) {
    // NOTE: camera near is slightly smaller than spherecast. far is slightly more than skybox.
    // this gives us minimal z-fighting without needing logarithmic depth buffers
    world.camera = new THREE.PerspectiveCamera(70, 0, 0.2, 1200)
  }

  if (world.camera.parent !== world.rig) {
    world.rig.add(world.camera)
  }
}

export const viewPlugin = definePlugin({
  name: '@gamedev/plugin-view',
  requires: ['core'],
  provides: ['view', 'camera'],
  setup: installView,
})
