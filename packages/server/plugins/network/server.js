import { definePlugin } from '@gamedev/core/plugins.js'
import { ServerNetwork } from './ServerNetwork.js'

export { ServerNetwork }

export const networkServerPlugin = definePlugin({
  name: '@gamedev/plugin-network/server',
  requires: ['core', 'server', 'chat'],
  provides: ['@gamedev/plugin-network', 'network'],
  systems: [['network', ServerNetwork]],
})
