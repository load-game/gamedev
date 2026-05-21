import 'ses'
import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { World } from '@gamedev/core/World.js'
import { definePlugin, definePreset } from '@gamedev/core/plugins.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { adminPreset } from '@gamedev/core/createAdminWorld.js'
import { clientPreset } from '@gamedev/core/createClientWorld.js'
import { actionsClientPlugin } from '@gamedev/core/plugins/actions/client.js'
import { aiServerPlugin } from '@gamedev/core/plugins/ai/server.js'
import { audioClientPlugin } from '@gamedev/core/plugins/audio/client.js'
import { browserClientPlugin } from '@gamedev/core/plugins/browser/client.js'
import { chatPlugin } from '@gamedev/core/plugins/chat.js'
import { controlsClientPlugin } from '@gamedev/core/plugins/controls/client.js'
import { cssClientPlugin } from '@gamedev/core/plugins/css/client.js'
import { environmentClientPlugin } from '@gamedev/core/plugins/environment/client.js'
import { appEntityPlugin } from '@gamedev/core/plugins/entities/app.js'
import { playerEntitiesPlugin } from '@gamedev/core/plugins/entities/player.js'
import { evmServerPlugin } from '@gamedev/core/plugins/evm.js'
import { graphicsClientPlugin } from '@gamedev/core/plugins/graphics/client.js'
import { hyperliquidPlugin } from '@gamedev/core/plugins/hyperliquid.js'
import { loaderServerPlugin } from '@gamedev/core/plugins/loader/server.js'
import { livekitServerPlugin } from '@gamedev/core/plugins/livekit/server.js'
import { lodsClientPlugin } from '@gamedev/core/plugins/lods/client.js'
import { logsPlugin } from '@gamedev/core/plugins/logs.js'
import { monitorServerPlugin } from '@gamedev/core/plugins/monitor/server.js'
import { networkAdminPlugin } from '@gamedev/core/plugins/network/admin.js'
import { networkClientPlugin } from '@gamedev/core/plugins/network/client.js'
import { networkServerPlugin } from '@gamedev/server/plugins/network/server.js'
import { nodesPlugin } from '@gamedev/core/plugins/nodes.js'
import { nodeClientPreset } from '@gamedev/core/createNodeClientWorld.js'
import { particlesClientPlugin } from '@gamedev/core/plugins/particles/client.js'
import { pointerClientPlugin } from '@gamedev/core/plugins/pointer/client.js'
import { prefsClientPlugin } from '@gamedev/core/plugins/prefs/client.js'
import { snapsClientPlugin } from '@gamedev/core/plugins/snaps/client.js'
import { spatialPlugin } from '@gamedev/core/plugins/spatial.js'
import { storagePlugin } from '@gamedev/core/plugins/storage.js'
import { statsClientPlugin } from '@gamedev/core/plugins/stats/client.js'
import { targetClientPlugin } from '@gamedev/core/plugins/target/client.js'
import { uiClientPlugin } from '@gamedev/core/plugins/ui/client.js'
import { viewerPreset } from '@gamedev/core/createViewerWorld.js'
import { windClientPlugin } from '@gamedev/core/plugins/wind/client.js'
import { xrClientPlugin } from '@gamedev/core/plugins/xr/client.js'
import { createServerWorld, serverPreset } from '@gamedev/server/createServerWorld.js'
import { System } from '@gamedev/core/systems/System.js'

class TestSystem extends System {}
class DependentSystem extends System {}
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
})

test('runtime factories are preset compositions', () => {
  assert.deepEqual(
    adminPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-logs',
      '@gamedev/plugin-nodes',
      '@gamedev/plugin-spatial',
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
      '@gamedev/plugin-entities/app',
      '@gamedev/plugin-entities/player',
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
      '@gamedev/plugin-spatial',
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
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-chat',
      '@gamedev/plugin-controls/client',
      '@gamedev/node-client/runtime',
      '@gamedev/plugin-network/client',
      '@gamedev/plugin-loader/server',
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
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-prefs/client',
      '@gamedev/plugin-graphics/client',
      '@gamedev/plugin-controls/client',
      '@gamedev/viewer/runtime',
      '@gamedev/plugin-browser/client',
      '@gamedev/plugin-loader/client',
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
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-storage',
      '@gamedev/plugin-chat',
      '@gamedev/server/runtime',
      '@gamedev/plugin-network/server',
      '@gamedev/plugin-environment/server',
      '@gamedev/plugin-monitor/server',
      '@gamedev/plugin-loader/server',
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
      '@gamedev/plugin-spatial',
      '@gamedev/plugin-storage',
      '@gamedev/plugin-chat',
      '@gamedev/server/runtime',
      '@gamedev/plugin-network/server',
      '@gamedev/plugin-environment/server',
      '@gamedev/plugin-monitor/server',
      '@gamedev/plugin-loader/server',
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
  assert.equal(serverWorld.entityTypes.has('app'), true)
  assert.equal(serverWorld.entityTypes.has('player'), true)
  assert.ok(serverWorld.physics)
  assert.ok(serverWorld.stage)
  assert.ok(serverWorld.network)
  assert.ok(serverWorld.environment)
  assert.ok(serverWorld.monitor)
  assert.ok(serverWorld.chat)
  assert.ok(serverWorld.livekit)
  assert.ok(serverWorld.ai)
  assert.ok(serverWorld.aiScripts)
  assert.ok(serverWorld.evm)
  assert.ok(serverWorld.hyperliquid)
  assert.equal(serverWorld.loader.plugin, '@gamedev/plugin-loader/server')
  assert.equal(serverWorld.logs.plugin, '@gamedev/plugin-logs')
  assert.equal(serverWorld.physics.plugin, '@gamedev/plugin-spatial')
  assert.equal(serverWorld.stage.plugin, '@gamedev/plugin-spatial')
  assert.equal(serverWorld.network.plugin, '@gamedev/plugin-network/server')
  assert.equal(serverWorld.environment.plugin, '@gamedev/plugin-environment/server')
  assert.equal(serverWorld.monitor.plugin, '@gamedev/plugin-monitor/server')
  assert.equal(serverWorld.chat.plugin, '@gamedev/plugin-chat')
  assert.equal(serverWorld.livekit.plugin, '@gamedev/plugin-livekit/server')
  assert.equal(serverWorld.ai.plugin, '@gamedev/plugin-ai/server')
  assert.equal(serverWorld.aiScripts.plugin, '@gamedev/plugin-ai/server')
  assert.equal(serverWorld.evm.plugin, '@gamedev/plugin-evm/server')
  assert.equal(serverWorld.hyperliquid.plugin, '@gamedev/plugin-hyperliquid')
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
  assert.equal(coreWorld.apps.appMethods.send, undefined)
  assert.equal(coreWorld.apps.appMethods.sendTo, undefined)
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
  assert.equal(coreWorld.apps.worldMethods.evm, undefined)
  assert.equal(coreWorld.apps.worldMethods.hyperliquid, undefined)

  const spatialWorld = new World({
    plugins: [coreSystemsPlugin, spatialPlugin],
  })
  assert.ok(spatialWorld.anchors)
  assert.ok(spatialWorld.avatars)
  assert.ok(spatialWorld.animation)
  assert.ok(spatialWorld.physics)
  assert.ok(spatialWorld.stage)
  assert.equal(spatialWorld.physics.plugin, '@gamedev/plugin-spatial')
  assert.equal(spatialWorld.stage.plugin, '@gamedev/plugin-spatial')
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

  const appEntityWorld = new World({
    plugins: [coreSystemsPlugin, nodesPlugin, loaderServerPlugin, appEntityPlugin],
  })
  assert.equal(appEntityWorld.pluginCapabilities.has('entity:app'), true)
  assert.equal(appEntityWorld.entityTypes.has('app'), true)

  const playerEntityWorld = new World({
    plugins: [
      coreSystemsPlugin,
      nodesPlugin,
      spatialPlugin,
      chatPlugin,
      serverRuntimeStub,
      loaderServerPlugin,
      playerEntitiesPlugin,
    ],
  })
  assert.equal(playerEntityWorld.pluginCapabilities.has('entity:player'), true)
  assert.equal(playerEntityWorld.entityTypes.has('player'), true)

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
      new World({ plugins: [coreSystemsPlugin, nodesPlugin, spatialPlugin, loaderServerPlugin, playerEntitiesPlugin] }),
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
    () => new World({ plugins: [coreSystemsPlugin, controlsClientPlugin, pointerClientPlugin] }),
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
    plugins: [coreSystemsPlugin, controlsClientPlugin],
  })
  assert.ok(controlsWorld.controls)
  assert.equal(controlsWorld.controls.plugin, '@gamedev/plugin-controls/client')

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

  const networkWorld = new World({
    plugins: [coreSystemsPlugin, nodesPlugin, spatialPlugin, chatPlugin, clientOnlyRuntimeStub, networkClientPlugin],
  })
  assert.ok(networkWorld.network)
  assert.equal(networkWorld.network.plugin, '@gamedev/plugin-network/client')
  assert.equal(typeof networkWorld.apps.worldGetters.isClient, 'function')
  assert.equal(typeof networkWorld.apps.worldMethods.getTime, 'function')
  assert.equal(typeof networkWorld.apps.appMethods.send, 'function')

  const adminNetworkWorld = new World({
    plugins: [coreSystemsPlugin, nodesPlugin, spatialPlugin, clientOnlyRuntimeStub, networkAdminPlugin],
  })
  assert.ok(adminNetworkWorld.network)
  assert.equal(adminNetworkWorld.network.plugin, '@gamedev/plugin-network/admin')
  assert.equal(adminNetworkWorld.adminNetwork, adminNetworkWorld.network)

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
    plugins: [coreSystemsPlugin, spatialPlugin, clientRuntimeStub, actionsClientPlugin],
  })
  assert.ok(actionsWorld.actions)
  assert.equal(actionsWorld.actions.plugin, '@gamedev/plugin-actions/client')

  const statsWorld = new World({
    plugins: [coreSystemsPlugin, prefsClientPlugin, clientRuntimeStub, statsClientPlugin],
  })
  assert.ok(statsWorld.stats)
  assert.equal(statsWorld.stats.plugin, '@gamedev/plugin-stats/client')

  const graphicsWorld = new World({
    plugins: [coreSystemsPlugin, spatialPlugin, prefsClientPlugin, graphicsClientPlugin],
  })
  assert.ok(graphicsWorld.graphics)
  assert.equal(graphicsWorld.graphics.plugin, '@gamedev/plugin-graphics/client')

  const targetWorld = new World({
    plugins: [coreSystemsPlugin, clientRuntimeStub, targetClientPlugin],
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
      spatialPlugin,
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
      spatialPlugin,
      chatPlugin,
      serverRuntimeStub,
      loaderServerPlugin,
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
})
