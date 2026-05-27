import { usesHostedRuntimeBootstrap } from './runtimeBootstrap.js'

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function resolveAuthRuntimeConfig(env = process.env) {
  const configuredProvider = typeof env.RUNTIME_AUTH_PROVIDER === 'string' ? env.RUNTIME_AUTH_PROVIDER.trim() : ''
  const usesExternalIdentity =
    configuredProvider === 'external' ||
    configuredProvider === 'lobby' ||
    hasValue(env.RUNTIME_AUTH_URL) ||
    hasValue(env.PUBLIC_AUTH_URL)
  const usesControlPlaneRank = usesExternalIdentity && usesHostedRuntimeBootstrap(env)

  return {
    usesExternalIdentity,
    usesLobbyIdentity: usesExternalIdentity,
    usesLocalIdentity: !usesExternalIdentity,
    usesControlPlaneRank,
    usesRuntimeLocalRank: !usesControlPlaneRank,
  }
}
