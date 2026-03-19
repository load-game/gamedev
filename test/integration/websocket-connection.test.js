import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveWebSocketConnection } from '../../src/server/websocketConnection.js'

test('resolveWebSocketConnection returns raw websocket connections unchanged', () => {
  const connection = {
    on() {},
    send() {},
  }

  assert.equal(resolveWebSocketConnection(connection), connection)
})

test('resolveWebSocketConnection unwraps nested socket connections', () => {
  const nestedSocket = {
    on() {},
    send() {},
  }
  const connection = {
    socket: nestedSocket,
  }

  assert.equal(resolveWebSocketConnection(connection), nestedSocket)
})

test('resolveWebSocketConnection adapts EventTarget-style websocket connections', () => {
  const listeners = new Map()
  const sent = []
  const closed = []
  const connection = {
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler)
    },
    send(data) {
      sent.push(data)
    },
    close(code, reason) {
      closed.push([code, reason])
    },
  }

  const resolved = resolveWebSocketConnection(connection)
  const received = []
  resolved.on('message', data => {
    received.push(data)
  })
  resolved.send('hello')
  listeners.get('message')({ data: 'world' })
  resolved.close(1000, 'done')
  resolved.terminate()

  assert.deepEqual(received, ['world'])
  assert.deepEqual(sent, ['hello'])
  assert.deepEqual(closed, [[1000, 'done'], [undefined, undefined]])
})
