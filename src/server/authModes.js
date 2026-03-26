function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export const ADMIN_AUTH_KIND_PLAYER_TOKEN = 'player_token'
export const ADMIN_AUTH_KIND_ADMIN_CODE = 'admin_code'

function freezeAuthDescriptor(descriptor) {
  Object.freeze(descriptor.admin)
  return Object.freeze(descriptor)
}

export function resolveRuntimeAuthDescriptor(env = process.env) {
  const usesLobbyIdentity = hasValue(env.PUBLIC_AUTH_URL)
  const adminCodeConfigured = hasValue(env.ADMIN_CODE)
  const adminKind = usesLobbyIdentity ? ADMIN_AUTH_KIND_PLAYER_TOKEN : ADMIN_AUTH_KIND_ADMIN_CODE

  return freezeAuthDescriptor({
    usesLobbyIdentity,
    usesLocalIdentity: !usesLobbyIdentity,
    admin: {
      kind: adminKind,
      codeConfigured: !usesLobbyIdentity && adminCodeConfigured,
      openAccess: !usesLobbyIdentity && !adminCodeConfigured,
    },
  })
}

export function resolveAuthRuntimeConfig(env = process.env) {
  const authDescriptor = resolveRuntimeAuthDescriptor(env)

  return {
    usesLobbyIdentity: authDescriptor.usesLobbyIdentity,
    usesLocalIdentity: authDescriptor.usesLocalIdentity,
    authDescriptor,
  }
}
