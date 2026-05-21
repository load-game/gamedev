import * as THREE from './extras/three.js'
import EventEmitter from 'eventemitter3'
import { installWorldExtension } from './plugins.js'
import { warn } from './extras/warn.js'

export class World extends EventEmitter {
  constructor(options = {}) {
    super()

    this.maxDeltaTime = 1 / 30 // 0.33333
    this.fixedDeltaTime = 1 / 50 // 0.01666
    this.frame = 0
    this.time = 0
    this.accumulator = 0
    this.systems = []
    this.networkRate = 1 / 8 // 8Hz
    this.assetsUrl = null
    this.assetsDir = null
    this.hot = new Set()
    this.plugins = []
    this.pluginCapabilities = new Set()
    this.pendingScriptApi = []
    this.nodeTypes = new Map()
    this.entityTypes = new Map()

    this.rig = new THREE.Object3D()
    // NOTE: camera near is slightly smaller than spherecast. far is slightly more than skybox.
    // this gives us minimal z-fighting without needing logarithmic depth buffers
    this.camera = new THREE.PerspectiveCamera(70, 0, 0.2, 1200)
    this.rig.add(this.camera)

    if (options.plugins) {
      this.install(options.plugins)
    }
  }

  install(extension) {
    installWorldExtension(this, extension)
    return this
  }

  register(key, System, options = {}) {
    if (this[key]) {
      throw new Error(`world_system_collision:${key}`)
    }
    const system = new System(this)
    system.plugin = options.plugin || null
    this.systems.push(system)
    this[key] = system
    if (key === 'apps') {
      this.flushPendingScriptApi()
    }
    return system
  }

  registerNode(key, Node, options = {}) {
    if (this.nodeTypes.has(key)) {
      throw new Error(`world_node_collision:${key}`)
    }
    this.nodeTypes.set(key, { Node, plugin: options.plugin || null })
  }

  registerEntity(key, definition, options = {}) {
    if (this.entityTypes.has(key)) {
      throw new Error(`world_entity_collision:${key}`)
    }
    this.entityTypes.set(key, {
      Entity: definition.Entity || null,
      create: definition.create || null,
      plugin: options.plugin || null,
    })
  }

  createEntity(data, local) {
    const type = data?.type
    const entry = this.entityTypes.get(type)
    if (!entry) {
      throw new Error(`world_entity_missing:${type}`)
    }
    if (entry.create) {
      return entry.create(this, data, local)
    }
    return new entry.Entity(this, data, local)
  }

  createNode(name, data) {
    const entry = this.nodeTypes.get(name)
    if (!entry) {
      throw new Error(`world_node_missing:${name}`)
    }
    return new entry.Node(data)
  }

  exposeScripts(api, source = 'world') {
    if (!api) return
    if (this.apps?.exposeScriptApi) {
      this.apps.exposeScriptApi(api, source)
    } else {
      this.pendingScriptApi.push({ api, source })
    }
  }

  flushPendingScriptApi() {
    if (!this.apps?.exposeScriptApi || !this.pendingScriptApi.length) return
    const pending = this.pendingScriptApi.splice(0)
    for (const entry of pending) {
      this.apps.exposeScriptApi(entry.api, entry.source)
    }
  }

  async init(options) {
    this.storage = options.storage
    this.assetsDir = options.assetsDir
    this.assetsUrl = options.assetsUrl
    for (const system of this.systems) {
      await system.init(options)
    }
    this.start()
  }

  start() {
    for (const system of this.systems) {
      system.start()
    }
  }

  tick = time => {
    // begin any stats/performance monitors
    this.preTick()
    // update time, delta, frame and accumulator
    time /= 1000
    let delta = time - this.time
    if (delta < 0) delta = 0
    if (delta > this.maxDeltaTime) {
      delta = this.maxDeltaTime
    }
    this.frame++
    this.time = time
    this.accumulator += delta
    // prepare physics
    const willFixedStep = this.accumulator >= this.fixedDeltaTime
    this.preFixedUpdate(willFixedStep)
    // run as many fixed updates as we can for this ticks delta
    while (this.accumulator >= this.fixedDeltaTime) {
      // run all fixed updates
      this.fixedUpdate(this.fixedDeltaTime)
      // step physics
      this.postFixedUpdate(this.fixedDeltaTime)
      // decrement accumulator
      this.accumulator -= this.fixedDeltaTime
    }
    // interpolate physics for remaining delta time
    const alpha = this.accumulator / this.fixedDeltaTime
    this.preUpdate(alpha)
    // run all updates
    this.update(delta, alpha)
    // run post updates, eg cleaning all node matrices
    this.postUpdate(delta)
    // run all late updates
    this.lateUpdate(delta, alpha)
    // run post late updates, eg cleaning all node matrices
    this.postLateUpdate(delta)
    // commit all changes, eg render on the client
    this.commit()
    // end any stats/performance monitors
    this.postTick()
  }

  preTick() {
    for (const system of this.systems) {
      system.preTick()
    }
  }

  preFixedUpdate(willFixedStep) {
    for (const system of this.systems) {
      system.preFixedUpdate(willFixedStep)
    }
  }

  fixedUpdate(delta) {
    for (const item of this.hot) {
      item.fixedUpdate?.(delta)
    }
    for (const system of this.systems) {
      system.fixedUpdate(delta)
    }
  }

  postFixedUpdate(delta) {
    for (const system of this.systems) {
      system.postFixedUpdate(delta)
    }
  }

  preUpdate(alpha) {
    for (const system of this.systems) {
      system.preUpdate(alpha)
    }
  }

  update(delta) {
    for (const item of this.hot) {
      item.update?.(delta)
    }
    for (const system of this.systems) {
      system.update(delta)
    }
  }

  postUpdate(delta) {
    for (const system of this.systems) {
      system.postUpdate(delta)
    }
  }

  lateUpdate(delta) {
    for (const item of this.hot) {
      item.lateUpdate?.(delta)
    }
    for (const system of this.systems) {
      system.lateUpdate(delta)
    }
  }

  postLateUpdate(delta) {
    for (const item of this.hot) {
      item.postLateUpdate?.(delta)
    }
    for (const system of this.systems) {
      system.postLateUpdate(delta)
    }
  }

  commit() {
    for (const system of this.systems) {
      system.commit()
    }
  }

  postTick() {
    for (const system of this.systems) {
      system.postTick()
    }
  }

  setupMaterial = material => {
    this.environment?.csm?.setupMaterial(material)
  }

  setHot(item, hot) {
    if (hot) {
      this.hot.add(item)
    } else {
      this.hot.delete(item)
    }
  }

  resolveURL(url, allowLocal) {
    if (!url) return url
    url = url.trim()
    if (url.startsWith('blob')) {
      return url
    }
    if (url.startsWith('asset://')) {
      if (this.assetsDir && allowLocal) {
        return url.replace('asset:/', this.assetsDir)
      } else if (this.assetsUrl) {
        return url.replace('asset:/', this.assetsUrl)
      } else {
        warn('resolveURL: no assetsUrl or assetsDir defined')
        return url
      }
    }
    if (url.match(/^https?:\/\//i)) {
      return url
    }
    if (url.startsWith('//')) {
      return `https:${url}`
    }
    if (url.startsWith('/')) {
      return url
    }
    return `https://${url}`
  }

  inject(runtime) {
    this.exposeScripts(runtime, 'world.inject')
  }

  destroy() {
    for (const system of this.systems) {
      system.destroy()
    }
  }
}
