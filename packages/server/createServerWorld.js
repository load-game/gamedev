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
import { monitorServerPlugin } from '@gamedev/core/plugins/monitor/server.js'
import { storagePlugin } from '@gamedev/core/plugins/storage.js'
import { networkServerPlugin } from './plugins/network/server.js'

import { Server } from '@gamedev/core/systems/Server.js'

export const serverRuntimePlugin = definePlugin({
  name: '@gamedev/server/runtime',
  requires: ['core'],
  systems: [['server', Server]],
})

export const serverPreset = definePreset({
  name: '@gamedev/preset-server',
  plugins: [
    coreSystemsPlugin,
    storagePlugin,
    chatPlugin,
    serverRuntimePlugin,
    networkServerPlugin,
    environmentServerPlugin,
    monitorServerPlugin,
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
