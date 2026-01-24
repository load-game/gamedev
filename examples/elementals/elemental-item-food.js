const HEAL_AMOUNT = 40
const EAT_DURATION = 1

const _template = app.get('Food')

createItem(({ player, hooks }) => {
  let model
  let control
  let emote
  let usedAt
  return {
    client: {
      init() {
        model = _template.clone(true)
        control = player.local ? app.control() : null
        emote = props.emote?.url
        world.add(model)
      },
      update(delta) {
        if (control && control.mouseLeft.pressed && control.pointer.locked && !player.hasEffect()) {
          hooks.call('useBegin')
          player.applyEffect({
            snare: 0.9,
            duration: EAT_DURATION,
            emote,
            onEnd: () => {
              hooks.call('useEnd')
            },
          })
        }
      },
      lateUpdate(delta) {
        const matrix = player.getBoneTransform('leftHand')
        if (matrix) {
          model.position.setFromMatrixPosition(matrix)
          model.quaternion.setFromRotationMatrix(matrix)
        }
      },
      destroy() {
        world.remove(model)
        control?.release()
      },
    },
    server: {
      init() {
        // ...
      },
      useBegin() {
        usedAt = world.getTime()
      },
      useEnd() {
        if (!usedAt) return
        const elapsed = world.getTime() - usedAt
        if (elapsed > EAT_DURATION - 0.3) {
          const amount = Math.min(player.health, HEAL_AMOUNT)
          player.heal(amount)
          hooks.take(1)
        }
        usedAt = null
      },
      fixedUpdate(delta) {
        // ...
      },
      update(delta) {
        // ...
      },
      lateUpdate(delta) {
        // ...
      },
    },
  }
})

// ====================================================
// INTERNALS
// ====================================================

function createItem(createInstance) {
  app.configure([
    {
      key: 'id',
      type: 'text',
      label: 'ID',
      initial: 'item1',
    },
    {
      key: 'icon',
      type: 'file',
      kind: 'texture',
      label: 'Icon',
    },
    {
      key: 'name',
      type: 'text',
      label: 'Name',
      initial: '',
    },
    {
      key: 'desc',
      type: 'textarea',
      label: 'Desc',
      initial: '',
    },
    {
      key: 'stack',
      type: 'number',
      label: 'Stack',
      initial: 1,
    },
    {
      key: 'emote',
      type: 'file',
      kind: 'emote',
      label: 'Emote',
    },
    {
      key: 'droppable',
      type: 'switch',
      label: 'Droppable',
      options: [
        { label: 'No', value: false },
        { label: 'Yes', value: true },
      ],
      initial: false,
    },
    {
      key: 'give',
      type: 'button',
      label: 'Give',
      onClick: () => {
        const player = world.getPlayer()
        app.send('give', player.id)
      },
    },
  ])

  const id = props.id
  const icon = props.icon?.url || null
  const name = props.name || null
  const desc = props.desc || null
  const stack = props.stack || 1
  const droppable = props.droppable

  // each item must have an id
  if (!id) return console.error(`item does not have an id`)
  // and the id must be unique in the world
  let unique = true
  world.on(`elemental-item:check:${id}`, instanceId => {
    if (app.instanceId === instanceId) return
    app.emit(`elemental-item:check:${id}:reply`)
  })
  world.on(`elemental-item:check:${id}:reply`, () => {
    unique = false
  })
  app.emit(`elemental-item:check:${id}`, app.instanceId)
  if (!unique) return console.error(`item with id '${id}' exists more than once in the world`)

  if (world.isServer) {
    const state = app.state
    state.active = new Set()
    state.ready = true
    const instances = new Map() // playerId -> instance
    app.send('init', state)
    app.on('give', playerId => {
      app.emit('elemental-item:give', [playerId, id, 1])
    })
    world.on(`elemental-shop:request-spec:${id}`, () => {
      app.emit('elemental-item:spec', { id, icon, name, desc, stack })
    })
    world.on('elemental-core:request-specs', () => {
      app.emit('elemental-item:spec', { id, icon, name, desc, stack })
    })
    world.on(`elemental-shop:purchase:${id}`, playerId => {
      app.emit('elemental-item:give', [playerId, id, 1])
    })
    world.on(`elemental-core:activate:${id}`, playerId => {
      if (state.active.has(playerId)) {
        return console.warn(`${id} activate: already active`)
      }
      const player = world.getPlayer(playerId)
      if (!player) {
        return console.warn(`${id} activate: player not found`)
      }
      state.active.add(playerId)
      const instance = createInstance({
        player,
        hooks: {
          call(method, data) {
            app.send('call', [playerId, method, data])
          },
          take(qty) {
            app.emit('elemental-item:take', [playerId, id, qty])
          },
          damage(player, amount, crit) {
            player.damage(amount)
            app.send('dmg', [player.id, amount, crit])
          },
        },
      })
      instances.set(playerId, instance)
      instance.server?.init?.()
      app.send('activate', playerId)
    })
    world.on(`elemental-core:deactivate:${id}`, playerId => {
      if (!state.active.has(playerId)) {
        return console.warn(`${id} deactivate: player not active`)
      }
      state.active.delete(playerId)
      instances.get(playerId).server.destroy?.()
      instances.delete(playerId)
      app.send('deactivate', playerId)
    })
    world.on(`elemental-core:drop:${id}`, playerId => {
      if (!droppable) return
      if (!state.active.has(playerId)) {
        return console.warn(`${id} drop: player not active`)
      }
      // todo: instance control this?
      app.emit('elemental-item:take', [playerId, id, 1])
      // todo: optionally spawn on ground?
    })
    app.on('call', ([method, data], playerId) => {
      const instance = instances.get(playerId)
      if (!instance) return console.error('[item] error 1')
      instance.server?.[method]?.(data)
    })
    world.on('leave', e => {
      if (!state.active.has(e.playerId)) return
      state.active.delete(e.playerId)
      instances.get(playerId).server.destroy?.()
      instances.delete(playerId)
      app.send('deactivate', e.playerId)
    })
    app.on('fixedUpdate', delta => {
      instances.forEach(instance => {
        instance.server?.fixedUpdate?.(delta)
      })
    })
    app.on('update', delta => {
      instances.forEach(instance => {
        instance.server?.update?.(delta)
      })
    })
    app.on('lateUpdate', delta => {
      instances.forEach(instance => {
        instance.server?.lateUpdate?.(delta)
      })
    })
    // broadcast item existence and metadata
    // for elemental gear, shops, chests etc
    app.emit('elemental-item:spec', { id, icon, name, desc, stack })
  }

  if (world.isClient) {
    const localPlayer = world.getPlayer()

    let state = app.state
    if (state.ready) {
      init(state)
    } else {
      app.on('init', init)
    }
    function init(_state) {
      state = _state
      const instances = new Map()
      function activate(playerId) {
        const player = world.getPlayer(playerId)
        const instance = createInstance({
          player,
          hooks: {
            call(method, data) {
              app.send('call', [method, data])
            },
            take(qty) {
              console.error('[item] hooks.take() not available on the client')
            },
            damage(player, amount, crit) {
              console.error('[item] hooks.damage() not available on the client')
            },
          },
        })
        instances.set(playerId, instance)
        instance.client?.init?.()
      }
      for (const playerId of state.active) {
        activate(playerId)
      }
      app.on('activate', playerId => {
        activate(playerId)
      })
      app.on('call', ([playerId, method, data]) => {
        const instance = instances.get(playerId)
        if (!instance) return console.error('[item] error 1')
        instance.client?.[method]?.(data)
      })
      app.on('deactivate', playerId => {
        const instance = instances.get(playerId)
        instance.client?.destroy?.()
        instances.delete(playerId)
      })
      app.on('fixedUpdate', delta => {
        instances.forEach(instance => {
          instance.client?.fixedUpdate?.(delta)
        })
      })
      app.on('update', delta => {
        instances.forEach(instance => {
          instance.client?.update?.(delta)
        })
      })
      app.on('lateUpdate', delta => {
        instances.forEach(instance => {
          instance.client?.lateUpdate?.(delta)
        })
      })
      app.on('dmg', data => {
        app.emit('elemental-item:dmg', data)
      })
    }
  }
}
