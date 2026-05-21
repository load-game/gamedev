import { definePlugin } from '../../plugins.js'
import { ClientAudio } from './ClientAudio.js'

export { ClientAudio }

export const audioClientPlugin = definePlugin({
  name: '@gamedev/plugin-audio/client',
  requires: ['core', 'client', 'prefs'],
  provides: ['@gamedev/plugin-audio', 'audio'],
  systems: [['audio', ClientAudio]],
})
