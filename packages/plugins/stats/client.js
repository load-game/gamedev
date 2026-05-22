import { definePlugin } from '../../core/plugins.js'
import { ClientStats } from './ClientStats.js'

export { ClientStats }

export const statsClientPlugin = definePlugin({
  name: '@gamedev/plugin-stats/client',
  requires: ['core', 'client', 'prefs', 'graphics', 'network'],
  provides: ['@gamedev/plugin-stats', 'stats'],
  systems: [['stats', ClientStats]],
})
