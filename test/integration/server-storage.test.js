import assert from 'node:assert/strict'
import path from 'path'
import { test } from 'vite-plus/test'
import Knex from 'knex'

import { Storage } from '@gamedev/server/Storage.js'
import { createTempDir } from './helpers.js'

async function createStorageDB() {
  const dir = await createTempDir('hyperfy-storage-')
  const filename = path.join(dir, 'db.sqlite')
  const db = Knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
  })
  await db.schema.createTable('world_storage', table => {
    table.string('key').primary()
    table.text('value').notNullable()
    table.timestamp('createdAt').notNullable()
    table.timestamp('updatedAt').notNullable()
  })
  return { db, filename }
}

test('storage close flushes pending writes and reloads from sqlite', async () => {
  const { db, filename } = await createStorageDB()
  try {
    const storage = new Storage(db, { flushIntervalMs: 25 })
    await storage.init()
    storage.set('counter', { value: 3, tags: ['a', 'b'] })
    await storage.close()
  } finally {
    await db.destroy()
  }

  const dbReloaded = Knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
  })
  try {
    const storage = new Storage(dbReloaded)
    await storage.init()
    assert.deepEqual(storage.get('counter'), { value: 3, tags: ['a', 'b'] })
  } finally {
    await dbReloaded.destroy()
  }
})

test('storage remove deletes persisted keys', async () => {
  const { db } = await createStorageDB()
  try {
    const storage = new Storage(db, { flushIntervalMs: 25 })
    await storage.init()
    storage.set('greeting', 'hello')
    await storage.persist()

    storage.remove('greeting')
    await storage.persist()

    const row = await db('world_storage').where({ key: 'greeting' }).first()
    assert.equal(row, undefined)
    assert.equal(storage.get('greeting'), undefined)
  } finally {
    await db.destroy()
  }
})

test('mutating a fetched object does not persist until set is called again', async () => {
  const { db, filename } = await createStorageDB()
  try {
    const storage = new Storage(db, { flushIntervalMs: 25 })
    await storage.init()
    storage.set('prefs', { theme: 'dark', volume: 0.5 })
    await storage.persist()

    const prefs = storage.get('prefs')
    prefs.theme = 'light'

    await storage.close()
  } finally {
    await db.destroy()
  }

  const dbReloaded = Knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
  })
  try {
    const storage = new Storage(dbReloaded)
    await storage.init()
    assert.deepEqual(storage.get('prefs'), { theme: 'dark', volume: 0.5 })
  } finally {
    await dbReloaded.destroy()
  }
})

test('storage getFresh reads writes from another storage instance', async () => {
  const { db, filename } = await createStorageDB()
  try {
    const storageA = new Storage(db, { flushIntervalMs: 25 })
    await storageA.init()

    const dbReloaded = Knex({
      client: 'better-sqlite3',
      connection: { filename },
      useNullAsDefault: true,
    })

    try {
      const storageB = new Storage(dbReloaded, { flushIntervalMs: 25 })
      await storageB.init()

      await storageA.setFresh('shared', { version: 1, name: 'first' })
      assert.deepEqual(await storageB.getFresh('shared'), { version: 1, name: 'first' })

      await storageB.setFresh('shared', { version: 2, name: 'second' })
      assert.deepEqual(await storageA.getFresh('shared'), { version: 2, name: 'second' })
    } finally {
      await dbReloaded.destroy()
    }
  } finally {
    await db.destroy()
  }
})

test('storage commit rejects stale conditional writes', async () => {
  const { db, filename } = await createStorageDB()
  try {
    const storageA = new Storage(db, { flushIntervalMs: 25 })
    await storageA.init()
    await storageA.setFresh('town', { version: 1 })
    const entryA = await storageA.getFreshEntry('town')

    const dbReloaded = Knex({
      client: 'better-sqlite3',
      connection: { filename },
      useNullAsDefault: true,
    })

    try {
      const storageB = new Storage(dbReloaded, { flushIntervalMs: 25 })
      await storageB.init()
      const entryB = await storageB.getFreshEntry('town')
      assert.equal(entryB.updatedAt, entryA.updatedAt)

      const success = await storageA.commit([
        {
          key: 'town',
          value: { version: 2 },
          expectedUpdatedAt: entryA.updatedAt,
        },
      ])
      assert.equal(success.ok, true)

      const stale = await storageB.commit([
        {
          key: 'town',
          value: { version: 3 },
          expectedUpdatedAt: entryB.updatedAt,
        },
      ])
      assert.equal(stale.ok, false)
      assert.equal(stale.conflicts.length, 1)
      assert.deepEqual(stale.conflicts[0].value, { version: 2 })

      assert.deepEqual(await storageB.getFresh('town'), { version: 2 })
    } finally {
      await dbReloaded.destroy()
    }
  } finally {
    await db.destroy()
  }
})

test('storage commit supports create-if-absent and fresh prefix scans', async () => {
  const { db, filename } = await createStorageDB()
  try {
    const storageA = new Storage(db, { flushIntervalMs: 25 })
    await storageA.init()

    const created = await storageA.commit([
      {
        key: 'players:alice',
        value: { points: 5 },
        expectedUpdatedAt: null,
      },
    ])
    assert.equal(created.ok, true)

    const dbReloaded = Knex({
      client: 'better-sqlite3',
      connection: { filename },
      useNullAsDefault: true,
    })

    try {
      const storageB = new Storage(dbReloaded, { flushIntervalMs: 25 })
      await storageB.init()

      const staleCreate = await storageB.commit([
        {
          key: 'players:alice',
          value: { points: 8 },
          expectedUpdatedAt: null,
        },
      ])
      assert.equal(staleCreate.ok, false)
      assert.equal(staleCreate.conflicts.length, 1)
      assert.deepEqual(staleCreate.conflicts[0].value, { points: 5 })

      await storageA.setFresh('players:bob', { points: 7 })
      await storageA.setFresh('market:btc', { volume: 12 })

      const entries = await storageB.getFreshEntriesByPrefix('players:')
      assert.deepEqual(
        entries.map(entry => [entry.key, entry.value]),
        [
          ['players:alice', { points: 5 }],
          ['players:bob', { points: 7 }],
        ]
      )

      const keys = await storageB.listKeys('players:')
      assert.deepEqual(keys, ['players:alice', 'players:bob'])
    } finally {
      await dbReloaded.destroy()
    }
  } finally {
    await db.destroy()
  }
})

test('back-to-back durable commits never reuse the CAS timestamp', async () => {
  const { db } = await createStorageDB()
  try {
    const storage = new Storage(db)
    await storage.init()
    const a = await storage.commit([{ key: 'home', value: { revision: 0 }, expectedUpdatedAt: null }])
    const b = await storage.commit([{ key: 'home', value: { revision: 1 }, expectedUpdatedAt: a.entries[0].updatedAt }])
    assert.equal(b.ok, true)
    assert.notEqual(a.entries[0].updatedAt, b.entries[0].updatedAt)
    const stale = await storage.commit([
      { key: 'home', value: { revision: 2 }, expectedUpdatedAt: a.entries[0].updatedAt },
    ])
    assert.equal(stale.ok, false)
    await storage.close()
  } finally {
    await db.destroy()
  }
})
