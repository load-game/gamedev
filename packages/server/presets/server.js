import { definePreset } from '@gamedev/core/plugins.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { animationPlugin } from '@gamedev/core/plugins/animation.js'
import { chatPlugin } from '@gamedev/core/plugins/chat.js'
import { environmentServerPlugin } from '@gamedev/core/plugins/environment/server.js'
import { evmServerPlugin } from '@gamedev/core/plugins/evm.js'
import { hyperliquidPlugin } from '@gamedev/core/plugins/hyperliquid.js'
import { aiServerPlugin } from '@gamedev/core/plugins/ai/server.js'
import { appEntityPlugin } from '@gamedev/core/plugins/entities/app.js'
import { playerEntitiesPlugin } from '@gamedev/core/plugins/entities/player.js'
import { loaderServerPlugin } from '@gamedev/core/plugins/loader/server.js'
import { loaderServerHandlersPlugin } from '@gamedev/core/plugins/loader/server-handlers.js'
import { livekitServerPlugin } from '@gamedev/core/plugins/livekit/server.js'
import { logsPlugin } from '@gamedev/core/plugins/logs.js'
import { monitorServerPlugin } from '@gamedev/core/plugins/monitor/server.js'
import { nodesPlugin } from '@gamedev/core/plugins/nodes.js'
import { spatialPlugin } from '@gamedev/core/plugins/spatial.js'
import { stagePlugin } from '@gamedev/core/plugins/stage.js'
import { storagePlugin } from '@gamedev/core/plugins/storage.js'
import { viewPlugin } from '@gamedev/core/plugins/view.js'
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
