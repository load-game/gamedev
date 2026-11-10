import { test } from 'vitest'
import assert from 'node:assert/strict'
import { unpack } from 'msgpackr'
import { readPacket, writePacket } from '../../packages/core/packets.js'

test('world access keeps its wire ID after the companion protocol is retired', () => {
  const packet = writePacket('worldAccess', { allowed: true })
  assert.equal(unpack(packet)[0], 44)
  assert.deepEqual(readPacket(packet), ['onWorldAccess', { allowed: true }])
})
