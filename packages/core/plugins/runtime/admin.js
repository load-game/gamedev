import { definePlugin } from '../../plugins.js'
import { Client } from '../../systems/Client.js'

export { Client }

export const adminRuntimePlugin = definePlugin({
  name: '@gamedev/admin/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
})
