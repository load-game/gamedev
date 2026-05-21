import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { chatPlugin } from './plugins/chat.js'
import { environmentNodeClientPlugin } from './plugins/environment/node-client.js'
import { loaderServerPlugin } from './plugins/loader/server.js'

import { NodeClient } from './systems/NodeClient.js'
import { ClientControls } from './systems/ClientControls.js'
import { ClientNetwork } from './systems/ClientNetwork.js'

export const nodeClientRuntimePlugin = definePlugin({
  name: '@gamedev/node-client/runtime',
  requires: ['core', 'chat'],
  systems: [
    ['client', NodeClient],
    ['controls', ClientControls],
    ['network', ClientNetwork],
  ],
})

export const nodeClientPreset = definePreset({
  name: '@gamedev/preset-node-client',
  plugins: [coreSystemsPlugin, chatPlugin, nodeClientRuntimePlugin, environmentNodeClientPlugin, loaderServerPlugin],
})

export function createNodeClientWorld(options = {}) {
  const world = new World()
  world.install(nodeClientPreset)
  world.install(options.plugins || [])
  return world
}
