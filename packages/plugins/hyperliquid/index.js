import { definePlugin } from '../../core/plugins.js'
import { Hyperliquid as HyperliquidSystem } from './Hyperliquid.js'

export { HyperliquidSystem as Hyperliquid }

export const hyperliquidScriptApi = Object.freeze({
  world: Object.freeze({
    hyperliquid: (entity, address = null) =>
      entity.world.hyperliquid.getRuntimeAPI({
        owner: entity,
        address: address ?? null,
      }),
  }),
})

export const hyperliquidPlugin = definePlugin({
  name: '@gamedev/plugin-hyperliquid',
  requires: ['core'],
  provides: ['hyperliquid'],
  systems: [['hyperliquid', HyperliquidSystem]],
  scripts: hyperliquidScriptApi,
})
