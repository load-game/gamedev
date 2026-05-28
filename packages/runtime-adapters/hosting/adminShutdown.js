export const RUNTIME_SHUTDOWN_COMMAND = 'runtime_shutdown'
export const LEGACY_AGONES_SHUTDOWN_COMMAND = 'agones_shutdown'
export const ADMIN_SHUTDOWN_COMMAND = RUNTIME_SHUTDOWN_COMMAND

function resolveShutdownRequestFailureReason(err) {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('_status_') ? message : 'request_failed'
}

export async function handleRuntimeShutdownCommand({ canDeploy, beforeShutdown = null, hosting = null } = {}) {
  if (!canDeploy) {
    return {
      ok: false,
      error: 'admin_required',
      reason: 'deploy_capability_required',
    }
  }

  if (!hosting || typeof hosting.shutdown !== 'function') {
    return {
      ok: false,
      error: 'shutdown_unavailable',
      reason: 'missing_shutdown_transport',
    }
  }

  if (typeof beforeShutdown === 'function') {
    try {
      await beforeShutdown()
    } catch {
      return {
        ok: false,
        error: 'shutdown_save_failed',
        reason: 'before_shutdown_failed',
      }
    }
  }

  try {
    await hosting.shutdown()
  } catch (err) {
    return {
      ok: false,
      error: 'shutdown_request_failed',
      reason: resolveShutdownRequestFailureReason(err),
    }
  }

  return {
    ok: true,
    requested: true,
  }
}

export const handleAdminShutdownCommand = handleRuntimeShutdownCommand
