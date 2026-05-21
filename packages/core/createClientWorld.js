import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { actionsClientPlugin } from './plugins/actions/client.js'
import { adminClientPlugin } from './plugins/admin/client.js'
import { audioClientPlugin } from './plugins/audio/client.js'
import { builderClientPlugin } from './plugins/builder/client.js'
import { chatPlugin } from './plugins/chat.js'
import { controlsClientPlugin } from './plugins/controls/client.js'
import { cssClientPlugin } from './plugins/css/client.js'
import { environmentClientPlugin } from './plugins/environment/client.js'
import { evmClientPlugin } from './plugins/evm.js'
import { graphicsClientPlugin } from './plugins/graphics/client.js'
import { hyperliquidPlugin } from './plugins/hyperliquid.js'
import { aiClientPlugin } from './plugins/ai/client.js'
import { browserClientPlugin } from './plugins/browser/client.js'
import { loaderClientPlugin } from './plugins/loader/client.js'
import { livekitClientPlugin } from './plugins/livekit/client.js'
import { lodsClientPlugin } from './plugins/lods/client.js'
import { logsPlugin } from './plugins/logs.js'
import { nametagsClientPlugin } from './plugins/nametags/client.js'
import { networkClientPlugin } from './plugins/network/client.js'
import { nodesPlugin } from './plugins/nodes.js'
import { particlesClientPlugin } from './plugins/particles/client.js'
import { pointerClientPlugin } from './plugins/pointer/client.js'
import { prefsClientPlugin } from './plugins/prefs/client.js'
import { snapsClientPlugin } from './plugins/snaps/client.js'
import { spatialPlugin } from './plugins/spatial.js'
import { statsClientPlugin } from './plugins/stats/client.js'
import { targetClientPlugin } from './plugins/target/client.js'
import { uiClientPlugin } from './plugins/ui/client.js'
import { windClientPlugin } from './plugins/wind/client.js'
import { xrClientPlugin } from './plugins/xr/client.js'

import { Client } from './systems/Client.js'

export const clientRuntimePlugin = definePlugin({
  name: '@gamedev/client/runtime',
  requires: ['core', 'graphics'],
  systems: [['client', Client]],
})

export const clientPreset = definePreset({
  name: '@gamedev/preset-client',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    spatialPlugin,
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
  const world = new World()
  world.install(clientPreset)
  world.install(options.plugins || [])
  return world
}
