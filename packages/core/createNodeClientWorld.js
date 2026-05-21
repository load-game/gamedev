import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { chatPlugin } from './plugins/chat.js'
import { controlsClientPlugin } from './plugins/controls/client.js'
import { environmentNodeClientPlugin } from './plugins/environment/node-client.js'
import { loaderServerPlugin } from './plugins/loader/server.js'
import { networkClientPlugin } from './plugins/network/client.js'

import { NodeClient } from './systems/NodeClient.js'

export const nodeClientRuntimePlugin = definePlugin({
  name: '@gamedev/node-client/runtime',
  requires: ['core'],
  systems: [['client', NodeClient]],
})

export const nodeClientPreset = definePreset({
  name: '@gamedev/preset-node-client',
  plugins: [
    coreSystemsPlugin,
    chatPlugin,
    controlsClientPlugin,
    nodeClientRuntimePlugin,
    networkClientPlugin,
    environmentNodeClientPlugin,
    loaderServerPlugin,
  ],
})

export function createNodeClientWorld(options = {}) {
  const world = new World()
  world.install(nodeClientPreset)
  world.install(options.plugins || [])
  return world
}
