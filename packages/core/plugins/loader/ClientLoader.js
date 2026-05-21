import * as THREE from '../../extras/three.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from '../../systems/System.js'
import { createVRMFactory } from '../../extras/createVRMFactory.js'
import { glbToNodes } from '../../extras/glbToNodes.js'
import { createEmoteFactory } from '../../extras/createEmoteFactory.js'
import { TextureLoader } from 'three'
import Hls from 'hls.js/dist/hls.js'

// THREE.Cache.enabled = true

/**
 * Client Loader System
 *
 * - Runs on the client
 * - Basic file loader for many different formats, cached.
 *
 */
let sparkRenderer = null

export class ClientLoader extends System {
  constructor(world) {
    super(world)
    this.files = new Map()
    this.promises = new Map()
    this.results = new Map()
    this.handlers = new Map()
    this.rgbeLoader = new RGBELoader()
    this.texLoader = new TextureLoader()
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
    this.preloadItems = []
  }

  async ensureSparkRenderer() {
    if (sparkRenderer) return sparkRenderer
    if (!this.world.camera || !this.world.graphics?.renderer) return null
    const { SparkRenderer } = await import('@sparkjsdev/spark')
    sparkRenderer = new SparkRenderer({
      renderer: this.world.graphics.renderer,
    })
    this.world.camera.add(sparkRenderer)
    return sparkRenderer
  }

  async createSplatMesh(fileBytes) {
    await this.ensureSparkRenderer()
    const { SplatMesh } = await import('@sparkjsdev/spark')
    const blob = new Blob([fileBytes], { type: 'application/octet-stream' })
    const blobUrl = URL.createObjectURL(blob)
    return new Promise((resolve, reject) => {
      try {
        const splatMesh = new SplatMesh({
          url: blobUrl,
          fileType: 'spz',
          onLoad: mesh => {
            URL.revokeObjectURL(blobUrl)
            resolve(mesh)
          },
        })
        setTimeout(() => {
          if (!splatMesh.isInitialized) {
            URL.revokeObjectURL(blobUrl)
            resolve(splatMesh)
          }
        }, 30000)
      } catch (error) {
        URL.revokeObjectURL(blobUrl)
        reject(error)
      }
    })
  }

  start() {
    this.vrmHooks = {
      camera: this.world.camera,
      scene: this.world.stage.scene,
      octree: this.world.stage.octree,
      setupMaterial: this.world.setupMaterial,
      loader: this.world.loader,
    }
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

async function loadClientHdr(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  const result = loader.rgbeLoader.parse(buffer)
  // Mimic the texture setup that RGBELoader.load() performs internally.
  const texture = new THREE.DataTexture(result.data, result.width, result.height)
  texture.colorSpace = THREE.LinearSRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.flipY = true
  texture.type = result.type
  texture.needsUpdate = true
  return texture
}

async function loadClientImage(loader, url) {
  const file = await loader.loadFile(url)
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      resolve(img)
    }
    img.src = URL.createObjectURL(file)
  })
}

async function loadClientTexture(loader, url) {
  const file = await loader.loadFile(url)
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const texture = loader.texLoader.load(img.src)
      texture.colorSpace = THREE.SRGBColorSpace
      resolve(texture)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

async function loadClientModel(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  const glb = await loader.gltfLoader.parseAsync(buffer)
  const node = glbToNodes(glb, loader.world)
  return {
    toNodes() {
      return node.clone(true)
    },
    getStats() {
      const stats = node.getStats(true)
      stats.fileBytes = file.size
      return stats
    },
  }
}

async function loadClientEmote(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  const glb = await loader.gltfLoader.parseAsync(buffer)
  const factory = createEmoteFactory(glb, url)
  return {
    toClip(options) {
      return factory.toClip(options)
    },
  }
}

async function loadClientAvatar(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  const glb = await loader.gltfLoader.parseAsync(buffer)
  const factory = createVRMFactory(glb, loader.world.setupMaterial)
  const hooks = loader.vrmHooks
  const node = loader.world.createNode('group', { id: '$root' })
  const node2 = loader.world.createNode('avatar', { id: 'avatar', factory, hooks })
  node.add(node2)
  return {
    factory,
    hooks,
    toNodes(customHooks) {
      const clone = node.clone(true)
      if (customHooks) {
        clone.get('avatar').hooks = customHooks
      }
      return clone
    },
    getStats() {
      const stats = node.getStats(true)
      stats.fileBytes = file.size
      return stats
    },
  }
}

async function loadClientScript(loader, url) {
  const file = await loader.loadFile(url)
  const code = await file.text()
  return loader.world.scripts.evaluate(code)
}

async function loadClientAudio(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  return loader.world.audio.ctx.decodeAudioData(buffer)
}

async function loadClientSplat(loader, url) {
  const file = await loader.loadFile(url)
  const fileBytes = await file.arrayBuffer()
  const splatMesh = await loader.createSplatMesh(fileBytes)
  const node = loader.world.createNode('group', { id: '$root' })
  const splatNode = loader.world.createNode('splat', { id: 'splat', mesh: splatMesh })
  node.add(splatNode)
  return {
    toNodes() {
      return node.clone(true)
    },
    getStats() {
      return {
        fileBytes: file.size,
      }
    },
  }
}

function loadClientVideo(loader, url) {
  const file = loader.getFile(url)
  const videoUrl = file ? URL.createObjectURL(file) : loader.world.resolveURL(url)
  return createVideoFactory(loader.world, videoUrl)
}

export const clientLoaderHandlers = Object.freeze({
  hdr: loadClientHdr,
  image: loadClientImage,
  texture: loadClientTexture,
  video: loadClientVideo,
  model: loadClientModel,
  emote: loadClientEmote,
  avatar: loadClientAvatar,
  script: loadClientScript,
  audio: loadClientAudio,
  splat: loadClientSplat,
})

function createVideoFactory(world, url) {
  const isHLS = url?.endsWith('.m3u8')
  const sources = {}
  let width
  let height
  let duration
  let ready = false
  let prepare
  function createSource(key) {
    const elem = document.createElement('video')
    elem.crossOrigin = 'anonymous'
    elem.playsInline = true
    elem.loop = false
    elem.muted = true
    elem.style.width = '1px'
    elem.style.height = '1px'
    elem.style.position = 'absolute'
    elem.style.opacity = '0'
    elem.style.zIndex = '-1000'
    elem.style.pointerEvents = 'none'
    elem.style.overflow = 'hidden'
    const needsPolyfill = isHLS && !elem.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()
    if (needsPolyfill) {
      const hls = new Hls()
      hls.loadSource(url)
      hls.attachMedia(elem)
    } else {
      elem.src = url
    }
    const audio = world.audio.ctx.createMediaElementSource(elem)
    let n = 0
    world.audio.ready(() => {
      elem.muted = false
    })
    // set linked=false to have a separate source (and texture)
    const texture = new THREE.VideoTexture(elem)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = world.graphics.maxAnisotropy
    if (!prepare) {
      prepare = (function () {
        /**
         *
         * A regular video will load data automatically BUT a stream
         * needs to hit play() before it gets that data.
         *
         * The following code handles this for us, and when streaming
         * will hit play just until we get the data needed, then pause.
         */
        return new Promise(resolve => {
          let playing = false
          let data = false
          elem.addEventListener(
            'loadeddata',
            async () => {
              // if we needed to hit play to fetch data then revert back to paused
              // console.log('[video] loadeddata', { playing })
              if (playing) elem.pause()
              data = true
              // await new Promise(resolve => setTimeout(resolve, 2000))
              width = elem.videoWidth
              height = elem.videoHeight
              duration = elem.duration
              ready = true
              resolve()
            },
            { once: true }
          )
          elem.addEventListener(
            'loadedmetadata',
            async () => {
              // we need a gesture before we can potentially hit play
              // console.log('[video] ready')
              // await this.engine.driver.gesture
              // if we already have data do nothing, we're done!
              // console.log('[video] gesture', { data })
              if (data) return
              // otherwise hit play to force data loading for streams
              elem.play()
              playing = true
            },
            { once: true }
          )
        })
      })()
    }
    function isPlaying() {
      return elem.currentTime > 0 && !elem.paused && !elem.ended && elem.readyState > 2
    }
    function play(restartIfPlaying = false) {
      if (restartIfPlaying) elem.currentTime = 0
      elem.play()
    }
    function pause() {
      elem.pause()
    }
    function stop() {
      elem.currentTime = 0
      elem.pause()
    }
    function release() {
      n--
      if (n === 0) {
        stop()
        audio.disconnect()
        texture.dispose()
        document.body.removeChild(elem)
        delete sources[key]
        // help to prevent chrome memory leaks
        // see: https://github.com/facebook/react/issues/15583#issuecomment-490912533
        elem.src = ''
        elem.load()
      }
    }
    const handle = {
      elem,
      audio,
      texture,
      prepare,
      get ready() {
        return ready
      },
      get width() {
        return width
      },
      get height() {
        return height
      },
      get duration() {
        return duration
      },
      get loop() {
        return elem.loop
      },
      set loop(value) {
        elem.loop = value
      },
      get isPlaying() {
        return isPlaying()
      },
      get currentTime() {
        return elem.currentTime
      },
      set currentTime(value) {
        elem.currentTime = value
      },
      play,
      pause,
      stop,
      release,
    }
    return {
      createHandle() {
        n++
        if (n === 1) {
          document.body.appendChild(elem)
        }
        return handle
      },
    }
  }
  return {
    get(key) {
      let source = sources[key]
      if (!source) {
        source = createSource(key)
        sources[key] = source
      }
      return source.createHandle()
    },
  }
}
