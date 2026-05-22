import { definePlugin } from '../../core/plugins.js'
import { NodeClient } from './NodeClient.js'

export { NodeClient }

export const nodeClientRuntimePlugin = definePlugin({
  name: '@gamedev/node-client/runtime',
  requires: ['core'],
  systems: [['client', NodeClient]],
})
