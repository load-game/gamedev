import { definePlugin } from '../../plugins.js'
import { ClientEnvironment } from './ClientEnvironment.js'

export { ClientEnvironment }

export const environmentClientPlugin = definePlugin({
  name: '@gamedev/plugin-environment/client',
  requires: ['core', 'prefs', 'graphics', 'loader', 'loader:hdr', 'loader:texture', 'stage'],
  provides: ['@gamedev/plugin-environment', 'environment'],
  systems: [['environment', ClientEnvironment]],
})
