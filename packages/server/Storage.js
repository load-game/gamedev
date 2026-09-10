import { throttle } from 'lodash-es'

function cloneValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function normalizeTimestamp(value) {
  if (value == null) return null
  if (value instanceof Date) {
    const ts = value.getTime()
    return Number.isFinite(ts) ? value.toISOString() : null
  }
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString()
  }
  const normalized = String(value).trim()
  return normalized || null
}

export class Storage {
  constructor(db, { flushIntervalMs = 1000 } = {}) {
    this.db = db
    this.data = new Map()
    this.dirty = new Set()
    this.deleted = new Set()
    this.pendingPersist = false
    this.activePersistPromise = null
    this.schedulePersist = throttle(
      () => {
        void this.persist()
      },
      flushIntervalMs,
      { leading: true, trailing: true }
    )
  }

  async init() {
    const rows = await this.db('world_storage').select('key', 'value')
    for (const row of rows) {
      try {
        this.data.set(row.key, JSON.parse(row.value))
      } catch (err) {
        console.error(`error reading storage key: ${row.key}`)
        console.error(err)
      }
    }
  }

  normalizeKey(key) {
    return String(key)
  }

  get(key) {
    return this.data.get(this.normalizeKey(key))
  }

  parseRow(key, row) {
    if (!row) {
      return {
        key,
        exists: false,
        value: undefined,
        createdAt: null,
        updatedAt: null,
      }
    }

    let value
    try {
      value = JSON.parse(row.value)
    } catch (err) {
      console.error(`error reading storage key: ${row.key}`)
      console.error(err)
      value = undefined
    }

    return {
      key,
      exists: true,
      value,
      createdAt: normalizeTimestamp(row.createdAt),
      updatedAt: normalizeTimestamp(row.updatedAt),
    }
  }

  applyEntryToCache(entry) {
    const normalizedKey = this.normalizeKey(entry?.key)
    if (!entry?.exists) {
      this.data.delete(normalizedKey)
      this.dirty.delete(normalizedKey)
      this.deleted.delete(normalizedKey)
      return
    }

    this.data.set(normalizedKey, entry.value)
    this.dirty.delete(normalizedKey)
    this.deleted.delete(normalizedKey)
  }

  cloneEntry(entry) {
    return {
      key: entry.key,
      exists: !!entry.exists,
      value: cloneValue(entry.value),
      createdAt: entry.createdAt || null,
      updatedAt: entry.updatedAt || null,
    }
  }

  async getFreshEntry(key) {
    const normalizedKey = this.normalizeKey(key)
    const row = await this.db('world_storage')
      .select('key', 'value', 'createdAt', 'updatedAt')
      .where({ key: normalizedKey })
      .first()
    const entry = this.parseRow(normalizedKey, row)
    this.applyEntryToCache(entry)
    return this.cloneEntry(entry)
  }

  async getFresh(key) {
    const entry = await this.getFreshEntry(key)
    return entry.value
  }

  async getFreshEntriesByPrefix(prefix = '') {
    const normalizedPrefix = String(prefix ?? '')
    let query = this.db('world_storage').select('key', 'value', 'createdAt', 'updatedAt').orderBy('key', 'asc')

    if (normalizedPrefix) {
      query = query.where('key', 'like', `${normalizedPrefix}%`)
    }

    const rows = await query
    const entries = rows.map(row => this.parseRow(this.normalizeKey(row.key), row))
    for (const entry of entries) {
      this.applyEntryToCache(entry)
    }
    return entries.map(entry => this.cloneEntry(entry))
  }

  async listKeys(prefix = '') {
    const entries = await this.getFreshEntriesByPrefix(prefix)
    return entries.map(entry => entry.key)
  }

  set(key, value) {
    const normalizedKey = this.normalizeKey(key)
    try {
      value = JSON.parse(JSON.stringify(value))
      this.data.set(normalizedKey, value)
      this.deleted.delete(normalizedKey)
      this.dirty.add(normalizedKey)
      this.schedulePersist()
    } catch (err) {
      console.error(err)
    }
  }

  remove(key) {
    const normalizedKey = this.normalizeKey(key)
    if (!this.data.has(normalizedKey) && !this.deleted.has(normalizedKey)) return
    this.data.delete(normalizedKey)
    this.dirty.delete(normalizedKey)
    this.deleted.add(normalizedKey)
    this.schedulePersist()
  }

  async commit(operations = []) {
    if (!Array.isArray(operations)) {
      throw new Error('storage_commit_requires_array')
    }
    if (operations.length === 0) {
      return { ok: true, entries: [], conflicts: [] }
    }

    const normalizedOps = operations.map(operation => {
      if (!operation || typeof operation !== 'object') {
        throw new Error('storage_commit_invalid_operation')
      }

      const normalizedKey = this.normalizeKey(operation.key)
      if (!normalizedKey) {
        throw new Error('storage_commit_missing_key')
      }
      if (operation.value === undefined) {
        throw new Error(`storage_commit_undefined_value:${normalizedKey}`)
      }

      return {
        key: normalizedKey,
        value: cloneValue(operation.value),
        expectedUpdatedAt: Object.prototype.hasOwnProperty.call(operation, 'expectedUpdatedAt')
          ? normalizeTimestamp(operation.expectedUpdatedAt)
          : undefined,
      }
    })

    const duplicateKeys = normalizedOps
      .map(operation => operation.key)
      .filter((key, index, array) => array.indexOf(key) !== index)
    if (duplicateKeys.length > 0) {
      throw new Error(`storage_commit_duplicate_keys:${duplicateKeys.join(',')}`)
    }

    const keys = normalizedOps.map(operation => operation.key)

    const result = await this.db.transaction(async trx => {
      const rows = await trx('world_storage').select('key', 'value', 'createdAt', 'updatedAt').whereIn('key', keys)
      const rowsByKey = new Map(rows.map(row => [this.normalizeKey(row.key), row]))

      const conflicts = []
      for (const operation of normalizedOps) {
        if (operation.expectedUpdatedAt === undefined) continue

        const row = rowsByKey.get(operation.key)
        const currentUpdatedAt = normalizeTimestamp(row?.updatedAt)

        if (operation.expectedUpdatedAt === null) {
          if (row) {
            conflicts.push(this.parseRow(operation.key, row))
          }
          continue
        }

        if (!row || currentUpdatedAt !== operation.expectedUpdatedAt) {
          conflicts.push(this.parseRow(operation.key, row))
        }
      }

      if (conflicts.length > 0) {
        return {
          ok: false,
          conflicts,
          entries: [],
        }
      }

      // CAS tokens must change even when two commits land within one millisecond.
      const newest = Math.max(0, ...rows.map(row => Date.parse(row.updatedAt) || 0))
      const now = new Date(Math.max(Date.now(), newest + 1)).toISOString()
      const rowsToWrite = normalizedOps.map(operation => {
        const existingRow = rowsByKey.get(operation.key)
        return {
          key: operation.key,
          value: JSON.stringify(operation.value),
          createdAt: normalizeTimestamp(existingRow?.createdAt) || now,
          updatedAt: now,
        }
      })

      await trx('world_storage').insert(rowsToWrite).onConflict('key').merge(['value', 'updatedAt'])

      return {
        ok: true,
        conflicts: [],
        entries: rowsToWrite.map(row => ({
          key: row.key,
          exists: true,
          value: normalizedOps.find(operation => operation.key === row.key)?.value,
          createdAt: normalizeTimestamp(row.createdAt),
          updatedAt: normalizeTimestamp(row.updatedAt),
        })),
      }
    })

    if (result.ok) {
      for (const entry of result.entries) {
        this.applyEntryToCache(entry)
      }
      return {
        ok: true,
        conflicts: [],
        entries: result.entries.map(entry => this.cloneEntry(entry)),
      }
    }

    for (const conflict of result.conflicts) {
      this.applyEntryToCache(conflict)
    }
    return {
      ok: false,
      conflicts: result.conflicts.map(conflict => this.cloneEntry(conflict)),
      entries: [],
    }
  }

  async setFresh(key, value) {
    const result = await this.commit([{ key, value }])
    if (!result.ok) {
      throw new Error(`storage_set_fresh_failed:${this.normalizeKey(key)}`)
    }
    return result.entries[0]?.value
  }

  async persist() {
    if (this.activePersistPromise) {
      this.pendingPersist = true
      return this.activePersistPromise
    }
    this.activePersistPromise = this.runPersistLoop()
    try {
      await this.activePersistPromise
    } finally {
      this.activePersistPromise = null
    }
  }

  async runPersistLoop() {
    while (this.pendingPersist || this.dirty.size > 0 || this.deleted.size > 0) {
      this.pendingPersist = false
      const dirtyKeys = [...this.dirty]
      const deletedKeys = [...this.deleted]

      if (!dirtyKeys.length && !deletedKeys.length) break

      this.dirty.clear()
      this.deleted.clear()

      try {
        const now = new Date().toISOString()
        const rows = dirtyKeys.map(key => ({
          key,
          value: JSON.stringify(this.data.get(key)),
          createdAt: now,
          updatedAt: now,
        }))
        await this.db.transaction(async trx => {
          if (rows.length) {
            await trx('world_storage').insert(rows).onConflict('key').merge(['value', 'updatedAt'])
          }
          if (deletedKeys.length) {
            await trx('world_storage').whereIn('key', deletedKeys).delete()
          }
        })
      } catch (err) {
        for (const key of dirtyKeys) {
          if (!this.deleted.has(key)) {
            this.dirty.add(key)
          }
        }
        for (const key of deletedKeys) {
          if (!this.dirty.has(key)) {
            this.deleted.add(key)
          }
        }
        console.error(err)
        console.log('failed to persist storage')
        break
      }

      if (!this.pendingPersist && this.dirty.size === 0 && this.deleted.size === 0) {
        break
      }
    }
  }

  async close() {
    this.schedulePersist.cancel?.()
    await this.persist()
  }
}
