import { definePreset } from '../plugins.js'
import { createWorldFromPreset } from './createWorld.js'
import { coreSystemsPlugin } from './core.js'
import { animationPlugin } from '../plugins/animation.js'
import { chatPlugin } from '../plugins/chat.js'
import { controlsClientPlugin } from '../plugins/controls/client.js'
import { environmentNodeClientPlugin } from '../plugins/environment/node-client.js'
import { appEntityPlugin } from '../plugins/entities/app.js'
import { playerEntitiesPlugin } from '../plugins/entities/player.js'
import { loaderServerPlugin } from '../plugins/loader/server.js'
import { loaderServerHandlersPlugin } from '../../plugins/loader/server-handlers.js'
import { logsPlugin } from '../plugins/logs.js'
import { networkClientPlugin } from '../plugins/network/client.js'
import { nodesPlugin } from '../plugins/nodes.js'
import { spatialPlugin } from '../plugins/spatial.js'
import { stagePlugin } from '../plugins/stage.js'
import { viewPlugin } from '../plugins/view.js'
import { nodeClientRuntimePlugin } from '../../plugins/runtime/node-client.js'

export { nodeClientRuntimePlugin }

export const nodeClientPreset = definePreset({
  name: '@gamedev/preset-node-client',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    animationPlugin,
    spatialPlugin,
    stagePlugin,
    chatPlugin,
    controlsClientPlugin,
    nodeClientRuntimePlugin,
    networkClientPlugin,
    loaderServerPlugin,
    loaderServerHandlersPlugin,
    appEntityPlugin,
    playerEntitiesPlugin,
    environmentNodeClientPlugin,
  ],
})

export function createNodeClientWorld(options = {}) {
  return createWorldFromPreset(nodeClientPreset, options)
}
