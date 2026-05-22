import { definePlugin } from '../../plugins.js'
import { AdminPlayerRemote } from '../../entities/AdminPlayerRemote.js'
import { PlayerLocal } from '../../entities/PlayerLocal.js'
import { PlayerRemote } from '../../entities/PlayerRemote.js'
import { cleanupPlayerEntityProxy, playerEntityScriptApi } from './playerScriptApi.js'

export { AdminPlayerRemote, PlayerLocal, PlayerRemote }
export { cleanupPlayerEntityProxy, playerEntityScriptApi }

function createPlayerEntity(world, data, local) {
  const Entity = world.isAdminClient ? AdminPlayerRemote : data.owner === world.network.id ? PlayerLocal : PlayerRemote
  return new Entity(world, data, local)
}

export const playerEntitiesPlugin = definePlugin({
  name: '@gamedev/plugin-entities/player',
  requires: ['core', 'apps', 'entities', 'nodes', 'loader', 'loader:avatar', 'network', 'spatial'],
  provides: ['player-entities'],
  entities: [
    {
      key: 'player',
      create: createPlayerEntity,
    },
  ],
  scripts: playerEntityScriptApi,
  setup(world) {
    world.apps.addPlayerProxyCleanup(cleanupPlayerEntityProxy, '@gamedev/plugin-entities/player')
  },
})
