import { World } from '@gamedev/core/World.js'
import { definePlugin, definePreset } from '@gamedev/core/plugins.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { chatPlugin } from '@gamedev/core/plugins/chat.js'
import { environmentServerPlugin } from '@gamedev/core/plugins/environment/server.js'
import { evmServerPlugin } from '@gamedev/core/plugins/evm.js'
import { hyperliquidPlugin } from '@gamedev/core/plugins/hyperliquid.js'
import { aiServerPlugin } from '@gamedev/core/plugins/ai/server.js'
import { loaderServerPlugin } from '@gamedev/core/plugins/loader/server.js'
import { livekitServerPlugin } from '@gamedev/core/plugins/livekit/server.js'

import { Server } from '@gamedev/core/systems/Server.js'
import { ServerMonitor } from '@gamedev/core/systems/ServerMonitor.js'
import { ServerNetwork } from './ServerNetwork.js'

export const serverRuntimePlugin = definePlugin({
  name: '@gamedev/server/runtime',
  requires: ['core', 'chat'],
  systems: [
    ['server', Server],
    ['network', ServerNetwork],
    ['monitor', ServerMonitor],
  ],
})

export const serverPreset = definePreset({
  name: '@gamedev/preset-server',
  plugins: [
    coreSystemsPlugin,
    chatPlugin,
    serverRuntimePlugin,
    environmentServerPlugin,
    loaderServerPlugin,
    livekitServerPlugin,
    aiServerPlugin,
    evmServerPlugin,
    hyperliquidPlugin,
  ],
})

export function createServerWorld(options = {}) {
  const world = new World()
  world.install(serverPreset)
  world.install(options.plugins || [])
  return world
}
