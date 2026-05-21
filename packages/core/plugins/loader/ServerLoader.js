import fs from 'fs-extra'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFLoader } from '../../libs/gltfloader/GLTFLoader.js'
// import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from '../../systems/System.js'
import { glbToNodes } from '../../extras/glbToNodes.js'
import { createNode } from '../../extras/createNode.js'
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
    url = this.world.resolveURL(url, true)

    let promise
    if (type === 'hdr') {
      // promise = this.rgbeLoader.loadAsync(url).then(texture => {
      //   return texture
      // })
    }
    if (type === 'image') {
      // ...
    }
    if (type === 'texture') {
      // ...
    }
    if (type === 'model') {
      promise = this.fetchArrayBuffer(url).then(arrayBuffer => {
        return new Promise((resolve, reject) => {
          this.gltfLoader.parse(
            arrayBuffer,
            '',
            glb => {
              const node = glbToNodes(glb, this.world)
              const model = {
                toNodes() {
                  return node.clone(true)
                },
              }
              this.results.set(key, model)
              resolve(model)
            },
            reject
          )
        })
      })
    }
    if (type === 'emote') {
      promise = this.fetchArrayBuffer(url).then(arrayBuffer => {
        return new Promise((resolve, reject) => {
          this.gltfLoader.parse(
            arrayBuffer,
            '',
            glb => {
              const factory = createEmoteFactory(glb, url)
              const emote = {
                toClip(options) {
                  return factory.toClip(options)
                },
              }
              this.results.set(key, emote)
              resolve(emote)
            },
            reject
          )
        })
      })
    }
    if (type === 'avatar') {
      // NOTE: we can't load vrms on the server yet but we don't need 'em anyway.
      let node
      const glb = {
        toNodes: () => {
          if (!node) {
            node = createNode('group')
            const node2 = createNode('avatar', { id: 'avatar', factory: null })
            node.add(node2)
          }
          return node.clone(true)
        },
      }
      this.results.set(key, glb)
      promise = Promise.resolve(glb)
    }
    if (type === 'script') {
      promise = this.fetchText(url).then(code => {
        return new Promise(resolve => {
          const script = this.world.scripts.evaluate(code)
          this.results.set(key, script)
          resolve(script)
        })
      })
    }
    if (type === 'audio') {
      promise = Promise.reject(null)
    }
    this.promises.set(key, promise)
    return promise
  }

  destroy() {
    this.promises.clear()
    this.results.clear()
    this.preloadItems = []
  }
}
