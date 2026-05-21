import fs from 'fs-extra'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFLoader } from '../../libs/gltfloader/GLTFLoader.js'
// import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from '../../systems/System.js'
import { glbToNodes } from '../../extras/glbToNodes.js'
import { createEmoteFactory } from '../../extras/createEmoteFactory.js'

/**
 * Server Loader System
 *
 * - Runs on the server
 * - Basic file loader for many different formats, cached.
 *
 */
export class ServerLoader extends System {
  constructor(world) {
    super(world)
    this.promises = new Map()
    this.results = new Map()
    this.handlers = new Map()
    this.rgbeLoader = new RGBELoader()
    this.gltfLoader = new GLTFLoader()
    this.preloadItems = []
    // this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))

    // mock globals to allow gltf loader to work in nodejs
    globalThis.self = { URL }
    globalThis.window = {}
    globalThis.document = {
      createElementNS: () => ({ style: {} }),
    }
  }

  start() {
    // ...
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
    const promises = this.preloadItems.map(item => this.load(item.type, item.url))
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
    })
  }

  async fetchArrayBuffer(url) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://')
    if (isRemote) {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      return arrayBuffer
    } else {
      const buffer = await fs.readFile(url)
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      return arrayBuffer
    }
  }

  async fetchText(url) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://')
    if (isRemote) {
      const response = await fetch(url)
      const text = await response.text()
      return text
    } else {
      const text = await fs.readFile(url, { encoding: 'utf8' })
      return text
    }
  }

  load(type, url) {
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

  destroy() {
    this.promises.clear()
    this.results.clear()
    this.handlers.clear()
    this.preloadItems = []
  }
}

async function parseServerGltf(loader, url) {
  const resolvedUrl = loader.world.resolveURL(url, true)
  const arrayBuffer = await loader.fetchArrayBuffer(resolvedUrl)
  return new Promise((resolve, reject) => {
    loader.gltfLoader.parse(arrayBuffer, '', resolve, reject)
  })
}

async function loadServerModel(loader, url) {
  const glb = await parseServerGltf(loader, url)
  const node = glbToNodes(glb, loader.world)
  return {
    toNodes() {
      return node.clone(true)
    },
  }
}

async function loadServerEmote(loader, url) {
  const resolvedUrl = loader.world.resolveURL(url, true)
  const glb = await parseServerGltf(loader, url)
  const factory = createEmoteFactory(glb, resolvedUrl)
  return {
    toClip(options) {
      return factory.toClip(options)
    },
  }
}

function loadServerAvatar(loader) {
  // The server does not need to parse VRM data; it only needs a compatible node tree.
  let node
  return {
    toNodes: () => {
      if (!node) {
        node = loader.world.createNode('group')
        const node2 = loader.world.createNode('avatar', { id: 'avatar', factory: null })
        node.add(node2)
      }
      return node.clone(true)
    },
  }
}

async function loadServerScript(loader, url) {
  const resolvedUrl = loader.world.resolveURL(url, true)
  const code = await loader.fetchText(resolvedUrl)
  return loader.world.scripts.evaluate(code)
}

function loadServerAudio() {
  return Promise.reject(null)
}

export const serverLoaderHandlers = Object.freeze({
  model: loadServerModel,
  emote: loadServerEmote,
  avatar: loadServerAvatar,
  script: loadServerScript,
  audio: loadServerAudio,
})
