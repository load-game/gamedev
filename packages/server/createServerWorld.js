import { World } from '@gamedev/core/World.js'

import { Server } from '@gamedev/core/systems/Server.js'
import { ServerLiveKit } from '@gamedev/core/systems/ServerLiveKit.js'
import { ServerLoader } from '@gamedev/core/systems/ServerLoader.js'
import { ServerEnvironment } from '@gamedev/core/systems/ServerEnvironment.js'
import { ServerMonitor } from '@gamedev/core/systems/ServerMonitor.js'
import { ServerAIScripts } from '@gamedev/core/systems/ServerAIScripts.js'
import { ServerAI } from '@gamedev/core/systems/ServerAI.js'
import { registerServerCapabilities } from '@gamedev/capabilities'
import { ServerNetwork } from './ServerNetwork.js'

export function createServerWorld() {
  const world = new World()
  world.register('server', Server)
  world.register('livekit', ServerLiveKit)
  world.register('network', ServerNetwork)
  world.register('loader', ServerLoader)
  world.register('ai', ServerAI)
  world.register('aiScripts', ServerAIScripts)
  world.register('environment', ServerEnvironment)
  world.register('monitor', ServerMonitor)
  registerServerCapabilities(world)
  return world
}
