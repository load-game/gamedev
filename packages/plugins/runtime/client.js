import { definePlugin } from '../../core/plugins.js'
import { Client } from './Client.js'

export { Client }

export const clientRuntimePlugin = definePlugin({
  name: '@gamedev/client/runtime',
  requires: ['core', 'graphics'],
  systems: [['client', Client]],
})
