# Plugin Architecture

This migration moves the runtime away from implicit all-in-core construction and toward explicit build-time composition.

## Kernel

`World` is the engine kernel. A new `World()` starts without systems. Systems are installed through plugins or presets.

The core runtime systems are represented by `coreSystemsPlugin` from `gamedev/presets/core`. It installs the kernel-level settings, app/script runtime, event, blueprint, and entity systems, and advertises the built-in script proxy methods such as `script:world.add` and `script:app.create`.

The old root `extras` bucket has been removed. Shared primitives now live behind named kernel contracts: `math` for the patched Three.js facade and rotation/math helpers, `layers` for collision/camera layer masks, `permissions` for rank constants, and `diagnostics` for shared warnings. Browser and server-specific helpers live under `platform/browser` and `platform/server` instead of the kernel root.

Blueprint validation/naming helpers live under `blueprints`, and app script module specifier plus legacy body wrapping support lives under `script-runtime`. These are app/script runtime contracts rather than world kernel root modules.

Concrete node constructors are not part of the kernel. The first-party built-in node set is registered by `nodesPlugin` from `gamedev/plugins/nodes`, and custom builds can replace or extend node types through plugin `nodes` contributions. The core kernel keeps the base node contract; first-party concrete node classes live with the node plugin that installs them.

Mesh statistics helpers such as triangle counting and texture byte estimation live with the nodes plugin support code. Loader plugins can reuse those helpers for VRM stats, but the kernel no longer owns mesh-analysis utilities.

The concrete mirror and water render helpers live with the built-in nodes plugin because only the first-party `mirror` and `water` node implementations use them.

Built-in UI node layout and canvas drawing support lives with the nodes plugin. The browser runtime still triggers Yoga initialization during world startup, and nametag rendering can reuse the same canvas rounded-rectangle helper, but those helpers are no longer root core extras.

Stage and snaps spatial indexes live with the plugins that own those systems. The stage plugin owns its loose octree for renderable scene entries, and the snaps plugin owns its point-query octree.

Concrete entity constructors are plugin-owned. The default runtime presets register app entities through `gamedev/plugins/entities/app` and player entities through `gamedev/plugins/entities/player`. The admin preset adds `gamedev/plugins/entities/admin-player` for the admin-only local player, free camera, and admin remote-player implementation. The core kernel keeps the base entity contract, while first-party concrete entity classes live with the plugins that install them. App-local asset resolution (`app.asset`) is contributed by the app entity plugin. Player lookup (`world.getPlayer`/`world.getPlayers`) and player movement, avatar, health, effect, ragdoll, and local camera helpers are contributed by the player entities plugin rather than the kernel.

The default Three.js view rig and camera are plugin-owned. A bare kernel world has no `world.rig` or `world.camera`; `viewPlugin` from `gamedev/plugins/view` creates those objects for presets and plugins that need a camera-facing runtime.

App script player proxies and script error serialization are owned by the app entity plugin because they are part of concrete app entity execution rather than the kernel.

Default player locomotion emote URLs live with the player entity plugin support code. Loader and network plugins can still preload or apply those defaults, but the default player animation list is no longer a root core extra.

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

Preset modules are exported directly as `gamedev/presets/client`, `gamedev/presets/admin`, `gamedev/presets/viewer`, `gamedev/presets/node-client`, and `gamedev/presets/server`. Runtime plugins are exported as `gamedev/plugins/runtime/client`, `gamedev/plugins/runtime/admin`, `gamedev/plugins/runtime/viewer`, `gamedev/plugins/runtime/node-client`, and `gamedev/plugins/runtime/server`; presets re-export them, but custom builds can import the runtime entrypoints directly. Those runtime plugin modules own the browser, node-client, and server tick-loop systems instead of keeping them in the core system namespace. The `create*World` helpers are thin wrappers over those presets, so build tooling can compose from the preset modules without importing a factory that hides the plugin list. Preset type declarations also import the plugin type augmentations included by that preset, while narrower custom builds can reference only the plugin declarations they actually include.

```js
import { definePreset } from 'gamedev/plugins'
import { actionsClientPlugin } from 'gamedev/plugins/actions/client'
import { adminClientPlugin } from 'gamedev/plugins/admin/client'
import { animationPlugin } from 'gamedev/plugins/animation'
import { aiClientPlugin } from 'gamedev/plugins/ai/client'
import { audioClientPlugin } from 'gamedev/plugins/audio/client'
import { browserClientPlugin } from 'gamedev/plugins/browser/client'
import { builderClientPlugin } from 'gamedev/plugins/builder/client'
import { chatPlugin } from 'gamedev/plugins/chat'
import { controlsClientPlugin } from 'gamedev/plugins/controls/client'
import { cssClientPlugin } from 'gamedev/plugins/css/client'
import { adminPlayerEntitiesPlugin } from 'gamedev/plugins/entities/admin-player'
import { environmentClientPlugin } from 'gamedev/plugins/environment/client'
import { appEntityPlugin } from 'gamedev/plugins/entities/app'
import { playerEntitiesPlugin } from 'gamedev/plugins/entities/player'
import { evmClientPlugin } from 'gamedev/plugins/evm'
import { graphicsClientPlugin } from 'gamedev/plugins/graphics/client'
import { hyperliquidPlugin } from 'gamedev/plugins/hyperliquid'
import { loaderClientPlugin } from 'gamedev/plugins/loader/client'
import { loaderClientHandlersPlugin } from 'gamedev/plugins/loader/client-handlers'
import { livekitClientPlugin } from 'gamedev/plugins/livekit/client'
import { lodsClientPlugin } from 'gamedev/plugins/lods/client'
import { logsPlugin } from 'gamedev/plugins/logs'
import { nametagsClientPlugin } from 'gamedev/plugins/nametags/client'
import { networkClientPlugin } from 'gamedev/plugins/network/client'
import { nodesPlugin } from 'gamedev/plugins/nodes'
import { particlesClientPlugin } from 'gamedev/plugins/particles/client'
import { pointerClientPlugin } from 'gamedev/plugins/pointer/client'
import { prefsClientPlugin } from 'gamedev/plugins/prefs/client'
import { clientRuntimePlugin } from 'gamedev/plugins/runtime/client'
import { snapsClientPlugin } from 'gamedev/plugins/snaps/client'
import { spatialPlugin } from 'gamedev/plugins/spatial'
import { stagePlugin } from 'gamedev/plugins/stage'
import { statsClientPlugin } from 'gamedev/plugins/stats/client'
import { targetClientPlugin } from 'gamedev/plugins/target/client'
import { uiClientPlugin } from 'gamedev/plugins/ui/client'
import { viewPlugin } from 'gamedev/plugins/view'
import { windClientPlugin } from 'gamedev/plugins/wind/client'
import { xrClientPlugin } from 'gamedev/plugins/xr/client'
import { coreSystemsPlugin } from 'gamedev/presets/core'

export const clientPreset = definePreset({
  name: '@gamedev/preset-client',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    animationPlugin,
    spatialPlugin,
    stagePlugin,
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
    loaderClientHandlersPlugin,
    appEntityPlugin,
    playerEntitiesPlugin,
    adminPlayerEntitiesPlugin,
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

The default client and server presets include the first-party logs/diagnostics, built-in nodes, view/camera, app/player entities, spatial/simulation, chat, network sync, loader registry, first-party loader handlers, environment, LiveKit, AI, EVM, and Hyperliquid plugins. The logs plugin owns the runtime log buffer used by client/admin diagnostics and server log streaming, and the animation and stage plugins own their camera-distance app throttling and scene/octree systems. The nodes plugin owns built-in node constructors such as `group`, `mesh`, `avatar`, `ui`, `rigidbody`, and `collider`. The view plugin owns the default Three.js `world.rig` and `world.camera`. The entity plugins own concrete app and player entity construction, and the admin player plugin owns admin-only local-player/free-camera behavior instead of the default player entity plugin branching on an admin world flag. The loader registry plugins own `world.loader` and the `world.load` script API, while `gamedev/plugins/loader/client-handlers` and `gamedev/plugins/loader/server-handlers` install the default concrete asset handlers such as `loader:model`, `loader:avatar`, `loader:script`, and client-only handlers such as `loader:video` and `loader:splat`. A custom build can install the loader registry with only its own `loaders` contributions and omit the first-party handler plugins entirely. The spatial plugin owns its anchors, avatars, physics systems, and script APIs such as `world.raycast`, `world.overlapSphere`, and `world.createLayerMask`. The environment plugins own material setup hooks such as `world.setupMaterial`, so worlds without environment support do not carry CSM-specific material plumbing. Server also includes the storage script API plugin and the monitor plugin for runtime stats. Client also includes browser helpers, prefs, graphics, controls, network sync, pointer dispatch, XR, CSS3D, actions, audio, stats, target, LODs, snaps, wind, nametags, UI, particles, the admin bridge, and builder/drafts plugins so build tools remain explicit capabilities. Admin includes logs/diagnostics, built-in nodes, view/camera, app/player entities, admin local-player/free-camera support, spatial/simulation, browser helpers, chat, prefs, graphics, controls, admin network sync, pointer dispatch, admin XR no-op, CSS3D, actions, audio, stats, target, LODs, snaps, wind, nametags, UI, the client loader registry, first-party client loader handlers, environment, particles, admin bridge, admin builder, and LiveKit admin no-op/moderation bridge. Viewer includes logs/diagnostics, built-in nodes, view/camera, app entities, spatial/simulation, browser helpers, prefs, graphics, controls, the client loader registry, first-party client loader handlers, and environment. A custom build can omit those plugins, and then the corresponding systems, entity constructors, node constructors, loader types, and script APIs do not exist.

The first-party loader handler plugins also own GLB-to-node conversion, VRM factory creation, and emote factory creation. These helpers are no longer root core extras because they are only needed when the selected build includes the first-party loader handlers.

The controls plugin owns input button maps and control priorities. Plugins or UI surfaces that bind controls import those contracts from `gamedev/plugins/controls` support files instead of root core extras.

Client-only UI helpers such as file download, byte formatting, and curve editing live in the client package rather than root core extras.

The UI plugin owns reticle theme validation because `world.ui.setReticle()` is available only when the selected preset installs UI support.

Builder-owned built-in app templates are exported from `gamedev/plugins/builder/builtins`. They are intentionally no longer part of the core kernel surface.

Builder/editor script grouping and unique-variant comparison helpers live with builder plugin support code. Script AI can reuse those helpers, but they are no longer root core extras.

Builder-owned `.hyp` import/export helpers live with the builder plugin rather than root core extras, so packaging and drag/drop tooling can move independently from the kernel.

Server bootstrap built-ins are exported from `gamedev/plugins/builtins/server`. That plugin module owns the default `$scene` seed data and built-in asset source paths used by local/S3 asset bootstrap and app project scaffolding. The first-party built-in asset files live under the server built-ins plugin instead of a server runtime `world` directory.

Client-side local persistence used by first-party runtime plugins lives under `@gamedev/core/plugins/storage/local.js`. The kernel-level storage script API remains the `storagePlugin`; concrete browser/local fallback behavior is plugin support code rather than a root core module.

The PhysX loader and generated webidl artifacts live under the spatial plugin. They are copied into build output as runtime assets, but they are no longer root `@gamedev/core` modules.

PhysX-specific Three.js adapters live with the spatial plugin, and PhysX mesh-cooking helpers used by first-party collider/prim nodes live with the built-in nodes plugin.

## Script APIs

Plugins can expose script-facing APIs through `scripts`. Contributions are validated when the plugin is defined. Collisions are rejected before the plugin mutates the world, and each contribution is also available as a capability such as `script:world.load`, `script:world.evm`, or `script:player.evm`. Other plugins can list those capability names in `requires`.

A world only exposes APIs such as `world.copy`, `world.raycast`, `world.evm`, `world.hyperliquid`, `player.evm`, LiveKit player helpers like `player.screenshare` and `player.setVoiceLevel`, network helpers like `world.isServer`, or storage helpers like `world.get` when the selected preset includes the plugin that contributes them.

Script methods receive the owning app entity as their first argument because app scripts access them through a proxy.

Script endowment helpers such as `Curve`, `prng`, `LerpVector3`, `LerpQuaternion`, `BufferedLerpVector3`, and `BufferedLerpQuaternion` live under `@gamedev/core/script-api`. They are formal script runtime API support, not generic root core extras.

Script entries can use the function shorthand or a descriptor with `call`, `get`, or `set`. Descriptors can include a `meta` object with docs/type information; installed metadata is recorded on `world.apps.scriptApiMetadata` by scope and key so tooling can inspect the APIs contributed by a selected preset.

Plugin TypeScript declarations live with plugin entrypoints. For example, app code that uses browser helpers should reference `gamedev/plugins/browser/client`, app code that uses spatial APIs should reference `gamedev/plugins/spatial`, app code that uses `app.control()` should reference `gamedev/plugins/controls/client`, and app code that uses EVM APIs should reference `gamedev/plugins/evm` in addition to the base `gamedev` types. World projects using the default composition can reference `gamedev/presets/client` and `gamedev/presets/server` instead of listing every included plugin type individually.

## Reference World

`../hl-world` is the reference integration project for this migration. It currently depends on Hyperliquid, EVM, storage, UI nodes, prims, and app-server sync. Any extraction of those systems must keep `../hl-world` as the acceptance target.
