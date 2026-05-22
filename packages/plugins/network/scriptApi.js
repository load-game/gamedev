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

function rejectInternalAppEvent(entity, name) {
  entity.world.logs?.add('script', 'error', [`apps cannot send internal events (${name})`])
}

export const networkScriptApi = {
  world: {
    networkId: {
      get: entity => entity.world.network.id,
    },
    isServer: {
      get: entity => !!entity.world.network.isServer,
    },
    isClient: {
      get: entity => !!entity.world.network.isClient,
    },
    getTime(entity) {
      return entity.world.network.getTime()
    },
  },
  app: {
    send(entity, name, data, ignoreSocketId) {
      if (internalEvents.includes(name)) {
        return rejectInternalAppEvent(entity, name)
      }
      const event = [entity.data.id, entity.blueprint.version, name, data]
      entity.world.network.send('entityEvent', event, ignoreSocketId)
    },
    sendTo(entity, playerId, name, data) {
      if (internalEvents.includes(name)) {
        return rejectInternalAppEvent(entity, name)
      }
      if (!entity.world.network.isServer) {
        throw new Error('sendTo can only be called on the server')
      }
      const player = entity.world.entities.get(playerId)
      if (!player) return
      const event = [entity.data.id, entity.blueprint.version, name, data]
      entity.world.network.sendTo(playerId, 'entityEvent', event)
    },
  },
}
