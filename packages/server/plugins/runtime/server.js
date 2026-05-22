import { definePlugin } from '@gamedev/core/plugins.js'
import { Server } from './Server.js'

export { Server }

export const serverRuntimePlugin = definePlugin({
  name: '@gamedev/server/runtime',
  requires: ['core'],
  systems: [['server', Server]],
})
