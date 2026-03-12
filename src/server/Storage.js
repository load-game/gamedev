import { throttle } from 'lodash-es'

export class Storage {
  constructor(db, { flushIntervalMs = 1000 } = {}) {
    this.db = db
    this.data = new Map()
    this.dirty = new Set()
    this.deleted = new Set()
    this.pendingPersist = false
    this.activePersistPromise = null
    this.schedulePersist = throttle(() => {
      void this.persist()
    }, flushIntervalMs, { leading: true, trailing: true })
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
    while (true) {
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
