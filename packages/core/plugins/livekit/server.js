import { definePlugin } from '../../plugins.js'
import { ServerLiveKit } from './ServerLiveKit.js'

export { ServerLiveKit }

export const livekitServerPlugin = definePlugin({
  name: '@gamedev/plugin-livekit/server',
  requires: ['core', 'server', 'network'],
  provides: ['@gamedev/plugin-livekit', 'livekit', 'voice'],
  systems: [['livekit', ServerLiveKit]],
})
