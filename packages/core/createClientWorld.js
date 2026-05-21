import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { adminClientPlugin } from './plugins/admin/client.js'
import { builderClientPlugin } from './plugins/builder/client.js'
import { chatPlugin } from './plugins/chat.js'
import { evmClientPlugin } from './plugins/evm.js'
import { hyperliquidPlugin } from './plugins/hyperliquid.js'
import { aiClientPlugin } from './plugins/ai/client.js'
import { loaderClientPlugin } from './plugins/loader/client.js'
import { livekitClientPlugin } from './plugins/livekit/client.js'
import { uiClientPlugin } from './plugins/ui/client.js'

import { Client } from './systems/Client.js'
import { ClientPointer } from './systems/ClientPointer.js'
import { ClientPrefs } from './systems/ClientPrefs.js'
import { ClientControls } from './systems/ClientControls.js'
import { ClientNetwork } from './systems/ClientNetwork.js'
import { ClientCSS } from './systems/ClientCSS.js'
import { ClientGraphics } from './systems/ClientGraphics.js'
import { ClientEnvironment } from './systems/ClientEnvironment.js'
import { ClientAudio } from './systems/ClientAudio.js'
import { ClientStats } from './systems/ClientStats.js'
import { ClientActions } from './systems/ClientActions.js'
import { ClientTarget } from './systems/ClientTarget.js'
import { LODs } from './systems/LODs.js'
import { Nametags } from './systems/Nametags.js'
import { Particles } from './systems/Particles.js'
import { Snaps } from './systems/Snaps.js'
import { Wind } from './systems/Wind.js'
import { XR } from './systems/XR.js'

export const clientRuntimePlugin = definePlugin({
  name: '@gamedev/client/runtime',
  requires: ['core', 'chat'],
  systems: [
    ['client', Client],
    ['pointer', ClientPointer],
    ['prefs', ClientPrefs],
    ['controls', ClientControls],
    ['network', ClientNetwork],
    ['css', ClientCSS],
    ['graphics', ClientGraphics],
    ['environment', ClientEnvironment],
    ['audio', ClientAudio],
    ['stats', ClientStats],
    ['actions', ClientActions],
    ['target', ClientTarget],
    ['lods', LODs],
    ['nametags', Nametags],
    ['particles', Particles],
    ['snaps', Snaps],
    ['wind', Wind],
    ['xr', XR],
  ],
})

export const clientPreset = definePreset({
  name: '@gamedev/preset-client',
  plugins: [
    coreSystemsPlugin,
    chatPlugin,
    clientRuntimePlugin,
    uiClientPlugin,
    loaderClientPlugin,
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
