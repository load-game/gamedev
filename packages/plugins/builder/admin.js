import { definePlugin } from '../../core/plugins.js'
import { AdminBuilder } from './AdminBuilder.js'

export { AdminBuilder }

export const builderAdminPlugin = definePlugin({
  name: '@gamedev/plugin-builder/admin',
  requires: [
    'core',
    'client',
    'network',
    'controls',
    'ui',
    'loader',
    'admin',
    'nodes',
    'entity:app',
    'snaps',
    'stage',
    'view',
  ],
  provides: ['@gamedev/plugin-builder', 'builder'],
  systems: [['builder', AdminBuilder]],
})
