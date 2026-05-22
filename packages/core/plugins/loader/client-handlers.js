import * as THREE from '../../extras/three.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { TextureLoader } from 'three'
import Hls from 'hls.js/dist/hls.js'

import { definePlugin } from '../../plugins.js'
import { createVRMFactory } from './createVRMFactory.js'
import { glbToNodes } from './glbToNodes.js'
import { createEmoteFactory } from './createEmoteFactory.js'

let sparkRenderer = null

function getRgbeLoader(loader) {
  if (!loader.rgbeLoader) loader.rgbeLoader = new RGBELoader()
  return loader.rgbeLoader
}

function getTextureLoader(loader) {
  if (!loader.texLoader) loader.texLoader = new TextureLoader()
  return loader.texLoader
}

function getGltfLoader(loader) {
  if (!loader.gltfLoader) {
    loader.gltfLoader = new GLTFLoader()
    loader.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
  }
  return loader.gltfLoader
}

async function ensureSparkRenderer(loader) {
  if (sparkRenderer) return sparkRenderer
  if (!loader.world.camera || !loader.world.graphics?.renderer) return null
  const { SparkRenderer } = await import('@sparkjsdev/spark')
  sparkRenderer = new SparkRenderer({
    renderer: loader.world.graphics.renderer,
  })
  loader.world.camera.add(sparkRenderer)
  return sparkRenderer
}

async function createSplatMesh(loader, fileBytes) {
  await ensureSparkRenderer(loader)
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

function getVrmHooks(loader) {
  if (!loader.vrmHooks) {
    loader.vrmHooks = {
      camera: loader.world.camera,
      scene: loader.world.stage.scene,
      octree: loader.world.stage.octree,
      setupMaterial: material => loader.world.setupMaterial?.(material),
      loader: loader.world.loader,
    }
  }
  return loader.vrmHooks
}

async function loadClientHdr(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  const result = getRgbeLoader(loader).parse(buffer)
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
      const texture = getTextureLoader(loader).load(img.src)
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
  const glb = await getGltfLoader(loader).parseAsync(buffer)
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
  const glb = await getGltfLoader(loader).parseAsync(buffer)
  const factory = createEmoteFactory(glb)
  return {
    toClip(options) {
      return factory.toClip(options)
    },
  }
}

async function loadClientAvatar(loader, url) {
  const file = await loader.loadFile(url)
  const buffer = await file.arrayBuffer()
  const glb = await getGltfLoader(loader).parseAsync(buffer)
  const factory = createVRMFactory(glb, material => loader.world.setupMaterial?.(material))
  const hooks = getVrmHooks(loader)
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
  const splatMesh = await createSplatMesh(loader, fileBytes)
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

export const loaderClientHandlersPlugin = definePlugin({
  name: '@gamedev/plugin-loader-handlers/client',
  requires: ['loader', 'client', 'nodes', 'stage', 'view'],
  loaders: clientLoaderHandlers,
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
