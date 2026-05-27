import { createRuntimePlayerTracker, resolveEffectivePlayerCapacity } from '@gamedev/hosting/playerTracking.js'
import { createAgonesHostingAdapter } from '@gamedev/hosting-agones'

function createAgonesCompatibilityAdapter(agones) {
  if (!agones) return null
  if (
    typeof agones.publishPlayerCapacity === 'function' &&
    typeof agones.trackPlayerConnect === 'function' &&
    typeof agones.trackPlayerDisconnect === 'function'
  ) {
    return agones.name ? agones : { name: 'agones', ...agones }
  }
  return {
    name: 'agones',
    async publishPlayerCapacity(capacity) {
      return agones.updateList?.('players', {
        capacity: String(capacity),
      })
    },
    trackPlayerConnect(playerId) {
      return agones.addListValue?.('players', playerId)
    },
    trackPlayerDisconnect(playerId) {
      return agones.removeListValue?.('players', playerId)
    },
  }
}

export function createAgonesPlayerTracker({ agones, ...options } = {}) {
  const hosting =
    options.hosting || (agones === undefined ? createAgonesHostingAdapter() : createAgonesCompatibilityAdapter(agones))
  return createRuntimePlayerTracker({
    ...options,
    hosting,
  })
}

export { createRuntimePlayerTracker, resolveEffectivePlayerCapacity }
