import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import { test } from 'vite-plus/test'
import { runAppCommand } from '@gamedev/app-server/commands.js'
import { DirectAppServer } from '@gamedev/app-server/direct.js'
import { createTempDir } from './helpers.js'

async function writeFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents)
}

test('deploy pipeline uploads script files and defaults to legacy-body for entry bodies', async () => {
  const rootDir = await createTempDir('hyperfy-script-deploy-')

  await writeFile(path.join(rootDir, 'apps', 'LegacyApp', 'index.js'), "app.on('update', () => {});\n")
  await writeFile(path.join(rootDir, 'apps', 'LegacyApp', 'lib', 'value.js'), "export default 'legacy-value';\n")

  const server = new DirectAppServer({ worldUrl: 'http://example.com', rootDir })
  const info = await server._uploadScriptForApp('LegacyApp', null, { upload: false })

  assert.equal(info.mode, 'module')
  assert.equal(info.scriptEntry, 'index.js')
  assert.equal(info.scriptFiles[info.scriptEntry], info.scriptUrl)
  assert.ok(info.scriptFiles['lib/value.js'])
  assert.equal(info.scriptFormat, 'legacy-body')
})

test('deploy pipeline infers module format when entry exports default', async () => {
  const rootDir = await createTempDir('hyperfy-module-deploy-')
  const appDir = path.join(rootDir, 'apps', 'ModuleApp')

  await writeFile(path.join(appDir, 'index.js'), 'export default (world, app) => { app.state.ready = true }\n')
  await writeFile(path.join(appDir, 'lib', 'value.js'), "export default 'module-value';\n")

  const server = new DirectAppServer({ worldUrl: 'http://example.com', rootDir })
  const info = await server._uploadScriptForApp('ModuleApp', null, { upload: false })

  assert.equal(info.mode, 'module')
  assert.equal(info.scriptEntry, 'index.js')
  assert.equal(info.scriptFiles[info.scriptEntry], info.scriptUrl)
  assert.ok(info.scriptFiles['lib/value.js'])
  assert.equal(info.scriptFormat, 'module')
})

test('apps build validates every local app without connecting to a world', async () => {
  const rootDir = await createTempDir('hyperfy-apps-build-')
  const appDir = path.join(rootDir, 'apps', 'BuildApp')

  await writeFile(path.join(appDir, 'index.js'), 'export default (world, app) => { app.state.ready = true }\n')
  await writeFile(
    path.join(appDir, 'BuildApp.json'),
    JSON.stringify(
      {
        id: 'BuildApp',
        name: 'Build App',
      },
      null,
      2
    )
  )

  const exitCode = await runAppCommand({
    command: 'build',
    args: ['--all'],
    rootDir,
  })

  const config = JSON.parse(await fs.readFile(path.join(appDir, 'BuildApp.json'), 'utf8'))
  assert.equal(exitCode, 0)
  assert.equal(config.scriptFormat, 'module')
})
