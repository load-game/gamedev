import { definePlugin } from '../../plugins.js'
import { AdminLiveKit } from './AdminLiveKit.js'

export { AdminLiveKit }

export const livekitAdminPlugin = definePlugin({
  name: '@gamedev/plugin-livekit/admin',
  requires: ['core', 'client', 'network'],
  provides: ['@gamedev/plugin-livekit', 'livekit', 'voice'],
  systems: [['livekit', AdminLiveKit]],
})
