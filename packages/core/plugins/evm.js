import { definePlugin } from '../plugins.js'
import { EVM as EVMClientSystem } from './evm/EVMClient.js'
import { EVM as EVMServerSystem } from './evm/EVMServer.js'

export { EVMClientSystem as EVMClient, EVMServerSystem as EVMServer }

function getPlayerCustom(player) {
  const custom = player?.data?.custom
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null
  return custom
}

function getPlayerEvmAddress(player) {
  const value = getPlayerCustom(player)?.evm
  return typeof value === 'string' && value ? value : null
}

function getPlayerEvmChainId(player) {
  const value = getPlayerCustom(player)?.evmChainId
  return Number.isInteger(value) && value > 0 ? value : null
}

export const evmScriptApi = Object.freeze({
  world: Object.freeze({
    evm: (entity, chainId = null) => entity.world.evm.getRuntimeAPI(chainId),
  }),
  player: Object.freeze({
    evm: Object.freeze({
      get: player => getPlayerEvmAddress(player),
    }),
    evmChainId: Object.freeze({
      get: player => getPlayerEvmChainId(player),
    }),
  }),
})

export const evmClientPlugin = definePlugin({
  name: '@gamedev/plugin-evm/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-evm', 'evm'],
  systems: [['evm', EVMClientSystem]],
  scripts: evmScriptApi,
})

export const evmServerPlugin = definePlugin({
  name: '@gamedev/plugin-evm/server',
  requires: ['core'],
  provides: ['@gamedev/plugin-evm', 'evm'],
  systems: [['evm', EVMServerSystem]],
  scripts: evmScriptApi,
})

export const evmPlugins = Object.freeze({
  client: evmClientPlugin,
  server: evmServerPlugin,
})
