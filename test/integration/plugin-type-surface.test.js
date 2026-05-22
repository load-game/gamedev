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
    const presetEnabled = path.join(tempDir, 'preset-enabled.ts')

    await fs.writeFile(
      rootOnly,
      `
        import 'gamedev'

        app.configure([])
        app.get('node-id')
        world.getPlayers()

        // @ts-expect-error concrete node names are provided by the nodes plugin
        app.create('prim', { color: '#fff' })

        // @ts-expect-error controls are provided by the controls client plugin
        app.control()
      `
    )

    await fs.writeFile(
      pluginEnabled,
      `
        import 'gamedev'
        import 'gamedev/plugins/controls/client'
        import 'gamedev/plugins/nodes'

        const prim = app.create('prim', { type: 'box', color: '#fff' })
        prim.color = '#000'

        const controls = app.control()
        controls.keyW.down
        controls.release()

        // @ts-expect-error unknown node names are not part of the selected node registry
        app.create('not-a-node')
      `
    )

    await fs.writeFile(
      presetEnabled,
      `
        import 'gamedev'
        import 'gamedev/presets/client'
        import 'gamedev/presets/server'

        app.create('ui', { width: 320, height: 180 })
        app.control().pointer.lock()

        world.set('score', 10)
        world.get<number>('score')
        world.evm().isConnected()
        world.hyperliquid().getAvailableTickers()
      `
    )

    await runTsc(rootOnly)
    await runTsc(pluginEnabled)
    await runTsc(presetEnabled)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }

  assert.ok(true)
})
