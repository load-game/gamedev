import { EVM as ClientEVM } from './systems/EVMClient.js'
import { EVM as ServerEVM } from './systems/EVMServer.js'
import { Hyperliquid } from './systems/Hyperliquid.js'

export { ClientEVM, ServerEVM, Hyperliquid }

export function registerClientCapabilities(world, { evm = true, hyperliquid = true } = {}) {
  if (evm) world.register('evm', ClientEVM)
  if (hyperliquid) world.register('hyperliquid', Hyperliquid)
  return world
}

export function registerServerCapabilities(world, { evm = true, hyperliquid = true } = {}) {
  if (evm) world.register('evm', ServerEVM)
  if (hyperliquid) world.register('hyperliquid', Hyperliquid)
  return world
}
