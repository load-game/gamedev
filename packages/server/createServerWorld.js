import { World } from '@gamedev/core/World.js'
import { serverPreset } from './presets/server.js'

export { serverPreset, serverRuntimePlugin } from './presets/server.js'

export function createServerWorld(options = {}) {
  const world = new World()
  world.install(serverPreset)
  world.install(options.plugins || [])
  return world
}
