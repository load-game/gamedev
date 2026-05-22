import { definePlugin } from '../../core/plugins.js'
import { Client } from './Client.js'

export { Client }

export const adminRuntimePlugin = definePlugin({
  name: '@gamedev/admin/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
})
