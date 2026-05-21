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
import { chatPlugin } from '@gamedev/core/plugins/chat.js'
import { environmentClientPlugin } from '@gamedev/core/plugins/environment/client.js'
import { evmServerPlugin } from '@gamedev/core/plugins/evm.js'
import { hyperliquidPlugin } from '@gamedev/core/plugins/hyperliquid.js'
import { loaderServerPlugin } from '@gamedev/core/plugins/loader/server.js'
import { livekitServerPlugin } from '@gamedev/core/plugins/livekit/server.js'
import { lodsClientPlugin } from '@gamedev/core/plugins/lods/client.js'
import { nodeClientPreset } from '@gamedev/core/createNodeClientWorld.js'
import { particlesClientPlugin } from '@gamedev/core/plugins/particles/client.js'
import { prefsClientPlugin } from '@gamedev/core/plugins/prefs/client.js'
import { snapsClientPlugin } from '@gamedev/core/plugins/snaps/client.js'
import { statsClientPlugin } from '@gamedev/core/plugins/stats/client.js'
import { targetClientPlugin } from '@gamedev/core/plugins/target/client.js'
import { uiClientPlugin } from '@gamedev/core/plugins/ui/client.js'
import { viewerPreset } from '@gamedev/core/createViewerWorld.js'
import { windClientPlugin } from '@gamedev/core/plugins/wind/client.js'
import { createServerWorld, serverPreset } from '@gamedev/server/createServerWorld.js'
import { System } from '@gamedev/core/systems/System.js'

class TestSystem extends System {}
class DependentSystem extends System {}

test('World starts as a kernel and installs systems through plugins', () => {
  const emptyWorld = new World()
  assert.deepEqual(emptyWorld.systems, [])

  const testPlugin = definePlugin({
    name: 'test-plugin',
    requires: ['core'],
    provides: ['test-capability'],
    systems: [['test', TestSystem]],
    scripts: {
      world: {
        testApi: (entity, value) => `${entity.data.id}:${value}`,
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
  assert.equal(world.apps.worldMethods.testApi({ data: { id: 'app-1' } }, 'ok'), 'app-1:ok')
  assert.equal(world.apps.playerGetters.testValue({ data: { testValue: 42 } }), 42)
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
    /script_api_collision:world\.add:core:bad-script-api/
  )
})

test('runtime factories are preset compositions', () => {
  assert.deepEqual(
    adminPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-chat',
      '@gamedev/plugin-prefs/client',
      '@gamedev/admin/runtime',
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
      '@gamedev/plugin-chat',
      '@gamedev/plugin-prefs/client',
      '@gamedev/client/runtime',
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
      '@gamedev/plugin-chat',
      '@gamedev/node-client/runtime',
      '@gamedev/plugin-environment/node-client',
      '@gamedev/plugin-loader/server',
    ]
  )

  assert.deepEqual(
    viewerPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-prefs/client',
      '@gamedev/viewer/runtime',
      '@gamedev/plugin-loader/client',
      '@gamedev/plugin-environment/client',
    ]
  )

  assert.deepEqual(
    serverPreset.plugins.map(plugin => plugin.name),
    [
      '@gamedev/core/systems',
      '@gamedev/plugin-chat',
      '@gamedev/server/runtime',
      '@gamedev/plugin-environment/server',
      '@gamedev/plugin-loader/server',
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
      '@gamedev/plugin-chat',
      '@gamedev/server/runtime',
      '@gamedev/plugin-environment/server',
      '@gamedev/plugin-loader/server',
      '@gamedev/plugin-livekit/server',
      '@gamedev/plugin-ai/server',
      '@gamedev/plugin-evm/server',
      '@gamedev/plugin-hyperliquid',
    ]
  )
  assert.ok(serverWorld.loader)
  assert.ok(serverWorld.environment)
  assert.ok(serverWorld.chat)
  assert.ok(serverWorld.livekit)
  assert.ok(serverWorld.ai)
  assert.ok(serverWorld.aiScripts)
  assert.ok(serverWorld.evm)
  assert.ok(serverWorld.hyperliquid)
  assert.equal(serverWorld.loader.plugin, '@gamedev/plugin-loader/server')
  assert.equal(serverWorld.environment.plugin, '@gamedev/plugin-environment/server')
  assert.equal(serverWorld.chat.plugin, '@gamedev/plugin-chat')
  assert.equal(serverWorld.livekit.plugin, '@gamedev/plugin-livekit/server')
  assert.equal(serverWorld.ai.plugin, '@gamedev/plugin-ai/server')
  assert.equal(serverWorld.aiScripts.plugin, '@gamedev/plugin-ai/server')
  assert.equal(serverWorld.evm.plugin, '@gamedev/plugin-evm/server')
  assert.equal(serverWorld.hyperliquid.plugin, '@gamedev/plugin-hyperliquid')
  assert.equal(typeof serverWorld.apps.worldMethods.load, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.chat, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.evm, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.hyperliquid, 'function')
})

test('feature APIs only appear when their plugins are selected', () => {
  const coreWorld = new World({ plugins: [coreSystemsPlugin] })
  assert.equal(coreWorld.evm, undefined)
  assert.equal(coreWorld.hyperliquid, undefined)
  assert.equal(coreWorld.livekit, undefined)
  assert.equal(coreWorld.ai, undefined)
  assert.equal(coreWorld.aiScripts, undefined)
  assert.equal(coreWorld.loader, undefined)
  assert.equal(coreWorld.environment, undefined)
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
  assert.equal(coreWorld.apps.worldMethods.load, undefined)
  assert.equal(coreWorld.apps.worldMethods.chat, undefined)
  assert.equal(coreWorld.apps.worldMethods.setReticle, undefined)
  assert.equal(coreWorld.apps.worldMethods.evm, undefined)
  assert.equal(coreWorld.apps.worldMethods.hyperliquid, undefined)

  const serverRuntimeStub = definePlugin({
    name: 'test-server-runtime',
    systems: [
      ['server', TestSystem],
      ['network', DependentSystem],
    ],
  })

  const clientRuntimeStub = definePlugin({
    name: 'test-client-runtime',
    systems: [
      ['client', TestSystem],
      ['controls', DependentSystem],
      ['graphics', TestSystem],
      ['network', DependentSystem],
    ],
  })

  assert.throws(
    () => new World({ plugins: [coreSystemsPlugin, prefsClientPlugin, audioClientPlugin] }),
    /plugin_missing_requirement:@gamedev\/plugin-audio\/client:client/
  )

  const actionsWorld = new World({
    plugins: [coreSystemsPlugin, clientRuntimeStub, actionsClientPlugin],
  })
  assert.ok(actionsWorld.actions)
  assert.equal(actionsWorld.actions.plugin, '@gamedev/plugin-actions/client')

  const statsWorld = new World({
    plugins: [coreSystemsPlugin, prefsClientPlugin, clientRuntimeStub, statsClientPlugin],
  })
  assert.ok(statsWorld.stats)
  assert.equal(statsWorld.stats.plugin, '@gamedev/plugin-stats/client')

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
      chatPlugin,
      prefsClientPlugin,
      clientRuntimeStub,
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
      chatPlugin,
      serverRuntimeStub,
      loaderServerPlugin,
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
