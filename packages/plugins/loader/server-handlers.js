// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFLoader } from '../../core/libs/gltfloader/GLTFLoader.js'
// import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { definePlugin } from '../../core/plugins.js'
import { glbToNodes } from './glbToNodes.js'
import { createEmoteFactory } from './createEmoteFactory.js'

function getGltfLoader(loader) {
  if (!loader.gltfLoader) {
    loader.gltfLoader = new GLTFLoader()
    // loader.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
  }
  return loader.gltfLoader
}

async function parseServerGltf(loader, url) {
  const resolvedUrl = loader.world.resolveURL(url, true)
  const arrayBuffer = await loader.fetchArrayBuffer(resolvedUrl)
  return new Promise((resolve, reject) => {
    getGltfLoader(loader).parse(arrayBuffer, '', resolve, reject)
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
  const glb = await parseServerGltf(loader, url)
  const factory = createEmoteFactory(glb)
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

export const loaderServerHandlersPlugin = definePlugin({
  name: '@gamedev/plugin-loader-handlers/server',
  requires: ['loader', 'nodes'],
  loaders: serverLoaderHandlers,
})
