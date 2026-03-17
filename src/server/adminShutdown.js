import { createAgonesSdkHttp, resolveAgonesSdkHttpBaseUrl } from './agonesSdkHttp.js'

export const ADMIN_SHUTDOWN_COMMAND = 'agones_shutdown'

export function resolveAgonesShutdownUrl(env = process.env) {
  return `${resolveAgonesSdkHttpBaseUrl(env)}/shutdown`
}

function resolveShutdownRequestFailureReason(err) {
  const message = err instanceof Error ? err.message : String(err)
  return message.startsWith('agones_sdk_status_') ? message : 'request_failed'
}

export async function handleAdminShutdownCommand({
  canDeploy,
  beforeShutdown = null,
  agones = createAgonesSdkHttp(),
} = {}) {
  if (!canDeploy) {
    return {
      ok: false,
      error: 'admin_required',
      reason: 'deploy_capability_required',
    }
  }

  if (!agones || typeof agones.shutdown !== 'function') {
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
    await agones.shutdown()
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
