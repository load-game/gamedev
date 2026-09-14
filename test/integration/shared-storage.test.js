import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Knex from 'knex'
import { test } from 'vite-plus/test'
import { createAppStorage } from '../../packages/server/sharedStorage.js'

test.skipIf(!process.env.TEST_POSTGRES_URL)(
  'two PostgreSQL clients serialize creation and conflicting revisions',
  async () => {
    const schema = `test_${randomUUID().replaceAll('-', '')}`
    const env = {
      SHARED_STORAGE_DB_URI: process.env.TEST_POSTGRES_URL,
      SHARED_STORAGE_SCHEMA: schema,
      SHARED_STORAGE_PREFIXES: 'home:',
    }
    const a = await createAppStorage(null, env)
    const b = await createAppStorage(null, env)
    try {
      const create = value => [{ key: 'home:alice', value, expectedUpdatedAt: null }]
      const first = await Promise.all([a.commit(create(1)), b.commit(create(2))])
      assert.equal(first.filter(r => r.ok).length, 1)
      const entry = await a.getFreshEntry('home:alice')
      const edit = value => [{ key: entry.key, value, expectedUpdatedAt: entry.updatedAt }]
      const edits = await Promise.all([a.commit(edit(3)), b.commit(edit(4))])
      assert.equal(edits.filter(r => r.ok).length, 1)
      const saved = await b.getFreshEntry(entry.key)
      assert.notEqual(saved.updatedAt, entry.updatedAt)
      assert.throws(() => a.set(entry.key, 9), /requires_commit/)
      assert.throws(() => a.commit([{ key: entry.key, value: 9 }]), /requires_revision/)
      assert.throws(() => a.commit([...edit(9), { key: 'local:x', value: 1 }]), /cross_database/)
      assert.equal((await a.getFreshEntry(entry.key)).value, saved.value)
    } finally {
      await a.shared.db.destroy()
      await b.shared.db.destroy()
      const cleanup = Knex({ client: 'pg', connection: process.env.TEST_POSTGRES_URL })
      await cleanup.raw('DROP SCHEMA ?? CASCADE', [schema])
      await cleanup.destroy()
    }
  }
)
