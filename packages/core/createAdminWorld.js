import { World } from './World.js'
import { adminPreset } from './presets/admin.js'

export { adminPreset, adminRuntimePlugin } from './presets/admin.js'

export function createAdminWorld(options = {}) {
  const world = new World()
  world.install(adminPreset)
  world.install(options.plugins || [])
  return world
}
