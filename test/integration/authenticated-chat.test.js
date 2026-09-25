import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { authenticatedChatMessage } from '../../packages/server/authenticatedChat.js'

test('chat identity and metadata come from the authenticated socket', () => {
  const socket = { id: 'guest', player: { data: { name: 'Guest' } } }
  const input = {
    id: 'replay',
    from: 'Owner',
    fromId: 'owner',
    body: ' listen to me ',
    createdAt: 'old',
    generation: 10,
    authenticated: true,
  }
  const message = authenticatedChatMessage(socket, input)
  assert.equal(message.fromId, 'guest')
  assert.equal(message.from, 'Guest')
  assert.equal(message.body, 'listen to me')
  assert.notEqual(message.id, input.id)
  assert.notEqual(message.createdAt, input.createdAt)
  assert.equal(message.generation, undefined)
  assert.equal(message.authenticated, undefined)
  assert.notEqual(authenticatedChatMessage(socket, input).id, message.id)
  assert.equal(input.fromId, 'owner')
})
test('chat rejects malformed, empty, oversized and unauthenticated messages', () => {
  const socket = { id: 'guest', player: { data: { name: 'Guest' } } }
  for (const input of [null, {}, { body: 3 }, { body: '  ' }, { body: 'x'.repeat(1501) }]) {
    assert.equal(authenticatedChatMessage(socket, input), null)
  }
  assert.equal(authenticatedChatMessage({ id: 'guest' }, { body: 'listen to me' }), null)
  assert.ok(authenticatedChatMessage(socket, { body: 'x'.repeat(1500) }))
})
