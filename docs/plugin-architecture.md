# Plugin Architecture

This migration moves the runtime away from implicit all-in-core construction and toward explicit build-time composition.

## Kernel

`World` is the engine kernel. A new `World()` starts without systems. Systems are installed through plugins or presets.

The core runtime systems are represented by `coreSystemsPlugin` from `gamedev/presets/core`.

## Plugins

Plugins declare what they install and what they need:

```js
import { definePlugin } from 'gamedev/plugins'
import { EVMClient } from 'gamedev/plugins/evm'

export const evmClientPlugin = definePlugin({
  name: '@gamedev/plugin-evm/client',
  requires: ['core'],
  provides: ['@gamedev/plugin-evm', 'evm'],
  systems: [['evm', EVMClient]],
  scripts: {
    world: {
      evm: (entity, chainId) => entity.world.evm.getRuntimeAPI(chainId),
    },
  },
})
```

Plugin fields:

- `name`: stable plugin id.
- `requires`: capabilities that must already be installed.
- `provides`: additional capabilities made available by this plugin.
- `systems`: `[key, System]` entries installed on the world.
- `scripts`: app-runtime APIs exposed on `world`, `app`, or `player`.
- `setup(world)`: optional build-time setup after systems are registered.

System keys are also capabilities, so a plugin that installs `['loader', Loader]` provides `loader`.

## Presets

Presets are ordered plugin compositions:

```js
import { definePreset } from 'gamedev/plugins'
import { evmClientPlugin } from 'gamedev/plugins/evm'
import { hyperliquidPlugin } from 'gamedev/plugins/hyperliquid'
import { livekitClientPlugin } from 'gamedev/plugins/livekit/client'
import { coreSystemsPlugin } from 'gamedev/presets/core'

export const clientPreset = definePreset({
  name: '@gamedev/preset-client',
  plugins: [coreSystemsPlugin, clientRuntimePlugin, livekitClientPlugin, evmClientPlugin, hyperliquidPlugin],
})
```

The existing client, server, admin, viewer, and node-client world factories are now expressed as presets.

The default client and server presets include the first-party LiveKit, EVM, and Hyperliquid plugins. Admin includes the LiveKit admin no-op/moderation bridge. A custom build can omit those plugins, and then the corresponding systems and script APIs do not exist.

## Script APIs

Plugins can expose script-facing APIs through `scripts`. Collisions are rejected. A world only exposes APIs such as `world.evm`, `world.hyperliquid`, or `player.evm` when the selected preset includes the plugin that contributes them.

Script methods receive the owning app entity as their first argument because app scripts access them through a proxy.

Plugin TypeScript declarations live with plugin entrypoints. For example, app code that uses EVM APIs should reference `gamedev/plugins/evm` in addition to the base `gamedev` types.

## Reference World

`../hl-world` is the reference integration project for this migration. It currently depends on Hyperliquid, EVM, storage, UI nodes, prims, and app-server sync. Any extraction of those systems must keep `../hl-world` as the acceptance target.
