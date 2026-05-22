import { definePlugin } from '../core/plugins.js'
import { Logs } from './logs/Logs.js'

export { Logs }

export const logsPlugin = definePlugin({
  name: '@gamedev/plugin-logs',
  requires: ['core'],
  provides: ['@gamedev/plugin-logs', 'logs'],
  systems: [['logs', Logs]],
})
