# Plugin Architecture

This migration moves the runtime away from implicit all-in-core construction and toward explicit build-time composition.

## Kernel

`World` is the engine kernel. A new `World()` starts without systems. Systems are installed through plugins or presets.

The core runtime systems are represented by `coreSystemsPlugin` from `gamedev/presets/core`. It installs the kernel-level settings, app/script runtime, event, blueprint, and entity systems, and advertises the built-in script proxy methods such as `script:world.add` and `script:app.create`.

Concrete node constructors are not part of the kernel. The first-party built-in node set is registered by `nodesPlugin` from `gamedev/plugins/nodes`, and custom builds can replace or extend node types through plugin `nodes` contributions.

Concrete entity constructors are also plugin-owned. The default runtime presets register app entities through `gamedev/plugins/entities/app` and player entities through `gamedev/plugins/entities/player`.

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
- `nodes`: node constructors installed by name for `world.createNode()` and script `app.create()`.
- `entities`: entity constructors or factories installed by type for `world.createEntity()` and the entities system.
- `loaders`: asset type handlers installed on `world.loader`.
- `scripts`: app-runtime APIs exposed on `world`, `app`, or `player`.
- `setup(world)`: optional build-time setup after systems are registered.

System keys, node types, entity types, loader asset types, and script APIs are also capabilities. A plugin that installs `['loader', Loader]` provides `loader`, a node contribution named `group` provides `node:group`, an entity contribution named `app` provides `entity:app`, a loader contribution named `model` provides `loader:model`, and a script contribution named `world.evm` provides `script:world.evm`.

## Presets

Presets are ordered plugin compositions:

Preset modules are exported directly as `gamedev/presets/client`, `gamedev/presets/admin`, `gamedev/presets/viewer`, `gamedev/presets/node-client`, and `gamedev/presets/server`. The `create*World` helpers are thin wrappers over those presets, so build tooling can compose from the preset modules without importing a factory that hides the plugin list.

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
import { appEntityPlugin } from 'gamedev/plugins/entities/app'
import { playerEntitiesPlugin } from 'gamedev/plugins/entities/player'
import { evmClientPlugin } from 'gamedev/plugins/evm'
import { graphicsClientPlugin } from 'gamedev/plugins/graphics/client'
import { hyperliquidPlugin } from 'gamedev/plugins/hyperliquid'
import { loaderClientPlugin } from 'gamedev/plugins/loader/client'
import { livekitClientPlugin } from 'gamedev/plugins/livekit/client'
import { lodsClientPlugin } from 'gamedev/plugins/lods/client'
import { logsPlugin } from 'gamedev/plugins/logs'
import { nametagsClientPlugin } from 'gamedev/plugins/nametags/client'
import { networkClientPlugin } from 'gamedev/plugins/network/client'
import { nodesPlugin } from 'gamedev/plugins/nodes'
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
    nodesPlugin,
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
    appEntityPlugin,
    playerEntitiesPlugin,
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

The default client and server presets include the first-party logs/diagnostics, built-in nodes, app/player entities, spatial/simulation, chat, network sync, loader, environment, LiveKit, AI, EVM, and Hyperliquid plugins. The logs plugin owns the runtime log buffer used by client/admin diagnostics and server log streaming. The nodes plugin owns built-in node constructors such as `group`, `mesh`, `avatar`, `ui`, `rigidbody`, and `collider`. The entity plugins own concrete app and player entity construction. The loader plugins own concrete asset handlers such as `loader:model`, `loader:avatar`, `loader:script`, and client-only handlers such as `loader:video` and `loader:splat`. The spatial plugin owns anchors, avatars, animation, physics, stage, and script APIs such as `world.raycast`, `world.overlapSphere`, and `world.createLayerMask`. Server also includes the storage script API plugin and the monitor plugin for runtime stats. Client also includes browser helpers, prefs, graphics, controls, network sync, pointer dispatch, XR, CSS3D, actions, audio, stats, target, LODs, snaps, wind, nametags, UI, particles, the admin bridge, and builder/drafts plugins so build tools remain explicit capabilities. Admin includes logs/diagnostics, built-in nodes, app/player entities, spatial/simulation, browser helpers, chat, prefs, graphics, controls, admin network sync, pointer dispatch, admin XR no-op, CSS3D, actions, audio, stats, target, LODs, snaps, wind, nametags, UI, the client loader, environment, particles, admin bridge, admin builder, and LiveKit admin no-op/moderation bridge. Viewer includes logs/diagnostics, built-in nodes, app entities, spatial/simulation, browser helpers, prefs, graphics, controls, the client loader, and environment. A custom build can omit those plugins, and then the corresponding systems, entity constructors, node constructors, loader types, and script APIs do not exist.

Builder-owned built-in app templates are exported from `gamedev/plugins/builder/builtins`. They are intentionally no longer part of the core kernel surface.

Server bootstrap built-ins are exported from `gamedev/plugins/builtins/server`. That plugin module owns the default `$scene` seed data and built-in asset source paths used by local/S3 asset bootstrap and app project scaffolding.

## Script APIs

Plugins can expose script-facing APIs through `scripts`. Contributions are validated when the plugin is defined. Collisions are rejected before the plugin mutates the world, and each contribution is also available as a capability such as `script:world.load`, `script:world.evm`, or `script:player.evm`. Other plugins can list those capability names in `requires`.

A world only exposes APIs such as `world.copy`, `world.raycast`, `world.evm`, `world.hyperliquid`, `player.evm`, network helpers like `world.isServer`, or storage helpers like `world.get` when the selected preset includes the plugin that contributes them.

Script methods receive the owning app entity as their first argument because app scripts access them through a proxy.

Plugin TypeScript declarations live with plugin entrypoints. For example, app code that uses browser helpers should reference `gamedev/plugins/browser/client`, app code that uses spatial APIs should reference `gamedev/plugins/spatial`, and app code that uses EVM APIs should reference `gamedev/plugins/evm` in addition to the base `gamedev` types.

## Reference World

`../hl-world` is the reference integration project for this migration. It currently depends on Hyperliquid, EVM, storage, UI nodes, prims, and app-server sync. Any extraction of those systems must keep `../hl-world` as the acceptance target.
