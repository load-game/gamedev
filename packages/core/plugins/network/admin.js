import { definePlugin } from '../../plugins.js'
import { AdminNetwork } from './AdminNetwork.js'
import { networkScriptApi } from './scriptApi.js'

export { AdminNetwork, networkScriptApi }

export const networkAdminPlugin = definePlugin({
  name: '@gamedev/plugin-network/admin',
  requires: ['core', 'client', 'nodes', 'spatial'],
  provides: ['@gamedev/plugin-network', 'network'],
  systems: [['network', AdminNetwork]],
  scripts: networkScriptApi,
  setup(world) {
    world.adminNetwork = world.network
  },
})
