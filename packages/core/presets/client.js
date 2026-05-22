import { definePreset } from '../plugins.js'
import { createWorldFromPreset } from './createWorld.js'
import { coreSystemsPlugin } from './core.js'
import { actionsClientPlugin } from '../plugins/actions/client.js'
import { adminClientPlugin } from '../../plugins/admin/client.js'
import { animationPlugin } from '../plugins/animation.js'
import { audioClientPlugin } from '../plugins/audio/client.js'
import { builderClientPlugin } from '../../plugins/builder/client.js'
import { chatPlugin } from '../plugins/chat.js'
import { controlsClientPlugin } from '../plugins/controls/client.js'
import { cssClientPlugin } from '../plugins/css/client.js'
import { environmentClientPlugin } from '../plugins/environment/client.js'
import { appEntityPlugin } from '../../plugins/entities/app.js'
import { playerEntitiesPlugin } from '../../plugins/entities/player.js'
import { evmClientPlugin } from '../../plugins/evm/index.js'
import { graphicsClientPlugin } from '../plugins/graphics/client.js'
import { hyperliquidPlugin } from '../../plugins/hyperliquid/index.js'
import { aiClientPlugin } from '../../plugins/ai/client.js'
import { browserClientPlugin } from '../plugins/browser/client.js'
import { loaderClientPlugin } from '../plugins/loader/client.js'
import { loaderClientHandlersPlugin } from '../../plugins/loader/client-handlers.js'
import { livekitClientPlugin } from '../../plugins/livekit/client.js'
import { lodsClientPlugin } from '../plugins/lods/client.js'
import { logsPlugin } from '../plugins/logs.js'
import { nametagsClientPlugin } from '../plugins/nametags/client.js'
import { networkClientPlugin } from '../../plugins/network/client.js'
import { nodesPlugin } from '../../plugins/nodes.js'
import { particlesClientPlugin } from '../plugins/particles/client.js'
import { pointerClientPlugin } from '../plugins/pointer/client.js'
import { prefsClientPlugin } from '../plugins/prefs/client.js'
import { snapsClientPlugin } from '../plugins/snaps/client.js'
import { spatialPlugin } from '../plugins/spatial.js'
import { stagePlugin } from '../plugins/stage.js'
import { statsClientPlugin } from '../plugins/stats/client.js'
import { targetClientPlugin } from '../plugins/target/client.js'
import { uiClientPlugin } from '../plugins/ui/client.js'
import { viewPlugin } from '../../plugins/view.js'
import { windClientPlugin } from '../plugins/wind/client.js'
import { xrClientPlugin } from '../plugins/xr/client.js'
import { clientRuntimePlugin } from '../../plugins/runtime/client.js'

export { clientRuntimePlugin }

export const clientPreset = definePreset({
  name: '@gamedev/preset-client',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    animationPlugin,
    spatialPlugin,
    stagePlugin,
    chatPlugin,
    prefsClientPlugin,
    graphicsClientPlugin,
    controlsClientPlugin,
    clientRuntimePlugin,
    browserClientPlugin,
    networkClientPlugin,
    pointerClientPlugin,
    xrClientPlugin,
    cssClientPlugin,
    actionsClientPlugin,
    audioClientPlugin,
    statsClientPlugin,
    targetClientPlugin,
    lodsClientPlugin,
    snapsClientPlugin,
    windClientPlugin,
    nametagsClientPlugin,
    uiClientPlugin,
    loaderClientPlugin,
    loaderClientHandlersPlugin,
    appEntityPlugin,
    playerEntitiesPlugin,
    environmentClientPlugin,
    particlesClientPlugin,
    adminClientPlugin,
    builderClientPlugin,
    livekitClientPlugin,
    aiClientPlugin,
    evmClientPlugin,
    hyperliquidPlugin,
  ],
})

export function createClientWorld(options = {}) {
  return createWorldFromPreset(clientPreset, options)
}
