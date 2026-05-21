import { definePlugin } from '../../plugins.js'
import { ClientGraphics } from './ClientGraphics.js'

export { ClientGraphics }

export const graphicsClientPlugin = definePlugin({
  name: '@gamedev/plugin-graphics/client',
  requires: ['core', 'prefs'],
  provides: ['@gamedev/plugin-graphics', 'graphics'],
  systems: [['graphics', ClientGraphics]],
})
