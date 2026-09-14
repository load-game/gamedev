import Knex from 'knex'
import { Storage } from './Storage.js'

// Shared records use a separate schema and never share instance entities/configuration.
export class RoutedStorage {
  constructor(local, shared, prefixes) {
    Object.assign(this, { local, shared, prefixes })
  }

  target(key) {
    return this.prefixes.some(prefix => String(key).startsWith(prefix)) ? this.shared : this.local
  }

  async init() {
    await this.local.init()
  }
  get(key) {
    return this.target(key).get(key)
  }
  getFresh(key) {
    return this.target(key).getFresh(key)
  }
  getFreshEntry(key) {
    return this.target(key).getFreshEntry(key)
  }

  set(key, value) {
    if (this.target(key) === this.shared) throw new Error('shared_storage_requires_commit')
    return this.local.set(key, value)
  }

  remove(key) {
    if (this.target(key) === this.shared) throw new Error('shared_storage_requires_commit')
    return this.local.remove(key)
  }

  setFresh(key, value) {
    if (this.target(key) === this.shared) throw new Error('shared_storage_requires_revision')
    return this.local.setFresh(key, value)
  }

  commit(operations) {
    if (!Array.isArray(operations)) throw new Error('storage_commit_requires_array')
    const targets = new Set(operations.map(op => this.target(op?.key)))
    if (targets.size > 1) throw new Error('storage_commit_cross_database')
    const target = targets.values().next().value || this.local
    if (target === this.shared && operations.some(op => op.expectedUpdatedAt === undefined)) {
      throw new Error('shared_storage_requires_revision')
    }
    return target.commit(operations)
  }

  async getFreshEntriesByPrefix(prefix = '') {
    const [local, shared] = await Promise.all([
      this.local.getFreshEntriesByPrefix(prefix),
      this.shared.getFreshEntriesByPrefix(prefix),
    ])
    return [
      ...local.filter(e => this.target(e.key) === this.local),
      ...shared.filter(e => this.target(e.key) === this.shared),
    ].sort((a, b) => a.key.localeCompare(b.key))
  }

  async listKeys(prefix = '') {
    return (await this.getFreshEntriesByPrefix(prefix)).map(e => e.key)
  }
  async close() {
    await this.local.close()
    await this.shared.close()
    await this.shared.db.destroy()
  }
}

export async function createAppStorage(db, env = process.env) {
  const local = new Storage(db)
  if (!env.SHARED_STORAGE_DB_URI) return local
  const schema = env.SHARED_STORAGE_SCHEMA
  const prefixes = (env.SHARED_STORAGE_PREFIXES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (
    !/^postgres(?:ql)?:\/\//.test(env.SHARED_STORAGE_DB_URI) ||
    !/^[a-z][a-z0-9_]{0,62}$/.test(schema || '') ||
    schema === 'public' ||
    !prefixes.length
  ) {
    throw new Error('shared_storage_requires_postgres_schema_and_prefixes')
  }
  const sharedDb = Knex({
    client: 'pg',
    connection: env.SHARED_STORAGE_DB_URI,
    searchPath: [schema],
    pool: { min: 0, max: 4 },
  })
  try {
    await sharedDb.transaction(async trx => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`storage-migrate:${schema}`])
      await trx.raw('CREATE SCHEMA IF NOT EXISTS ??', [schema])
      await trx.raw(
        'CREATE TABLE IF NOT EXISTS ??.world_storage (key text PRIMARY KEY, value text NOT NULL, "createdAt" text NOT NULL, "updatedAt" text NOT NULL)',
        [schema]
      )
    })
    return new RoutedStorage(local, new Storage(sharedDb), prefixes)
  } catch (error) {
    await sharedDb.destroy()
    throw error
  }
}
