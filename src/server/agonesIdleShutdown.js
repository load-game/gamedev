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

export function resolveAgonesIdleShutdownTimeoutMs(env = process.env) {
  const parsedTimeoutSeconds = Number.parseInt(String(env?.SHUTDOWN_IDLE ?? ''), 10)
  if (!Number.isFinite(parsedTimeoutSeconds) || parsedTimeoutSeconds <= 0) return 0
  return parsedTimeoutSeconds * 1000
}

export function createAgonesIdleController({
  enabled = false,
  timeoutMs = 0,
  agones = createAgonesSdkHttp(),
  getActiveSessionCount,
  beforeShutdown = null,
  logger = console,
} = {}) {
  let idleShutdownTimerId = null
  let idleShutdownRequested = false
  const log = createLogger(logger)
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0
  const hasShutdownTransport = !!agones && typeof agones.shutdown === 'function'
  const isEnabled = enabled && hasShutdownTransport

  function clearIdleShutdownTimer(reason = 'active_session') {
    if (!idleShutdownTimerId) return
    clearTimeout(idleShutdownTimerId)
    idleShutdownTimerId = null
    log.info(`[agones-idle] cancelled idle shutdown (${reason})`)
  }

  function scheduleIdleShutdown(reason = 'idle') {
    if (!isEnabled || normalizedTimeoutMs <= 0 || idleShutdownRequested || idleShutdownTimerId) return
    idleShutdownTimerId = setTimeout(() => {
      idleShutdownTimerId = null
      void requestAgonesShutdown('idle_timeout_elapsed')
    }, normalizedTimeoutMs)
    log.info(`[agones-idle] scheduling shutdown in ${normalizedTimeoutMs / 1000}s (${reason})`)
  }

  async function requestAgonesShutdown(reason = 'idle') {
    if (!isEnabled || normalizedTimeoutMs <= 0 || idleShutdownRequested) return
    if (getActiveSessionCount() > 0) return
    if (typeof beforeShutdown === 'function') {
      try {
        await beforeShutdown()
      } catch (err) {
        log.warn(`[agones-idle] failed to save world before shutdown (${formatErrorMessage(err)})`)
        scheduleIdleShutdown('retry_after_failed_save')
        return
      }
    }
    try {
      if (getActiveSessionCount() > 0) return
      await agones.shutdown()
      idleShutdownRequested = true
      log.info(`[agones-idle] requested Agones shutdown (${reason})`)
    } catch (err) {
      log.warn(`[agones-idle] failed to request Agones shutdown (${formatErrorMessage(err)})`)
      scheduleIdleShutdown('retry_after_failed_shutdown')
    }
  }

  function reconcileIdleShutdown(reason = 'state_change') {
    if (!isEnabled || normalizedTimeoutMs <= 0 || idleShutdownRequested) return
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
