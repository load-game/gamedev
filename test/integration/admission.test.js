import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { Admission } from '../../packages/server/Admission.js'

test('twenty seats include pending, connected and grace; reconnect consumes no extra seat', () => {
  let now = 0
  const a = new Admission({ capacity: 20, now: () => now })
  const ids = Array.from({ length: 20 }, (_, i) => `session_number_${String(i).padStart(3, '0')}`)
  const tickets = ids.map(id => a.reserve(id))
  assert.deepEqual(a.reserve(ids[0]), tickets[0])
  assert.throws(() => a.reserve('overflow_session_1'), /full/)
  for (const t of tickets) {
    a.consume(t.ticket)
    a.connected(t.sessionId)
  }
  a.disconnected(ids[0])
  assert.equal(a.status().grace, 1)
  assert.throws(() => a.reserve('overflow_session_1'), /full/)
  const reconnect = a.reserve(ids[0])
  a.consume(reconnect.ticket)
  assert.throws(() => a.consume(reconnect.ticket), /invalid_ticket/)
  a.connected(ids[0])
  a.disconnected(ids[0])
  now = 60001
  a.reserve('overflow_session_1')
  assert.equal(a.status().used, 20)
})

test('expiry, drain and generation replacement cannot leak or replay reservations', () => {
  let now = 0
  const a = new Admission({ capacity: 1, now: () => now })
  const t = a.reserve('example_session_01')
  now = 30001
  assert.throws(() => a.consume(t.ticket), /invalid_ticket/)
  const next = a.reserve('example_session_02')
  a.consume(next.ticket)
  now += 15001
  assert.throws(() => a.connected(next.sessionId), /invalid_transition/)
  a.draining = true
  assert.throws(() => a.reserve('example_session_03'), /draining/)
  const replacement = new Admission({ capacity: 1 })
  assert.throws(() => replacement.consume(next.ticket), /invalid_ticket/)
})
