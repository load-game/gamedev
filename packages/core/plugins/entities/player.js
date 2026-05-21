import { definePlugin } from '../../plugins.js'
import { AdminPlayerRemote } from '../../entities/AdminPlayerRemote.js'
import { PlayerLocal } from '../../entities/PlayerLocal.js'
import { PlayerRemote } from '../../entities/PlayerRemote.js'

export { AdminPlayerRemote, PlayerLocal, PlayerRemote }

function createPlayerEntity(world, data, local) {
  const Entity = world.isAdminClient ? AdminPlayerRemote : data.owner === world.network.id ? PlayerLocal : PlayerRemote
  return new Entity(world, data, local)
}

export const playerEntitiesPlugin = definePlugin({
  name: '@gamedev/plugin-entities/player',
  requires: ['core', 'entities', 'nodes', 'loader', 'loader:avatar', 'network', 'spatial'],
  provides: ['player-entities'],
  entities: [
    {
      key: 'player',
      create: createPlayerEntity,
    },
  ],
})
