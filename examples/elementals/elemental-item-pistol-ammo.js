// Magazine Item for Combat Pistol (@elementals/)
// This is a holdable/equippable item that you carry in your hand

const v1 = new Vector3()

const _template = app.get('WAPClip') || app.get('Magazine') || app.get('Mag') || app.get('Clip')

createItem(({ player, hooks }) => {
  let model
  let control

  return {
    client: {
      init() {
        console.log('[magazine] Initializing magazine for player:', player.name)

        // Clone the magazine model with error handling
        if (_template) {
          try {
            model = _template.clone(true)
            console.log('[magazine] Successfully cloned template:', _template.id || 'unnamed')
          } catch (error) {
            console.warn('[magazine] Failed to clone template, falling back to app clone:', error.message)
            model = app.clone(true)
          }
        } else {
          console.warn('[magazine] No template found, cloning entire app')
          model = app.clone(true)
        }

        if (!model) {
          console.error('[magazine] CRITICAL: Could not create magazine instance!')
          return
        }

        // Add to world
        world.add(model)

        // Get control handle for local player
        control = player.local ? app.control() : null

        // Emit magazine equipped signal
        console.log('[magazine] Emitting magazine:equipped signal')
        app.emit('magazine:equipped', {
          playerId: player.id,
          magazineId: props.id || 'magazine',
        })

        // Listen for pistol ammo count updates
        app.on('pistol:ammo-count', data => {
          if (data.playerId === player.id) {
            console.log('[magazine] Pistol ammo count update:', data.ammo, '/', data.maxAmmo)
            // Play low ammo animation when ammo is running low
            if (data.ammo <= 3 && data.ammo > 0) {
              console.log('[magazine] Ammo low - playing indicator animation')
              this.playLowAmmoIndicator()
            } else if (data.ammo > 3) {
              // Stop low ammo indicator if ammo is replenished
              this.stopLowAmmoIndicator()
            }
          }
        })

        // Listen for pistol empty signal
        app.on('pistol:ammo-empty', data => {
          if (data.playerId === player.id) {
            console.log('[magazine] Pistol empty - reload animation triggered')
            // Play reload animation or effect
            this.playReloadAnimation()
          }
        })

        // Listen for pistol needing magazine
        app.on('pistol:need-magazine', data => {
          if (data.playerId === player.id) {
            console.log('[magazine] Pistol needs magazine - responding with ready signal')
            // Respond that we have a magazine ready
            app.emit('magazine:ready-response', {
              playerId: player.id,
              magazineId: props.id || 'magazine',
            })
          }
        })

        // Listen for when this magazine has been loaded into pistol
        app.on('pistol:loaded', data => {
          if (data.playerId === player.id) {
            console.log('[magazine] Magazine successfully loaded into pistol - dropping from inventory')

            // Play loading animation
            this.playLoadAnimation()

            // Auto-drop the magazine after it's been loaded
            setTimeout(() => {
              console.log('[magazine] Consuming magazine from inventory')
              hooks.take(1) // This will consume/consume the magazine item
            }, 500) // Small delay to show the animation
          }
        })

        console.log('[magazine] Magazine equipped')
      },

      update(delta) {
        // Magazines are just held - no special actions needed
        // Could add inspection or usage logic here if needed
      },

      lateUpdate(delta) {
        if (!model) return

        // Anchor to player's left hand
        const handMatrix = player.getBoneTransform('leftHand')
        if (handMatrix) {
          model.position.setFromMatrixPosition(handMatrix)
          model.quaternion.setFromRotationMatrix(handMatrix)

          // Apply scale from props
          const scale = props.scale || 1
          model.scale.setScalar(scale)
        } else {
          // Fallback: position at player's left side
          model.position.copy(player.position)
          model.position.x -= 0.3 // Left side
          model.position.y += 1.3 // Hand height
          model.quaternion.copy(player.quaternion)
        }
      },

      // Animation methods for magazine states
      playReloadAnimation() {
        if (!model) return
        console.log('[magazine] Playing reload animation')

        // Simple visual feedback - scale pulse
        const originalScale = model.scale.x
        model.scale.setScalar(originalScale * 1.2)

        // Reset scale after short duration
        setTimeout(() => {
          if (model) {
            model.scale.setScalar(originalScale)
          }
        }, 200)
      },

      playLowAmmoIndicator() {
        if (!model) return
        console.log('[magazine] Playing low ammo indicator')

        // Gentle pulsing effect for low ammo
        const pulseInterval = setInterval(() => {
          if (!model) {
            clearInterval(pulseInterval)
            return
          }

          const time = Date.now() * 0.005
          const pulseFactor = 1 + Math.sin(time) * 0.05
          model.scale.setScalar(pulseFactor)
        }, 50)

        // Store interval ID for cleanup
        this._pulseInterval = pulseInterval
      },

      stopLowAmmoIndicator() {
        if (this._pulseInterval) {
          clearInterval(this._pulseInterval)
          this._pulseInterval = null
        }
        if (model) {
          model.scale.setScalar(1)
        }
      },

      playLoadAnimation() {
        if (!model) return
        console.log('[magazine] Playing load animation - magazine being consumed')

        // Visual feedback - scale up and fade out
        const originalScale = model.scale.x
        let scaleStep = 0
        const maxSteps = 10

        const animateStep = () => {
          scaleStep++
          const progress = scaleStep / maxSteps

          // Scale up while fading
          const scale = originalScale * (1 + progress * 0.5)
          model.scale.setScalar(scale)

          // Fade out
          if (model.material) {
            model.material.opacity = 1 - progress
            model.material.transparent = true
          }

          if (scaleStep < maxSteps) {
            setTimeout(animateStep, 50)
          }
        }

        animateStep()
      },

      destroy() {
        // Emit magazine unequipped signal before cleanup
        console.log('[magazine] Emitting magazine:unequipped signal')
        app.emit('magazine:unequipped', {
          playerId: player.id,
          magazineId: props.id || 'magazine',
        })

        // Clean up animations
        this.stopLowAmmoIndicator()

        if (model) {
          world.remove(model)
          model = null
        }
        control?.release()
      },
    },
    server: {
      init() {
        console.log('[magazine] SERVER: Magazine initialized for player:', player.name)
      },
    },
  }
})

app.configure([
  // ===== Basic Item Properties =====
  { key: 'id', type: 'text', label: 'ID', initial: 'magazine' },
  { key: 'icon', type: 'file', kind: 'texture', label: 'Icon' },
  { key: 'name', type: 'text', label: 'Name', initial: 'Pistol Magazine' },
  { key: 'desc', type: 'textarea', label: 'Desc', initial: 'Standard magazine for combat pistol. Holds 15 rounds.' },
  { key: 'stack', type: 'number', label: 'Stack', initial: 30 },
  {
    key: 'droppable',
    type: 'switch',
    label: 'Droppable',
    options: [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    initial: true,
  },

  // ===== Visual Settings =====
  { type: 'section', key: 'visualSection', label: 'Visual Settings' },
  { key: 'scale', type: 'number', label: 'Scale', initial: 1, dp: 2, step: 0.1, hint: 'Overall size multiplier' },

  // ===== Admin Tools =====
  { type: 'section', key: 'adminSection', label: 'Admin' },
  {
    key: 'give',
    type: 'button',
    label: 'Give to Local Player',
    onClick: () => {
      const p = world.getPlayer()
      app.send('give', p.id)
    },
  },
])

function createItem(createInstance) {
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
      // instance could control this in future
      app.emit('elemental-item:take', [playerId, id, 1])
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
