import { createPlayerContext } from '../extras/playerContext.js'
import moment from 'moment'
import { isArray, isFunction, isNumber } from 'lodash-es'
import * as THREE from '../extras/three.js'

import { System } from './System.js'
import { getRef } from '../nodes/Node.js'
import { Layers } from '../extras/Layers.js'
import { ControlPriorities } from '../extras/ControlPriorities.js'
import { warn } from '../extras/warn.js'
import { createFurnishingAPI } from '../extras/furnishing.js'

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
  }

  initWorldHooks() {
    const self = this
    const world = this.world
    const allowLoaders = ['avatar', 'model', 'splat']
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
      companions(entity) {
        if (!world.network.isClient) throw new Error('client_only')
        return {
          list: () => structuredClone(world.companions.agents),
          request: (action, params) => world.companions.request(action, params),
        }
      },
      clearAgentLandmarks(entity) {
        if (!world.network.isClient) return
        for (const id of world.companions.landmarks.keys())
          if (id.startsWith(`${entity.data.id}:`)) world.companions.landmarks.delete(id)
      },
      agentLandmark(entity, item) {
        if (
          !world.network.isClient ||
          !item ||
          typeof item.id !== 'string' ||
          typeof item.label !== 'string' ||
          !Array.isArray(item.position) ||
          item.position.length !== 3 ||
          !item.position.every(Number.isFinite)
        )
          return
        const id = `${entity.data.id}:${item.id}`
        world.companions.landmarks.set(id, {
          id,
          label: item.label.slice(0, 160),
          description: String(item.description || '').slice(0, 600),
          position: [...item.position],
          approach:
            Array.isArray(item.approach) && item.approach.length === 3 && item.approach.every(Number.isFinite)
              ? [...item.approach]
              : null,
        })
        if (!entity.hasAgentLandmarkCleanup) {
          entity.hasAgentLandmarkCleanup = true
          entity.on('destroy', () => {
            for (const key of world.companions.landmarks.keys())
              if (key.startsWith(`${entity.data.id}:`)) world.companions.landmarks.delete(key)
          })
        }
      },
      playerContext(entity, options) {
        return createPlayerContext(entity, options)
      },
      furnishing(entity) {
        return createFurnishingAPI(entity)
      },
      walletAuth(entity) {
        if (!world.network.isServer) throw new Error('server_only')
        return world.network.walletBindings.forApp(entity)
      },
      friends(entity, auth) {
        if (!world.network.isServer) throw new Error('server_only')
        const service = world.network.friendsForApp(entity, auth)
        return Object.fromEntries(
          ['request', 'act', 'list', 'status', 'sync', 'join'].map(name => [name, service[name].bind(service)])
        )
      },
      joinFriend(entity, token) {
        if (!world.network.isClient) throw new Error('client_only')
        return world.network.joinFriend(token)
      },
      getBrowserPreferences(entity) {
        if (!world.network.isClient) return null
        return {
          colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        }
      },
      getPreference(entity, key) {
        if (!world.network.isClient || typeof key !== 'string') return null
        try {
          return JSON.parse(localStorage.getItem(`app:${entity.data.blueprint}:${key}`))
        } catch {
          return null
        }
      },
      setPreference(entity, key, value) {
        if (!world.network.isClient || typeof key !== 'string') return
        const serialized = JSON.stringify(value)
        if (typeof serialized !== 'string' || serialized.length > 4096)
          throw new Error('Preference exceeds 4096 characters')
        localStorage.setItem(`app:${entity.data.blueprint}:${key}`, serialized)
      },
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
      chat(entity, msg, broadcast) {
        if (!msg) return
        world.chat.add(msg, broadcast)
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
      load(entity, type, url) {
        return new Promise(async (resolve, reject) => {
          const hook = entity.getDeadHook()
          try {
            if (!allowLoaders.includes(type)) {
              return reject(new Error(`cannot load type: ${type}`))
            }
            let glb = world.loader.get(type, url)
            if (!glb) glb = await world.loader.load(type, url)
            if (hook.dead) return
            const root = glb.toNodes()
            resolve(type === 'avatar' ? root.children[0] : root)
          } catch (err) {
            if (hook.dead) return
            reject(err)
          }
        })
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

  inject({ world, app, player }) {
    if (world) {
      for (const key in world) {
        const value = world[key]
        const isFunction = typeof value === 'function'
        if (isFunction) {
          this.worldMethods[key] = value
          continue
        }
        if (value.get) {
          this.worldGetters[key] = value.get
        }
        if (value.set) {
          this.worldSetters[key] = value.set
        }
      }
    }
    if (app) {
      for (const key in app) {
        const value = app[key]
        const isFunction = typeof value === 'function'
        if (isFunction) {
          this.appMethods[key] = value
          continue
        }
        if (value.get) {
          this.appGetters[key] = value.get
        }
        if (value.set) {
          this.appSetters[key] = value.set
        }
      }
    }
    if (player) {
      for (const key in player) {
        const value = player[key]
        const isFunction = typeof value === 'function'
        if (isFunction) {
          this.playerMethods[key] = value
          continue
        }
        if (value.get) {
          this.playerGetters[key] = value.get
        }
        if (value.set) {
          this.playerSetters[key] = value.set
        }
      }
    }
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
