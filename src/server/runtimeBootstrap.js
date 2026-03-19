import crypto from 'crypto'
import path from 'path'

const MANAGED_RUNTIME_BOOTSTRAP_MODES = new Set(['pull', 'push'])
const PUSH_RUNTIME_BINDING_ENV_KEYS = [
  'CONTROL_INTERNAL_BASE_URL',
  'DB_SCHEMA',
  'PUBLIC_ADMIN_URL',
  'PUBLIC_API_URL',
  'PUBLIC_AUTH_URL',
  'PUBLIC_MAX_UPLOAD_SIZE',
  'PUBLIC_PRIVY_APP_ID',
  'PUBLIC_WORLD_MAX_PLAYERS',
  'PUBLIC_WS_URL',
  'SHUTDOWN_IDLE',
  'WORLD',
  'WORLD_ID',
]

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function hasValue(value) {
  return normalizeString(value).length > 0
}

export function resolveRuntimeBootstrapMode(env = process.env) {
  const explicitMode = normalizeString(env.RUNTIME_BOOTSTRAP_MODE).toLowerCase()
  if (explicitMode) {
    if (MANAGED_RUNTIME_BOOTSTRAP_MODES.has(explicitMode)) {
      return explicitMode
    }
    throw new Error("[envs] RUNTIME_BOOTSTRAP_MODE must be 'pull' or 'push'")
  }

  if (!hasValue(env.WORLD_ID)) {
    return 'push'
  }

  return null
}

export function usesHostedRuntimeBootstrap(env = process.env) {
  if (hasValue(env.RUNTIME_BOOTSTRAP_URL)) return true
  if (hasValue(env.RUNTIME_BOOTSTRAP_MODE)) return true
  return !hasValue(env.WORLD_ID) && (hasValue(env.RUNTIME_BOOTSTRAP_INSTANCE_ID) || hasValue(env.POD_NAME))
}

export function clearPushRuntimeBindingEnv(env = process.env) {
  for (const key of PUSH_RUNTIME_BINDING_ENV_KEYS) {
    delete env[key]
  }
}

export function resolveHostedRuntimeBootstrapUrl(env = process.env) {
  const url = normalizePublicUrl(env.RUNTIME_BOOTSTRAP_URL)
  return url || null
}

export function derivePublicWsUrlFromApiUrl(apiUrl) {
  const value = normalizeString(apiUrl)
  if (!value) return null
  return value
    .replace(/\/api\/?$/, '/ws')
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
}

export function derivePublicAdminUrl({ publicApiUrl, publicWsUrl } = {}) {
  const normalizedApiUrl = normalizePublicUrl(publicApiUrl)
  if (normalizedApiUrl) {
    const baseUrl = normalizedApiUrl.replace(/\/api\/?$/, '')
    return baseUrl ? `${baseUrl}/admin` : null
  }

  const normalizedWsUrl = normalizePublicUrl(publicWsUrl)
  if (!normalizedWsUrl) return null

  const baseUrl = normalizedWsUrl
    .replace(/\/ws\/?$/, '')
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
  return baseUrl ? `${baseUrl}/admin` : null
}

function normalizePublicUrl(value) {
  return normalizeString(value).replace(/\/+$/, '')
}

function parseNonNegativeInteger(value) {
  const normalized = typeof value === 'string' ? value.trim() : value
  if (typeof normalized === 'number' && Number.isFinite(normalized) && normalized >= 0) {
    return Math.floor(normalized)
  }
  if (typeof normalized !== 'string' || !normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function sanitizeWorldPathSegment(value, fallback = 'world') {
  const normalized = normalizeString(value).replace(/[^A-Za-z0-9._-]+/g, '_')
  return normalized || fallback
}

function buildHostedWorldRelativePath({ worldSlug, worldId }) {
  return path.join('.runtime-worlds', sanitizeWorldPathSegment(worldSlug || worldId, 'world'))
}

export function buildRuntimeBootstrapId({ worldId, runtimeInstanceId } = {}) {
  const normalizedWorldId = normalizeString(worldId)
  const normalizedRuntimeInstanceId = normalizeString(runtimeInstanceId)
  if (!normalizedWorldId) return ''
  if (!normalizedRuntimeInstanceId) return normalizedWorldId
  return `${normalizedWorldId}:${normalizedRuntimeInstanceId}`
}

function deriveLegacyControlBaseFromPublicAuthUrl(publicAuthUrl) {
  const normalizedPublicAuthUrl = normalizePublicUrl(publicAuthUrl)
  if (!normalizedPublicAuthUrl) return null
  try {
    const url = new URL(normalizedPublicAuthUrl)
    let basePath = url.pathname.replace(/\/+$/, '')
    basePath = basePath.replace(/\/identity$/, '')
    url.pathname = basePath || '/'
    url.search = ''
    url.hash = ''
    return normalizePublicUrl(url.toString()) || null
  } catch {
    return null
  }
}

export function resolveControlInternalBaseUrl(env = process.env) {
  const explicit = normalizePublicUrl(env.CONTROL_INTERNAL_BASE_URL)
  if (explicit) return explicit
  return deriveLegacyControlBaseFromPublicAuthUrl(env.PUBLIC_AUTH_URL)
}

export function usesLegacyControlPlaneBaseUrl(env = process.env) {
  return !hasValue(env.CONTROL_INTERNAL_BASE_URL) && hasValue(env.PUBLIC_AUTH_URL)
}

export function resolveControlInternalUrl(pathname, env = process.env) {
  const baseUrl = resolveControlInternalBaseUrl(env)
  if (!baseUrl) return null
  try {
    const url = new URL(baseUrl)
    const basePath = url.pathname.replace(/\/+$/, '')
    const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`
    url.pathname = `${basePath}${suffix}` || suffix
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function resolveRuntimeBootstrapInstanceId(env = process.env) {
  return normalizeString(env.RUNTIME_BOOTSTRAP_INSTANCE_ID || env.POD_NAME || env.HOSTNAME) || null
}

export function resolveRuntimeBootstrapAuthSecret(env = process.env) {
  return normalizeString(env.RUNTIME_BOOTSTRAP_AUTH_SECRET || env.JWT_SECRET) || null
}

export function deriveRuntimeBootstrapAuthToken(runtimeInstanceId, secret) {
  const normalizedRuntimeInstanceId = normalizeString(runtimeInstanceId)
  const normalizedSecret = normalizeString(secret)
  if (!normalizedRuntimeInstanceId || !normalizedSecret) return null
  return crypto
    .createHmac('sha256', normalizedSecret)
    .update(`runtime-bootstrap:${normalizedRuntimeInstanceId}`)
    .digest('hex')
}

export function buildRuntimeBootstrapAuthorization(runtimeInstanceId, secret) {
  const token = deriveRuntimeBootstrapAuthToken(runtimeInstanceId, secret)
  return token ? `Bearer ${token}` : null
}

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return ''
  if (!authorizationHeader.startsWith('Bearer ')) return ''
  return authorizationHeader.slice(7).trim()
}

export function verifyRuntimeBootstrapAuthorization(authorizationHeader, env = process.env) {
  const providedToken = readBearerToken(authorizationHeader)
  const expectedToken = deriveRuntimeBootstrapAuthToken(
    resolveRuntimeBootstrapInstanceId(env),
    resolveRuntimeBootstrapAuthSecret(env)
  )
  if (!providedToken || !expectedToken) return false
  const providedBuffer = Buffer.from(providedToken)
  const expectedBuffer = Buffer.from(expectedToken)
  if (providedBuffer.length !== expectedBuffer.length) return false
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

export function parseRuntimeBootstrapPayload(payload = null, { runtimeInstanceId } = {}) {
  const worldId = normalizeString(payload?.world?.id)
  const worldSlug = normalizeString(payload?.world?.slug)
  const dbSchema = normalizeString(payload?.world?.dbSchema)
  const normalizedRuntimeInstanceId = normalizeString(payload?.runtime?.instanceId)
  const resolvedRuntimeInstanceId = normalizedRuntimeInstanceId || normalizeString(runtimeInstanceId)
  const runtimeApiUrl = normalizePublicUrl(payload?.runtime?.publicApiUrl) || null
  const runtimeWsUrlRaw = normalizePublicUrl(payload?.runtime?.publicWsUrl) || null
  const runtimeAdminUrlRaw = normalizePublicUrl(payload?.runtime?.publicAdminUrl) || null
  const authUrl = normalizePublicUrl(payload?.auth?.publicAuthUrl) || null
  const privyAppId = normalizeString(payload?.auth?.publicPrivyAppId) || null
  const controlInternalBaseUrl = normalizePublicUrl(payload?.control?.internalBaseUrl) || null
  const publicMaxUploadSize = parseNonNegativeInteger(payload?.world?.publicMaxUploadSize)
  const publicWorldMaxPlayers = parseNonNegativeInteger(payload?.world?.publicWorldMaxPlayers)
  const shutdownIdleSeconds = parseNonNegativeInteger(payload?.world?.shutdownIdleSeconds)
  const runtimeWsUrl = runtimeWsUrlRaw || (runtimeApiUrl ? derivePublicWsUrlFromApiUrl(runtimeApiUrl) || null : null)
  const runtimeAdminUrl =
    runtimeAdminUrlRaw
    || derivePublicAdminUrl({
      publicApiUrl: runtimeApiUrl,
      publicWsUrl: runtimeWsUrl,
    })

  return {
    bootstrapId: normalizeString(payload?.bootstrapId) || buildRuntimeBootstrapId({
      worldId,
      runtimeInstanceId: resolvedRuntimeInstanceId,
    }),
    world: {
      id: worldId || null,
      slug: worldSlug || null,
      dbSchema: dbSchema || null,
      publicMaxUploadSize,
      publicWorldMaxPlayers,
      shutdownIdleSeconds,
    },
    runtime: {
      instanceId: resolvedRuntimeInstanceId || null,
      publicApiUrl: runtimeApiUrl,
      publicWsUrl: runtimeWsUrl,
      publicAdminUrl: runtimeAdminUrl,
    },
    auth: {
      publicAuthUrl: authUrl,
      publicPrivyAppId: privyAppId,
    },
    control: {
      internalBaseUrl: controlInternalBaseUrl,
    },
  }
}

export function serializeRuntimeBootstrapBinding(payload = null, options = {}) {
  return JSON.stringify(parseRuntimeBootstrapPayload(payload, options))
}

export function applyHostedRuntimeBootstrapPayload(env = process.env, payload = null) {
  const appliedKeys = []
  const binding = parseRuntimeBootstrapPayload(payload)
  const worldId = normalizeString(binding.world.id)
  const worldSlug = normalizeString(binding.world.slug)
  const dbSchema = normalizeString(binding.world.dbSchema)
  const runtimeApiUrl = normalizePublicUrl(binding.runtime.publicApiUrl)
  const runtimeWsUrl = normalizePublicUrl(binding.runtime.publicWsUrl)
  const runtimeAdminUrl = normalizePublicUrl(binding.runtime.publicAdminUrl)
  const authUrl = normalizePublicUrl(binding.auth.publicAuthUrl)
  const privyAppId = normalizeString(binding.auth.publicPrivyAppId)
  const controlInternalBaseUrl = normalizePublicUrl(binding.control.internalBaseUrl)
  const publicMaxUploadSize = binding.world.publicMaxUploadSize
  const publicWorldMaxPlayers = binding.world.publicWorldMaxPlayers
  const shutdownIdleSeconds = binding.world.shutdownIdleSeconds

  if (worldId) {
    env.WORLD_ID = worldId
    appliedKeys.push('WORLD_ID')
  }

  if (!hasValue(env.WORLD) && (worldSlug || worldId)) {
    env.WORLD = buildHostedWorldRelativePath({ worldSlug, worldId })
    appliedKeys.push('WORLD')
  }

  if (dbSchema) {
    env.DB_SCHEMA = dbSchema
    appliedKeys.push('DB_SCHEMA')
  }

  if (publicMaxUploadSize !== null) {
    env.PUBLIC_MAX_UPLOAD_SIZE = String(publicMaxUploadSize)
    appliedKeys.push('PUBLIC_MAX_UPLOAD_SIZE')
  }

  if (publicWorldMaxPlayers !== null) {
    env.PUBLIC_WORLD_MAX_PLAYERS = String(publicWorldMaxPlayers)
    appliedKeys.push('PUBLIC_WORLD_MAX_PLAYERS')
  }

  if (shutdownIdleSeconds !== null) {
    env.SHUTDOWN_IDLE = String(shutdownIdleSeconds)
    appliedKeys.push('SHUTDOWN_IDLE')
  }

  if (runtimeApiUrl) {
    env.PUBLIC_API_URL = runtimeApiUrl
    appliedKeys.push('PUBLIC_API_URL')
  }

  if (runtimeWsUrl && runtimeWsUrl.startsWith('ws')) {
    env.PUBLIC_WS_URL = runtimeWsUrl
    appliedKeys.push('PUBLIC_WS_URL')
  }

  if (runtimeAdminUrl) {
    env.PUBLIC_ADMIN_URL = runtimeAdminUrl
    appliedKeys.push('PUBLIC_ADMIN_URL')
  }

  if (authUrl) {
    env.PUBLIC_AUTH_URL = authUrl
    appliedKeys.push('PUBLIC_AUTH_URL')
  }

  if (privyAppId) {
    env.PUBLIC_PRIVY_APP_ID = privyAppId
    appliedKeys.push('PUBLIC_PRIVY_APP_ID')
  }

  if (controlInternalBaseUrl) {
    env.CONTROL_INTERNAL_BASE_URL = controlInternalBaseUrl
    appliedKeys.push('CONTROL_INTERNAL_BASE_URL')
  }

  return appliedKeys
}

export function resolveRuntimeWorldDir(env = process.env, cwd = process.cwd()) {
  const worldPath = hasValue(env.WORLD)
    ? normalizeString(env.WORLD)
    : buildHostedWorldRelativePath({
        worldSlug: normalizeString(env.WORLD),
        worldId: normalizeString(env.WORLD_ID),
      })
  return path.resolve(cwd, worldPath)
}
