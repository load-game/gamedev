import { registerWithRegistry } from './registry'

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
  agones = null,
  agonesIdleController = null,
  agonesIdleControllerEnabled = false,
  idleTimeoutMs = 0,
  registryState = null,
  worldId = null,
  commitHash = null,
  registerWithRegistryImpl = registerWithRegistry,
  logger = console,
} = {}) {
  const log = createLogger(logger)

  if (agones && typeof agones.ready === 'function') {
    try {
      await agones.ready()
      log.info('[agones] requested Agones Ready')
    } catch (err) {
      log.error(`[agones] failed to request Agones Ready (${formatErrorMessage(err)})`)
      throw err
    }
  }

  if (agonesIdleControllerEnabled) {
    log.info(`[agones-idle] enabled with timeout=${idleTimeoutMs / 1000}s`)
    agonesIdleController?.reconcileIdleShutdown('startup')
  }

  void registerWithRegistryImpl(registryState, {
    worldId,
    commitHash,
  })
}
