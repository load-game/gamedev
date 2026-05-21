import { definePlugin } from '../plugins.js'

export const storageScriptApi = {
  world: {
    get(entity, key) {
      return entity.world.storage?.get(key)
    },
    async getFresh(entity, key) {
      const { storage } = entity.world
      if (typeof storage?.getFresh !== 'function') {
        return storage?.get(key)
      }
      return storage.getFresh(key)
    },
    async getFreshEntry(entity, key) {
      const { storage } = entity.world
      if (typeof storage?.getFreshEntry !== 'function') {
        return {
          key: String(key),
          exists: storage?.get(key) !== undefined,
          value: storage?.get(key),
          createdAt: null,
          updatedAt: null,
        }
      }
      return storage.getFreshEntry(key)
    },
    async getFreshEntriesByPrefix(entity, prefix = '') {
      const { storage } = entity.world
      if (typeof storage?.getFreshEntriesByPrefix !== 'function') {
        return []
      }
      return storage.getFreshEntriesByPrefix(prefix)
    },
    async listStorageKeys(entity, prefix = '') {
      const { storage } = entity.world
      if (typeof storage?.listKeys !== 'function') {
        return []
      }
      return storage.listKeys(prefix)
    },
    set(entity, key, value) {
      entity.world.storage?.set(key, value)
    },
    async setFresh(entity, key, value) {
      const { storage } = entity.world
      if (typeof storage?.setFresh !== 'function') {
        storage?.set(key, value)
        return value
      }
      return storage.setFresh(key, value)
    },
    async commitStorage(entity, operations) {
      const { storage } = entity.world
      if (typeof storage?.commit !== 'function') {
        throw new Error('storage_commit_unavailable')
      }
      return storage.commit(operations)
    },
  },
}

export const storagePlugin = definePlugin({
  name: '@gamedev/plugin-storage',
  requires: ['core', 'apps'],
  provides: ['storage'],
  scripts: storageScriptApi,
})
