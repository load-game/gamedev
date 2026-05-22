import { definePlugin } from '../../core/plugins.js'
import { ServerMonitor } from './ServerMonitor.js'

export { ServerMonitor }

export const monitorServerPlugin = definePlugin({
  name: '@gamedev/plugin-monitor/server',
  requires: ['core', 'server'],
  provides: ['@gamedev/plugin-monitor', 'monitor'],
  systems: [['monitor', ServerMonitor]],
})
