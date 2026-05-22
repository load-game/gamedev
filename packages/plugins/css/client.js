import { definePlugin } from '../../core/plugins.js'
import { ClientCSS } from './ClientCSS.js'

export { ClientCSS }

export const cssClientPlugin = definePlugin({
  name: '@gamedev/plugin-css/client',
  requires: ['core', 'graphics'],
  provides: ['@gamedev/plugin-css', 'css'],
  systems: [['css', ClientCSS]],
})
