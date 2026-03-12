import { parseBooleanEnvFlag } from './adminCredentials.js'

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

export function resolveAgonesIdleControllerEnabled(env = process.env) {
  return parseBooleanEnvFlag(env?.SHUTDOWN_IDLE, false)
}

export function createAgonesIdleController({
  enabled = false,
  timeoutMs = 0,
  shutdownUrl,
  getActiveSessionCount,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  let idleShutdownTimerId = null
  let idleShutdownRequested = false
  const log = createLogger(logger)
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : 0

  function clearIdleShutdownTimer(reason = 'active_session') {
    if (!idleShutdownTimerId) return
    clearTimeout(idleShutdownTimerId)
    idleShutdownTimerId = null
    log.info(`[agones-idle] cancelled idle shutdown (${reason})`)
  }

  function scheduleIdleShutdown(reason = 'idle') {
    if (!enabled || idleShutdownRequested || idleShutdownTimerId) return
    idleShutdownTimerId = setTimeout(() => {
      idleShutdownTimerId = null
      void requestAgonesShutdown('idle_timeout_elapsed')
    }, normalizedTimeoutMs)
    log.info(`[agones-idle] scheduling shutdown in ${normalizedTimeoutMs / 1000}s (${reason})`)
  }

  async function requestAgonesShutdown(reason = 'idle') {
    if (!enabled || idleShutdownRequested) return
    if (getActiveSessionCount() > 0) return
    try {
      const response = await fetchImpl(shutdownUrl, { method: 'POST' })
      if (!response.ok) {
        throw new Error(`agones_sdk_status_${response.status}`)
      }
      idleShutdownRequested = true
      log.info(`[agones-idle] requested Agones shutdown (${reason})`)
    } catch (err) {
      log.warn(`[agones-idle] failed to request Agones shutdown (${formatErrorMessage(err)})`)
      scheduleIdleShutdown('retry_after_failed_shutdown')
    }
  }

  function reconcileIdleShutdown(reason = 'state_change') {
    if (!enabled || idleShutdownRequested) return
    if (getActiveSessionCount() === 0) {
      scheduleIdleShutdown(reason)
    } else {
      clearIdleShutdownTimer(reason)
    }
  }

  return {
    clearIdleShutdownTimer,
    reconcileIdleShutdown,
    requestAgonesShutdown,
  }
}
