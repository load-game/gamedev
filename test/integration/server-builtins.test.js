import assert from 'node:assert/strict'
import path from 'node:path'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import { test } from 'vite-plus/test'

import {
  DEFAULT_SCENE_BLUEPRINT_ID,
  createDefaultSceneBlueprintData,
  createDefaultWorldSeedRecords,
  getBuiltinAssetSourceDirs,
  resolveBuiltinAssetPath,
} from '@gamedev/server/plugins/builtins/server.js'
import { AssetsLocal } from '@gamedev/server/AssetsLocal.js'
import { createTempDir } from './helpers.js'

test('server builtins own default scene seed data', () => {
  const blueprint = createDefaultSceneBlueprintData()
  assert.equal(blueprint.id, DEFAULT_SCENE_BLUEPRINT_ID)
  assert.equal(blueprint.model, 'asset://Model.glb')
  assert.equal(blueprint.script, 'asset://scene.js')
  assert.deepEqual(blueprint.scriptFiles, { 'scene.js': 'asset://scene.js' })
  assert.equal(blueprint.props.sky.url, 'asset://sky.jpg')
  assert.equal(blueprint.props.hdr.url, 'asset://sky.hdr')

  blueprint.props.sky.url = 'asset://changed.jpg'
  assert.equal(createDefaultSceneBlueprintData().props.sky.url, 'asset://sky.jpg')
})

test('server builtins convert legacy settings model into scene seed records', () => {
  const seed = createDefaultWorldSeedRecords({
    settings: {
      model: { url: 'asset://legacy.glb' },
      name: 'Legacy',
    },
    now: '2026-05-21T00:00:00.000Z',
    createId: () => 'entity-1',
  })

  const blueprint = JSON.parse(seed.blueprint.data)
  const entity = JSON.parse(seed.entity.data)
  assert.equal(seed.settingsChanged, true)
  assert.deepEqual(seed.settings, { name: 'Legacy' })
  assert.equal(blueprint.id, '$scene')
  assert.equal(blueprint.model, 'asset://legacy.glb')
  assert.equal(blueprint.script, null)
  assert.equal(entity.id, 'entity-1')
  assert.equal(entity.type, 'app')
  assert.equal(entity.blueprint, '$scene')
})

test('builtin asset source paths are server-plugin owned', async t => {
  const rootDir = await createTempDir('gamedev-server-builtins-')
  t.onTestFinished(async () => {
    await fsPromises.rm(rootDir, { recursive: true, force: true })
  })

  const dirs = getBuiltinAssetSourceDirs(rootDir)
  assert.deepEqual(dirs, [path.join(rootDir, 'build/world/assets'), path.join(rootDir, 'packages/server/world/assets')])

  const sourceDir = path.join(rootDir, 'packages/server/world/assets')
  const buildDir = path.join(rootDir, 'build/world/assets')
  await fsPromises.mkdir(sourceDir, { recursive: true })
  await fsPromises.mkdir(buildDir, { recursive: true })
  await fsPromises.writeFile(path.join(sourceDir, 'Model.glb'), 'model')
  await fsPromises.writeFile(path.join(buildDir, 'Model.glb'), 'build-model')

  assert.equal(resolveBuiltinAssetPath(rootDir, 'Model.glb', fs.existsSync), path.join(buildDir, 'Model.glb'))
  assert.equal(
    resolveBuiltinAssetPath(rootDir, 'Missing.glb', () => false),
    null
  )

  const assets = new AssetsLocal()
  await assets.init({ rootDir, worldDir: path.join(rootDir, 'world') })
  assert.equal(await fsPromises.readFile(path.join(rootDir, 'world/assets/Model.glb'), 'utf8'), 'build-model')
})
