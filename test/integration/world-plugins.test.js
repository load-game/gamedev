import 'ses'
import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { World } from '@gamedev/core/World.js'
import { definePlugin, definePreset } from '@gamedev/core/plugins.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { adminPreset, createAdminWorld } from '@gamedev/core/presets/admin.js'
import { clientPreset, createClientWorld } from '@gamedev/core/presets/client.js'
import { nodeClientPreset, createNodeClientWorld } from '@gamedev/core/presets/node-client.js'
import { viewerPreset, createViewerWorld } from '@gamedev/core/presets/viewer.js'
import { adminRuntimePlugin as adminRuntimeEntryPlugin } from 'gamedev/plugins/runtime/admin'
import { clientRuntimePlugin as clientRuntimeEntryPlugin } from 'gamedev/plugins/runtime/client'
import { nodeClientRuntimePlugin as nodeClientRuntimeEntryPlugin } from 'gamedev/plugins/runtime/node-client'
import { viewerRuntimePlugin as viewerRuntimeEntryPlugin } from 'gamedev/plugins/runtime/viewer'
import { actionsClientPlugin } from '@gamedev/core/plugins/actions/client.js'
import { animationPlugin } from '@gamedev/core/plugins/animation.js'
import { aiServerPlugin } from 'gamedev/plugins/ai/server'
import { audioClientPlugin } from '@gamedev/core/plugins/audio/client.js'
import { browserClientPlugin } from '@gamedev/core/plugins/browser/client.js'
import { chatPlugin } from '@gamedev/core/plugins/chat.js'
import { controlsClientPlugin } from '@gamedev/core/plugins/controls/client.js'
import { cssClientPlugin } from '@gamedev/core/plugins/css/client.js'
import { environmentClientPlugin } from '@gamedev/core/plugins/environment/client.js'
import { environmentServerPlugin } from '@gamedev/core/plugins/environment/server.js'
import { adminPlayerEntitiesPlugin } from 'gamedev/plugins/entities/admin-player'
import { appEntityPlugin } from 'gamedev/plugins/entities/app'
import { playerEntitiesPlugin } from 'gamedev/plugins/entities/player'
import { evmServerPlugin } from 'gamedev/plugins/evm'
import { graphicsClientPlugin } from '@gamedev/core/plugins/graphics/client.js'
import { hyperliquidPlugin } from 'gamedev/plugins/hyperliquid'
import { loaderClientPlugin } from '@gamedev/core/plugins/loader/client.js'
import { loaderClientHandlersPlugin } from 'gamedev/plugins/loader/client-handlers'
import { loaderServerPlugin } from '@gamedev/core/plugins/loader/server.js'
import { loaderServerHandlersPlugin } from 'gamedev/plugins/loader/server-handlers'
import { livekitClientPlugin } from 'gamedev/plugins/livekit/client'
import { livekitServerPlugin } from 'gamedev/plugins/livekit/server'
import { lodsClientPlugin } from '@gamedev/core/plugins/lods/client.js'
import { logsPlugin } from '@gamedev/core/plugins/logs.js'
import { monitorServerPlugin } from '@gamedev/core/plugins/monitor/server.js'
import { networkAdminPlugin } from 'gamedev/plugins/network/admin'
import { networkClientPlugin } from 'gamedev/plugins/network/client'
import { networkServerPlugin } from '@gamedev/server/plugins/network/server.js'
import { nodesPlugin } from 'gamedev/plugins/nodes'
import { particlesClientPlugin } from '@gamedev/core/plugins/particles/client.js'
import { pointerClientPlugin } from '@gamedev/core/plugins/pointer/client.js'
import { prefsClientPlugin } from '@gamedev/core/plugins/prefs/client.js'
import { snapsClientPlugin } from '@gamedev/core/plugins/snaps/client.js'
import { spatialPlugin } from '@gamedev/core/plugins/spatial.js'
import { stagePlugin } from '@gamedev/core/plugins/stage.js'
import { storagePlugin } from '@gamedev/core/plugins/storage.js'
import { statsClientPlugin } from '@gamedev/core/plugins/stats/client.js'
import { targetClientPlugin } from '@gamedev/core/plugins/target/client.js'
import { uiClientPlugin } from '@gamedev/core/plugins/ui/client.js'
import { viewPlugin } from 'gamedev/plugins/view'
import { windClientPlugin } from '@gamedev/core/plugins/wind/client.js'
import { xrClientPlugin } from '@gamedev/core/plugins/xr/client.js'
import { createServerWorld, serverPreset } from '@gamedev/server/presets/server.js'
import { serverRuntimePlugin as serverRuntimeEntryPlugin } from '@gamedev/server/plugins/runtime/server.js'
import { System } from '@gamedev/core/systems/System.js'

class TestSystem extends System {}
class DependentSystem extends System {}
class TestLoader extends System {
  constructor(world) {
    super(world)
    this.handlers = new Map()
  }

  register(type, load, options = {}) {
    if (this.handlers.has(type)) {
      throw new Error(`loader_type_collision:${type}`)
    }
    this.handlers.set(type, { load, plugin: options.plugin || null })
  }

  load(type, url) {
    const handler = this.handlers.get(type)
    if (!handler) {
      throw new Error(`loader_type_missing:${type}`)
    }
    return handler.load(this, url, { type, key: `${type}/${url}` })
  }
}
class TestEntity {
  constructor(world, data, local) {
    this.world = world
    this.data = data
    this.local = local
  }
}

test('World starts as a kernel and installs systems through plugins', () => {
  const emptyWorld = new World()
  assert.deepEqual(emptyWorld.systems, [])
  assert.equal(emptyWorld.rig, undefined)
  assert.equal(emptyWorld.camera, undefined)

  const testPlugin = definePlugin({
    name: 'test-plugin',
    requires: ['core'],
    provides: ['test-capability'],
    systems: [['test', TestSystem]],
    entities: {
      testEntity: TestEntity,
    },
    scripts: {
      world: {
        testApi: (entity, value) => `${entity.data.id}:${value}`,
      },
      app: {
        testApp: entity => entity.data.id,
      },
      player: {
        testValue: {
          get: player => player.data.testValue,
        },
      },
    },
  })

  const world = new World({ plugins: [coreSystemsPlugin, testPlugin] })

  assert.ok(world.apps)
  assert.ok(world.test instanceof TestSystem)
  assert.equal(world.test.plugin, 'test-plugin')
  assert.equal(world.pluginCapabilities.has('core'), true)
  assert.equal(world.pluginCapabilities.has('test-capability'), true)
  assert.equal(world.pluginCapabilities.has('entity:testEntity'), true)
  assert.equal(world.pluginCapabilities.has('script:world.add'), true)
  assert.equal(world.pluginCapabilities.has('script:app.create'), true)
  assert.equal(world.pluginCapabilities.has('script:world.testApi'), true)
  assert.equal(world.pluginCapabilities.has('script:app.testApp'), true)
  assert.equal(world.pluginCapabilities.has('script:player.testValue'), true)
  assert.ok(world.createEntity({ id: 'entity-1', type: 'testEntity' }, true) instanceof TestEntity)
  assert.equal(world.apps.worldMethods.testApi({ data: { id: 'app-1' } }, 'ok'), 'app-1:ok')
  assert.equal(world.apps.appMethods.testApp({ data: { id: 'app-1' } }), 'app-1')
  assert.equal(world.apps.playerGetters.testValue({ data: { testValue: 42 } }), 42)

  const scriptDependentPlugin = definePlugin({
    name: 'script-dependent-plugin',
    requires: ['script:world.testApi'],
  })
  assert.ok(new World({ plugins: [coreSystemsPlugin, testPlugin, scriptDependentPlugin] }))
  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, scriptDependentPlugin] }),
    /plugin_missing_requirement:script-dependent-plugin:script:world\.testApi/
  )
})

test('presets install ordered plugins and validate requirements', () => {
  const depPlugin = definePlugin({
    name: 'dependent-plugin',
    requires: ['test-capability'],
    systems: [['dependent', DependentSystem]],
  })
  const preset = definePreset({
    name: 'test-preset',
    plugins: [
      coreSystemsPlugin,
      definePlugin({
        name: 'test-provider',
        provides: ['test-capability'],
      }),
      depPlugin,
    ],
  })

  const world = new World({ plugins: preset })
  assert.ok(world.dependent instanceof DependentSystem)

  assert.throws(() => new World({ plugins: depPlugin }), /plugin_missing_requirement:dependent-plugin:test-capability/)
})

test('loader handlers are plugin contributions', async () => {
  const loaderRuntimePlugin = definePlugin({
    name: 'test-loader-runtime',
    provides: ['loader'],
    systems: [['loader', TestLoader]],
  })
  const loaderAssetPlugin = definePlugin({
    name: 'test-loader-assets',
    requires: ['loader'],
    loaders: {
      custom: (loader, url, context) => `${context.type}:${url}`,
    },
  })

  const world = new World({ plugins: [coreSystemsPlugin, loaderRuntimePlugin, loaderAssetPlugin] })
  assert.equal(world.pluginCapabilities.has('loader:custom'), true)
  assert.equal(world.loader.handlers.get('custom').plugin, 'test-loader-assets')
  assert.equal(await world.loader.load('custom', 'asset://thing.custom'), 'custom:asset://thing.custom')

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          loaderRuntimePlugin,
          loaderAssetPlugin,
          definePlugin({
            name: 'duplicate-loader-assets',
            loaders: {
              custom: () => null,
            },
          }),
        ],
      }),
    /plugin_capability_collision:duplicate-loader-assets:loader:custom/
  )

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          definePlugin({
            name: 'loader-assets-without-loader',
            loaders: {
              custom: () => null,
            },
          }),
        ],
      }),
    /plugin_missing_loader_registry:loader-assets-without-loader:custom/
  )
})

test('plugins reject system and script API collisions', () => {
  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          definePlugin({
            name: 'duplicate-apps',
            systems: [['apps', TestSystem]],
          }),
        ],
      }),
    /plugin_capability_collision:duplicate-apps:apps|world_system_collision:apps/
  )

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          nodesPlugin,
          definePlugin({
            name: 'duplicate-node',
            nodes: {
              group: TestSystem,
            },
          }),
        ],
      }),
    /plugin_capability_collision:duplicate-node:node:group|world_node_collision:group/
  )

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          definePlugin({
            name: 'entity-provider',
            entities: {
              app: TestEntity,
            },
          }),
          definePlugin({
            name: 'duplicate-entity',
            entities: {
              app: TestEntity,
            },
          }),
        ],
      }),
    /plugin_capability_collision:duplicate-entity:entity:app|world_entity_collision:app/
  )

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          definePlugin({
            name: 'bad-script-api',
            scripts: {
              world: {
                add: () => null,
              },
            },
          }),
        ],
      }),
    /plugin_capability_collision:bad-script-api:script:world\.add/
  )

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          definePlugin({
            name: 'script-one',
            scripts: {
              world: {
                custom: () => null,
              },
            },
          }),
          definePlugin({
            name: 'script-two',
            scripts: {
              world: {
                custom: () => null,
              },
            },
          }),
        ],
      }),
    /plugin_capability_collision:script-two:script:world\.custom/
  )

  const collisionWorld = new World({ plugins: [coreSystemsPlugin] })
  assert.throws(
    () =>
      collisionWorld.install(
        definePlugin({
          name: 'bad-script-api-with-system',
          systems: [['badScriptSystem', TestSystem]],
          scripts: {
            world: {
              add: () => null,
            },
          },
        })
      ),
    /plugin_capability_collision:bad-script-api-with-system:script:world\.add/
  )
  assert.equal(collisionWorld.badScriptSystem, undefined)
  assert.equal(collisionWorld.pluginCapabilities.has('bad-script-api-with-system'), false)
  assert.equal(collisionWorld.pluginCapabilities.has('badScriptSystem'), false)
})

test('plugins validate script API descriptors at definition time', () => {
  const documentedAppMethod = Object.assign(entity => entity.data.id, {
    meta: {
      summary: 'Returns the app id',
      docs: '/docs/app-id',
    },
  })
  const documentedPlugin = definePlugin({
    name: 'documented-script-api',
    scripts: {
      world: {
        documentedMethod: {
          call: (entity, value) => value,
          meta: {
            summary: 'Documented world method',
            docs: '/docs/world-method',
            type: '(value: string) => string',
          },
        },
        documentedGetter: {
          get: entity => entity.data.value,
          meta: {
            summary: 'Documented world getter',
            type: 'string',
          },
        },
      },
      app: {
        documentedAppMethod,
      },
    },
  })

  assert.equal(typeof documentedPlugin.scripts.world.documentedMethod, 'function')
  assert.equal(documentedPlugin.scriptMetadata.world.documentedMethod.summary, 'Documented world method')
  assert.equal(documentedPlugin.scriptMetadata.world.documentedGetter.type, 'string')
  assert.equal(documentedPlugin.scriptMetadata.app.documentedAppMethod.docs, '/docs/app-id')
  assert.equal(Object.isFrozen(documentedPlugin.scriptMetadata.world.documentedMethod), true)

  const documentedWorld = new World({ plugins: [coreSystemsPlugin, documentedPlugin] })
  assert.equal(documentedWorld.apps.worldMethods.documentedMethod({ data: {} }, 'ok'), 'ok')
  assert.equal(documentedWorld.apps.worldGetters.documentedGetter({ data: { value: 'state' } }), 'state')
  assert.equal(documentedWorld.apps.appMethods.documentedAppMethod({ data: { id: 'app-1' } }), 'app-1')
  assert.deepEqual(
    {
      source: documentedWorld.apps.scriptApiMetadata.world.get('documentedMethod').source,
      capability: documentedWorld.apps.scriptApiMetadata.world.get('documentedMethod').capability,
      summary: documentedWorld.apps.scriptApiMetadata.world.get('documentedMethod').summary,
      docs: documentedWorld.apps.scriptApiMetadata.world.get('documentedMethod').docs,
    },
    {
      source: 'documented-script-api',
      capability: 'script:world.documentedMethod',
      summary: 'Documented world method',
      docs: '/docs/world-method',
    }
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'bad-script-scope',
        scripts: {
          entity: {
            test: () => null,
          },
        },
      }),
    /plugin_invalid_script_scope:bad-script-scope:entity/
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'bad-script-entry',
        scripts: {
          world: {
            test: 1,
          },
        },
      }),
    /plugin_invalid_script_descriptor:bad-script-entry:world\.test/
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'bad-script-getter',
        scripts: {
          world: {
            test: {
              get: 'nope',
            },
          },
        },
      }),
    /plugin_invalid_script_descriptor:bad-script-getter:world\.test/
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'bad-script-method',
        scripts: {
          world: {
            test: {
              call: 'nope',
            },
          },
        },
      }),
    /plugin_invalid_script_descriptor:bad-script-method:world\.test/
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'bad-script-meta',
        scripts: {
          world: {
            test: {
              get: () => null,
              meta: 'nope',
            },
          },
        },
      }),
    /plugin_invalid_script_meta:bad-script-meta:world\.test/
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'ambiguous-script-entry',
        scripts: {
          world: {
            test: {
              call: () => null,
              get: () => null,
            },
          },
        },
      }),
    /plugin_invalid_script_descriptor:ambiguous-script-entry:world\.test/
  )

  assert.throws(
    () =>
      definePlugin({
        name: 'bad-loader-entry',
        loaders: {
          custom: 1,
        },
      }),
    /plugin_invalid_loader:bad-loader-entry:custom/
  )
})

test('runtime factories are preset compositions', () => {
  assert.equal(typeof createAdminWorld, 'function')
  assert.equal(typeof createClientWorld, 'function')
  assert.equal(typeof createNodeClientWorld, 'function')
  assert.equal(typeof createViewerWorld, 'function')
  assert.equal(typeof createServerWorld, 'function')

  assert.equal(
    adminPreset.plugins.find(plugin => plugin.name === '@gamedev/admin/runtime'),
    adminRuntimeEntryPlugin
  )
  assert.equal(
    clientPreset.plugins.find(plugin => plugin.name === '@gamedev/client/runtime'),
    clientRuntimeEntryPlugin
  )
  assert.equal(
    nodeClientPreset.plugins.find(plugin => plugin.name === '@gamedev/node-client/runtime'),
    nodeClientRuntimeEntryPlugin
  )
  assert.equal(
    viewerPreset.plugins.find(plugin => plugin.name === '@gamedev/viewer/runtime'),
    viewerRuntimeEntryPlugin
  )
  assert.equal(
    serverPreset.plugins.find(plugin => plugin.name === '@gamedev/server/runtime'),
    serverRuntimeEntryPlugin
  )

  assert.deepEqual(
    adminPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-view',
      '@gamedev/plugin-animation',
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-stage',
      '@gamedev/plugin-chat',
      '@gamedev/plugin-prefs/client',
      '@gamedev/plugin-graphics/client',
      '@gamedev/plugin-controls/client',
      '@gamedev/admin/runtime',
      '@gamedev/plugin-browser/client',
      '@gamedev/plugin-network/admin',
      '@gamedev/plugin-pointer/client',
      '@gamedev/plugin-xr/admin',
      '@gamedev/plugin-css/client',
      '@gamedev/plugin-actions/client',
      '@gamedev/plugin-audio/client',
      '@gamedev/plugin-stats/client',
      '@gamedev/plugin-target/client',
      '@gamedev/plugin-lods/client',
      '@gamedev/plugin-snaps/client',
      '@gamedev/plugin-wind/client',
      '@gamedev/plugin-nametags/client',
      '@gamedev/plugin-ui/client',
      '@gamedev/plugin-loader/client',
      '@gamedev/plugin-loader-handlers/client',
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-entities/player',
      '@gamedev/plugin-entities/admin-player',
      '@gamedev/plugin-environment/client',
      '@gamedev/plugin-particles/client',
      '@gamedev/plugin-admin/client',
      '@gamedev/plugin-builder/admin',
      '@gamedev/plugin-livekit/admin',
    ]
  )

  assert.deepEqual(
    clientPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-view',
      '@gamedev/plugin-animation',
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-stage',
      '@gamedev/plugin-chat',
      '@gamedev/plugin-prefs/client',
      '@gamedev/plugin-graphics/client',
      '@gamedev/plugin-controls/client',
      '@gamedev/client/runtime',
      '@gamedev/plugin-browser/client',
      '@gamedev/plugin-network/client',
      '@gamedev/plugin-pointer/client',
      '@gamedev/plugin-xr/client',
      '@gamedev/plugin-css/client',
      '@gamedev/plugin-actions/client',
      '@gamedev/plugin-audio/client',
      '@gamedev/plugin-stats/client',
      '@gamedev/plugin-target/client',
      '@gamedev/plugin-lods/client',
      '@gamedev/plugin-snaps/client',
      '@gamedev/plugin-wind/client',
      '@gamedev/plugin-nametags/client',
      '@gamedev/plugin-ui/client',
      '@gamedev/plugin-loader/client',
      '@gamedev/plugin-loader-handlers/client',
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-entities/player',
      '@gamedev/plugin-environment/client',
      '@gamedev/plugin-particles/client',
      '@gamedev/plugin-admin/client',
      '@gamedev/plugin-builder/client',
      '@gamedev/plugin-livekit/client',
      '@gamedev/plugin-ai/client',
      '@gamedev/plugin-evm/client',
      '@gamedev/plugin-hyperliquid',
    ]
  )

  assert.deepEqual(
    nodeClientPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-view',
      '@gamedev/plugin-animation',
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-stage',
      '@gamedev/plugin-chat',
      '@gamedev/plugin-controls/client',
      '@gamedev/node-client/runtime',
      '@gamedev/plugin-network/client',
      '@gamedev/plugin-loader/server',
      '@gamedev/plugin-loader-handlers/server',
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-entities/player',
      '@gamedev/plugin-environment/node-client',
    ]
  )

  assert.deepEqual(
    viewerPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-view',
      '@gamedev/plugin-animation',
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-stage',
      '@gamedev/plugin-prefs/client',
      '@gamedev/plugin-graphics/client',
      '@gamedev/plugin-controls/client',
      '@gamedev/viewer/runtime',
      '@gamedev/plugin-browser/client',
      '@gamedev/plugin-loader/client',
      '@gamedev/plugin-loader-handlers/client',
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-environment/client',
    ]
  )

  assert.deepEqual(
    serverPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-view',
      '@gamedev/plugin-animation',
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-stage',
      '@gamedev/plugin-storage',
      '@gamedev/plugin-chat',
      '@gamedev/server/runtime',
      '@gamedev/plugin-network/server',
      '@gamedev/plugin-environment/server',
      '@gamedev/plugin-monitor/server',
      '@gamedev/plugin-loader/server',
      '@gamedev/plugin-loader-handlers/server',
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-entities/player',
      '@gamedev/plugin-livekit/server',
      '@gamedev/plugin-ai/server',
      '@gamedev/plugin-evm/server',
      '@gamedev/plugin-hyperliquid',
    ]
  )
  const serverWorld = createServerWorld()
  assert.deepEqual(
    serverWorld.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-view',
      '@gamedev/plugin-animation',
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-stage',
      '@gamedev/plugin-storage',
      '@gamedev/plugin-chat',
      '@gamedev/server/runtime',
      '@gamedev/plugin-network/server',
      '@gamedev/plugin-environment/server',
      '@gamedev/plugin-monitor/server',
      '@gamedev/plugin-loader/server',
      '@gamedev/plugin-loader-handlers/server',
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-entities/player',
      '@gamedev/plugin-livekit/server',
      '@gamedev/plugin-ai/server',
      '@gamedev/plugin-evm/server',
      '@gamedev/plugin-hyperliquid',
    ]
  )
  assert.ok(serverWorld.loader)
  assert.ok(serverWorld.logs)
  assert.equal(serverWorld.pluginCapabilities.has('nodes'), true)
  assert.equal(serverWorld.nodeTypes.has('group'), true)
  assert.equal(serverWorld.pluginCapabilities.has('entity:app'), true)
  assert.equal(serverWorld.pluginCapabilities.has('entity:player'), true)
  assert.equal(serverWorld.pluginCapabilities.has('loader:model'), true)
  assert.equal(serverWorld.pluginCapabilities.has('loader:avatar'), true)
  assert.equal(serverWorld.pluginCapabilities.has('loader:script'), true)
  assert.equal(serverWorld.entityTypes.has('app'), true)
  assert.equal(serverWorld.entityTypes.has('player'), true)
  assert.ok(serverWorld.physics)
  assert.ok(serverWorld.animation)
  assert.ok(serverWorld.stage)
  assert.ok(serverWorld.network)
  assert.ok(serverWorld.environment)
  assert.equal(typeof serverWorld.setupMaterial, 'function')
  assert.ok(serverWorld.monitor)
  assert.ok(serverWorld.chat)
  assert.ok(serverWorld.livekit)
  assert.ok(serverWorld.ai)
  assert.ok(serverWorld.aiScripts)
  assert.ok(serverWorld.evm)
  assert.ok(serverWorld.hyperliquid)
  assert.equal(serverWorld.loader.plugin, '@gamedev/plugin-loader/server')
  assert.equal(serverWorld.loader.handlers.get('model').plugin, '@gamedev/plugin-loader-handlers/server')
  assert.equal(serverWorld.logs.plugin, '@gamedev/plugin-logs')
  assert.equal(serverWorld.animation.plugin, '@gamedev/plugin-animation')
  assert.equal(serverWorld.physics.plugin, '@gamedev/plugin-spatial')
  assert.equal(serverWorld.stage.plugin, '@gamedev/plugin-stage')
  assert.equal(serverWorld.network.plugin, '@gamedev/plugin-network/server')
  assert.equal(serverWorld.environment.plugin, '@gamedev/plugin-environment/server')
  assert.equal(serverWorld.monitor.plugin, '@gamedev/plugin-monitor/server')
  assert.equal(serverWorld.chat.plugin, '@gamedev/plugin-chat')
  assert.equal(serverWorld.livekit.plugin, '@gamedev/plugin-livekit/server')
  assert.equal(serverWorld.ai.plugin, '@gamedev/plugin-ai/server')
  assert.equal(serverWorld.aiScripts.plugin, '@gamedev/plugin-ai/server')
  assert.equal(serverWorld.evm.plugin, '@gamedev/plugin-evm/server')
  assert.equal(serverWorld.hyperliquid.plugin, '@gamedev/plugin-hyperliquid')
  assert.equal(serverWorld.pluginCapabilities.has('script:player.setVoiceLevel'), true)
  assert.equal(typeof serverWorld.apps.worldGetters.isServer, 'function')
  assert.equal(typeof serverWorld.apps.worldGetters.networkId, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.getTime, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.createLayerMask, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.raycast, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.overlapSphere, 'function')
  assert.equal(typeof serverWorld.apps.appMethods.send, 'function')
  assert.equal(typeof serverWorld.apps.appMethods.sendTo, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.get, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.commitStorage, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.load, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.chat, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.evm, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.hyperliquid, 'function')
  assert.equal(typeof serverWorld.apps.playerMethods.setVoiceLevel, 'function')
  assert.equal(serverWorld.apps.worldMethods.open, undefined)
  assert.equal(serverWorld.apps.worldMethods.copy, undefined)
})

test('feature APIs only appear when their plugins are selected', () => {
  const coreWorld = new World({ plugins: [coreSystemsPlugin] })
  assert.equal(coreWorld.evm, undefined)
  assert.equal(coreWorld.hyperliquid, undefined)
  assert.equal(coreWorld.logs, undefined)
  assert.equal(coreWorld.pluginCapabilities.has('nodes'), false)
  assert.equal(coreWorld.nodeTypes.has('group'), false)
  assert.throws(() => coreWorld.createNode('group'), /world_node_missing:group/)
  assert.equal(coreWorld.entityTypes.has('app'), false)
  assert.equal(coreWorld.entityTypes.has('player'), false)
  assert.throws(() => coreWorld.createEntity({ id: 'app-1', type: 'app' }), /world_entity_missing:app/)
  assert.equal(coreWorld.livekit, undefined)
  assert.equal(coreWorld.ai, undefined)
  assert.equal(coreWorld.aiScripts, undefined)
  assert.equal(coreWorld.loader, undefined)
  assert.equal(coreWorld.environment, undefined)
  assert.equal(coreWorld.setupMaterial, undefined)
  assert.equal(coreWorld.monitor, undefined)
  assert.equal(coreWorld.graphics, undefined)
  assert.equal(coreWorld.controls, undefined)
  assert.equal(coreWorld.network, undefined)
  assert.equal(coreWorld.css, undefined)
  assert.equal(coreWorld.pointer, undefined)
  assert.equal(coreWorld.xr, undefined)
  assert.equal(coreWorld.chat, undefined)
  assert.equal(coreWorld.prefs, undefined)
  assert.equal(coreWorld.actions, undefined)
  assert.equal(coreWorld.audio, undefined)
  assert.equal(coreWorld.stats, undefined)
  assert.equal(coreWorld.target, undefined)
  assert.equal(coreWorld.lods, undefined)
  assert.equal(coreWorld.snaps, undefined)
  assert.equal(coreWorld.wind, undefined)
  assert.equal(coreWorld.nametags, undefined)
  assert.equal(coreWorld.particles, undefined)
  assert.equal(coreWorld.ui, undefined)
  assert.equal(coreWorld.admin, undefined)
  assert.equal(coreWorld.builder, undefined)
  assert.equal(coreWorld.drafts, undefined)
  assert.equal(coreWorld.rig, undefined)
  assert.equal(coreWorld.camera, undefined)
  assert.equal(coreWorld.anchors, undefined)
  assert.equal(coreWorld.avatars, undefined)
  assert.equal(coreWorld.animation, undefined)
  assert.equal(coreWorld.physics, undefined)
  assert.equal(coreWorld.stage, undefined)
  assert.equal(coreWorld.apps.worldMethods.load, undefined)
  assert.equal(coreWorld.apps.worldGetters.isServer, undefined)
  assert.equal(coreWorld.apps.worldGetters.isClient, undefined)
  assert.equal(coreWorld.apps.worldGetters.networkId, undefined)
  assert.equal(coreWorld.apps.worldMethods.getTime, undefined)
  assert.equal(coreWorld.apps.appMethods.asset, undefined)
  assert.equal(coreWorld.apps.appMethods.send, undefined)
  assert.equal(coreWorld.apps.appMethods.sendTo, undefined)
  assert.equal(coreWorld.apps.appMethods.control, undefined)
  assert.equal(coreWorld.apps.worldMethods.get, undefined)
  assert.equal(coreWorld.apps.worldMethods.commitStorage, undefined)
  assert.equal(coreWorld.apps.worldMethods.chat, undefined)
  assert.equal(coreWorld.apps.worldMethods.setReticle, undefined)
  assert.equal(coreWorld.apps.worldMethods.open, undefined)
  assert.equal(coreWorld.apps.worldMethods.copy, undefined)
  assert.equal(coreWorld.apps.worldMethods.getQueryParam, undefined)
  assert.equal(coreWorld.apps.worldMethods.setQueryParam, undefined)
  assert.equal(coreWorld.apps.worldMethods.createLayerMask, undefined)
  assert.equal(coreWorld.apps.worldMethods.raycast, undefined)
  assert.equal(coreWorld.apps.worldMethods.overlapSphere, undefined)
  assert.equal(coreWorld.apps.worldMethods.getPlayer, undefined)
  assert.equal(coreWorld.apps.worldMethods.getPlayers, undefined)
  assert.equal(coreWorld.apps.worldMethods.evm, undefined)
  assert.equal(coreWorld.apps.worldMethods.hyperliquid, undefined)
  assert.equal(coreWorld.apps.playerMethods.teleport, undefined)
  assert.equal(coreWorld.apps.playerMethods.damage, undefined)
  assert.equal(coreWorld.apps.playerMethods.applyEffect, undefined)
  assert.equal(coreWorld.apps.playerMethods.ragdoll, undefined)
  assert.equal(coreWorld.apps.playerMethods.screenshare, undefined)
  assert.equal(coreWorld.apps.playerMethods.setVoiceLevel, undefined)

  const viewWorld = new World({
    plugins: [coreSystemsPlugin, viewPlugin],
  })
  assert.ok(viewWorld.rig)
  assert.ok(viewWorld.camera)
  assert.equal(viewWorld.camera.parent, viewWorld.rig)
  assert.equal(viewWorld.pluginCapabilities.has('view'), true)
  assert.equal(viewWorld.pluginCapabilities.has('camera'), true)

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, animationPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-animation:view/
  )

  const animationWorld = new World({
    plugins: [coreSystemsPlugin, viewPlugin, animationPlugin],
  })
  assert.ok(animationWorld.animation)
  assert.equal(animationWorld.animation.plugin, '@gamedev/plugin-animation')

  const stageWorld = new World({
    plugins: [coreSystemsPlugin, stagePlugin],
  })
  assert.ok(stageWorld.stage)
  assert.equal(stageWorld.stage.plugin, '@gamedev/plugin-stage')

  const spatialWorld = new World({
    plugins: [coreSystemsPlugin, spatialPlugin],
  })
  assert.ok(spatialWorld.anchors)
  assert.ok(spatialWorld.avatars)
  assert.ok(spatialWorld.physics)
  assert.equal(spatialWorld.animation, undefined)
  assert.equal(spatialWorld.stage, undefined)
  assert.equal(spatialWorld.physics.plugin, '@gamedev/plugin-spatial')
  assert.equal(typeof spatialWorld.apps.worldMethods.createLayerMask, 'function')
  assert.equal(typeof spatialWorld.apps.worldMethods.raycast, 'function')
  assert.equal(typeof spatialWorld.apps.worldMethods.overlapSphere, 'function')

  const logsWorld = new World({
    plugins: [coreSystemsPlugin, logsPlugin],
  })
  assert.ok(logsWorld.logs)
  assert.equal(logsWorld.logs.plugin, '@gamedev/plugin-logs')

  const nodesWorld = new World({
    plugins: [coreSystemsPlugin, nodesPlugin],
  })
  assert.equal(nodesWorld.pluginCapabilities.has('nodes'), true)
  assert.equal(nodesWorld.pluginCapabilities.has('node:group'), true)
  assert.equal(nodesWorld.createNode('group').name, 'group')

  const serverRuntimeStub = definePlugin({
    name: 'test-server-runtime',
    systems: [
      ['server', TestSystem],
      ['network', DependentSystem],
    ],
  })

  const serverLoaderWorld = new World({
    plugins: [coreSystemsPlugin, loaderServerPlugin],
  })
  assert.ok(serverLoaderWorld.loader)
  assert.equal(typeof serverLoaderWorld.apps.worldMethods.load, 'function')
  assert.equal(serverLoaderWorld.pluginCapabilities.has('loader'), true)
  assert.equal(serverLoaderWorld.pluginCapabilities.has('loader:model'), false)

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, nodesPlugin, loaderServerPlugin, appEntityPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-entities\/app:loader:model/
  )

  const appEntityWorld = new World({
    plugins: [coreSystemsPlugin, nodesPlugin, loaderServerPlugin, loaderServerHandlersPlugin, appEntityPlugin],
  })
  assert.equal(appEntityWorld.pluginCapabilities.has('entity:app'), true)
  assert.equal(appEntityWorld.pluginCapabilities.has('script:app.asset'), true)
  assert.equal(appEntityWorld.entityTypes.has('app'), true)
  assert.equal(typeof appEntityWorld.apps.appMethods.asset, 'function')
  appEntityWorld.assetsUrl = 'https://assets.example.test/assets'
  assert.equal(
    appEntityWorld.apps.appMethods.asset(
      {
        world: appEntityWorld,
        blueprint: {
          assetMap: {
            'assets/sprite.png': 'asset://sprite.hash.png',
          },
        },
      },
      './assets/sprite.png?frame=1'
    ),
    'https://assets.example.test/assets/sprite.hash.png?frame=1'
  )
  assert.equal(
    appEntityWorld.apps.appMethods.asset(
      {
        world: appEntityWorld,
        blueprint: { assetMap: {} },
      },
      './assets/missing.png'
    ),
    ''
  )

  const playerEntityWorld = new World({
    plugins: [
      coreSystemsPlugin,
      nodesPlugin,
      viewPlugin,
      spatialPlugin,
      chatPlugin,
      serverRuntimeStub,
      loaderServerPlugin,
      loaderServerHandlersPlugin,
      playerEntitiesPlugin,
    ],
  })
  assert.equal(playerEntityWorld.pluginCapabilities.has('entity:player'), true)
  assert.equal(playerEntityWorld.pluginCapabilities.has('script:world.getPlayer'), true)
  assert.equal(playerEntityWorld.pluginCapabilities.has('script:world.getPlayers'), true)
  assert.equal(playerEntityWorld.pluginCapabilities.has('script:player.teleport'), true)
  assert.equal(playerEntityWorld.pluginCapabilities.has('script:player.applyEffect'), true)
  assert.equal(playerEntityWorld.pluginCapabilities.has('admin-player-entities'), false)
  assert.equal(playerEntityWorld.entityTypes.has('player'), true)
  assert.equal(playerEntityWorld.isAdminClient, undefined)
  assert.equal(playerEntityWorld.playerEntityFactory, undefined)
  assert.equal(typeof playerEntityWorld.apps.worldMethods.getPlayer, 'function')
  assert.equal(typeof playerEntityWorld.apps.worldMethods.getPlayers, 'function')
  assert.equal(typeof playerEntityWorld.apps.playerMethods.teleport, 'function')
  assert.equal(typeof playerEntityWorld.apps.playerMethods.damage, 'function')
  assert.equal(typeof playerEntityWorld.apps.playerMethods.applyEffect, 'function')
  assert.equal(typeof playerEntityWorld.apps.playerMethods.ragdoll, 'function')
  assert.equal(playerEntityWorld.apps.playerProxyCleanups.length, 1)
  playerEntityWorld.network.id = 'network-1'
  playerEntityWorld.network.isServer = false
  let teleportPayload = null
  playerEntityWorld.network.enqueue = (name, payload) => {
    teleportPayload = { name, payload }
  }
  const fakePlayerEntity = {
    data: { id: 'player-1', owner: 'network-1', health: 100, effect: null },
    world: playerEntityWorld,
    avatar: {
      getBoneTransform(boneName) {
        return `bone:${boneName}`
      },
    },
    modify(patch) {
      Object.assign(this.data, patch)
    },
    setEffect(effect) {
      this.data.effect = effect
    },
    setRagdoll(enable) {
      this.ragdollEnabled = enable
    },
    push(force) {
      this.pushed = force
    },
  }
  const fakeAppEntity = {
    data: { id: 'app-1' },
    world: playerEntityWorld,
    getPlayerProxy(playerId) {
      return { id: playerId || 'local-player' }
    },
  }
  playerEntityWorld.entities.players.set('player-1', fakePlayerEntity)
  assert.deepEqual(playerEntityWorld.apps.worldMethods.getPlayer(fakeAppEntity, 'player-1'), { id: 'player-1' })
  assert.deepEqual(playerEntityWorld.apps.worldMethods.getPlayer(fakeAppEntity), { id: 'local-player' })
  assert.deepEqual(playerEntityWorld.apps.worldMethods.getPlayers(fakeAppEntity), [{ id: 'player-1' }])
  const fakeVector = {
    toArray() {
      return [1, 2, 3]
    },
  }
  playerEntityWorld.apps.playerMethods.teleport(fakePlayerEntity, fakeVector, 1.5)
  assert.deepEqual(teleportPayload, {
    name: 'onPlayerTeleport',
    payload: { position: [1, 2, 3], rotationY: 1.5 },
  })
  assert.equal(playerEntityWorld.apps.playerMethods.getBoneTransform(fakePlayerEntity, 'head'), 'bone:head')
  playerEntityWorld.apps.playerMethods.damage(fakePlayerEntity, 25)
  assert.equal(fakePlayerEntity.data.health, 75)
  let effectEnded = false
  const effectHandle = playerEntityWorld.apps.playerMethods.applyEffect.call(fakeAppEntity, fakePlayerEntity, {
    freeze: true,
    onEnd() {
      effectEnded = true
    },
  })
  assert.equal(effectHandle.active, true)
  assert.deepEqual(fakePlayerEntity.data.effect, { freeze: true })
  playerEntityWorld.apps.playerProxyCleanups[0].cleanup(fakeAppEntity, fakePlayerEntity)
  assert.equal(effectHandle.active, false)
  assert.equal(fakePlayerEntity.data.effect, null)
  assert.equal(effectEnded, true)

  const adminPlayerRuntimeStub = definePlugin({
    name: 'test-admin-player-runtime',
    systems: [['client', TestSystem]],
  })
  const adminPlayerWorld = new World({
    plugins: [
      coreSystemsPlugin,
      nodesPlugin,
      viewPlugin,
      spatialPlugin,
      stagePlugin,
      chatPlugin,
      prefsClientPlugin,
      controlsClientPlugin,
      adminPlayerRuntimeStub,
      networkAdminPlugin,
      loaderClientPlugin,
      loaderClientHandlersPlugin,
      playerEntitiesPlugin,
      adminPlayerEntitiesPlugin,
    ],
  })
  assert.equal(adminPlayerWorld.pluginCapabilities.has('admin-player-entities'), true)
  assert.equal(adminPlayerWorld.isAdminClient, true)
  assert.equal(typeof adminPlayerWorld.playerEntityFactory, 'function')
  assert.ok(adminPlayerWorld.adminPlayer)
  assert.equal(adminPlayerWorld.entities.player, adminPlayerWorld.adminPlayer)
  assert.equal(adminPlayerWorld.adminPlayer.data.id, adminPlayerWorld.network.id)

  const clientRuntimeStub = definePlugin({
    name: 'test-client-runtime',
    systems: [
      ['client', TestSystem],
      ['controls', DependentSystem],
      ['graphics', TestSystem],
      ['network', DependentSystem],
    ],
  })

  const clientOnlyRuntimeStub = definePlugin({
    name: 'test-client-only-runtime',
    systems: [['client', TestSystem]],
  })

  const browserWorld = new World({
    plugins: [coreSystemsPlugin, clientOnlyRuntimeStub, browserClientPlugin],
  })
  assert.equal(typeof browserWorld.apps.worldMethods.open, 'function')
  assert.equal(typeof browserWorld.apps.worldMethods.copy, 'function')
  assert.equal(typeof browserWorld.apps.worldMethods.getQueryParam, 'function')
  assert.equal(typeof browserWorld.apps.worldMethods.setQueryParam, 'function')

  const clientLoaderRegistryWorld = new World({
    plugins: [coreSystemsPlugin, clientOnlyRuntimeStub, loaderClientPlugin],
  })
  assert.ok(clientLoaderRegistryWorld.loader)
  assert.equal(clientLoaderRegistryWorld.pluginCapabilities.has('loader'), true)
  assert.equal(clientLoaderRegistryWorld.pluginCapabilities.has('loader:video'), false)

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          nodesPlugin,
          viewPlugin,
          stagePlugin,
          loaderServerPlugin,
          loaderClientHandlersPlugin,
        ],
      }),
    /plugin_missing_requirement:@gamedev\/plugin-loader-handlers\/client:client/
  )

  const clientLoaderWorld = new World({
    plugins: [
      coreSystemsPlugin,
      nodesPlugin,
      viewPlugin,
      spatialPlugin,
      stagePlugin,
      clientOnlyRuntimeStub,
      loaderClientPlugin,
      loaderClientHandlersPlugin,
    ],
  })
  assert.ok(clientLoaderWorld.loader)
  assert.equal(clientLoaderWorld.pluginCapabilities.has('loader:model'), true)
  assert.equal(clientLoaderWorld.pluginCapabilities.has('loader:video'), true)
  assert.equal(clientLoaderWorld.pluginCapabilities.has('loader:splat'), true)
  assert.equal(clientLoaderWorld.loader.handlers.get('splat').plugin, '@gamedev/plugin-loader-handlers/client')

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, prefsClientPlugin, audioClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-audio\/client:client/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, browserClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-browser\/client:client/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, nodesPlugin, appEntityPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-entities\/app:loader/
  )

  assert.throws(
    () =>
      new World({
        plugins: [
          coreSystemsPlugin,
          nodesPlugin,
          viewPlugin,
          spatialPlugin,
          loaderServerPlugin,
          loaderServerHandlersPlugin,
          playerEntitiesPlugin,
        ],
      }),
    /plugin_missing_requirement:@gamedev\/plugin-entities\/player:network/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, graphicsClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-graphics\/client:prefs/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, prefsClientPlugin, graphicsClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-graphics\/client:stage/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, cssClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-css\/client:graphics/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, pointerClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-pointer\/client:controls/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, viewPlugin, controlsClientPlugin, pointerClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-pointer\/client:stage/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, chatPlugin, networkClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-network\/client:client/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, chatPlugin, clientOnlyRuntimeStub, networkClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-network\/client:nodes/
  )

  assert.throws(
    () =>
      new World({ plugins: [coreSystemsPlugin, chatPlugin, clientOnlyRuntimeStub, nodesPlugin, networkClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-network\/client:spatial/
  )

  const controlsWorld = new World({
    plugins: [coreSystemsPlugin, viewPlugin, controlsClientPlugin],
  })
  assert.ok(controlsWorld.controls)
  assert.equal(controlsWorld.controls.plugin, '@gamedev/plugin-controls/client')
  assert.equal(controlsWorld.pluginCapabilities.has('script:app.control'), true)
  assert.equal(typeof controlsWorld.apps.appMethods.control, 'function')

  const storageWorld = new World({
    plugins: [coreSystemsPlugin, storagePlugin],
  })
  storageWorld.storage = {
    values: new Map([['key', 'value']]),
    get(key) {
      return this.values.get(key)
    },
    set(key, value) {
      this.values.set(key, value)
    },
  }
  assert.equal(storageWorld.apps.worldMethods.get({ world: storageWorld }, 'key'), 'value')
  storageWorld.apps.worldMethods.set({ world: storageWorld }, 'next', 42)
  assert.equal(storageWorld.storage.values.get('next'), 42)

  const environmentWorld = new World({
    plugins: [coreSystemsPlugin, serverRuntimeStub, environmentServerPlugin],
  })
  assert.ok(environmentWorld.environment)
  assert.equal(environmentWorld.environment.plugin, '@gamedev/plugin-environment/server')
  assert.equal(typeof environmentWorld.setupMaterial, 'function')

  const networkWorld = new World({
    plugins: [
      coreSystemsPlugin,
      nodesPlugin,
      viewPlugin,
      spatialPlugin,
      chatPlugin,
      clientOnlyRuntimeStub,
      networkClientPlugin,
    ],
  })
  assert.ok(networkWorld.network)
  assert.equal(networkWorld.network.plugin, '@gamedev/plugin-network/client')
  assert.equal(typeof networkWorld.apps.worldGetters.isClient, 'function')
  assert.equal(typeof networkWorld.apps.worldMethods.getTime, 'function')
  assert.equal(typeof networkWorld.apps.appMethods.send, 'function')

  const adminNetworkWorld = new World({
    plugins: [coreSystemsPlugin, nodesPlugin, viewPlugin, spatialPlugin, clientOnlyRuntimeStub, networkAdminPlugin],
  })
  assert.ok(adminNetworkWorld.network)
  assert.equal(adminNetworkWorld.network.plugin, '@gamedev/plugin-network/admin')
  assert.equal(adminNetworkWorld.pluginCapabilities.has('admin-network'), true)
  assert.equal(adminNetworkWorld.adminNetwork, adminNetworkWorld.network)

  const livekitClientWorld = new World({
    plugins: [
      coreSystemsPlugin,
      definePlugin({
        name: 'test-livekit-client-prereqs',
        provides: ['client', 'network', 'audio'],
      }),
      livekitClientPlugin,
    ],
  })
  assert.equal(livekitClientWorld.pluginCapabilities.has('script:player.screenshare'), true)
  assert.equal(typeof livekitClientWorld.apps.playerMethods.screenshare, 'function')
  let screenTarget = null
  const fakeClientPlayer = {
    data: { id: 'player-1', owner: 'network-1' },
    world: {
      network: { id: 'network-1' },
      livekit: {
        setScreenShareTarget(targetId) {
          screenTarget = targetId
        },
      },
    },
  }
  livekitClientWorld.apps.playerMethods.screenshare(fakeClientPlayer, 'screen-a')
  assert.equal(screenTarget, 'screen-a')

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, xrClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-xr\/client:graphics/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, monitorServerPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-monitor\/server:server/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, chatPlugin, networkServerPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-network\/server:server/
  )

  const actionsWorld = new World({
    plugins: [coreSystemsPlugin, viewPlugin, spatialPlugin, stagePlugin, clientRuntimeStub, actionsClientPlugin],
  })
  assert.ok(actionsWorld.actions)
  assert.equal(actionsWorld.actions.plugin, '@gamedev/plugin-actions/client')

  const statsWorld = new World({
    plugins: [coreSystemsPlugin, prefsClientPlugin, clientRuntimeStub, statsClientPlugin],
  })
  assert.ok(statsWorld.stats)
  assert.equal(statsWorld.stats.plugin, '@gamedev/plugin-stats/client')

  const graphicsWorld = new World({
    plugins: [coreSystemsPlugin, viewPlugin, spatialPlugin, stagePlugin, prefsClientPlugin, graphicsClientPlugin],
  })
  assert.ok(graphicsWorld.graphics)
  assert.equal(graphicsWorld.graphics.plugin, '@gamedev/plugin-graphics/client')

  const targetWorld = new World({
    plugins: [coreSystemsPlugin, viewPlugin, clientRuntimeStub, targetClientPlugin],
  })
  assert.ok(targetWorld.target)
  assert.equal(targetWorld.target.plugin, '@gamedev/plugin-target/client')

  const lodsWorld = new World({
    plugins: [coreSystemsPlugin, lodsClientPlugin],
  })
  assert.ok(lodsWorld.lods)
  assert.equal(lodsWorld.lods.plugin, '@gamedev/plugin-lods/client')

  const snapsWorld = new World({
    plugins: [coreSystemsPlugin, snapsClientPlugin],
  })
  assert.ok(snapsWorld.snaps)
  assert.equal(snapsWorld.snaps.plugin, '@gamedev/plugin-snaps/client')

  const windWorld = new World({
    plugins: [coreSystemsPlugin, windClientPlugin],
  })
  assert.ok(windWorld.wind)
  assert.equal(windWorld.wind.plugin, '@gamedev/plugin-wind/client')

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, clientRuntimeStub, particlesClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-particles\/client:loader/
  )

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, prefsClientPlugin, clientRuntimeStub, environmentClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-environment\/client:loader/
  )

  const uiWorld = new World({
    plugins: [
      coreSystemsPlugin,
      viewPlugin,
      spatialPlugin,
      stagePlugin,
      chatPlugin,
      prefsClientPlugin,
      clientRuntimeStub,
      pointerClientPlugin,
      actionsClientPlugin,
      targetClientPlugin,
      uiClientPlugin,
    ],
  })
  assert.ok(uiWorld.ui)
  assert.equal(uiWorld.ui.plugin, '@gamedev/plugin-ui/client')
  assert.equal(typeof uiWorld.apps.worldMethods.setReticle, 'function')

  const prefsWorld = new World({
    plugins: [coreSystemsPlugin, prefsClientPlugin],
  })
  assert.ok(prefsWorld.prefs)
  assert.equal(prefsWorld.prefs.plugin, '@gamedev/plugin-prefs/client')

  const featureWorld = new World({
    plugins: [
      coreSystemsPlugin,
      nodesPlugin,
      viewPlugin,
      spatialPlugin,
      chatPlugin,
      serverRuntimeStub,
      loaderServerPlugin,
      loaderServerHandlersPlugin,
      appEntityPlugin,
      playerEntitiesPlugin,
      livekitServerPlugin,
      aiServerPlugin,
      evmServerPlugin,
      hyperliquidPlugin,
    ],
  })
  assert.ok(featureWorld.loader)
  assert.ok(featureWorld.chat)
  assert.ok(featureWorld.livekit)
  assert.ok(featureWorld.ai)
  assert.ok(featureWorld.aiScripts)
  assert.ok(featureWorld.evm)
  assert.ok(featureWorld.hyperliquid)
  assert.equal(featureWorld.loader.plugin, '@gamedev/plugin-loader/server')
  assert.equal(featureWorld.chat.plugin, '@gamedev/plugin-chat')
  assert.equal(featureWorld.livekit.plugin, '@gamedev/plugin-livekit/server')
  assert.equal(featureWorld.ai.plugin, '@gamedev/plugin-ai/server')
  assert.equal(featureWorld.aiScripts.plugin, '@gamedev/plugin-ai/server')
  assert.equal(typeof featureWorld.apps.worldMethods.load, 'function')
  assert.equal(typeof featureWorld.apps.worldMethods.chat, 'function')
  assert.equal(typeof featureWorld.apps.worldMethods.evm, 'function')
  assert.equal(typeof featureWorld.apps.playerGetters.evm, 'function')
  assert.equal(typeof featureWorld.apps.playerGetters.evmChainId, 'function')
  assert.equal(typeof featureWorld.apps.worldMethods.hyperliquid, 'function')
  assert.equal(featureWorld.pluginCapabilities.has('script:player.setVoiceLevel'), true)
  assert.equal(typeof featureWorld.apps.playerMethods.setVoiceLevel, 'function')

  const fakeEntity = { data: { id: 'app-1' } }
  const fakeServerPlayer = { data: { id: 'player-1' }, world: featureWorld }
  featureWorld.network.isServer = true
  featureWorld.network.send = () => {}
  featureWorld.apps.playerMethods.setVoiceLevel.call(fakeEntity, fakeServerPlayer, 'global')
  assert.equal(featureWorld.livekit.levels['player-1'], 'global')
  const livekitCleanup = featureWorld.apps.playerProxyCleanups.find(
    entry => entry.source === '@gamedev/plugin-livekit/server'
  )
  assert.ok(livekitCleanup)
  livekitCleanup.cleanup(fakeEntity, fakeServerPlayer)
  assert.equal(featureWorld.livekit.levels['player-1'], null)
})
