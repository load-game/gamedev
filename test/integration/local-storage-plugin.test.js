import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'

import { BrowserStorage, MemoryStorage } from 'gamedev/plugins/storage/local'

test('plugin local storage provides an in-memory fallback', () => {
  const storage = new MemoryStorage()

  assert.equal(storage.get('missing', 'fallback'), 'fallback')
  storage.set('prefs', { volume: 0.5 })
  assert.deepEqual(storage.get('prefs'), { volume: 0.5 })
  storage.remove('prefs')
  assert.equal(storage.get('prefs', null), null)
})

test('plugin browser storage falls back when localStorage is unavailable', () => {
  const failingLocalStorage = {
    setItem() {
      throw new Error('denied')
    },
    removeItem() {},
  }
  const storage = new BrowserStorage(failingLocalStorage)

  storage.set('authToken', 'token')
  assert.equal(storage.get('authToken'), 'token')
  storage.set('authToken', null)
  assert.equal(storage.get('authToken', 'missing'), 'missing')
})

test('plugin browser storage serializes values through localStorage', () => {
  const data = new Map()
  const localStorage = {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
  }
  const storage = new BrowserStorage(localStorage)

  storage.set('prefs', { theme: 'dark' })
  assert.deepEqual(storage.get('prefs'), { theme: 'dark' })
  assert.equal(data.get('prefs'), '{"theme":"dark"}')
  storage.remove('prefs')
  assert.equal(storage.get('prefs', 'missing'), 'missing')
})
