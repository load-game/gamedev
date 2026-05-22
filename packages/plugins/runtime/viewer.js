import { definePlugin } from '../../core/plugins.js'
import { Client } from './Client.js'

export { Client }

export const viewerRuntimePlugin = definePlugin({
  name: '@gamedev/viewer/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
})
