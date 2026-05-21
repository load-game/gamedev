import { definePlugin } from '../../plugins.js'
import { LODs } from './LODs.js'

export { LODs }

export const lodsClientPlugin = definePlugin({
  name: '@gamedev/plugin-lods/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-lods', 'lods'],
  systems: [['lods', LODs]],
})
