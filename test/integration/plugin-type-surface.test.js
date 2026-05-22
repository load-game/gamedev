import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { test } from 'vite-plus/test'

import { getRepoRoot } from './helpers.js'

const execFileAsync = promisify(execFile)

async function runTsc(file) {
  const repoRoot = getRepoRoot()
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')
  try {
    await execFileAsync(
      process.execPath,
      [
        tsc,
        '--noEmit',
        '--module',
        'ESNext',
        '--moduleResolution',
        'Bundler',
        '--target',
        'ES2022',
        '--lib',
        'ES2022,DOM',
        '--skipLibCheck',
        file,
      ],
      {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024,
      }
    )
  } catch (err) {
    throw new Error([err.message, err.stdout, err.stderr].filter(Boolean).join('\n'))
  }
}

test('plugin and preset type surfaces gate script APIs', async () => {
  const repoRoot = getRepoRoot()
  const tempDir = await fs.mkdtemp(path.join(repoRoot, '.tmp-plugin-type-surface-'))

  try {
    const rootOnly = path.join(tempDir, 'root-only.ts')
    const pluginEnabled = path.join(tempDir, 'plugin-enabled.ts')
    const loaderRegistryOnly = path.join(tempDir, 'loader-registry-only.ts')
    const loaderServerHandlers = path.join(tempDir, 'loader-server-handlers.ts')
    const livekitClientOnly = path.join(tempDir, 'livekit-client-only.ts')
    const livekitServerOnly = path.join(tempDir, 'livekit-server-only.ts')
    const runtimePlugins = path.join(tempDir, 'runtime-plugins.ts')
    const presetEnabled = path.join(tempDir, 'preset-enabled.ts')

    await fs.writeFile(
      rootOnly,
      `
        import 'gamedev'

        app.configure([])
        app.get('node-id')
        const player = null as unknown as import('gamedev').Player

        // @ts-expect-error player lookup is provided by the player entities plugin
        world.getPlayers()

        // @ts-expect-error player lookup is provided by the player entities plugin
        world.getPlayer()

        // @ts-expect-error concrete node names are provided by the nodes plugin
        app.create('prim', { color: '#fff' })

        // @ts-expect-error app asset resolution is provided by the app entities plugin
        app.asset('./assets/sprite.png')

        // @ts-expect-error world.load is provided by the loader registry plugin
        world.load('model', 'asset://model.glb')

        // @ts-expect-error controls are provided by the controls client plugin
        app.control()

        // @ts-expect-error concrete player methods are provided by the player entities plugin
        player?.teleport([0, 1, 0])

        // @ts-expect-error concrete player methods are provided by the player entities plugin
        player?.damage(10)

        // @ts-expect-error screenshare is provided by the LiveKit client plugin
        player?.screenshare('monitor')

        // @ts-expect-error voice overrides are provided by the LiveKit server plugin
        player?.setVoiceLevel('global')
      `
    )

    await fs.writeFile(
      pluginEnabled,
      `
        import 'gamedev'
        import 'gamedev/plugins/controls/client'
        import 'gamedev/plugins/entities/app'
        import 'gamedev/plugins/entities/player'
        import 'gamedev/plugins/livekit/client'
        import 'gamedev/plugins/livekit/server'
        import 'gamedev/plugins/nodes'
        import { ControlPriorities } from 'gamedev/plugins/controls/ControlPriorities'
        import { buttons, propToLabel } from 'gamedev/plugins/controls/buttons'

        const prim = app.create('prim', { type: 'box', color: '#fff' })
        prim.color = '#000'
        app.asset('./assets/sprite.png')

        const controls = app.control({ priority: ControlPriorities.APP })
        controls.keyW.down
        controls.release()
        buttons.has('keyW')
        propToLabel.keyW.toLowerCase()

        world.getPlayer()?.teleport([0, 1, 0])
        world.getPlayer()?.damage(10)
        world.getPlayer()?.screenshare('monitor')
        world.getPlayer()?.setVoiceLevel('global')

        // @ts-expect-error unknown node names are not part of the selected node registry
        app.create('not-a-node')
      `
    )

    await fs.writeFile(
      loaderRegistryOnly,
      `
        import 'gamedev'
        import 'gamedev/plugins/loader/server'

        // @ts-expect-error loader asset types are provided by loader handler plugins
        world.load('model', 'asset://model.glb')
      `
    )

    await fs.writeFile(
      loaderServerHandlers,
      `
        import 'gamedev'
        import 'gamedev/plugins/loader/server'
        import 'gamedev/plugins/loader/server-handlers'

        world.load('model', 'asset://model.glb')
        world.load('avatar', 'asset://avatar.vrm')

        // @ts-expect-error splat loading is provided by the client handler plugin
        world.load('splat', 'asset://scan.spz')
      `
    )

    await fs.writeFile(
      livekitClientOnly,
      `
        import 'gamedev'
        import 'gamedev/plugins/entities/player'
        import 'gamedev/plugins/livekit/client'

        world.getPlayer()?.screenshare('monitor')

        // @ts-expect-error voice overrides are provided by the LiveKit server plugin
        world.getPlayer()?.setVoiceLevel('global')
      `
    )

    await fs.writeFile(
      livekitServerOnly,
      `
        import 'gamedev'
        import 'gamedev/plugins/entities/player'
        import 'gamedev/plugins/livekit/server'

        world.getPlayer()?.setVoiceLevel('global')

        // @ts-expect-error screenshare is provided by the LiveKit client plugin
        world.getPlayer()?.screenshare('monitor')
      `
    )

    await fs.writeFile(
      runtimePlugins,
      `
        import { clientRuntimePlugin } from 'gamedev/plugins/runtime/client'
        import { nodeClientRuntimePlugin } from 'gamedev/plugins/runtime/node-client'
        import { serverRuntimePlugin } from 'gamedev/plugins/runtime/server'
        import { viewerRuntimePlugin } from 'gamedev/plugins/runtime/viewer'

        clientRuntimePlugin.name
        nodeClientRuntimePlugin.name
        serverRuntimePlugin.name
        viewerRuntimePlugin.name
      `
    )

    await fs.writeFile(
      presetEnabled,
      `
        import 'gamedev'
        import 'gamedev/presets/client'
        import 'gamedev/presets/server'

        app.create('ui', { width: 320, height: 180 })
        app.asset('./assets/sprite.png')
        app.control().pointer.lock()

        world.set('score', 10)
        world.get<number>('score')
        world.evm().isConnected()
        world.hyperliquid().getAvailableTickers()
        world.load('model', 'asset://model.glb')
        world.load('splat', 'asset://scan.spz')
        world.getPlayer()?.teleport([0, 1, 0])
        world.getPlayer()?.damage(10)
        world.getPlayer()?.screenshare('monitor')
        world.getPlayer()?.setVoiceLevel('spatial')
      `
    )

    await runTsc(rootOnly)
    await runTsc(pluginEnabled)
    await runTsc(loaderRegistryOnly)
    await runTsc(loaderServerHandlers)
    await runTsc(livekitClientOnly)
    await runTsc(livekitServerOnly)
    await runTsc(runtimePlugins)
    await runTsc(presetEnabled)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }

  assert.ok(true)
})
