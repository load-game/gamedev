import { definePlugin } from '../../plugins.js'
import { AdminBuilder } from './AdminBuilder.js'

export { AdminBuilder }

export const builderAdminPlugin = definePlugin({
  name: '@gamedev/plugin-builder/admin',
  requires: ['core', 'client', 'network', 'controls', 'ui', 'loader', 'admin', 'snaps', 'stage'],
  provides: ['@gamedev/plugin-builder', 'builder'],
  systems: [['builder', AdminBuilder]],
})
