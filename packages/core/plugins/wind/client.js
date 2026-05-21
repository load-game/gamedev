import { definePlugin } from '../../plugins.js'
import { Wind } from './Wind.js'

export { Wind }

export const windClientPlugin = definePlugin({
  name: '@gamedev/plugin-wind/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-wind', 'wind'],
  systems: [['wind', Wind]],
})
