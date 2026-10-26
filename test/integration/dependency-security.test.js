import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'vite-plus/test'

// Exercise the actual legacy dependency reached by the wallet SDK, not a test-only copy.
const require = createRequire(import.meta.url)
const privyRequire = createRequire(require.resolve('@privy-io/react-auth'))
const apiRequire = createRequire(privyRequire.resolve('@privy-io/api-base'))
const legacyEntry = apiRequire.resolve('zod')
const loaders = {
  commonjs: () => apiRequire('zod').z,
  esm: async () => (await import(pathToFileURL(path.join(path.dirname(legacyEntry), 'index.js')).href)).z,
}

const providerRequire = createRequire(privyRequire.resolve('@walletconnect/ethereum-provider'))
const walletUtilsRequire = createRequire(providerRequire.resolve('@walletconnect/utils'))
const queryRequire = createRequire(walletUtilsRequire.resolve('query-string'))
const decoderEntry = queryRequire.resolve('decode-uri-component')

test('legacy URI decoder keeps its CommonJS and query-string behavior', () => {
  const decode = queryRequire('decode-uri-component')
  assert.equal(decode('hello+world%20%C3%A9'), 'hello world é')
  assert.equal(decode('%FE%FF'), '\uFFFD\uFFFD')
  assert.equal(decode('%C2'), '\uFFFD')
  assert.equal(decode('%G0'), '%G0')
  assert.throws(() => decode(null), TypeError)
})

test('legacy URI decoder handles long malformed UTF-8 within a bounded subprocess', () => {
  const child = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=64',
      '-e',
      "const decode = require(process.argv[1]); const output = decode('%41%80'.repeat(50000)); if (output !== 'A%80'.repeat(50000)) process.exit(1)",
      decoderEntry,
    ],
    { timeout: 2000, encoding: 'utf8' }
  )
  assert.ifError(child.error)
  assert.equal(child.status, 0, child.stderr)
})

for (const [format, load] of Object.entries(loaders)) {
  test(`legacy Zod ${format} rejects oversized arrays and sets before parsing their elements`, async () => {
    const z = await load()
    let visited = 0
    const element = z.preprocess(value => {
      visited++
      return value
    }, z.string())
    const oversized = Array.from({ length: 5000 }, (_, index) => index)
    for (const schema of [z.array(element).max(2), z.array(element).length(2)]) {
      const result = schema.safeParse(oversized)
      assert.equal(result.success, false)
      assert.equal(result.error.issues.length, 1)
      assert.equal(result.error.issues[0].code, 'too_big')
    }
    const nested = z.object({ items: z.set(element).max(2) }).safeParse({ items: new Set(oversized) })
    assert.equal(nested.success, false)
    assert.deepEqual(nested.error.issues[0].path, ['items'])
    assert.equal(visited, 0)
    assert.deepEqual(z.array(element).max(2).parse(['valid']), ['valid'])
    assert.equal(visited, 1)
  })

  test(`legacy Zod ${format} applies the size gate before asynchronous validation`, async () => {
    const z = await load()
    let visited = 0
    const element = z.preprocess(async value => {
      visited++
      return value
    }, z.string())
    const result = await z.array(element).max(1).safeParseAsync(['one', 'two'])
    assert.equal(result.success, false)
    assert.equal(result.error.issues[0].code, 'too_big')
    assert.equal(visited, 0)
    assert.deepEqual(await z.array(element).max(1).parseAsync(['valid']), ['valid'])
    assert.equal(visited, 1)
  })
}
