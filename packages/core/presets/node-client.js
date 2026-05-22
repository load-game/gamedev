import { definePlugin, definePreset } from '../plugins.js'
import { coreSystemsPlugin } from './core.js'
import { chatPlugin } from '../plugins/chat.js'
import { controlsClientPlugin } from '../plugins/controls/client.js'
import { environmentNodeClientPlugin } from '../plugins/environment/node-client.js'
import { appEntityPlugin } from '../plugins/entities/app.js'
import { playerEntitiesPlugin } from '../plugins/entities/player.js'
import { loaderServerPlugin } from '../plugins/loader/server.js'
import { logsPlugin } from '../plugins/logs.js'
import { networkClientPlugin } from '../plugins/network/client.js'
import { nodesPlugin } from '../plugins/nodes.js'
import { spatialPlugin } from '../plugins/spatial.js'
import { viewPlugin } from '../plugins/view.js'
import { NodeClient } from '../systems/NodeClient.js'

export const nodeClientRuntimePlugin = definePlugin({
  name: '@gamedev/node-client/runtime',
  requires: ['core'],
  systems: [['client', NodeClient]],
})

export const nodeClientPreset = definePreset({
  name: '@gamedev/preset-node-client',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    spatialPlugin,
    chatPlugin,
    controlsClientPlugin,
    nodeClientRuntimePlugin,
    networkClientPlugin,
    loaderServerPlugin,
    appEntityPlugin,
    playerEntitiesPlugin,
    environmentNodeClientPlugin,
  ],
})
