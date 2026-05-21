import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { evmClientPlugin } from './plugins/evm.js'
import { hyperliquidPlugin } from './plugins/hyperliquid.js'

import { Client } from './systems/Client.js'
import { ClientLiveKit } from './systems/ClientLiveKit.js'
import { ClientPointer } from './systems/ClientPointer.js'
import { ClientPrefs } from './systems/ClientPrefs.js'
import { ClientControls } from './systems/ClientControls.js'
import { ClientNetwork } from './systems/ClientNetwork.js'
import { AdminClient } from './systems/AdminClient.js'
import { ClientLoader } from './systems/ClientLoader.js'
import { ClientCSS } from './systems/ClientCSS.js'
import { ClientGraphics } from './systems/ClientGraphics.js'
import { ClientEnvironment } from './systems/ClientEnvironment.js'
import { ClientAudio } from './systems/ClientAudio.js'
import { ClientStats } from './systems/ClientStats.js'
import { ClientBuilder } from './systems/ClientBuilder.js'
import { ClientActions } from './systems/ClientActions.js'
import { ClientTarget } from './systems/ClientTarget.js'
import { ClientUI } from './systems/ClientUI.js'
import { ClientAI } from './systems/ClientAI.js'
import { ClientDrafts } from './systems/ClientDrafts.js'
import { LODs } from './systems/LODs.js'
import { Nametags } from './systems/Nametags.js'
import { Particles } from './systems/Particles.js'
import { Snaps } from './systems/Snaps.js'
import { Wind } from './systems/Wind.js'
import { XR } from './systems/XR.js'

export const clientRuntimePlugin = definePlugin({
  name: '@gamedev/client/runtime',
  requires: ['core'],
  systems: [
    ['client', Client],
    ['livekit', ClientLiveKit],
    ['pointer', ClientPointer],
    ['prefs', ClientPrefs],
    ['controls', ClientControls],
    ['network', ClientNetwork],
    ['admin', AdminClient],
    ['loader', ClientLoader],
    ['css', ClientCSS],
    ['graphics', ClientGraphics],
    ['environment', ClientEnvironment],
    ['audio', ClientAudio],
    ['stats', ClientStats],
    ['builder', ClientBuilder],
    ['actions', ClientActions],
    ['target', ClientTarget],
    ['ui', ClientUI],
    ['ai', ClientAI],
    ['drafts', ClientDrafts],
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
  plugins: [coreSystemsPlugin, clientRuntimePlugin, evmClientPlugin, hyperliquidPlugin],
})

export function createClientWorld(options = {}) {
  const world = new World()
  world.install(clientPreset)
  world.install(options.plugins || [])
  return world
}
