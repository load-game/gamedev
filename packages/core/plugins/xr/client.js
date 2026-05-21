import { definePlugin } from '../../plugins.js'
import { XR } from './XR.js'

export { XR }

export const xrClientPlugin = definePlugin({
  name: '@gamedev/plugin-xr/client',
  requires: ['core', 'graphics'],
  provides: ['@gamedev/plugin-xr', 'xr'],
  systems: [['xr', XR]],
})
