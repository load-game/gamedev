import { definePlugin } from '../../core/plugins.js'
import { ClientTarget } from './ClientTarget.js'

export { ClientTarget }

export const targetClientPlugin = definePlugin({
  name: '@gamedev/plugin-target/client',
  requires: ['core', 'client', 'view'],
  provides: ['@gamedev/plugin-target', 'target'],
  systems: [['target', ClientTarget]],
})
