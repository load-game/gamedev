import { definePlugin } from '../../plugins.js'
import { ClientPointer } from './ClientPointer.js'

export { ClientPointer }

export const pointerClientPlugin = definePlugin({
  name: '@gamedev/plugin-pointer/client',
  requires: ['core', 'controls'],
  provides: ['@gamedev/plugin-pointer', 'pointer'],
  systems: [['pointer', ClientPointer]],
})
