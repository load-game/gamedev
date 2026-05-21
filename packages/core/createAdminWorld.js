import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { adminClientPlugin } from './plugins/admin/client.js'
import { builderAdminPlugin } from './plugins/builder/admin.js'
import { chatPlugin } from './plugins/chat.js'
import { loaderClientPlugin } from './plugins/loader/client.js'
import { livekitAdminPlugin } from './plugins/livekit/admin.js'
import { uiClientPlugin } from './plugins/ui/client.js'

import { Client } from './systems/Client.js'
import { ClientPointer } from './systems/ClientPointer.js'
import { ClientPrefs } from './systems/ClientPrefs.js'
import { ClientControls } from './systems/ClientControls.js'
import { AdminNetwork } from './systems/AdminNetwork.js'
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
import { AdminXR } from './systems/AdminXR.js'

import { FreeCam } from './entities/FreeCam.js'
import { AdminLocalPlayer } from './entities/AdminLocalPlayer.js'

export const adminRuntimePlugin = definePlugin({
  name: '@gamedev/admin/runtime',
  requires: ['core', 'chat'],
  systems: [
    ['client', Client],
    ['pointer', ClientPointer],
    ['prefs', ClientPrefs],
    ['controls', ClientControls],
    ['network', AdminNetwork],
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
    ['xr', AdminXR],
  ],
  setup(world) {
    world.isAdminClient = true
    world.adminNetwork = world.network

    const adminPlayer = new AdminLocalPlayer(world, { id: world.network.id })
    world.entities.player = adminPlayer
    world.adminPlayer = adminPlayer
    world.emit('player', adminPlayer)

    const baseInit = world.init.bind(world)
    world.init = async options => {
      await baseInit(options)
      if (!world.freeCam) {
        world.freeCam = new FreeCam(world)
      }
    }
  },
})

export const adminPreset = definePreset({
  name: '@gamedev/preset-admin',
  plugins: [
    coreSystemsPlugin,
    chatPlugin,
    adminRuntimePlugin,
    uiClientPlugin,
    loaderClientPlugin,
    adminClientPlugin,
    builderAdminPlugin,
    livekitAdminPlugin,
  ],
})

export function createAdminWorld(options = {}) {
  const world = new World()
  world.install(adminPreset)
  world.install(options.plugins || [])
  return world
}
