import { definePlugin } from '../../plugins.js'
import { ClientNetwork } from './ClientNetwork.js'

export { ClientNetwork }

export const networkClientPlugin = definePlugin({
  name: '@gamedev/plugin-network/client',
  requires: ['core', 'chat', 'client'],
  provides: ['@gamedev/plugin-network', 'network'],
  systems: [['network', ClientNetwork]],
})
