import { World } from './World.js'
import { definePlugin, definePreset } from './plugins.js'
import { coreSystemsPlugin } from './presets/core.js'
import { actionsClientPlugin } from './plugins/actions/client.js'
import { adminClientPlugin } from './plugins/admin/client.js'
import { audioClientPlugin } from './plugins/audio/client.js'
import { builderAdminPlugin } from './plugins/builder/admin.js'
import { chatPlugin } from './plugins/chat.js'
import { cssClientPlugin } from './plugins/css/client.js'
import { environmentClientPlugin } from './plugins/environment/client.js'
import { loaderClientPlugin } from './plugins/loader/client.js'
import { livekitAdminPlugin } from './plugins/livekit/admin.js'
import { lodsClientPlugin } from './plugins/lods/client.js'
import { nametagsClientPlugin } from './plugins/nametags/client.js'
import { particlesClientPlugin } from './plugins/particles/client.js'
import { prefsClientPlugin } from './plugins/prefs/client.js'
import { snapsClientPlugin } from './plugins/snaps/client.js'
import { statsClientPlugin } from './plugins/stats/client.js'
import { targetClientPlugin } from './plugins/target/client.js'
import { uiClientPlugin } from './plugins/ui/client.js'
import { windClientPlugin } from './plugins/wind/client.js'

import { Client } from './systems/Client.js'
import { ClientPointer } from './systems/ClientPointer.js'
import { ClientControls } from './systems/ClientControls.js'
import { AdminNetwork } from './systems/AdminNetwork.js'
import { ClientGraphics } from './systems/ClientGraphics.js'
import { AdminXR } from './systems/AdminXR.js'

import { FreeCam } from './entities/FreeCam.js'
import { AdminLocalPlayer } from './entities/AdminLocalPlayer.js'

export const adminRuntimePlugin = definePlugin({
  name: '@gamedev/admin/runtime',
  requires: ['core', 'chat', 'prefs'],
  systems: [
    ['client', Client],
    ['pointer', ClientPointer],
    ['controls', ClientControls],
    ['network', AdminNetwork],
    ['graphics', ClientGraphics],
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
    prefsClientPlugin,
    adminRuntimePlugin,
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
