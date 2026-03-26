export function resolveInitialAdminAuthFromEnv(env = globalThis.env) {
  const publicAuthUrl = typeof env?.PUBLIC_AUTH_URL === 'string' ? env.PUBLIC_AUTH_URL.trim() : ''
  if (!publicAuthUrl) return null
  return {
    usesLobbyIdentity: true,
    usesLocalIdentity: false,
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  }
}
