import { createAgonesSdkHttp } from './agonesSdkHttp.js'

function formatErrorMessage(err) {
  if (err instanceof Error) return err.message
  return String(err)
}

function createLogger(logger = console) {
  return {
    info(message) {
      if (typeof logger?.info === 'function') logger.info(message)
    },
    warn(message) {
      if (typeof logger?.warn === 'function') logger.warn(message)
    },
  }
}

function normalizePositiveInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizePlayerId(playerId) {
  return typeof playerId === 'string' ? playerId.trim() : ''
}

export function resolveEffectivePlayerCapacity({ playerLimit, env = process.env } = {}) {
  const worldPlayerLimit = normalizePositiveInteger(playerLimit)
  if (worldPlayerLimit !== null) return worldPlayerLimit
  return normalizePositiveInteger(env?.PUBLIC_WORLD_MAX_PLAYERS)
}

export function createAgonesPlayerTracker({
  agones = createAgonesSdkHttp(),
  world = null,
  env = process.env,
  logger = console,
} = {}) {
  const log = createLogger(logger)
  const canTrackPlayers =
    !!agones &&
    typeof agones.setPlayerCapacity === 'function' &&
    typeof agones.playerConnect === 'function' &&
    typeof agones.playerDisconnect === 'function'
  const canSubscribe =
    !!world &&
    typeof world?.settings?.on === 'function' &&
    typeof world?.network?.on === 'function'
  const enabled = canTrackPlayers && canSubscribe

  let started = false
  let lastObservedCapacity
  let lastPublishedCapacity

  async function publishCapacity(reason = 'update') {
    if (!enabled) return false

    const nextCapacity = resolveEffectivePlayerCapacity({
      playerLimit: world?.settings?.playerLimit,
      env,
    })
    const capacityChanged = nextCapacity !== lastObservedCapacity
    lastObservedCapacity = nextCapacity

    if (!Number.isInteger(nextCapacity) || nextCapacity <= 0) {
      if (capacityChanged) {
        log.info(`[agones] skipped player capacity update (${reason})`)
      }
      return false
    }
    if (!capacityChanged && nextCapacity === lastPublishedCapacity) {
      return false
    }

    try {
      await agones.setPlayerCapacity(nextCapacity)
      lastPublishedCapacity = nextCapacity
      log.info(`[agones] updated player capacity to ${nextCapacity} (${reason})`)
      return true
    } catch (err) {
      log.warn(`[agones] failed to update player capacity to ${nextCapacity} (${formatErrorMessage(err)})`)
      return false
    }
  }

  async function trackPlayerConnect(playerId) {
    if (!enabled) return false

    const normalizedPlayerId = normalizePlayerId(playerId)
    if (!normalizedPlayerId) {
      log.warn('[agones] skipped player connect with invalid player id')
      return false
    }

    try {
      const connected = await agones.playerConnect(normalizedPlayerId)
      if (connected === false) {
        log.info(`[agones] player connect ignored for ${normalizedPlayerId} (already connected)`)
      }
      return connected !== false
    } catch (err) {
      log.warn(`[agones] failed to track player connect for ${normalizedPlayerId} (${formatErrorMessage(err)})`)
      return false
    }
  }

  async function trackPlayerDisconnect(playerId) {
    if (!enabled) return false

    const normalizedPlayerId = normalizePlayerId(playerId)
    if (!normalizedPlayerId) {
      log.warn('[agones] skipped player disconnect with invalid player id')
      return false
    }

    try {
      const disconnected = await agones.playerDisconnect(normalizedPlayerId)
      if (disconnected === false) {
        log.info(`[agones] player disconnect ignored for ${normalizedPlayerId} (not connected)`)
      }
      return disconnected !== false
    } catch (err) {
      log.warn(`[agones] failed to track player disconnect for ${normalizedPlayerId} (${formatErrorMessage(err)})`)
      return false
    }
  }

  function onSettingsChange(changes) {
    if (!changes?.playerLimit) return
    void publishCapacity('player_limit_changed')
  }

  function onPlayerJoined({ id } = {}) {
    void trackPlayerConnect(id)
  }

  function onPlayerLeft({ id } = {}) {
    void trackPlayerDisconnect(id)
  }

  function start() {
    if (!enabled || started) return enabled
    started = true
    world.settings.on('change', onSettingsChange)
    world.network.on('playerJoined', onPlayerJoined)
    world.network.on('playerLeft', onPlayerLeft)
    return true
  }

  function stop() {
    if (!started) return
    started = false
    world.settings.off?.('change', onSettingsChange)
    world.network.off?.('playerJoined', onPlayerJoined)
    world.network.off?.('playerLeft', onPlayerLeft)
  }

  return {
    enabled,
    publishCapacity,
    start,
    stop,
    trackPlayerConnect,
    trackPlayerDisconnect,
  }
}
