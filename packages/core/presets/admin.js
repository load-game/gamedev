import { definePlugin, definePreset } from '../plugins.js'
import { coreSystemsPlugin } from './core.js'
import { actionsClientPlugin } from '../plugins/actions/client.js'
import { adminClientPlugin } from '../plugins/admin/client.js'
import { audioClientPlugin } from '../plugins/audio/client.js'
import { builderAdminPlugin } from '../plugins/builder/admin.js'
import { browserClientPlugin } from '../plugins/browser/client.js'
import { chatPlugin } from '../plugins/chat.js'
import { controlsClientPlugin } from '../plugins/controls/client.js'
import { cssClientPlugin } from '../plugins/css/client.js'
import { environmentClientPlugin } from '../plugins/environment/client.js'
import { appEntityPlugin } from '../plugins/entities/app.js'
import { playerEntitiesPlugin } from '../plugins/entities/player.js'
import { graphicsClientPlugin } from '../plugins/graphics/client.js'
import { loaderClientPlugin } from '../plugins/loader/client.js'
import { livekitAdminPlugin } from '../plugins/livekit/admin.js'
import { lodsClientPlugin } from '../plugins/lods/client.js'
import { logsPlugin } from '../plugins/logs.js'
import { nametagsClientPlugin } from '../plugins/nametags/client.js'
import { networkAdminPlugin } from '../plugins/network/admin.js'
import { nodesPlugin } from '../plugins/nodes.js'
import { particlesClientPlugin } from '../plugins/particles/client.js'
import { pointerClientPlugin } from '../plugins/pointer/client.js'
import { prefsClientPlugin } from '../plugins/prefs/client.js'
import { snapsClientPlugin } from '../plugins/snaps/client.js'
import { spatialPlugin } from '../plugins/spatial.js'
import { statsClientPlugin } from '../plugins/stats/client.js'
import { targetClientPlugin } from '../plugins/target/client.js'
import { uiClientPlugin } from '../plugins/ui/client.js'
import { viewPlugin } from '../plugins/view.js'
import { windClientPlugin } from '../plugins/wind/client.js'
import { xrAdminPlugin } from '../plugins/xr/admin.js'
import { AdminLocalPlayer } from '../entities/AdminLocalPlayer.js'
import { FreeCam } from '../entities/FreeCam.js'
import { Client } from '../systems/Client.js'
import { uuid } from '../utils.js'

export const adminRuntimePlugin = definePlugin({
  name: '@gamedev/admin/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
  setup(world) {
    world.isAdminClient = true

    const adminPlayer = new AdminLocalPlayer(world, { id: world.network?.id || uuid() })
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
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    spatialPlugin,
    chatPlugin,
    prefsClientPlugin,
    graphicsClientPlugin,
    controlsClientPlugin,
    adminRuntimePlugin,
    browserClientPlugin,
    networkAdminPlugin,
    pointerClientPlugin,
    xrAdminPlugin,
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
    appEntityPlugin,
    playerEntitiesPlugin,
    environmentClientPlugin,
    particlesClientPlugin,
    adminClientPlugin,
    builderAdminPlugin,
    livekitAdminPlugin,
  ],
})
