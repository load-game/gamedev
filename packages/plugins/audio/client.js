import { definePlugin } from '../../core/plugins.js'
import { ClientAudio } from './ClientAudio.js'

export { ClientAudio }

export const audioClientPlugin = definePlugin({
  name: '@gamedev/plugin-audio/client',
  requires: ['core', 'client', 'prefs', 'view'],
  provides: ['@gamedev/plugin-audio', 'audio'],
  systems: [['audio', ClientAudio]],
})
