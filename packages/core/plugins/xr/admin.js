import { definePlugin } from '../../plugins.js'
import { AdminXR } from './AdminXR.js'

export { AdminXR }

export const xrAdminPlugin = definePlugin({
  name: '@gamedev/plugin-xr/admin',
  requires: ['core'],
  provides: ['@gamedev/plugin-xr', 'xr'],
  systems: [['xr', AdminXR]],
})
