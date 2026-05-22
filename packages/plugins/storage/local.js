class MemoryStorage {
  constructor() {
    this.data = new Map()
  }

  get(key, defaultValue = null) {
    const value = this.data.get(key)
    if (value === undefined) return defaultValue
    return value ?? defaultValue
  }

  set(key, value) {
    if (value === undefined || value === null) {
      this.data.delete(key)
    } else {
      this.data.set(key, value)
    }
  }

  remove(key) {
    this.data.delete(key)
  }
}

class BrowserStorage {
  constructor(localStorageImpl = globalThis.localStorage) {
    this.localStorage = localStorageImpl
    this.fallback = null

    try {
      const key = '__gamedev_storage_probe__'
      this.localStorage.setItem(key, '1')
      this.localStorage.removeItem(key)
    } catch {
      this.localStorage = null
      this.fallback = new MemoryStorage()
    }
  }

  get(key, defaultValue = null) {
    if (this.fallback) return this.fallback.get(key, defaultValue)

    const data = this.localStorage.getItem(key)
    if (data === undefined || data === null) return defaultValue
    try {
      const value = JSON.parse(data)
      if (value === undefined) return defaultValue
      return value ?? defaultValue
    } catch {
      return defaultValue
    }
  }

  set(key, value) {
    if (this.fallback) {
      this.fallback.set(key, value)
      return
    }

    if (value === undefined || value === null) {
      this.localStorage.removeItem(key)
    } else {
      this.localStorage.setItem(key, JSON.stringify(value))
    }
  }

  remove(key) {
    if (this.fallback) {
      this.fallback.remove(key)
      return
    }

    this.localStorage.removeItem(key)
  }
}

const hasBrowserLocalStorage = typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined'

const storage = hasBrowserLocalStorage ? new BrowserStorage() : new MemoryStorage()

export { BrowserStorage, MemoryStorage, storage }
