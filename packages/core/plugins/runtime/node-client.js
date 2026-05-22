import { definePlugin } from '../../plugins.js'
import { NodeClient } from '../../systems/NodeClient.js'

export { NodeClient }

export const nodeClientRuntimePlugin = definePlugin({
  name: '@gamedev/node-client/runtime',
  requires: ['core'],
  systems: [['client', NodeClient]],
})
