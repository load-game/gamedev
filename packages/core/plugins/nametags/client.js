import { definePlugin } from '../../plugins.js'
import { Nametags } from './Nametags.js'

export { Nametags }

export const nametagsClientPlugin = definePlugin({
  name: '@gamedev/plugin-nametags/client',
  requires: ['core', 'client', 'stage', 'view'],
  provides: ['@gamedev/plugin-nametags', 'nametags'],
  systems: [['nametags', Nametags]],
})
