import moment from 'moment'
import { isArray, isFunction, isNumber } from 'lodash-es'
import * as THREE from '../extras/three.js'

import { System } from './System.js'
import { getRef } from '../nodes/Node.js'
import { Layers } from '../extras/Layers.js'
import { ControlPriorities } from '../extras/ControlPriorities.js'
import { warn } from '../extras/warn.js'

const isBrowser = typeof window !== 'undefined'

const internalEvents = [
  'fixedUpdate',
  'updated',
  'lateUpdate',
  'destroy',
  'enter',
  'leave',
  'chat',
  'command',
  'health',
]

async function copyTextToClipboard(value) {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!text) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy clipboard path
    }
  }

  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copied
    } catch {
      return false
    }
  }

  return false
}

function resolveClipboardImageUrl(world, value) {
  if (typeof value === 'string' && value.trim()) {
    const url = value.trim()
    if (/^(data:|blob:|https?:\/\/|\/\/|\/)/i.test(url)) {
      return url
    }
    return world.resolveURL(url)
  }
  if (value && typeof value === 'object' && typeof value.url === 'string' && value.url.trim()) {
    const url = value.url.trim()
    if (/^(data:|blob:|https?:\/\/|\/\/|\/)/i.test(url)) {
      return url
    }
    return world.resolveURL(url)
  }
  return null
}

async function rasterizeClipboardImage(blob) {
  if (!blob || !blob.type?.startsWith('image/')) return null
  if (typeof document === 'undefined') return blob

  let url = null
  try {
    url = URL.createObjectURL(blob)
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = reject
      nextImage.src = url
    })

    const width = Math.max(1, Math.round(image.naturalWidth || image.width || 0))
    const height = Math.max(1, Math.round(image.naturalHeight || image.height || 0))
    if (!width || !height) {
      return blob
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      return blob
    }
    context.drawImage(image, 0, 0, width, height)

    const pngBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png')
    })
    return pngBlob || blob
  } catch {
    return blob
  } finally {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }
}

async function createClipboardImageItem(world, value) {
  const url = resolveClipboardImageUrl(world, value)
  if (!url || typeof fetch !== 'function' || typeof ClipboardItem === 'undefined') return null

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const clipboardBlob = await rasterizeClipboardImage(blob)
    const mimeType = clipboardBlob?.type || blob?.type || 'image/png'
    if (!mimeType.startsWith('image/')) return null
    return new ClipboardItem({
      [mimeType]: clipboardBlob || blob,
    })
  } catch {
    return null
  }
}

async function copyImageToClipboard(world, value) {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
    return false
  }

  const item = await createClipboardImageItem(world, value)
  if (!item) return false

  try {
    await navigator.clipboard.write([item])
    return true
  } catch {
    return false
  }
}

async function copyToClipboard(world, value, options = {}) {
  const kind = String(options?.kind || options?.type || '')
    .trim()
    .toLowerCase()
  const inferredImage =
    !kind &&
    ((typeof value === 'string' && /^data:image\//i.test(value.trim())) ||
      (value && typeof value === 'object' && typeof value.url === 'string' && value.url.trim()))

  if (kind === 'image' || inferredImage) {
    return copyImageToClipboard(world, value)
  }
  return copyTextToClipboard(value)
}

/**
 * Apps System
 *
 * - Runs on both the server and client.
 * - A single place to manage app runtime methods used by all apps
 *
 */
export class Apps extends System {
  constructor(world) {
    super(world)
    this.initWorldHooks()
    this.initAppHooks()
    this.playerGetters = {}
    this.playerSetters = {}
    this.playerMethods = {}
    this.scriptApiSources = {
      world: new Map(),
      app: new Map(),
      player: new Map(),
    }
    this.recordScriptApiScope('world', 'core')
    this.recordScriptApiScope('app', 'core')
  }

  initWorldHooks() {
    const self = this
    const world = this.world
    this.worldGetters = {
      networkId(entity) {
        return world.network.id
      },
      isServer(entity) {
        return world.network.isServer
      },
      isClient(entity) {
        return world.network.isClient
      },
    }
    this.worldSetters = {
      // ...
    }
    this.worldMethods = {
      add(entity, pNode) {
        const node = getRef(pNode)
        if (!node) return
        if (node.parent) {
          node.parent.remove(node)
        }
        entity.worldNodes.add(node)
        node.activate({ world, entity })
      },
      remove(entity, pNode) {
        const node = getRef(pNode)
        if (!node) return
        if (node.parent) return // its not in world
        if (!entity.worldNodes.has(node)) return
        entity.worldNodes.delete(node)
        node.deactivate()
      },
      attach(entity, pNode) {
        const node = getRef(pNode)
        if (!node) return
        const parent = node.parent
        if (!parent) return
        const finalMatrix = new THREE.Matrix4()
        finalMatrix.copy(node.matrix)
        let currentParent = node.parent
        while (currentParent) {
          finalMatrix.premultiply(currentParent.matrix)
          currentParent = currentParent.parent
        }
        parent.remove(node)
        finalMatrix.decompose(node.position, node.quaternion, node.scale)
        node.activate({ world, entity })
        entity.worldNodes.add(node)
      },
      on(entity, name, callback) {
        entity.onWorldEvent(name, callback)
      },
      off(entity, name, callback) {
        entity.offWorldEvent(name, callback)
      },
      emit(entity, name, data) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot emit internal events (${name})`)
        }
        warn('world.emit() is deprecated, use app.emit() instead')
        world.events.emit(name, data)
      },
      getTime(entity) {
        return world.network.getTime()
      },
      getTimestamp(entity, format) {
        if (!format) return moment().toISOString()
        return moment().format(format)
      },
      getPlayer(entity, playerId) {
        return entity.getPlayerProxy(playerId)
      },
      getPlayers(entity) {
        // tip: probably dont wanna call this every frame
        const players = []
        world.entities.players.forEach(player => {
          players.push(entity.getPlayerProxy(player.data.id))
        })
        return players
      },
      createLayerMask(entity, ...groups) {
        let mask = 0
        for (const group of groups) {
          if (!Layers[group]) throw new Error(`[createLayerMask] invalid group: ${group}`)
          mask |= Layers[group].group
        }
        return mask
      },
      raycast(entity, origin, direction, maxDistance, layerMask, opts) {
        if (!origin?.isVector3) throw new Error('[raycast] origin must be Vector3')
        if (!direction?.isVector3) throw new Error('[raycast] direction must be Vector3')
        if (maxDistance !== undefined && maxDistance !== null && !isNumber(maxDistance)) {
          throw new Error('[raycast] maxDistance must be number')
        }
        if (layerMask !== undefined && layerMask !== null && !isNumber(layerMask)) {
          throw new Error('[raycast] layerMask must be number')
        }
        const ignorePlayerId = opts?.ignoreLocalPlayer ? world.network.id : opts?.ignorePlayerId
        const hit = world.physics.raycast(origin, direction, maxDistance, layerMask, ignorePlayerId)
        if (!hit) return null
        if (!self.raycastHit) {
          self.raycastHit = {
            point: new THREE.Vector3(),
            normal: new THREE.Vector3(),
            distance: 0,
            tag: null,
            playerId: null,
            bone: null,
          }
        }
        self.raycastHit.point.copy(hit.point)
        self.raycastHit.normal.copy(hit.normal)
        self.raycastHit.distance = hit.distance
        self.raycastHit.tag = hit.handle?.tag
        self.raycastHit.playerId = hit.handle?.playerId
        self.raycastHit.bone = hit.handle?.bone || null
        return self.raycastHit
      },
      overlapSphere(entity, radius, origin, layerMask) {
        const hits = world.physics.overlapSphere(radius, origin, layerMask)
        return hits.map(hit => {
          return hit.proxy
        })
      },
      get(entity, key) {
        return world.storage?.get(key)
      },
      async getFresh(entity, key) {
        if (typeof world.storage?.getFresh !== 'function') {
          return world.storage?.get(key)
        }
        return world.storage.getFresh(key)
      },
      async getFreshEntry(entity, key) {
        if (typeof world.storage?.getFreshEntry !== 'function') {
          return {
            key: String(key),
            exists: world.storage?.get(key) !== undefined,
            value: world.storage?.get(key),
            createdAt: null,
            updatedAt: null,
          }
        }
        return world.storage.getFreshEntry(key)
      },
      async getFreshEntriesByPrefix(entity, prefix = '') {
        if (typeof world.storage?.getFreshEntriesByPrefix !== 'function') {
          return []
        }
        return world.storage.getFreshEntriesByPrefix(prefix)
      },
      async listStorageKeys(entity, prefix = '') {
        if (typeof world.storage?.listKeys !== 'function') {
          return []
        }
        return world.storage.listKeys(prefix)
      },
      set(entity, key, value) {
        world.storage?.set(key, value)
      },
      async setFresh(entity, key, value) {
        if (typeof world.storage?.setFresh !== 'function') {
          world.storage?.set(key, value)
          return value
        }
        return world.storage.setFresh(key, value)
      },
      async commitStorage(entity, operations) {
        if (typeof world.storage?.commit !== 'function') {
          throw new Error('storage_commit_unavailable')
        }
        return world.storage.commit(operations)
      },
      open(entity, url, newWindow = false) {
        if (!url) {
          console.error('[world.open] URL is required')
          return
        }

        if (world.network.isClient) {
          try {
            const resolvedUrl = world.resolveURL(url)

            setTimeout(() => {
              if (newWindow) {
                window.open(resolvedUrl, '_blank')
              } else {
                window.location.href = resolvedUrl
              }
            }, 0)

            console.log(`[world.open] Redirecting to: ${resolvedUrl} ${newWindow ? '(new window)' : ''}`)
          } catch (e) {
            console.error('[world.open] Failed to open URL:', e)
          }
        } else {
          console.warn('[world.open] URL redirection only works on client side')
        }
      },
      async copy(entity, value, options = {}) {
        if (!world.network.isClient) {
          console.warn('[world.copy] Clipboard access only works on client side')
          return false
        }
        return copyToClipboard(world, value, options)
      },
      getQueryParam(entity, key) {
        if (!isBrowser) {
          console.error('getQueryParam() must be called in the browser')
          return null
        }
        const urlParams = new URLSearchParams(window.location.search)
        return urlParams.get(key)
      },
      setReticle(entity, options) {
        if (!world.ui) return
        world.ui.setReticle(options)
      },
      setQueryParam(entity, key, value) {
        if (!isBrowser) {
          console.error('getQueryParam() must be called in the browser')
          return null
        }
        const urlParams = new URLSearchParams(window.location.search)
        if (value) {
          urlParams.set(key, value)
        } else {
          urlParams.delete(key)
        }
        const newUrl = window.location.pathname + '?' + urlParams.toString()
        window.history.replaceState({}, '', newUrl)
      },
    }
  }

  initAppHooks() {
    const world = this.world
    this.appGetters = {
      instanceId(entity) {
        return entity.data.id
      },
      version(entity) {
        return entity.blueprint.version
      },
      modelUrl(entity) {
        return entity.blueprint.model
      },
      state(entity) {
        return entity.data.state
      },
      props(entity) {
        return entity.getEffectiveProps()
      },
      config(entity) {
        // deprecated. will be removed
        return entity.getEffectiveProps()
      },
      resetOnMove(entity) {
        return entity.resetOnMove
      },
      isMoving(entity) {
        return entity.mode === 'moving'
      },
    }
    this.appSetters = {
      state(entity, value) {
        entity.data.state = value
      },
      resetOnMove(entity, value) {
        entity.resetOnMove = value
      },
    }
    this.appMethods = {
      on(entity, name, callback) {
        entity.on(name, callback)
      },
      off(entity, name, callback) {
        entity.off(name, callback)
      },
      send(entity, name, data, ignoreSocketId) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot send internal events (${name})`)
        }
        // NOTE: on the client ignoreSocketId is a no-op because it can only send events to the server
        const event = [entity.data.id, entity.blueprint.version, name, data]
        world.network.send('entityEvent', event, ignoreSocketId)
      },
      sendTo(entity, playerId, name, data) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot send internal events (${name})`)
        }
        if (!world.network.isServer) {
          throw new Error('sendTo can only be called on the server')
        }
        const player = world.entities.get(playerId)
        if (!player) return
        const event = [entity.data.id, entity.blueprint.version, name, data]
        world.network.sendTo(playerId, 'entityEvent', event)
      },
      emit(entity, name, data) {
        if (internalEvents.includes(name)) {
          return console.error(`apps cannot emit internal events (${name})`)
        }
        world.events.emit(name, data)
      },
      create(entity, name, data) {
        const node = entity.createNode(name, data)
        return node.getProxy()
      },
      control(entity, options) {
        entity.control?.release()
        // TODO: only allow on user interaction
        // TODO: show UI with a button to release()
        entity.control = world.controls.bind({
          ...options,
          priority: ControlPriorities.APP,
          object: entity,
        })
        return entity.control
      },
      configure(entity, fnOrArray) {
        if (isArray(fnOrArray)) {
          entity.fields = fnOrArray
        } else if (isFunction(fnOrArray)) {
          entity.fields = fnOrArray() // deprecated
        }
        if (!isArray(entity.fields)) {
          entity.fields = []
        }
        let props = entity.blueprint.props
        if (!props || typeof props !== 'object' || isArray(props)) {
          props = {}
          entity.blueprint.props = props
        }
        for (const field of entity.fields) {
          // apply file shortcuts
          fileRemaps[field.type]?.(field)
          // apply any initial values
          if (field.initial !== undefined && props[field.key] === undefined) {
            props[field.key] = field.initial
          }
        }
        entity.onFields?.(entity.fields)
      },
    }
  }

  recordScriptApiScope(scope, source) {
    const registry = this.scriptApiSources?.[scope]
    if (!registry) return
    const targets = this.getScriptApiTargets(scope)
    for (const key of Object.keys(targets.getters)) registry.set(key, source)
    for (const key of Object.keys(targets.setters)) registry.set(key, source)
    for (const key of Object.keys(targets.methods)) registry.set(key, source)
  }

  getScriptApiTargets(scope) {
    if (scope === 'world') {
      return {
        getters: this.worldGetters,
        setters: this.worldSetters,
        methods: this.worldMethods,
      }
    }
    if (scope === 'app') {
      return {
        getters: this.appGetters,
        setters: this.appSetters,
        methods: this.appMethods,
      }
    }
    if (scope === 'player') {
      return {
        getters: this.playerGetters,
        setters: this.playerSetters,
        methods: this.playerMethods,
      }
    }
    throw new Error(`script_api_invalid_scope:${scope}`)
  }

  assertScriptApiSlot(scope, key, source) {
    const registry = this.scriptApiSources[scope]
    const previousSource = registry.get(key)
    if (previousSource && previousSource !== source) {
      throw new Error(`script_api_collision:${scope}.${key}:${previousSource}:${source}`)
    }
    registry.set(key, source)
  }

  exposeScriptApiScope(scope, api, source) {
    if (!api) return
    const targets = this.getScriptApiTargets(scope)
    for (const key in api) {
      const value = api[key]
      const isFn = typeof value === 'function'
      this.assertScriptApiSlot(scope, key, source)
      if (isFn) {
        targets.methods[key] = value
        continue
      }
      if (!value || typeof value !== 'object') {
        throw new Error(`script_api_invalid_descriptor:${scope}.${key}:${source}`)
      }
      if (value.get) {
        targets.getters[key] = value.get
      }
      if (value.set) {
        targets.setters[key] = value.set
      }
      if (!value.get && !value.set) {
        throw new Error(`script_api_invalid_descriptor:${scope}.${key}:${source}`)
      }
    }
  }

  exposeScriptApi({ world, app, player }, source = 'unknown') {
    this.exposeScriptApiScope('world', world, source)
    this.exposeScriptApiScope('app', app, source)
    this.exposeScriptApiScope('player', player, source)
  }

  inject(api) {
    this.exposeScriptApi(api, 'world.inject')
  }
}

export const fileRemaps = {
  avatar: field => {
    field.type = 'file'
    field.kind = 'avatar'
  },
  emote: field => {
    field.type = 'file'
    field.kind = 'emote'
  },
  model: field => {
    field.type = 'file'
    field.kind = 'model'
  },
  texture: field => {
    field.type = 'file'
    field.kind = 'texture'
  },
  image: field => {
    field.type = 'file'
    field.kind = 'image'
  },
  video: field => {
    field.type = 'file'
    field.kind = 'video'
  },
  hdr: field => {
    field.type = 'file'
    field.kind = 'hdr'
  },
  audio: field => {
    field.type = 'file'
    field.kind = 'audio'
  },
  splat: field => {
    field.type = 'file'
    field.kind = 'splat'
  },
}
