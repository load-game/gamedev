export const ADMIN_CREDENTIAL_COMMAND = 'runtime_credentials_get'

function normalizeWorldId(worldId) {
  if (typeof worldId !== 'string') return null
  const trimmed = worldId.trim()
  return trimmed || null
}

export function buildRuntimeCredentialResponse({
  worldId,
  adminCode,
} = {}) {
  const normalizedWorldId = normalizeWorldId(worldId)
  const hasAdminCode = typeof adminCode === 'string' && adminCode.length > 0
  return {
    worldId: normalizedWorldId,
    hasAdminCode,
    adminCode: null,
  }
}

export function handleRuntimeCredentialCommand({
  canDeploy,
  worldId,
  adminCode,
} = {}) {
  if (!canDeploy) {
    return {
      ok: false,
      error: 'admin_required',
      reason: 'deploy_capability_required',
      revealed: false,
      credentials: null,
    }
  }

  const credentials = buildRuntimeCredentialResponse({
    worldId,
    adminCode,
  })
  const hasAdminCode = credentials.hasAdminCode
  const revealed = false

  return {
    ok: true,
    reason: hasAdminCode ? 'admin_code_hidden' : 'admin_code_unset',
    revealed,
    credentials,
  }
}
