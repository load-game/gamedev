import { definePlugin } from '../../plugins.js'
import { Client } from '../../systems/Client.js'

export { Client }

export const viewerRuntimePlugin = definePlugin({
  name: '@gamedev/viewer/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
})
