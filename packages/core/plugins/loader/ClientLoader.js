import { System } from '../../systems/System.js'

/**
 * Client Loader System
 *
 * - Runs on the client
 * - Basic file loader for many different formats, cached.
 *
 */
export class ClientLoader extends System {
  constructor(world) {
    super(world)
    this.files = new Map()
    this.promises = new Map()
    this.results = new Map()
    this.handlers = new Map()
    this.preloadItems = []
  }

  register(type, load, options = {}) {
    if (this.handlers.has(type)) {
      throw new Error(`loader_type_collision:${type}`)
    }
    this.handlers.set(type, {
      load,
      plugin: options.plugin || null,
    })
  }

  has(type, url) {
    const key = `${type}/${url}`
    return this.promises.has(key)
  }

  get(type, url) {
    const key = `${type}/${url}`
    return this.results.get(key)
  }

  preload(type, url) {
    this.preloadItems.push({ type, url })
  }

  execPreload() {
    let loadedItems = 0
    let totalItems = this.preloadItems.length
    let progress = 0
    const promises = this.preloadItems.map(item => {
      return this.load(item.type, item.url).then(() => {
        loadedItems++
        progress = (loadedItems / totalItems) * 100
        this.world.emit('progress', progress)
      })
    })
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
      // this.world.emit('ready', true)
    })
  }

  setFile(url, file) {
    this.files.set(url, file)
  }

  hasFile(url) {
    url = this.world.resolveURL(url)
    return this.files.has(url)
  }

  getFile(url, name) {
    const remoteUrl = this.world.resolveURL(url)
    const file = this.files.get(remoteUrl) ?? this.files.get(url)
    if (!file) return null
    if (this.files.has(url) && this.files.has(remoteUrl)) this.files.delete(url) // delete `file://` entry
    return name
      ? new File([file], name, {
          type: file.type, // Preserve the MIME type
          lastModified: file.lastModified, // Preserve the last modified timestamp
        })
      : file
  }

  loadFile = async url => {
    const rawUrl = url
    if (this.files.has(rawUrl)) {
      return this.files.get(rawUrl)
    }
    url = this.world.resolveURL(rawUrl)
    if (this.files.has(url)) {
      return this.files.get(url)
    }
    const resp = await fetch(url)
    const blob = await resp.blob()
    const file = new File([blob], url.split('/').pop(), { type: blob.type })
    this.files.set(url, file)
    return file
  }

  async load(type, url) {
    if (this.preloader) {
      await this.preloader
    }
    const key = `${type}/${url}`
    if (this.promises.has(key)) {
      return this.promises.get(key)
    }
    const handler = this.handlers.get(type)
    if (!handler) {
      throw new Error(`loader_type_missing:${type}`)
    }
    const promise = Promise.resolve(handler.load(this, url, { type, key })).then(result => {
      this.results.set(key, result)
      return result
    })
    this.promises.set(key, promise)
    return promise
  }

  insert(type, url, file) {
    this.files.set(url, file)
    return this.load(type, url)
  }

  destroy() {
    this.files.clear()
    this.promises.clear()
    this.results.clear()
    this.handlers.clear()
    this.preloadItems = []
  }
}
