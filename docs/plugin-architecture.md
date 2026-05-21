# Plugin Architecture

This migration moves the runtime away from implicit all-in-core construction and toward explicit build-time composition.

## Kernel

`World` is the engine kernel. A new `World()` starts without systems. Systems are installed through plugins or presets.

The core runtime systems are represented by `coreSystemsPlugin` from `gamedev/presets/core`. It installs the kernel-level settings, app/script runtime, event, blueprint, and entity systems.

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
import { actionsClientPlugin } from 'gamedev/plugins/actions/client'
import { adminClientPlugin } from 'gamedev/plugins/admin/client'
import { aiClientPlugin } from 'gamedev/plugins/ai/client'
import { audioClientPlugin } from 'gamedev/plugins/audio/client'
import { browserClientPlugin } from 'gamedev/plugins/browser/client'
import { builderClientPlugin } from 'gamedev/plugins/builder/client'
import { chatPlugin } from 'gamedev/plugins/chat'
import { controlsClientPlugin } from 'gamedev/plugins/controls/client'
import { cssClientPlugin } from 'gamedev/plugins/css/client'
import { environmentClientPlugin } from 'gamedev/plugins/environment/client'
import { evmClientPlugin } from 'gamedev/plugins/evm'
import { graphicsClientPlugin } from 'gamedev/plugins/graphics/client'
import { hyperliquidPlugin } from 'gamedev/plugins/hyperliquid'
import { loaderClientPlugin } from 'gamedev/plugins/loader/client'
import { livekitClientPlugin } from 'gamedev/plugins/livekit/client'
import { lodsClientPlugin } from 'gamedev/plugins/lods/client'
import { logsPlugin } from 'gamedev/plugins/logs'
import { nametagsClientPlugin } from 'gamedev/plugins/nametags/client'
import { networkClientPlugin } from 'gamedev/plugins/network/client'
import { particlesClientPlugin } from 'gamedev/plugins/particles/client'
import { pointerClientPlugin } from 'gamedev/plugins/pointer/client'
import { prefsClientPlugin } from 'gamedev/plugins/prefs/client'
import { snapsClientPlugin } from 'gamedev/plugins/snaps/client'
import { spatialPlugin } from 'gamedev/plugins/spatial'
import { statsClientPlugin } from 'gamedev/plugins/stats/client'
import { targetClientPlugin } from 'gamedev/plugins/target/client'
import { uiClientPlugin } from 'gamedev/plugins/ui/client'
import { windClientPlugin } from 'gamedev/plugins/wind/client'
import { xrClientPlugin } from 'gamedev/plugins/xr/client'
import { coreSystemsPlugin } from 'gamedev/presets/core'

export const clientPreset = definePreset({
  name: '@gamedev/preset-client',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    spatialPlugin,
    chatPlugin,
    prefsClientPlugin,
    graphicsClientPlugin,
    controlsClientPlugin,
    clientRuntimePlugin,
    browserClientPlugin,
    networkClientPlugin,
    pointerClientPlugin,
    xrClientPlugin,
    cssClientPlugin,
    actionsClientPlugin,
    audioClientPlugin,
    statsClientPlugin,
    targetClientPlugin,
    lodsClientPlugin,
    snapsClientPlugin,
    windClientPlugin,
    nametagsClientPlugin,
    uiClientPlugin,
    loaderClientPlugin,
    environmentClientPlugin,
    particlesClientPlugin,
    adminClientPlugin,
    builderClientPlugin,
    livekitClientPlugin,
    aiClientPlugin,
    evmClientPlugin,
    hyperliquidPlugin,
  ],
})
```

The existing client, server, admin, viewer, and node-client world factories are now expressed as presets.

The default client and server presets include the first-party logs/diagnostics, spatial/simulation, chat, network sync, loader, environment, LiveKit, AI, EVM, and Hyperliquid plugins. The logs plugin owns the runtime log buffer used by client/admin diagnostics and server log streaming. The spatial plugin owns anchors, avatars, animation, physics, stage, and script APIs such as `world.raycast`, `world.overlapSphere`, and `world.createLayerMask`. Server also includes the storage script API plugin and the monitor plugin for runtime stats. Client also includes browser helpers, prefs, graphics, controls, network sync, pointer dispatch, XR, CSS3D, actions, audio, stats, target, LODs, snaps, wind, nametags, UI, particles, the admin bridge, and builder/drafts plugins so build tools remain explicit capabilities. Admin includes logs/diagnostics, spatial/simulation, browser helpers, chat, prefs, graphics, controls, admin network sync, pointer dispatch, admin XR no-op, CSS3D, actions, audio, stats, target, LODs, snaps, wind, nametags, UI, the client loader, environment, particles, admin bridge, admin builder, and LiveKit admin no-op/moderation bridge. Viewer includes logs/diagnostics, spatial/simulation, browser helpers, prefs, graphics, controls, the client loader, and environment. A custom build can omit those plugins, and then the corresponding systems and script APIs do not exist.

Builder-owned built-in app templates are exported from `gamedev/plugins/builder/builtins`. They are intentionally no longer part of the core kernel surface.

## Script APIs

Plugins can expose script-facing APIs through `scripts`. Collisions are rejected. A world only exposes APIs such as `world.copy`, `world.raycast`, `world.evm`, `world.hyperliquid`, `player.evm`, network helpers like `world.isServer`, or storage helpers like `world.get` when the selected preset includes the plugin that contributes them.

Script methods receive the owning app entity as their first argument because app scripts access them through a proxy.

Plugin TypeScript declarations live with plugin entrypoints. For example, app code that uses browser helpers should reference `gamedev/plugins/browser/client`, app code that uses spatial APIs should reference `gamedev/plugins/spatial`, and app code that uses EVM APIs should reference `gamedev/plugins/evm` in addition to the base `gamedev` types.

## Reference World

`../hl-world` is the reference integration project for this migration. It currently depends on Hyperliquid, EVM, storage, UI nodes, prims, and app-server sync. Any extraction of those systems must keep `../hl-world` as the acceptance target.
