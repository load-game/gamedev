const livekitVoiceModifiers = new WeakMap()

function getEntityVoiceModifiers(entity) {
  let modifiers = livekitVoiceModifiers.get(entity)
  if (!modifiers) {
    modifiers = new Map()
    livekitVoiceModifiers.set(entity, modifiers)
  }
  return modifiers
}

function setVoiceModifier(entity, player, modifier) {
  const modifiers = getEntityVoiceModifiers(entity)
  const playerId = player.data.id
  if (modifier) {
    modifiers.set(playerId, modifier)
  } else {
    modifiers.delete(playerId)
  }
}

function getVoiceModifier(entity, player) {
  return livekitVoiceModifiers.get(entity)?.get(player.data.id) || null
}

export const livekitClientScriptApi = {
  player: {
    screenshare: {
      call(player, targetId) {
        const world = player.world
        if (!targetId) {
          return console.error(`screenshare has invalid targetId: ${targetId}`)
        }
        if (player.data.owner !== world.network.id) {
          return console.error('screenshare can only be called on local player')
        }
        world.livekit.setScreenShareTarget(targetId)
      },
      meta: {
        summary: 'Share the local player screen with matching video nodes.',
        docs: '/docs/scripting/world/Player.md#screensharescreenid',
        environment: 'client',
      },
    },
  },
}

export const livekitServerScriptApi = {
  player: {
    setVoiceLevel: {
      call(player, level) {
        const entity = this
        const world = player.world
        if (!world.network.isServer) {
          return console.error('[setVoiceLevel] must be applied on the server')
        }
        let modifier = getVoiceModifier(entity, player)
        if (!level && !modifier) {
          return
        }
        if (!level && modifier) {
          modifier = world.livekit.removeModifier(modifier)
          setVoiceModifier(entity, player, modifier)
          return
        }
        if (level && !modifier) {
          modifier = world.livekit.addModifier(player.data.id, level)
          setVoiceModifier(entity, player, modifier)
          return
        }
        if (level && modifier) {
          modifier = world.livekit.updateModifier(modifier, level)
          setVoiceModifier(entity, player, modifier)
        }
      },
      meta: {
        summary: 'Override a player voice chat level for this app.',
        docs: '/docs/scripting/world/Player.md#setvoicelevellevel',
        environment: 'server',
      },
    },
  },
}

export function cleanupLiveKitPlayerProxy(entity, player) {
  const modifier = getVoiceModifier(entity, player)
  if (!modifier) return
  player.world.livekit.removeModifier(modifier)
  setVoiceModifier(entity, player, null)
}
