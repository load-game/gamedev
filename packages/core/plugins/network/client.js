import { definePlugin } from '../../plugins.js'
import { ClientNetwork } from './ClientNetwork.js'
import { networkScriptApi } from './scriptApi.js'

export { ClientNetwork, networkScriptApi }

export const networkClientPlugin = definePlugin({
  name: '@gamedev/plugin-network/client',
  requires: ['core', 'chat', 'client', 'spatial'],
  provides: ['@gamedev/plugin-network', 'network'],
  systems: [['network', ClientNetwork]],
  scripts: networkScriptApi,
})
