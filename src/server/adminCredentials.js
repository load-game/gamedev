export const ADMIN_CREDENTIAL_COMMAND = 'runtime_credentials_get'
export const ADMIN_AUTH_KIND_ADMIN_CODE = 'admin_code'
export const ADMIN_AUTH_KIND_PLAYER_TOKEN = 'player_token'

function normalizeWorldId(worldId) {
  if (typeof worldId !== 'string') return null
  const trimmed = worldId.trim()
  return trimmed || null
}

function normalizeAdminAuthKind(kind) {
  return kind === ADMIN_AUTH_KIND_PLAYER_TOKEN ? ADMIN_AUTH_KIND_PLAYER_TOKEN : ADMIN_AUTH_KIND_ADMIN_CODE
}

export function buildRuntimeCredentialResponse({
  worldId,
  adminCode,
  adminAuthKind,
} = {}) {
  const normalizedWorldId = normalizeWorldId(worldId)
  const normalizedAdminAuthKind = normalizeAdminAuthKind(adminAuthKind)
  const hasAdminCode =
    normalizedAdminAuthKind === ADMIN_AUTH_KIND_ADMIN_CODE &&
    typeof adminCode === 'string' &&
    adminCode.length > 0
  return {
    worldId: normalizedWorldId,
    adminAuthKind: normalizedAdminAuthKind,
    hasAdminCode,
    adminCode: hasAdminCode ? adminCode : null,
  }
}

export function handleRuntimeCredentialCommand({
  canDeploy,
  worldId,
  adminCode,
  adminAuthKind,
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
    adminAuthKind,
  })
  const revealed = typeof credentials.adminCode === 'string'
  const reason =
    credentials.adminAuthKind === ADMIN_AUTH_KIND_PLAYER_TOKEN
      ? 'player_token_auth'
      : revealed
        ? 'revealed'
        : 'admin_code_unset'

  return {
    ok: true,
    reason,
    revealed,
    credentials,
  }
}
