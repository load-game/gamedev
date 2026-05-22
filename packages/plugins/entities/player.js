import { definePlugin } from '../../core/plugins.js'
import { PlayerLocal } from './PlayerLocal.js'
import { PlayerRemote } from './PlayerRemote.js'
import { cleanupPlayerEntityProxy, playerEntityScriptApi } from './playerScriptApi.js'

export { PlayerLocal, PlayerRemote }
export { cleanupPlayerEntityProxy, playerEntityScriptApi }

function createPlayerEntity(world, data, local) {
  if (world.playerEntityFactory) {
    return world.playerEntityFactory(world, data, local)
  }
  const Entity = data.owner === world.network.id ? PlayerLocal : PlayerRemote
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
