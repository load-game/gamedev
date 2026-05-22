import { definePreset } from '@gamedev/core/plugins.js'
import { createWorldFromPreset } from '@gamedev/core/presets/createWorld.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { animationPlugin } from '@gamedev/core/plugins/animation.js'
import { chatPlugin } from '@gamedev/core/plugins/chat.js'
import { environmentServerPlugin } from '@gamedev/core/plugins/environment/server.js'
import { evmServerPlugin } from '../../plugins/evm/index.js'
import { hyperliquidPlugin } from '../../plugins/hyperliquid/index.js'
import { aiServerPlugin } from '../../plugins/ai/server.js'
import { appEntityPlugin } from '../../plugins/entities/app.js'
import { playerEntitiesPlugin } from '../../plugins/entities/player.js'
import { loaderServerPlugin } from '@gamedev/core/plugins/loader/server.js'
import { loaderServerHandlersPlugin } from '../../plugins/loader/server-handlers.js'
import { livekitServerPlugin } from '../../plugins/livekit/server.js'
import { logsPlugin } from '@gamedev/core/plugins/logs.js'
import { monitorServerPlugin } from '@gamedev/core/plugins/monitor/server.js'
import { nodesPlugin } from '../../plugins/nodes.js'
import { spatialPlugin } from '@gamedev/core/plugins/spatial.js'
import { stagePlugin } from '../../plugins/stage.js'
import { storagePlugin } from '@gamedev/core/plugins/storage.js'
import { viewPlugin } from '../../plugins/view.js'
import { networkServerPlugin } from '../plugins/network/server.js'
import { serverRuntimePlugin } from '../plugins/runtime/server.js'

export { serverRuntimePlugin }

export const serverPreset = definePreset({
  name: '@gamedev/preset-server',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    animationPlugin,
    spatialPlugin,
    stagePlugin,
    storagePlugin,
    chatPlugin,
    serverRuntimePlugin,
    networkServerPlugin,
    environmentServerPlugin,
    monitorServerPlugin,
    loaderServerPlugin,
    loaderServerHandlersPlugin,
    appEntityPlugin,
    playerEntitiesPlugin,
    livekitServerPlugin,
    aiServerPlugin,
    evmServerPlugin,
    hyperliquidPlugin,
  ],
})

export function createServerWorld(options = {}) {
  return createWorldFromPreset(serverPreset, options)
}
