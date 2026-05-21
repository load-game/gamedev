import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { environmentClientPlugin } from './plugins/environment/client.js'
import { loaderClientPlugin } from './plugins/loader/client.js'
import { prefsClientPlugin } from './plugins/prefs/client.js'

import { Client } from './systems/Client.js'
import { ClientControls } from './systems/ClientControls.js'
import { ClientGraphics } from './systems/ClientGraphics.js'

export { System } from './systems/System.js'

export const viewerRuntimePlugin = definePlugin({
  name: '@gamedev/viewer/runtime',
  requires: ['core', 'prefs'],
  systems: [
    ['client', Client],
    ['controls', ClientControls],
    ['graphics', ClientGraphics],
  ],
})

export const viewerPreset = definePreset({
  name: '@gamedev/preset-viewer',
  plugins: [coreSystemsPlugin, prefsClientPlugin, viewerRuntimePlugin, loaderClientPlugin, environmentClientPlugin],
})

export function createViewerWorld(options = {}) {
  const world = new World()
  world.install(viewerPreset)
  world.install(options.plugins || [])
  return world
}
