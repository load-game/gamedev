import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const RUNTIME_SESSION_TYP = 'runtime_session'
const RUNTIME_SESSION_AUDIENCE = 'runtime:ws'
const IDENTITY_EXCHANGE_TYP = 'identity_exchange'
const IDENTITY_EXCHANGE_AUDIENCE = 'runtime:exchange'
const DEFAULT_RUNTIME_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const DEFAULT_VERIFY_TIMEOUT_MS = 5000

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeSecret(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeWorldId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\/+$/, '')
}

function resolveRuntimeSessionIssuer(env = process.env) {
  const fromPublicApi = env.PUBLIC_API_URL?.trim()
  if (fromPublicApi) return fromPublicApi.replace(/\/api\/?$/, '')
  const fromPublicWs = env.PUBLIC_WS_URL?.trim()
  if (fromPublicWs) {
    return fromPublicWs
      .replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace(/\/ws\/?$/, '')
  }
  const fromRuntimeAuth = env.RUNTIME_AUTH_URL?.trim()
  if (fromRuntimeAuth) return fromRuntimeAuth
  const fromPublicAuth = env.PUBLIC_AUTH_URL?.trim()
  if (fromPublicAuth) return fromPublicAuth
  return 'runtime'
}

function resolveExternalIdentityIssuer(env = process.env) {
  const fromRuntimeAuth = env.RUNTIME_AUTH_URL?.trim()
  if (fromRuntimeAuth) return fromRuntimeAuth
  const fromPublicAuth = env.PUBLIC_AUTH_URL?.trim()
  if (fromPublicAuth) return fromPublicAuth
  return null
}

function resolveRuntimeControlBaseUrl(env = process.env) {
  const runtimeControl = normalizeBaseUrl(env.RUNTIME_CONTROL_URL)
  if (runtimeControl) return runtimeControl

  const legacyControl = normalizeBaseUrl(env.CONTROL_INTERNAL_BASE_URL)
  if (legacyControl) return legacyControl

  const legacyPublicAuthUrl = normalizeBaseUrl(env.PUBLIC_AUTH_URL)
  if (!legacyPublicAuthUrl) return null

  try {
    const url = new URL(legacyPublicAuthUrl)
    let basePath = url.pathname.replace(/\/+$/, '')
    basePath = basePath.replace(/\/identity$/, '')
    url.pathname = basePath || '/'
    url.search = ''
    url.hash = ''
    return normalizeBaseUrl(url.toString()) || null
  } catch {
    return null
  }
}

function resolveExternalIdentityVerifyUrl(verifyUrl, controlBaseUrl, env = process.env) {
  const explicit = typeof verifyUrl === 'string' ? verifyUrl.trim() : ''
  if (explicit) return explicit

  const controlBase = normalizeBaseUrl(controlBaseUrl) || resolveRuntimeControlBaseUrl(env)
  if (controlBase) {
    return `${controlBase}/identity/exchange/verify`
  }

  const runtimeAuthUrl = normalizeBaseUrl(env.RUNTIME_AUTH_URL)
  if (runtimeAuthUrl) return `${runtimeAuthUrl}/exchange/verify`

  const legacyPublicAuthUrl = normalizeBaseUrl(env.PUBLIC_AUTH_URL)
  if (!legacyPublicAuthUrl) return null

  return `${legacyPublicAuthUrl}/exchange/verify`
}

export function createJWT(data, { worldId, env = process.env } = {}) {
  const userId = typeof data?.userId === 'string' ? data.userId.trim() : ''
  if (!userId) {
    return Promise.reject(new Error('createJWT requires userId'))
  }
  const jwtSecret = env.JWT_SECRET
  const runtimeSessionTtlSeconds = parsePositiveInt(
    env.RUNTIME_SESSION_TTL_SECONDS,
    DEFAULT_RUNTIME_SESSION_TTL_SECONDS
  )
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    typ: RUNTIME_SESSION_TYP,
    iss: resolveRuntimeSessionIssuer(env),
    aud: RUNTIME_SESSION_AUDIENCE,
    userId,
    worldId: worldId || data?.worldId || env.WORLD_ID || null,
    iat: now,
    exp: now + runtimeSessionTtlSeconds,
  }
  return new Promise((resolve, reject) => {
    jwt.sign(payload, jwtSecret, (err, token) => {
      if (err) return reject(err)
      resolve(token)
    })
  })
}

export function readJWT(token, { worldId, env = process.env } = {}) {
  return new Promise(resolve => {
    const issuer = resolveRuntimeSessionIssuer(env)
    jwt.verify(
      token,
      env.JWT_SECRET,
      {
        audience: RUNTIME_SESSION_AUDIENCE,
        ...(issuer ? { issuer } : {}),
      },
      (err, data) => {
        if (err || !data || typeof data !== 'object') {
          resolve(null)
          return
        }
        if (data.typ !== RUNTIME_SESSION_TYP) {
          resolve(null)
          return
        }
        if (typeof data.userId !== 'string' || !data.userId.trim()) {
          resolve(null)
          return
        }
        if (worldId && data.worldId !== worldId) {
          resolve(null)
          return
        }
        resolve(data)
      }
    )
  })
}

export function buildRuntimeControlAuthorization({ worldId, jwtSecret, env = process.env } = {}) {
  const normalizedWorldId = normalizeWorldId(worldId || env.WORLD_ID)
  const normalizedJwtSecret = normalizeSecret(jwtSecret || env.JWT_SECRET)
  if (!normalizedWorldId || !normalizedJwtSecret) return null
  const token = crypto
    .createHmac('sha256', normalizedJwtSecret)
    .update(`runtime-internal:${normalizedWorldId}`)
    .digest('hex')
  return `Bearer ${token}`
}

export async function verifyExternalIdentityExchangeToken(
  token,
  { verifyUrl, controlBaseUrl, worldId, jwtSecret, authorization, timeoutMs, env = process.env } = {}
) {
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  const endpoint = resolveExternalIdentityVerifyUrl(verifyUrl, controlBaseUrl, env)
  if (!endpoint) {
    return { ok: false, reason: 'unreachable' }
  }
  const controlAuthorization =
    (typeof authorization === 'string' && authorization.trim()) ||
    buildRuntimeControlAuthorization({ worldId, jwtSecret, env })
  const resolvedTimeoutMs = parsePositiveInt(timeoutMs, DEFAULT_VERIFY_TIMEOUT_MS)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), resolvedTimeoutMs)
  try {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json',
    }
    if (controlAuthorization) {
      headers.authorization = controlAuthorization
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: token.trim() }),
      signal: controller.signal,
    })
    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 422) {
        return { ok: false, reason: 'invalid' }
      }
      return { ok: false, reason: 'unreachable' }
    }
    const payload = await response.json().catch(() => null)
    if (payload?.valid !== true || !payload?.claims || typeof payload.claims !== 'object') {
      return { ok: false, reason: 'unreachable' }
    }
    const claims = payload.claims
    if (claims.typ !== IDENTITY_EXCHANGE_TYP) return { ok: false, reason: 'invalid' }
    if (claims.aud !== IDENTITY_EXCHANGE_AUDIENCE) return { ok: false, reason: 'invalid' }
    if (typeof claims.userId !== 'string' || !claims.userId.trim()) return { ok: false, reason: 'invalid' }
    if (typeof claims.sub !== 'string' || claims.sub !== claims.userId) return { ok: false, reason: 'invalid' }
    const expectedIssuer = resolveExternalIdentityIssuer(env)
    if (expectedIssuer && claims.iss !== expectedIssuer) return { ok: false, reason: 'invalid' }
    return { ok: true, claims }
  } catch {
    return { ok: false, reason: 'unreachable' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const verifyIdentityExchangeTokenWithLobby = verifyExternalIdentityExchangeToken
