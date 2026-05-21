import { definePlugin } from '../../plugins.js'
import { AdminNetwork } from './AdminNetwork.js'

export { AdminNetwork }

export const networkAdminPlugin = definePlugin({
  name: '@gamedev/plugin-network/admin',
  requires: ['core', 'client'],
  provides: ['@gamedev/plugin-network', 'network'],
  systems: [['network', AdminNetwork]],
  setup(world) {
    world.adminNetwork = world.network
  },
})
