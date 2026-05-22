import { definePlugin } from '../../core/plugins.js'
import { ClientLiveKit } from './ClientLiveKit.js'
import { livekitClientScriptApi } from './scriptApi.js'

export { ClientLiveKit }
export { livekitClientScriptApi }

export const livekitClientPlugin = definePlugin({
  name: '@gamedev/plugin-livekit/client',
  requires: ['core', 'client', 'network', 'audio'],
  provides: ['@gamedev/plugin-livekit', 'livekit', 'voice'],
  systems: [['livekit', ClientLiveKit]],
  scripts: livekitClientScriptApi,
})
