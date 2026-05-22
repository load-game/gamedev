import { definePlugin } from '../../core/plugins.js'
import { ServerLiveKit } from './ServerLiveKit.js'
import { cleanupLiveKitPlayerProxy, livekitServerScriptApi } from './scriptApi.js'

export { ServerLiveKit }
export { cleanupLiveKitPlayerProxy, livekitServerScriptApi }

export const livekitServerPlugin = definePlugin({
  name: '@gamedev/plugin-livekit/server',
  requires: ['core', 'server', 'network'],
  provides: ['@gamedev/plugin-livekit', 'livekit', 'voice'],
  systems: [['livekit', ServerLiveKit]],
  scripts: livekitServerScriptApi,
  setup(world) {
    world.apps.addPlayerProxyCleanup(cleanupLiveKitPlayerProxy, '@gamedev/plugin-livekit/server')
  },
})
