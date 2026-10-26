import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from 'vite-plus/test'
import { getRepoRoot, startWorldServer } from './helpers.js'

test('the world serves its browser module and font with static cache headers', async () => {
  const world = await startWorldServer()
  try {
    const assets = await fs.readdir(path.join(getRepoRoot(), 'build/public'))
    const moduleFile = assets.find(file => /^index-[\w-]+\.js$/.test(file))
    assert.ok(moduleFile, 'the build must contain its browser module')
    for (const asset of [`/${moduleFile}`, '/SpaceMono-regular.woff2']) {
      const response = await fetch(new URL(asset, world.worldUrl), { signal: AbortSignal.timeout(3000) })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-cache, no-store, must-revalidate')
      assert.equal(response.headers.get('pragma'), 'no-cache')
      assert.equal(response.headers.get('expires'), '0')
      assert.ok((await response.arrayBuffer()).byteLength > 0)
    }
  } finally {
    await world.stop()
  }
})
