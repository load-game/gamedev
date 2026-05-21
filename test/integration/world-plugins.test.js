import 'ses'
import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { World } from '@gamedev/core/World.js'
import { definePlugin, definePreset } from '@gamedev/core/plugins.js'
import { coreSystemsPlugin } from '@gamedev/core/presets/core.js'
import { clientPreset } from '@gamedev/core/createClientWorld.js'
import { evmServerPlugin } from '@gamedev/core/plugins/evm.js'
import { hyperliquidPlugin } from '@gamedev/core/plugins/hyperliquid.js'
import { viewerPreset } from '@gamedev/core/createViewerWorld.js'
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
    clientPreset.plugins.map(plugin => plugin.name),
    ['@gamedev/core/systems', '@gamedev/client/runtime', '@gamedev/plugin-evm/client', '@gamedev/plugin-hyperliquid']
  )

  assert.deepEqual(
    viewerPreset.plugins.map(plugin => plugin.name),
    ['@gamedev/core/systems', '@gamedev/viewer/runtime']
  )

  assert.deepEqual(
    serverPreset.plugins.map(plugin => plugin.name),
    ['@gamedev/core/systems', '@gamedev/server/runtime', '@gamedev/plugin-evm/server', '@gamedev/plugin-hyperliquid']
  )
  const serverWorld = createServerWorld()
  assert.deepEqual(
    serverWorld.plugins.map(plugin => plugin.name),
    ['@gamedev/core/systems', '@gamedev/server/runtime', '@gamedev/plugin-evm/server', '@gamedev/plugin-hyperliquid']
  )
  assert.ok(serverWorld.evm)
  assert.ok(serverWorld.hyperliquid)
  assert.equal(serverWorld.evm.plugin, '@gamedev/plugin-evm/server')
  assert.equal(serverWorld.hyperliquid.plugin, '@gamedev/plugin-hyperliquid')
  assert.equal(typeof serverWorld.apps.worldMethods.evm, 'function')
  assert.equal(typeof serverWorld.apps.worldMethods.hyperliquid, 'function')
})

test('feature APIs only appear when their plugins are selected', () => {
  const coreWorld = new World({ plugins: [coreSystemsPlugin] })
  assert.equal(coreWorld.evm, undefined)
  assert.equal(coreWorld.hyperliquid, undefined)
  assert.equal(coreWorld.apps.worldMethods.evm, undefined)
  assert.equal(coreWorld.apps.worldMethods.hyperliquid, undefined)

  const featureWorld = new World({
    plugins: [coreSystemsPlugin, evmServerPlugin, hyperliquidPlugin],
  })
  assert.ok(featureWorld.evm)
  assert.ok(featureWorld.hyperliquid)
  assert.equal(typeof featureWorld.apps.worldMethods.evm, 'function')
  assert.equal(typeof featureWorld.apps.playerGetters.evm, 'function')
  assert.equal(typeof featureWorld.apps.playerGetters.evmChainId, 'function')
  assert.equal(typeof featureWorld.apps.worldMethods.hyperliquid, 'function')
})
