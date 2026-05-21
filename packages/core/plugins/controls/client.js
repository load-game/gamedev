import { definePlugin } from '../../plugins.js'
import { ClientControls } from './ClientControls.js'

export { ClientControls }

export const controlsClientPlugin = definePlugin({
  name: '@gamedev/plugin-controls/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-controls', 'controls'],
  systems: [['controls', ClientControls]],
})
