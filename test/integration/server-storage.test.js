import assert from 'node:assert/strict'
import path from 'path'
import { test } from 'node:test'
import Knex from 'knex'

import { Storage } from '../../src/server/Storage.js'
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
