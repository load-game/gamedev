import { World } from '../World.js'

export function createWorldFromPreset(preset, options = {}) {
  const world = new World()
  world.install(preset)
  world.install(options.plugins || [])
  return world
}
