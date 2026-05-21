import { World } from '@gamedev/core/World.js'
import { definePlugin, definePreset } from '@gamedev/core/plugins.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { evmServerPlugin } from '@gamedev/core/plugins/evm.js'
import { hyperliquidPlugin } from '@gamedev/core/plugins/hyperliquid.js'
import { livekitServerPlugin } from '@gamedev/core/plugins/livekit/server.js'

import { Server } from '@gamedev/core/systems/Server.js'
import { ServerLoader } from '@gamedev/core/systems/ServerLoader.js'
import { ServerEnvironment } from '@gamedev/core/systems/ServerEnvironment.js'
import { ServerMonitor } from '@gamedev/core/systems/ServerMonitor.js'
import { ServerAIScripts } from '@gamedev/core/systems/ServerAIScripts.js'
import { ServerAI } from '@gamedev/core/systems/ServerAI.js'
import { ServerNetwork } from './ServerNetwork.js'

export const serverRuntimePlugin = definePlugin({
  name: '@gamedev/server/runtime',
  requires: ['core'],
  systems: [
    ['server', Server],
    ['network', ServerNetwork],
    ['loader', ServerLoader],
    ['ai', ServerAI],
    ['aiScripts', ServerAIScripts],
    ['environment', ServerEnvironment],
    ['monitor', ServerMonitor],
  ],
})

export const serverPreset = definePreset({
  name: '@gamedev/preset-server',
  plugins: [coreSystemsPlugin, serverRuntimePlugin, livekitServerPlugin, evmServerPlugin, hyperliquidPlugin],
})

export function createServerWorld(options = {}) {
  const world = new World()
  world.install(serverPreset)
  world.install(options.plugins || [])
  return world
}
