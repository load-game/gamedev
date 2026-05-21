import { definePlugin } from '../../plugins.js'
import { ClientLiveKit } from './ClientLiveKit.js'

export { ClientLiveKit }

export const livekitClientPlugin = definePlugin({
  name: '@gamedev/plugin-livekit/client',
  requires: ['core', 'client', 'network'],
  provides: ['@gamedev/plugin-livekit', 'livekit', 'voice'],
  systems: [['livekit', ClientLiveKit]],
})
