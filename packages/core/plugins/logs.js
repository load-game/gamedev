import { definePlugin } from '../plugins.js'
import { Logs } from '../systems/Logs.js'

export { Logs }

export const logsPlugin = definePlugin({
  name: '@gamedev/plugin-logs',
  requires: ['core'],
  provides: ['@gamedev/plugin-logs', 'logs'],
  systems: [['logs', Logs]],
})
