import { syncLobbyProfilePatch } from '../../profileSync.js'
import { clamp } from '../../utils.js'

const HEALTH_MAX = 100
const playerEffects = new WeakMap()

function getEntityEffects(entity) {
  let effects = playerEffects.get(entity)
  if (!effects) {
    effects = new Map()
    playerEffects.set(entity, effects)
  }
  return effects
}

function getActiveEffectConfig(entity, player) {
  return playerEffects.get(entity)?.get(player.data.id) || null
}

function setActiveEffectConfig(entity, player, config) {
  const effects = getEntityEffects(entity)
  if (config) {
    effects.set(player.data.id, config)
  } else {
    effects.delete(player.data.id)
  }
}

export const playerEntityScriptApi = {
  player: {
    teleport: {
      call(player, position, rotationY) {
        const world = player.world
        if (player.data.owner === world.network.id) {
          world.network.enqueue('onPlayerTeleport', { position: position.toArray(), rotationY })
        } else if (world.network.isClient) {
          world.network.send('playerTeleport', {
            networkId: player.data.owner,
            position: position.toArray(),
            rotationY,
          })
        } else {
          world.network.sendTo(player.data.owner, 'playerTeleport', { position: position.toArray(), rotationY })
        }
      },
      meta: {
        summary: 'Teleport a player through the active network runtime.',
        docs: '/docs/scripting/world/Player.md#teleportposition-rotationy',
      },
    },
    getBoneTransform: {
      call(player, boneName) {
        return player.avatar?.getBoneTransform?.(boneName) || null
      },
      meta: {
        summary: 'Return a player avatar bone transform in world space.',
        docs: '/docs/scripting/world/Player.md#getbonetransformbonename-matrix4',
      },
    },
    setAvatar: {
      async call(player, url) {
        const world = player.world
        const avatar = url || null
        if (world.network.isServer) {
          world.network.applyEntityModified({ id: player.data.id, avatar, sessionAvatar: null })
        } else if (player.data.owner === world.network.id) {
          const result = await syncLobbyProfilePatch({ avatar })
          if (!result.ok) {
            world.emit('toast', result.error?.message || 'Unable to update profile')
            return
          }
          player.modify({ avatar, sessionAvatar: null })
          world.network.send('playerAvatar', { avatar })
        } else {
          console.error('setAvatar can only be called on the local player from client scripts')
        }
      },
      meta: {
        summary: 'Set the player persistent avatar.',
        docs: '/docs/scripting/world/Player.md#setavatarurl',
      },
    },
    setSessionAvatar: {
      call(player, url) {
        const world = player.world
        const avatar = url
        if (player.data.owner === world.network.id) {
          world.network.enqueue('onPlayerSessionAvatar', { avatar })
        } else if (world.network.isClient) {
          world.network.send('playerSessionAvatar', { networkId: player.data.owner, avatar })
        } else {
          world.network.sendTo(player.data.owner, 'playerSessionAvatar', { avatar })
        }
      },
      meta: {
        summary: 'Set the player avatar for the current session.',
        docs: '/docs/scripting/world/Player.md#setsessionavatarurl',
      },
    },
    damage: {
      call(player, amount) {
        const world = player.world
        const health = clamp(player.data.health - amount, 0, HEALTH_MAX)
        if (player.data.health === health) return
        if (world.network.isServer) {
          world.network.send('entityModified', { id: player.data.id, health })
        }
        player.modify({ health })
      },
      meta: {
        summary: 'Remove health from the player.',
        docs: '/docs/scripting/world/Player.md#damageamount',
      },
    },
    heal: {
      call(player, amount = HEALTH_MAX) {
        const world = player.world
        const health = clamp(player.data.health + amount, 0, HEALTH_MAX)
        if (player.data.health === health) return
        if (world.network.isServer) {
          world.network.send('entityModified', { id: player.data.id, health })
        }
        player.modify({ health })
      },
      meta: {
        summary: 'Add health to the player.',
        docs: '/docs/scripting/world/Player.md#healamount',
      },
    },
    hasEffect: {
      call(player) {
        return !!player.data.effect
      },
      meta: {
        summary: 'Return whether the player currently has an effect.',
        docs: '/docs/scripting/world/Player.md#applyeffect-anchor-emote-snare-freeze-turn-duration-cancellable-onend-',
      },
    },
    applyEffect: {
      call(player, opts) {
        const entity = this
        const world = player.world
        if (!opts) return
        const effect = {}
        if (opts.anchor) effect.anchorId = opts.anchor.anchorId
        if (opts.emote) effect.emote = opts.emote
        if (opts.snare) effect.snare = opts.snare
        if (opts.freeze) effect.freeze = opts.freeze
        if (opts.turn) effect.turn = opts.turn
        if (opts.duration) effect.duration = opts.duration
        if (opts.cancellable) {
          effect.cancellable = opts.cancellable
          delete effect.freeze
        }
        const config = {
          effect,
          onEnd: () => {
            if (getActiveEffectConfig(entity, player) !== config) return
            setActiveEffectConfig(entity, player, null)
            player.setEffect(null)
            opts.onEnd?.()
          },
        }
        setActiveEffectConfig(entity, player, config)
        player.setEffect(config.effect, config.onEnd)
        if (world.network.isServer) {
          world.network.send('entityModified', { id: player.data.id, ef: config.effect })
        }
        return {
          get active() {
            return getActiveEffectConfig(entity, player) === config
          },
          cancel: () => {
            config.onEnd()
          },
        }
      },
      meta: {
        summary: 'Apply a temporary movement/avatar effect to the player.',
        docs: '/docs/scripting/world/Player.md#applyeffect-anchor-emote-snare-freeze-turn-duration-cancellable-onend-',
      },
    },
    cancelEffect: {
      call(player) {
        getActiveEffectConfig(this, player)?.onEnd()
      },
      meta: {
        summary: 'Cancel the current player effect for this app.',
        docs: '/docs/scripting/world/Player.md#applyeffect-anchor-emote-snare-freeze-turn-duration-cancellable-onend-',
      },
    },
    ragdoll: {
      call(player, enable, force, opts) {
        const world = player.world
        const forceArr = force?.toArray?.() || null
        const msg = { id: player.data.id, r: enable ? 1 : 0 }
        if (forceArr) msg.rf = forceArr
        if (opts) msg.ro = opts
        player.setRagdoll(enable, force || null, opts || null)
        if (world.network.isServer) {
          world.network.send('entityModified', msg)
        }
      },
      meta: {
        summary: 'Enable or disable player ragdoll physics.',
        docs: '/docs/scripting/world/Player.md#ragdollenable-force-opts',
      },
    },
    push: {
      call(player, force, opts) {
        const world = player.world
        const bone = opts?.bone
        const point = opts?.point
        if (bone) {
          player.pushBone(bone, force.toArray(), point ? point.toArray() : null)
          return
        }
        const msg = { networkId: player.data.owner, force: force.toArray() }
        if (player.data.owner === world.network.id) {
          player.push(msg.force)
        } else if (world.network.isClient) {
          world.network.send('playerPush', msg)
        } else {
          world.network.sendTo(player.data.owner, 'playerPush', msg)
        }
      },
      meta: {
        summary: 'Apply an impulse-like push to a player.',
        docs: '/docs/scripting/world/Player.md#pushforce',
      },
    },
    replaceAnimations: {
      call(player, newEmotes, reset = false) {
        const world = player.world
        if (!world.network.isClient) {
          return console.error('replaceAnimations can only be called on the client')
        }
        if (player.data.owner !== world.network.id) {
          return console.error('replaceAnimations can only be called on local player')
        }
        player.replaceAnimations?.(newEmotes, reset)
      },
      meta: {
        summary: 'Replace local player locomotion animation clips.',
        docs: '/docs/scripting/world/Player.md#replaceanimationsnewemotes-reset--false',
        environment: 'client',
      },
    },
    firstPerson: {
      call(player, value = true) {
        const world = player.world
        if (!world.network.isClient) {
          return console.error('firstPerson can only be called on the client')
        }
        if (player.data.owner !== world.network.id) {
          return console.error('firstPerson can only be called on local player')
        }
        player.firstPerson(value)
      },
      meta: {
        summary: 'Force the local player into or out of first-person view.',
        docs: '/docs/scripting/world/Player.md#firstpersonvalue--true',
        environment: 'client',
      },
    },
  },
}

export function cleanupPlayerEntityProxy(entity, player) {
  getActiveEffectConfig(entity, player)?.onEnd()
}
