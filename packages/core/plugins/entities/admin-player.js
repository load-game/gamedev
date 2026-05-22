import { definePlugin } from '../../plugins.js'
import { AdminLocalPlayer } from './AdminLocalPlayer.js'
import { AdminPlayerRemote } from './AdminPlayerRemote.js'
import { FreeCam } from './FreeCam.js'
import { uuid } from '../../ids/uuid.js'

export { AdminLocalPlayer, AdminPlayerRemote, FreeCam }

export function createAdminPlayerEntity(world, data, local) {
  return new AdminPlayerRemote(world, data, local)
}

export const adminPlayerEntitiesPlugin = definePlugin({
  name: '@gamedev/plugin-entities/admin-player',
  requires: ['core', 'client', 'controls', 'entities', 'admin-network', 'player-entities', 'view'],
  provides: ['admin-player-entities'],
  setup(world) {
    if (world.playerEntityFactory) {
      throw new Error('player_entity_factory_collision:@gamedev/plugin-entities/admin-player')
    }
    world.isAdminClient = true
    world.playerEntityFactory = createAdminPlayerEntity

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
