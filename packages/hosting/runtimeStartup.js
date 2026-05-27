function formatErrorMessage(err) {
  if (err instanceof Error) return err.message
  return String(err)
}

function createLogger(logger = console) {
  return {
    info(message) {
      if (typeof logger?.info === 'function') logger.info(message)
    },
    error(message) {
      if (typeof logger?.error === 'function') logger.error(message)
    },
  }
}

export async function completeRuntimeStartup({
  hosting = null,
  idleController = null,
  idleControllerEnabled = false,
  idleTimeoutMs = 0,
  requestHostingReady = true,
  logger = console,
} = {}) {
  const log = createLogger(logger)
  const label = hosting?.name || 'runtime-hosting'

  if (requestHostingReady && hosting && typeof hosting.ready === 'function') {
    try {
      await hosting.ready()
      log.info(`[${label}] requested runtime Ready`)
    } catch (err) {
      log.error(`[${label}] failed to request runtime Ready (${formatErrorMessage(err)})`)
      throw err
    }
  }

  if (idleControllerEnabled) {
    log.info(`[${label}-idle] enabled with timeout=${idleTimeoutMs / 1000}s`)
    idleController?.reconcileIdleShutdown('startup')
  }
}
