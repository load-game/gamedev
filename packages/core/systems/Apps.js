import moment from 'moment'
import { isArray, isFunction } from 'lodash-es'
import * as THREE from '../extras/three.js'

import { System } from './System.js'
import { getRef } from '../nodes/Node.js'
import { ControlPriorities } from '../extras/ControlPriorities.js'
import { warn } from '../extras/warn.js'

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
    const world = this.world
    this.worldGetters = {}
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
          return warn(`apps cannot emit internal events (${name})`)
        }
        warn('world.emit() is deprecated, use app.emit() instead')
        world.events.emit(name, data)
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
      emit(entity, name, data) {
        if (internalEvents.includes(name)) {
          return warn(`apps cannot emit internal events (${name})`)
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

  assertScriptApiSlotAvailable(scope, key, source) {
    const registry = this.scriptApiSources[scope]
    const previousSource = registry.get(key)
    if (previousSource && previousSource !== source) {
      throw new Error(`script_api_collision:${scope}.${key}:${previousSource}:${source}`)
    }
  }

  claimScriptApiSlot(scope, key, source) {
    this.assertScriptApiSlotAvailable(scope, key, source)
    const registry = this.scriptApiSources[scope]
    registry.set(key, source)
  }

  assertScriptApiScopeAvailable(scope, api, source) {
    if (!api) return
    this.getScriptApiTargets(scope)
    for (const key in api) {
      this.assertScriptApiSlotAvailable(scope, key, source)
    }
  }

  assertScriptApiAvailable({ world, app, player }, source = 'unknown') {
    this.assertScriptApiScopeAvailable('world', world, source)
    this.assertScriptApiScopeAvailable('app', app, source)
    this.assertScriptApiScopeAvailable('player', player, source)
  }

  exposeScriptApiScope(scope, api, source) {
    if (!api) return
    const targets = this.getScriptApiTargets(scope)
    for (const key in api) {
      const value = api[key]
      const isFn = typeof value === 'function'
      if (isFn) {
        this.claimScriptApiSlot(scope, key, source)
        targets.methods[key] = value
        continue
      }
      if (!value || typeof value !== 'object') {
        throw new Error(`script_api_invalid_descriptor:${scope}.${key}:${source}`)
      }
      const hasGet = Object.prototype.hasOwnProperty.call(value, 'get')
      const hasSet = Object.prototype.hasOwnProperty.call(value, 'set')
      if (hasGet) {
        if (typeof value.get !== 'function') {
          throw new Error(`script_api_invalid_descriptor:${scope}.${key}:${source}`)
        }
      }
      if (hasSet) {
        if (typeof value.set !== 'function') {
          throw new Error(`script_api_invalid_descriptor:${scope}.${key}:${source}`)
        }
      }
      if (!hasGet && !hasSet) {
        throw new Error(`script_api_invalid_descriptor:${scope}.${key}:${source}`)
      }
      this.claimScriptApiSlot(scope, key, source)
      if (hasGet) {
        targets.getters[key] = value.get
      }
      if (hasSet) {
        targets.setters[key] = value.set
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
