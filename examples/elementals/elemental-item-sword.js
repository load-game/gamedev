const forward = new Vector3(0, 0, -1)
const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const q1 = new Quaternion()
const q2 = new Quaternion()
const e1 = new Euler(0, 0, 0, 'YXZ')
const e2 = new Euler(0, 0, 0, 'YXZ')
const arr1 = []
const arr2 = []

const MIN_DMG = 20
const MAX_DMG = 30
const CRIT_CHANCE = 0.3
const CRIT_MULTIPLIER = 2
const HIT_RADIUS = 0.5
const HIT_DISTANCE = 1

const initialSword = app.get('Sword')
initialSword.type = 'kinematic'
const initialCollider = app.get('Sword_Collider')
initialCollider.trigger = true
initialCollider.layer = 'tool'

const sphere = app.get('Sphere')
sphere.parent.remove(sphere)
sphere.scale.setScalar(HIT_RADIUS)

const src = initialSword.clone(true)
// Don't use layer mask so we can hit both players and mobs
// const overlapLayerMask = world.createLayerMask('player')

createItem(({ player, hooks }) => {
  let model
  let control
  const attacks = []
  if (props.attack1) attacks.push(props.attack1.url)
  if (props.attack2) attacks.push(props.attack2.url)
  const getAttack = () => {
    const i = num(0, attacks.length - 1)
    return attacks[i]
  }
  return {
    // #region CLIENT
    client: {
      init() {
        model = src.clone(true)
        control = player.local ? app.control() : null
        world.add(model)
      },
      update(delta) {
        if (control && control.mouseLeft.pressed && control.pointer.locked && !player.hasEffect()) {
          player.applyEffect({
            snare: 0.9,
            duration: 0.4,
            emote: getAttack(),
            turn: true,
          })
          e1.setFromQuaternion(control.camera.quaternion)
          e1.x = 0
          e1.z = 0
          q1.setFromEuler(e1)
          const dir = v1.copy(forward).applyQuaternion(q1)
          const projection = v2.copy(dir).multiplyScalar(HIT_DISTANCE)
          const pos = v3.copy(player.position).add(projection)
          pos.y += 1
          pos.toArray(arr1)
          dir.toArray(arr2)
          // if (debug) {
          //   sphere.position.copy(pos)
          //   world.add(sphere)
          // }
          hooks.call('attack', {
            pos: arr1,
            dir: arr2,
          })
        }
      },
      lateUpdate(delta) {
        const matrix = player.getBoneTransform('rightHand')
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
    // #endregion
    // #region SERVER
    server: {
      attack(data) {
        console.log('[sword] ========== ATTACK START ==========')
        try {
          const { pos, dir } = data
          const origin = v1.fromArray(pos)
          const radius = HIT_RADIUS
          // Don't use layer mask to hit both players and mobs
          const hits = world.overlapSphere(radius, origin)
          console.log('[sword] Server attack - hits found:', hits.length)
          for (const hit of hits) {
            console.log('[sword] Hit details:', {
              playerId: hit.playerId,
              tag: hit.tag,
              entityId: hit.entityId,
              hasTag: !!hit.tag,
              tagValue: hit.tag
            })
            if (hit.playerId && hit.playerId !== player.id) {
              const playerB = world.getPlayer(hit.playerId)
              if (!playerB) {
                console.warn('[sword] Player not found:', hit.playerId)
                continue
              }
              if (!playerB.health) {
                console.warn('[sword] Player has no health property:', hit.playerId)
                continue
              }
              let amount = num(MIN_DMG, MAX_DMG)
              let crit = false
              if (playerB.health > amount) {
                crit = num(0, 1, 1) < CRIT_CHANCE
                if (crit) amount *= CRIT_MULTIPLIER
              }
              if (amount > playerB.health) amount = playerB.health
              console.log('[sword] Damaging player', playerB.id, 'health before:', playerB.health, 'damage:', amount)
              hooks.damage(playerB, amount, crit)
              console.log('[sword] Player health after damage:', playerB.health)
              //player.push(v1.fromArray(dir).multiplyScalar(3))
            } else if (hit.tag?.startsWith('elemental-mob:')) {
              const mobInstanceId = hit.tag.split(':')[1]
              console.log(`[sword] Attacking elemental mob with tag: ${hit.tag}, instanceId: ${mobInstanceId}`)
              let amount = num(MIN_DMG, MAX_DMG)
              const crit = num(0, 1, 1) < CRIT_CHANCE
              if (crit) amount *= CRIT_MULTIPLIER
              // Use elemental mob damage system - send instanceId (not full tag)
              app.emit('elemental-mob:hit', [mobInstanceId, player.id, amount, crit])
              console.log(`[sword] Emitted elemental-mob:hit event for instanceId: ${mobInstanceId} (via app.emit)`)
            } else {
              console.log('[sword] Hit unknown object - no playerId or mob tag:', hit)
            }
          }
          console.log('[sword] ========== ATTACK END ==========')
        } catch (error) {
          console.error('[sword] ERROR in server.attack():', error)
          console.error('[sword] Error stack:', error.stack)
        }
      },
    },
    // #endregion
  }
})

// #region INTERNALS
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
            // Emit health event for elemental-combat to handle death/respawn
            app.emit('health', { playerId: player.id, health: player.health })
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
// #endregion
