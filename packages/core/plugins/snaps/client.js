import { definePlugin } from '../../plugins.js'
import { Snaps } from './Snaps.js'

export { Snaps }

export const snapsClientPlugin = definePlugin({
  name: '@gamedev/plugin-snaps/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-snaps', 'snaps'],
  systems: [['snaps', Snaps]],
})
