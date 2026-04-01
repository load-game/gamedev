import assert from 'node:assert/strict'
import path from 'node:path'
import fsPromises from 'node:fs/promises'
import { test } from 'node:test'

import { AssetsS3 } from '../../src/server/AssetsS3.js'
import { createTempDir } from './helpers.js'

test('AssetsS3 init skips built-in uploads when runtime bootstrap mode is enabled', async t => {
  const rootDir = await createTempDir('hyperfy-assets-s3-')
  const builtInAssetsDir = path.join(rootDir, 'src/world/assets')
  await fsPromises.mkdir(builtInAssetsDir, { recursive: true })
  await fsPromises.writeFile(path.join(builtInAssetsDir, 'avatar.vrm'), 'avatar')

  t.after(async () => {
    await fsPromises.rm(rootDir, { recursive: true, force: true })
  })

  const assetManager = Object.create(AssetsS3.prototype)
  const sent = []
  let uploadCalled = false
  const previousBootstrapMode = process.env.RUNTIME_BOOTSTRAP

  assetManager.bucketName = 'shared-assets'
  assetManager.client = {
    async send(command) {
      sent.push(command.constructor.name)
      return {}
    },
  }
  assetManager.uploadDirectory = async () => {
    uploadCalled = true
  }

  process.env.RUNTIME_BOOTSTRAP = '1'
  try {
    await assetManager.init({ rootDir, worldDir: '/tmp/world' })
  } finally {
    if (previousBootstrapMode === undefined) {
      delete process.env.RUNTIME_BOOTSTRAP
    } else {
      process.env.RUNTIME_BOOTSTRAP = previousBootstrapMode
    }
  }

  assert.deepEqual(sent, ['ListObjectsV2Command'])
  assert.equal(uploadCalled, false)
})
