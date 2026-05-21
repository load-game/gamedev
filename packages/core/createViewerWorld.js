import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { loaderClientPlugin } from './plugins/loader/client.js'

import { Client } from './systems/Client.js'
import { ClientPrefs } from './systems/ClientPrefs.js'
import { ClientControls } from './systems/ClientControls.js'
import { ClientGraphics } from './systems/ClientGraphics.js'
import { ClientEnvironment } from './systems/ClientEnvironment.js'
// import { ClientAudio } from './systems/ClientAudio.js'

export { System } from './systems/System.js'

export const viewerRuntimePlugin = definePlugin({
  name: '@gamedev/viewer/runtime',
  requires: ['core'],
  systems: [
    ['client', Client],
    ['prefs', ClientPrefs],
    ['controls', ClientControls],
    ['graphics', ClientGraphics],
    ['environment', ClientEnvironment],
  ],
  // world.register('audio', ClientAudio)
})

export const viewerPreset = definePreset({
  name: '@gamedev/preset-viewer',
  plugins: [coreSystemsPlugin, viewerRuntimePlugin, loaderClientPlugin],
})

export function createViewerWorld(options = {}) {
  const world = new World()
  world.install(viewerPreset)
  world.install(options.plugins || [])
  return world
}
