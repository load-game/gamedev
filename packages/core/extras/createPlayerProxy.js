import * as THREE from './three.js'

export function createPlayerProxy(entity, player) {
  const world = player.world
  const position = new THREE.Vector3()
  const rotation = new THREE.Euler()
  const quaternion = new THREE.Quaternion()

  // Create the base proxy with default properties and methods
  const baseProxy = {
    get networkId() {
      return player.data.owner
    },
    get id() {
      return player.data.id
    },
    get userId() {
      return player.data.userId
    },
    get local() {
      return player.data.id === world.network.id
    },
    get admin() {
      return player.isAdmin()
    },
    get builder() {
      return player.isBuilder()
    },
    get isAdmin() {
      return player.isAdmin() // deprecated, use .admin
    },
    get name() {
      return player.data.name
    },
    get health() {
      return player.data.health
    },
    get position() {
      return position.copy(player.base.position)
    },
    get rotation() {
      return rotation.copy(player.base.rotation)
    },
    get quaternion() {
      return quaternion.copy(player.base.quaternion)
    },
    get height() {
      return player.avatar?.getHeight()
    },
    get headToHeight() {
      return player.avatar?.getHeadToHeight()
    },
    get destroyed() {
      return !!player.destroyed
    },
    $cleanup() {
      for (const entry of world.apps?.playerProxyCleanups || []) {
        entry.cleanup(entity, player, baseProxy)
      }
    },
  }

  // Create a dynamic proxy that can access both the base properties and injected ones
  return new Proxy(baseProxy, {
    get: (target, prop) => {
      // First check base proxy properties
      if (prop in target) {
        return target[prop]
      }

      // Check injected getters
      if (world.apps.playerGetters && prop in world.apps.playerGetters) {
        return world.apps.playerGetters[prop](player)
      }

      // Check injected methods
      if (world.apps.playerMethods && prop in world.apps.playerMethods) {
        const method = world.apps.playerMethods[prop]
        return (...args) => {
          return method.call(entity, player, ...args)
        }
      }

      return undefined
    },
    set: (target, prop, value) => {
      // Check injected setters
      if (world.apps.playerSetters && prop in world.apps.playerSetters) {
        world.apps.playerSetters[prop](player, value)
        return true
      }

      // Allow setting properties on the base proxy
      target[prop] = value
      return true
    },
  })
}
