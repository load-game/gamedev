import { World } from './World.js'
import { nodeClientPreset } from './presets/node-client.js'

export { nodeClientPreset, nodeClientRuntimePlugin } from './presets/node-client.js'

export function createNodeClientWorld(options = {}) {
  const world = new World()
  world.install(nodeClientPreset)
  world.install(options.plugins || [])
  return world
}
