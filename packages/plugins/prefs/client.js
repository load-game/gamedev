import { definePlugin } from '../../core/plugins.js'
import { ClientPrefs } from './ClientPrefs.js'

export { ClientPrefs }

export const prefsClientPlugin = definePlugin({
  name: '@gamedev/plugin-prefs/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-prefs', 'prefs'],
  systems: [['prefs', ClientPrefs]],
})
