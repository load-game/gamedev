import { World } from './World.js'
import { viewerPreset } from './presets/viewer.js'

export { System } from './systems/System.js'
export { viewerPreset, viewerRuntimePlugin } from './presets/viewer.js'

export function createViewerWorld(options = {}) {
  const world = new World()
  world.install(viewerPreset)
  world.install(options.plugins || [])
  return world
}
