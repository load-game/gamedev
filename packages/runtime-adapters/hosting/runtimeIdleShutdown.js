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

export function resolveRuntimeIdleShutdownTimeoutMs(env = process.env) {
  const parsedTimeoutSeconds = Number.parseInt(String(env?.SHUTDOWN_IDLE ?? ''), 10)
  if (!Number.isFinite(parsedTimeoutSeconds) || parsedTimeoutSeconds <= 0) return 0
  return parsedTimeoutSeconds * 1000
}

export function createRuntimeIdleController({
  enabled = false,
  timeoutMs = 0,
  hosting = null,
  getActiveSessionCount,
  beforeShutdown = null,
  logger = console,
} = {}) {
  let idleShutdownTimerId = null
  let idleShutdownRequested = false
  const log = createLogger(logger)
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0
  const hasShutdownTransport = !!hosting && typeof hosting.shutdown === 'function'
  const isEnabled = enabled && hasShutdownTransport
  const label = hosting?.name || 'runtime-hosting'

  function clearIdleShutdownTimer(reason = 'active_session') {
    if (!idleShutdownTimerId) return
    clearTimeout(idleShutdownTimerId)
    idleShutdownTimerId = null
    log.info(`[${label}-idle] cancelled idle shutdown (${reason})`)
  }

  function scheduleIdleShutdown(reason = 'idle') {
    if (!isEnabled || normalizedTimeoutMs <= 0 || idleShutdownRequested || idleShutdownTimerId) return
    idleShutdownTimerId = setTimeout(() => {
      idleShutdownTimerId = null
      void requestRuntimeShutdown('idle_timeout_elapsed')
    }, normalizedTimeoutMs)
    log.info(`[${label}-idle] scheduling shutdown in ${normalizedTimeoutMs / 1000}s (${reason})`)
  }

  async function requestRuntimeShutdown(reason = 'idle') {
    if (!isEnabled || normalizedTimeoutMs <= 0 || idleShutdownRequested) return
    if (getActiveSessionCount() > 0) return
    if (typeof beforeShutdown === 'function') {
      try {
        await beforeShutdown()
      } catch (err) {
        log.warn(`[${label}-idle] failed to save world before shutdown (${formatErrorMessage(err)})`)
        scheduleIdleShutdown('retry_after_failed_save')
        return
      }
    }
    try {
      if (getActiveSessionCount() > 0) return
      await hosting.shutdown()
      idleShutdownRequested = true
      log.info(`[${label}-idle] requested runtime shutdown (${reason})`)
    } catch (err) {
      log.warn(`[${label}-idle] failed to request runtime shutdown (${formatErrorMessage(err)})`)
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
    requestRuntimeShutdown,
    requestAgonesShutdown: requestRuntimeShutdown,
  }
}

export const resolveAgonesIdleShutdownTimeoutMs = resolveRuntimeIdleShutdownTimeoutMs
export const createAgonesIdleController = createRuntimeIdleController
