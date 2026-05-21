import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { browserClientPlugin } from './plugins/browser/client.js'
import { controlsClientPlugin } from './plugins/controls/client.js'
import { environmentClientPlugin } from './plugins/environment/client.js'
import { graphicsClientPlugin } from './plugins/graphics/client.js'
import { loaderClientPlugin } from './plugins/loader/client.js'
import { logsPlugin } from './plugins/logs.js'
import { prefsClientPlugin } from './plugins/prefs/client.js'
import { spatialPlugin } from './plugins/spatial.js'

import { Client } from './systems/Client.js'

export { System } from './systems/System.js'

export const viewerRuntimePlugin = definePlugin({
  name: '@gamedev/viewer/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
})

export const viewerPreset = definePreset({
  name: '@gamedev/preset-viewer',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    spatialPlugin,
    prefsClientPlugin,
    graphicsClientPlugin,
    controlsClientPlugin,
    viewerRuntimePlugin,
    browserClientPlugin,
    loaderClientPlugin,
    environmentClientPlugin,
  ],
})

export function createViewerWorld(options = {}) {
  const world = new World()
  world.install(viewerPreset)
  world.install(options.plugins || [])
  return world
}
