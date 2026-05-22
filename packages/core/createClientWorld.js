import { World } from './World.js'
import { clientPreset } from './presets/client.js'

export { clientPreset, clientRuntimePlugin } from './presets/client.js'

export function createClientWorld(options = {}) {
  const world = new World()
  world.install(clientPreset)
  world.install(options.plugins || [])
  return world
}
