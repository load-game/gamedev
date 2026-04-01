import 'ses'
import '../core/lockdown'
import './bootstrap'

import fs from 'fs-extra'
import path from 'path'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { admin } from './admin'
import {
  buildCliAuthPage,
  createCliAuthSessionStore,
  createStandaloneGuestSession,
  getCliAuthTokenFromRequest,
  hasRequiredCliCapability,
  resolveCliAuthStatus,
} from './cliAuth.js'
import { createDeferredResource } from './deferredResource.js'
import { createAgonesPlayerTracker } from './agonesPlayerTracking.js'
import { createAgonesSdkHttp } from './agonesSdkHttp.js'
import { createAgonesIdleController, resolveAgonesIdleShutdownTimeoutMs } from './agonesIdleShutdown.js'
import { createRegistryState, getRegistryPublicStatus, registerWithRegistry } from './registry'
import { describeWebSocketConnection, resolveWebSocketConnection } from './websocketConnection.js'
import { resolveAuthRuntimeConfig } from './authModes'
import { completeRuntimeStartup } from './runtimeStartup.js'
import {
  applyHostedRuntimeBootstrapPayload,
  buildRuntimeBootstrapId,
  clearBootstrapRuntimeBindingEnv,
  derivePublicAdminUrl,
  derivePublicWsUrlFromApiUrl,
  hasSupportedAdminCode,
  hasValue,
  parseRuntimeBootstrapPayload,
  resolveControlInternalBaseUrl,
  resolveControlInternalUrl,
  resolveRuntimeBootstrapInstanceId,
  resolveRuntimeWorldDir,
  serializeRuntimeBootstrapBinding,
  usesLegacyControlPlaneBaseUrl,
  verifyRuntimeBootstrapAuthorization,
  usesHostedRuntimeBootstrap,
} from './runtimeBootstrap.js'
import { buildRuntimeControlAuthorization, createJWT, verifyIdentityExchangeTokenWithLobby } from '../core/utils-server'
import { Ranks } from '../core/extras/ranks'

const rootDir = path.join(__dirname, '../')
const publicDir = path.join(__dirname, 'public')
const adminHtmlPath = path.join(publicDir, 'admin.html')
const MIME_TYPES = {
  '.aac': 'audio/aac',
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'image/vnd.radiance',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ktx2': 'image/ktx2',
  '.m4a': 'audio/mp4',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.spz': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.vrm': 'model/gltf-binary',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

function formatUserName(name) {
  if (!name || name.startsWith('anon_')) return 'Anonymous'
  return name
}

function formatErrorMessage(err) {
  if (err instanceof Error) return err.message
  return String(err)
}

function nowIso() {
  return new Date().toISOString()
}

function isTruthyEnvFlag(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function logRuntimeEvent(level, event, state, extra = {}) {
  const payload = {
    component: 'runtime',
    event,
    mode: usesHostedRuntimeBootstrap(process.env) ? 'bootstrap' : 'direct',
    state: state?.lifecycle?.state || null,
    bootstrapId:
      extra.bootstrapId !== undefined
        ? extra.bootstrapId || null
        : state?.lifecycle?.bootstrapId || null,
    runtimeInstanceId: state?.lifecycle?.runtimeInstanceId || null,
    worldId:
      extra.worldId !== undefined
        ? extra.worldId || null
        : state?.lifecycle?.worldId || process.env.WORLD_ID || null,
    worldSlug:
      extra.worldSlug !== undefined
        ? extra.worldSlug || null
        : state?.lifecycle?.worldSlug || null,
    source:
      extra.source !== undefined
        ? extra.source || null
        : state?.lifecycle?.source || null,
    timestamp: nowIso(),
  }

  if (extra.error !== undefined) {
    payload.error = formatErrorMessage(extra.error)
    if (extra.error instanceof Error && extra.error.stack) {
      payload.errorStack = extra.error.stack
    }
  }

  for (const [key, value] of Object.entries(extra)) {
    if (key === 'error' || value === undefined) continue
    payload[key] = value
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload))
    return
  }
  if (level === 'error') {
    console.error(JSON.stringify(payload))
    return
  }
  console.info(JSON.stringify(payload))
}

function logRuntimeBootstrapDebug(state, event, extra = {}) {
  if (!runtimeBootstrapDebugEnabled) return
  logRuntimeEvent('info', event, state, {
    debug: true,
    ...extra,
  })
}

function resolveDocsRoot() {
  const candidates = [
    path.join(process.cwd(), 'docs'),
    path.join(process.cwd(), 'build', 'docs'),
    path.join(process.cwd(), 'public', 'docs'),
    path.join(rootDir, 'docs'),
  ]
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue
      const stats = fs.statSync(candidate)
      if (stats.isDirectory()) return candidate
    } catch {
      // continue searching other paths
    }
  }
  return null
}

function listDocsFiles(dir, baseDir, output) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listDocsFiles(fullPath, baseDir, output)
      continue
    }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (ext !== '.md' && ext !== '.mdx') continue
    const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/')
    output.push(`docs/${relPath}`)
  }
}

function getDocsIndex() {
  const root = resolveDocsRoot()
  if (!root) return []
  const files = []
  try {
    listDocsFiles(root, root, files)
  } catch {
    return []
  }
  files.sort((a, b) => a.localeCompare(b))
  return files
}

function resolveBoundWorldId() {
  return runtimeState.resources.world?.network?.worldId || runtimeState.lifecycle.worldId || process.env.WORLD_ID || null
}

function resolveRuntimeControlAuthorization(worldId = resolveBoundWorldId()) {
  return buildRuntimeControlAuthorization({
    worldId,
    jwtSecret: process.env.JWT_SECRET,
  })
}

function resolveLobbyInternalUserUrl(userId) {
  if (!hasValue(userId)) return null
  return resolveControlInternalUrl(`/internal/users/${encodeURIComponent(userId.trim())}`, process.env)
}

function mapLobbyRoleToRank(role) {
  if (role === 'admin') return Ranks.ADMIN
  if (role === 'builder') return Ranks.BUILDER
  return Ranks.VISITOR
}

function parseStoredUserRank(value) {
  const rank = Number(value)
  return Number.isFinite(rank) ? rank : Ranks.VISITOR
}

async function resolveLobbyRoleRank(userId, { worldId = resolveBoundWorldId() } = {}) {
  const endpoint = resolveLobbyInternalUserUrl(userId)
  const authorization = resolveRuntimeControlAuthorization(worldId)
  if (!endpoint || !authorization) return Ranks.VISITOR

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization,
      },
      signal: controller.signal,
    })
    if (!response.ok) return Ranks.VISITOR
    const payload = await response.json().catch(() => null)
    const role = typeof payload?.role === 'string' ? payload.role.trim() : ''
    return mapLobbyRoleToRank(role)
  } catch {
    return Ranks.VISITOR
  } finally {
    clearTimeout(timeoutId)
  }
}

async function resolveAuthenticatedUserRank(userId, db, authConfig, { worldId = resolveBoundWorldId() } = {}) {
  if (!db || !userId) return Ranks.VISITOR
  if (authConfig?.usesControlPlaneRank) {
    return resolveLobbyRoleRank(userId, { worldId })
  }

  const existingUser = await db('users').where('id', userId).first('rank')
  return parseStoredUserRank(existingUser?.rank)
}

function isPostgresDbEnv(env = process.env) {
  return env.DB_URI?.startsWith('postgres://') || env.DB_URI?.startsWith('postgresql://')
}

function createNoopAgonesIdleController() {
  return {
    clearIdleShutdownTimer() {},
    reconcileIdleShutdown() {},
    requestAgonesShutdown() {},
  }
}

function createNoopAgonesPlayerTracker() {
  return {
    enabled: false,
    publishCapacity: async () => false,
    start: () => false,
    stop() {},
  }
}

function validateStaticRuntimeEnv(env = process.env) {
  if (!hasValue(env.PORT)) {
    throw new Error('[envs] PORT not set')
  }
  if (!hasValue(env.JWT_SECRET)) {
    throw new Error('[envs] JWT_SECRET not set')
  }
  if (!hasValue(env.ASSETS)) {
    throw new Error(`[envs] ASSETS must be set to 'local' or 's3'`)
  }
  if (!hasValue(env.ASSETS_BASE_URL)) {
    throw new Error('[envs] ASSETS_BASE_URL must be set')
  }
  if (env.ASSETS === 's3' && !hasValue(env.ASSETS_S3_URI)) {
    throw new Error('[envs] ASSETS_S3_URI must be set when using ASSETS=s3')
  }
}

let warnedAboutMissingAdminCode = false
let warnedAboutLegacyControlPlaneBaseUrl = false

function warnIfRuntimeUsesLegacyControlPlaneBaseUrl(env = process.env) {
  if (warnedAboutLegacyControlPlaneBaseUrl) return
  if (!usesLegacyControlPlaneBaseUrl(env)) return
  warnedAboutLegacyControlPlaneBaseUrl = true
  console.warn('[startup] CONTROL_INTERNAL_BASE_URL not set; deriving control callbacks from PUBLIC_AUTH_URL (legacy)')
}

function warnIfAdminCodeUnset(env = process.env) {
  if (warnedAboutMissingAdminCode) return
  if (usesHostedRuntimeBootstrap(env)) return
  if (hasValue(env.ADMIN_CODE)) return
  warnedAboutMissingAdminCode = true
  console.warn('[envs] ADMIN_CODE not set - admin privileges are open to all players')
}

function finalizeBoundRuntimeEnv(env = process.env) {
  if (!hasValue(env.WORLD_ID)) {
    throw new Error('[envs] WORLD_ID not set')
  }

  if (isPostgresDbEnv(env) && usesHostedRuntimeBootstrap(env) && !hasValue(env.DB_SCHEMA)) {
    throw new Error('[envs] DB_SCHEMA must be resolved for hosted postgres runtimes')
  }

  if (!hasValue(env.PUBLIC_API_URL)) {
    throw new Error('[envs] PUBLIC_API_URL must be set')
  }

  if (hasValue(env.PUBLIC_WS_URL)) {
    if (!String(env.PUBLIC_WS_URL).startsWith('ws')) {
      throw new Error('[envs] PUBLIC_WS_URL must start with ws:// or wss://')
    }
  } else {
    const derivedPublicWsUrl = derivePublicWsUrlFromApiUrl(env.PUBLIC_API_URL)
    if (!derivedPublicWsUrl) {
      throw new Error('[envs] PUBLIC_WS_URL could not be derived from PUBLIC_API_URL')
    }
    env.PUBLIC_WS_URL = derivedPublicWsUrl
  }

  if (!hasValue(env.PUBLIC_ADMIN_URL)) {
    const derivedPublicAdminUrl = derivePublicAdminUrl({
      publicApiUrl: env.PUBLIC_API_URL,
      publicWsUrl: env.PUBLIC_WS_URL,
    })
    if (derivedPublicAdminUrl) {
      env.PUBLIC_ADMIN_URL = derivedPublicAdminUrl
    }
  }

  warnIfAdminCodeUnset(env)
  warnIfRuntimeUsesLegacyControlPlaneBaseUrl(env)

  return {
    authConfig: resolveAuthRuntimeConfig(env),
    worldDir: resolveRuntimeWorldDir(env),
  }
}

function validateStandbyRuntimeEnv(env = process.env) {
  const runtimeInstanceId = resolveRuntimeBootstrapInstanceId(env)
  if (!runtimeInstanceId) {
    throw new Error('[envs] RUNTIME_BOOTSTRAP_INSTANCE_ID not set')
  }
}

function applyEnvSnapshot(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) continue
    process.env[key] = value
  }
}

function normalizeRequestedAssetPath(value) {
  if (typeof value !== 'string') return ''
  return path.posix.normalize(`/${value}`).replace(/^\/+/, '')
}

function resolveContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function isRuntimeReady(state) {
  return state.lifecycle.state === 'ready' && !!state.resources.world
}

function sendRuntimeNotReady(reply, state, { html = false } = {}) {
  reply.header('Retry-After', '1')
  if (html) {
    return reply
      .code(503)
      .type('text/html')
      .send(
        '<!doctype html><html><head><meta charset="utf-8"/><title>Runtime starting</title></head><body>Runtime bootstrap has not completed yet. Retry in a moment.</body></html>'
      )
  }
  return reply.code(503).send({
    error: 'runtime_not_ready',
    state: state.lifecycle.state,
    retryable: true,
  })
}

function buildPublicEnvsCode() {
  const publicEnvs = {}
  for (const key in process.env) {
    if (!key.startsWith('PUBLIC_')) continue
    publicEnvs[key] = process.env[key]
  }
  return `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`
}

function buildBootstrapStatusPayload(state) {
  return {
    state: state.lifecycle.state,
    bootstrapId: state.lifecycle.bootstrapId || null,
    startedAt: state.lifecycle.startedAt,
    boundAt: state.lifecycle.boundAt,
    readyAt: state.lifecycle.readyAt,
    failedAt: state.lifecycle.failedAt,
    updatedAt: state.lifecycle.updatedAt,
    error: state.lifecycle.error,
    world: {
      id: state.lifecycle.worldId || process.env.WORLD_ID || null,
      slug: state.lifecycle.worldSlug || null,
      dbSchema: process.env.DB_SCHEMA || null,
    },
    runtime: {
      instanceId: state.lifecycle.runtimeInstanceId,
      publicApiUrl: process.env.PUBLIC_API_URL || null,
      publicWsUrl: process.env.PUBLIC_WS_URL || null,
      publicAdminUrl: process.env.PUBLIC_ADMIN_URL || null,
    },
    auth: {
      publicAuthUrl: process.env.PUBLIC_AUTH_URL || null,
      publicPrivyAppId: process.env.PUBLIC_PRIVY_APP_ID || null,
    },
    control: {
      internalBaseUrl: resolveControlInternalBaseUrl(process.env),
    },
  }
}

function buildRuntimeStatusPayload(state) {
  const payload = {
    ok: isRuntimeReady(state),
    state: state.lifecycle.state,
    worldId: state.resources.world?.network?.worldId || process.env.WORLD_ID || null,
    commitHash: process.env.COMMIT_HASH || null,
    listable: !!state.registryState?.listable,
    updatedAt: nowIso(),
  }

  if (isRuntimeReady(state)) {
    const world = state.resources.world
    payload.title = world.settings.title || 'World'
    payload.description = world.settings.desc || ''
    payload.imageUrl = world.resolveURL(world.settings.image?.url) || null
    payload.playerCount = world?.network?.sockets?.size || 0
    payload.playerLimit = world.settings.playerLimit ?? null
  }

  const registry = getRegistryPublicStatus(state.registryState)
  if (registry) payload.registry = registry

  return payload
}

function setRuntimeLifecycleState(state, nextState, extra = {}) {
  state.lifecycle.state = nextState
  state.lifecycle.updatedAt = nowIso()

  if (extra.bootstrapId !== undefined) state.lifecycle.bootstrapId = extra.bootstrapId || null
  if (extra.binding !== undefined) {
    state.lifecycle.binding = extra.binding ? parseRuntimeBootstrapPayload(extra.binding) : null
    state.lifecycle.bindingKey = state.lifecycle.binding ? serializeRuntimeBootstrapBinding(state.lifecycle.binding) : null
  }
  if (extra.worldId !== undefined) state.lifecycle.worldId = extra.worldId || null
  if (extra.worldSlug !== undefined) state.lifecycle.worldSlug = extra.worldSlug || null
  if (extra.source !== undefined) state.lifecycle.source = extra.source || null

  if (nextState === 'standby') {
    state.lifecycle.boundAt = null
    state.lifecycle.binding = null
    state.lifecycle.bindingKey = null
    state.lifecycle.readyAt = null
    state.lifecycle.failedAt = null
    state.lifecycle.error = null
    logRuntimeEvent('info', 'standby', state)
    return
  }

  if (nextState === 'bootstrapping') {
    state.lifecycle.boundAt = state.lifecycle.updatedAt
    state.lifecycle.readyAt = null
    state.lifecycle.failedAt = null
    state.lifecycle.error = null
    logRuntimeEvent('info', 'bootstrap_start', state)
    return
  }

  if (nextState === 'ready') {
    state.lifecycle.readyAt = state.lifecycle.updatedAt
    state.lifecycle.failedAt = null
    state.lifecycle.error = null
    logRuntimeEvent('info', 'bootstrap_success', state)
    return
  }

  if (nextState === 'failed') {
    state.lifecycle.failedAt = state.lifecycle.updatedAt
    state.lifecycle.error = {
      message: formatErrorMessage(extra.error),
    }
    logRuntimeEvent('error', 'bootstrap_failed', state, {
      error: extra.error,
    })
  }
}

function loadClientHtmlTemplate(cache) {
  const candidates = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(process.cwd(), 'src/client/public/index.html'),
  ]
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue
      const html = fs.readFileSync(candidate, 'utf-8')
      if (!html) continue
      cache.value = html
      return html
    } catch {
      // continue trying other candidates
    }
  }
  if (cache.value) return cache.value
  return '<!doctype html><html><head><meta charset="utf-8"/><title>Loading...</title></head><body>Rebuilding client bundle, refresh in a moment.</body></html>'
}

function renderClientHtml(reply, state, cache) {
  if (!isRuntimeReady(state)) {
    return sendRuntimeNotReady(reply, state, { html: true })
  }

  const world = state.resources.world
  const title = world.settings.title || 'World'
  const desc = world.settings.desc || ''
  const image = world.resolveURL(world.settings.image?.url) || ''
  const url = process.env.ASSETS_BASE_URL || ''
  let html = loadClientHtmlTemplate(cache)
  html = html.replaceAll('{url}', url)
  html = html.replaceAll('{title}', title)
  html = html.replaceAll('{desc}', desc)
  html = html.replaceAll('{image}', image)
  html = html.replaceAll('{jsPath}', '/index.js')
  html = html.replaceAll('{particlesPath}', '/particles.js')
  html = html.replaceAll('{buildId}', Date.now())
  reply.type('text/html').send(html)
}

function buildRuntimeState({ initialBinding = null, initialSource = null } = {}) {
  const hasInitialWorldBinding = hasValue(process.env.WORLD_ID)
  const runtimeInstanceId = resolveRuntimeBootstrapInstanceId(process.env)
  const binding = initialBinding ? parseRuntimeBootstrapPayload(initialBinding, { runtimeInstanceId }) : null
  const bootstrapId = buildRuntimeBootstrapId({
    worldId: binding?.world?.id || process.env.WORLD_ID,
    runtimeInstanceId,
  })

  return {
    lifecycle: {
      state: hasInitialWorldBinding ? 'bootstrapping' : 'standby',
      bootstrapId: bootstrapId || null,
      source: hasInitialWorldBinding ? initialSource || 'startup' : null,
      startedAt: nowIso(),
      boundAt: hasInitialWorldBinding ? nowIso() : null,
      readyAt: null,
      failedAt: null,
      updatedAt: nowIso(),
      error: null,
      binding,
      bindingKey: binding ? serializeRuntimeBootstrapBinding(binding) : null,
      runtimeInstanceId,
      worldId: binding?.world?.id || process.env.WORLD_ID || null,
      worldSlug: binding?.world?.slug || null,
    },
    initializationPromise: null,
    registryState: createRegistryState(process.env),
    auth: {
      cliAuthSessions: createCliAuthSessionStore(),
    },
    resources: {
      assets: null,
      db: null,
      storage: null,
      world: null,
      worldDir: null,
      agones: null,
      agonesPlayerTracker: createNoopAgonesPlayerTracker(),
      agonesIdleController: createNoopAgonesIdleController(),
    },
  }
}

validateStaticRuntimeEnv(process.env)

const bootstrapRuntimeEnabled = usesHostedRuntimeBootstrap(process.env)
const runtimeBootstrapDebugEnabled = isTruthyEnvFlag(process.env.RUNTIME_BOOTSTRAP_DEBUG)
if (bootstrapRuntimeEnabled) {
  process.env.RUNTIME_BOOTSTRAP = '1'
  clearBootstrapRuntimeBindingEnv(process.env)
  validateStandbyRuntimeEnv(process.env)
} else {
  finalizeBoundRuntimeEnv(process.env)
}

const runtimeState = buildRuntimeState()

if (runtimeState.lifecycle.state === 'standby' && hasValue(process.env.AGONES_SDK_HTTP_PORT)) {
  const standbyAgones = createAgonesSdkHttp({ env: process.env })
  if (standbyAgones && typeof standbyAgones.ready === 'function') {
    void (async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          await standbyAgones.ready()
          console.info('[agones] requested Agones Ready')
          return
        } catch (err) {
          if (attempt === 9) {
            const message = err instanceof Error ? err.message : String(err)
            console.warn(`[agones] failed to request Agones Ready (${message})`)
            return
          }
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    })()
  }
}

if (runtimeState.lifecycle.state === 'standby') {
  logRuntimeEvent('info', 'standby', runtimeState)
}
if (runtimeState.lifecycle.state === 'bootstrapping') {
  logRuntimeEvent('info', 'bootstrap_start', runtimeState)
}
const clientHtmlTemplateCache = { value: null }
const adminConnectionCounts = {
  main: 0,
  wss: 0,
}
const { proxy: worldProxy, flushPendingCalls: flushWorldProxyCalls } = createDeferredResource(
  () => runtimeState.resources.world,
  { queueMethods: ['on', 'once', 'addListener'] }
)
const { proxy: assetsProxy } = createDeferredResource(() => runtimeState.resources.assets)

function getAdminConnectionCount() {
  return adminConnectionCounts.main + adminConnectionCounts.wss
}

function getActiveSessionCount() {
  return (runtimeState.resources.world?.network?.sockets?.size || 0) + getAdminConnectionCount()
}

function updateAdminConnectionCount(channel, count) {
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (adminConnectionCounts[channel] === normalized) return
  adminConnectionCounts[channel] = normalized
  runtimeState.resources.agonesIdleController.reconcileIdleShutdown(`admin_${channel}`)
}

function configureAgonesIntegration(world) {
  const agones = createAgonesSdkHttp({ env: process.env })
  const idleTimeoutMs = resolveAgonesIdleShutdownTimeoutMs(process.env)
  const agonesIdleControllerEnabled = !!agones && idleTimeoutMs > 0
  const agonesIdleController = createAgonesIdleController({
    enabled: agonesIdleControllerEnabled,
    timeoutMs: idleTimeoutMs,
    agones,
    getActiveSessionCount,
    beforeShutdown: async () => {
      await world.network.save()
    },
  })
  const agonesPlayerTracker = createAgonesPlayerTracker({
    agones,
    world,
    env: process.env,
  })
  agonesPlayerTracker.start()

  runtimeState.resources.agones = agones
  runtimeState.resources.agonesPlayerTracker = agonesPlayerTracker
  runtimeState.resources.agonesIdleController = agonesIdleController

  if (agonesIdleControllerEnabled) {
    world.network.on('playerJoined', () => {
      runtimeState.resources.agonesIdleController.reconcileIdleShutdown('player_joined')
    })
    world.network.on('playerLeft', () => {
      runtimeState.resources.agonesIdleController.reconcileIdleShutdown('player_left')
    })
  }

  return {
    agones,
    agonesIdleController,
    agonesIdleControllerEnabled,
    agonesPlayerTracker,
    idleTimeoutMs,
  }
}

async function initializeRuntime({ source, binding = null } = {}) {
  if (isRuntimeReady(runtimeState)) {
    return runtimeState.resources.world
  }
  if (runtimeState.initializationPromise) {
    return runtimeState.initializationPromise
  }

  const startedAt = Date.now()
  let stage = 'resolve_env'
  runtimeState.initializationPromise = (async () => {
    const { authConfig, worldDir } = finalizeBoundRuntimeEnv(process.env)
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_runtime_initialize_start', {
      bootstrapId:
        binding?.bootstrapId
        || runtimeState.lifecycle.bootstrapId
        || buildRuntimeBootstrapId({
          worldId: process.env.WORLD_ID,
          runtimeInstanceId: runtimeState.lifecycle.runtimeInstanceId,
        }),
      source,
      stage,
      worldDir,
    })

    stage = 'load_runtime_modules'
    const [
      { assets },
      { cleaner },
      { getDB },
      { Storage },
      { createServerWorld },
    ] = await Promise.all([
      import('./assets.js'),
      import('./cleaner.js'),
      import('./db.js'),
      import('./Storage.js'),
      import('../core/createServerWorld.js'),
    ])
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_runtime_modules_ready', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
    })

    stage = 'assets_init'
    await fs.ensureDir(worldDir)
    const assetsInitStartedAt = Date.now()
    await assets.init({ rootDir, worldDir })
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_assets_init_complete', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      stepDurationMs: Date.now() - assetsInitStartedAt,
      worldDir,
    })

    stage = 'get_db'
    const getDbStartedAt = Date.now()
    const db = await getDB({ worldDir })
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_get_db_complete', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      stepDurationMs: Date.now() - getDbStartedAt,
      worldDir,
    })

    stage = 'cleaner_init'
    const cleanerInitStartedAt = Date.now()
    await cleaner.init({ db })
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_cleaner_init_complete', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      stepDurationMs: Date.now() - cleanerInitStartedAt,
      worldDir,
    })

    stage = 'storage_init'
    const storage = new Storage(db)
    const storageInitStartedAt = Date.now()
    await storage.init()
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_storage_init_complete', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      stepDurationMs: Date.now() - storageInitStartedAt,
      worldDir,
    })

    stage = 'prepare_storage'
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_runtime_storage_ready', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      worldDir,
    })

    stage = 'init_world'
    const world = createServerWorld()
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_world_init_start', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      worldDir,
    })
    await world.init({
      assetsDir: assets.dir,
      assetsUrl: assets.url,
      db,
      assets,
      storage,
      authConfig,
    })
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_world_init_complete', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      worldId: world?.network?.worldId || process.env.WORLD_ID || null,
      worldSlug: binding?.world?.slug || runtimeState.lifecycle.worldSlug,
    })

    runtimeState.resources.assets = assets
    runtimeState.resources.db = db
    runtimeState.resources.storage = storage
    runtimeState.resources.world = world
    runtimeState.resources.worldDir = worldDir
    runtimeState.registryState = createRegistryState(process.env)

    flushWorldProxyCalls()
    const agonesIntegration = configureAgonesIntegration(world)

    stage = 'complete_runtime_startup'
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_runtime_startup_finalize_start', {
      durationMs: Date.now() - startedAt,
      source,
      stage,
      worldId: world?.network?.worldId || process.env.WORLD_ID || null,
    })
    await completeRuntimeStartup({
      agones: agonesIntegration.agones,
      agonesIdleController: agonesIntegration.agonesIdleController,
      agonesIdleControllerEnabled: agonesIntegration.agonesIdleControllerEnabled,
      idleTimeoutMs: agonesIntegration.idleTimeoutMs,
      requestAgonesReady: source !== 'bootstrap',
      registryState: runtimeState.registryState,
      worldId: world?.network?.worldId || process.env.WORLD_ID || null,
      commitHash: process.env.COMMIT_HASH || null,
      registerWithRegistryImpl: (registryState, payload) => {
        void registerWithRegistry(registryState, payload)
      },
    })
    logRuntimeBootstrapDebug(runtimeState, 'bootstrap_runtime_initialize_complete', {
      bootstrapId:
        binding?.bootstrapId
        || runtimeState.lifecycle.bootstrapId
        || buildRuntimeBootstrapId({
          worldId: process.env.WORLD_ID,
          runtimeInstanceId: runtimeState.lifecycle.runtimeInstanceId,
        }),
      durationMs: Date.now() - startedAt,
      source,
      stage,
      worldId: world?.network?.worldId || process.env.WORLD_ID || null,
      worldSlug: binding?.world?.slug || runtimeState.lifecycle.worldSlug,
      worldDir,
    })

    setRuntimeLifecycleState(runtimeState, 'ready', {
      bootstrapId:
        runtimeState.lifecycle.bootstrapId
        || buildRuntimeBootstrapId({
          worldId: process.env.WORLD_ID,
          runtimeInstanceId: runtimeState.lifecycle.runtimeInstanceId,
        }),
      source,
      worldId: world?.network?.worldId || process.env.WORLD_ID || null,
      worldSlug: binding?.world?.slug || runtimeState.lifecycle.worldSlug,
    })

    void agonesIntegration.agonesPlayerTracker.publishCapacity('startup')

    return world
  })()
    .catch(err => {
      logRuntimeBootstrapDebug(runtimeState, 'bootstrap_runtime_initialize_failed', {
        bootstrapId:
          binding?.bootstrapId
          || runtimeState.lifecycle.bootstrapId
          || buildRuntimeBootstrapId({
            worldId: process.env.WORLD_ID || runtimeState.lifecycle.worldId,
            runtimeInstanceId: runtimeState.lifecycle.runtimeInstanceId,
          }),
        durationMs: Date.now() - startedAt,
        error: err,
        source,
        stage,
        worldId: process.env.WORLD_ID || runtimeState.lifecycle.worldId || null,
        worldSlug: binding?.world?.slug || runtimeState.lifecycle.worldSlug,
      })
      runtimeState.resources.agonesIdleController.clearIdleShutdownTimer('bootstrap_failed')
      runtimeState.resources.agonesPlayerTracker.stop?.()
      setRuntimeLifecycleState(runtimeState, 'failed', {
        bootstrapId: runtimeState.lifecycle.bootstrapId,
        source,
        worldId: process.env.WORLD_ID || runtimeState.lifecycle.worldId,
        worldSlug: binding?.world?.slug || runtimeState.lifecycle.worldSlug,
        error: err,
      })
      throw err
    })
    .finally(() => {
      runtimeState.initializationPromise = null
    })

  return runtimeState.initializationPromise
}

async function handleAuthExchange(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }

  const authConfig = resolveAuthRuntimeConfig(process.env)
  if (!authConfig.usesLobbyIdentity) {
    return reply.code(404).send({ error: 'not_found' })
  }

  const identityToken = typeof req?.body?.token === 'string' ? req.body.token.trim() : ''
  if (!identityToken) {
    return reply.code(400).send({ error: 'invalid_payload', message: 'token is required' })
  }

  const boundWorldId = resolveBoundWorldId()
  const controlAuthorization = resolveRuntimeControlAuthorization(boundWorldId)
  const verification = await verifyIdentityExchangeTokenWithLobby(identityToken, {
    controlBaseUrl: resolveControlInternalBaseUrl(process.env),
    worldId: boundWorldId,
    jwtSecret: process.env.JWT_SECRET,
    authorization: controlAuthorization,
  })
  if (!verification?.ok) {
    if (verification?.reason === 'unreachable') {
      return reply.code(503).send({ error: 'identity_verifier_unreachable' })
    }
    return reply.code(401).send({ error: 'invalid_exchange_token' })
  }

  const claims = verification.claims
  const userId = typeof claims?.userId === 'string' ? claims.userId.trim() : ''
  if (!userId) {
    return reply.code(401).send({ error: 'invalid_exchange_token' })
  }

  const db = runtimeState.resources.db
  if (!db) {
    return sendRuntimeNotReady(reply, runtimeState)
  }

  const claimName = formatUserName(typeof claims?.name === 'string' ? claims.name.trim() : 'Anonymous')
  const avatar = typeof claims?.avatar === 'string' ? claims.avatar.trim() || null : null
  // Lobby identity does not imply control-plane rank authority. Only hosted runtimes
  // should rehydrate rank from world-service; self-hosted worlds keep their local rank.
  const rank = await resolveAuthenticatedUserRank(userId, db, authConfig, { worldId: boundWorldId })

  await db('users')
    .insert({
      id: userId,
      name: claimName,
      avatar,
      rank,
      createdAt: new Date().toISOString(),
    })
    .onConflict('id')
    .merge({
      name: claimName,
      avatar,
      rank,
    })

  const runtimeToken = await createJWT({ userId, worldId: process.env.WORLD_ID })
  return reply.code(200).send({
    token: runtimeToken,
    token_type: 'runtime_session',
    user: { id: userId, name: claimName, avatar },
  })
}

async function handleCliAuthPage(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState, { html: true })
  }
  const sessionId = typeof req.query?.session === 'string' ? req.query.session.trim() : ''
  const worldId = typeof req.query?.worldId === 'string' ? req.query.worldId.trim() : resolveBoundWorldId() || ''
  const requiredCapability = typeof req.query?.required === 'string' ? req.query.required.trim() : 'builder'
  if (!sessionId) {
    return reply.code(400).type('text/html').send(
      '<!doctype html><html><body>Missing session.</body></html>'
    )
  }
  reply.type('text/html').send(
    buildCliAuthPage({
      sessionId,
      worldId,
      requiredCapability,
      publicAuthUrl: process.env.PUBLIC_AUTH_URL || null,
    })
  )
}

async function handleCliAuthSessionCreate(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }
  const boundWorldId = resolveBoundWorldId()
  const requestedWorldId = typeof req?.body?.worldId === 'string' ? req.body.worldId.trim() : ''
  if (requestedWorldId && boundWorldId && requestedWorldId !== boundWorldId) {
    return reply.code(409).send({
      error: 'world_id_mismatch',
      expectedWorldId: boundWorldId,
      receivedWorldId: requestedWorldId,
    })
  }
  const requiredCapability =
    typeof req?.body?.requiredCapability === 'string' ? req.body.requiredCapability.trim() : 'builder'
  const session = runtimeState.auth.cliAuthSessions.createSession({
    worldId: boundWorldId || requestedWorldId || null,
    requiredCapability,
  })
  return reply.code(200).send(session)
}

async function handleCliAuthSessionStatus(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }
  const sessionId = typeof req.params?.sessionId === 'string' ? req.params.sessionId.trim() : ''
  const result = runtimeState.auth.cliAuthSessions.readSession(sessionId)
  if (!result.found || !result.session) {
    return reply.code(404).send({ error: 'not_found' })
  }
  return reply.code(200).send(result.session)
}

async function handleCliAuthSessionComplete(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }
  const sessionId = typeof req.params?.sessionId === 'string' ? req.params.sessionId.trim() : ''
  const existing = runtimeState.auth.cliAuthSessions.readSession(sessionId)
  if (!existing.found || !existing.session) {
    return reply.code(404).send({ error: 'not_found' })
  }

  const authToken = typeof req?.body?.authToken === 'string' ? req.body.authToken.trim() : ''
  const worldUrl = typeof req?.body?.worldUrl === 'string' ? req.body.worldUrl.trim() : ''
  if (!authToken) {
    return reply.code(400).send({ error: 'invalid_payload', message: 'authToken is required' })
  }

  const status = await resolveCliAuthStatus({
    authToken,
    db: runtimeState.resources.db,
    worldId: resolveBoundWorldId(),
    adminCode: process.env.ADMIN_CODE,
    adminCodeSupported: hasSupportedAdminCode(process.env),
  })
  if (!status.authenticated) {
    const code = status.error === 'db_unavailable' ? 503 : 401
    return reply.code(code).send({
      error: status.error,
      authenticated: false,
    })
  }
  if (!hasRequiredCliCapability(status.capabilities, existing.session.requiredCapability)) {
    return reply.code(409).send({
      error: 'capability_required',
      capabilities: status.capabilities,
      requiredCapability: existing.session.requiredCapability,
    })
  }

  const completed = runtimeState.auth.cliAuthSessions.completeSession(sessionId, {
    worldId: status.worldId || existing.session.worldId,
    worldUrl,
    authToken,
    user: status.user,
    capabilities: status.capabilities,
  })
  if (!completed.found || !completed.session) {
    return reply.code(404).send({ error: 'not_found' })
  }
  return reply.code(200).send({
    ok: true,
    status: completed.session.status,
    result: completed.session.result || null,
  })
}

async function handleCliAuthStatus(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }
  const worldId = resolveBoundWorldId()
  const status = await resolveCliAuthStatus({
    authToken: getCliAuthTokenFromRequest(req),
    db: runtimeState.resources.db,
    worldId,
    adminCode: process.env.ADMIN_CODE,
    adminCodeSupported: hasSupportedAdminCode(process.env),
  })
  if (!status.authenticated) {
    const code = status.error === 'db_unavailable' ? 503 : 401
    return reply.code(code).send({
      error: status.error,
      authenticated: false,
    })
  }
  return reply.code(200).send(status)
}

async function handleCliAuthGuest(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }
  const authConfig = resolveAuthRuntimeConfig(process.env)
  if (authConfig.usesLobbyIdentity) {
    return reply.code(404).send({ error: 'not_found' })
  }
  try {
    const session = await createStandaloneGuestSession({
      db: runtimeState.resources.db,
      worldId: resolveBoundWorldId(),
    })
    return reply.code(200).send(session)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'db_unavailable') {
      return reply.code(503).send({ error: 'db_unavailable' })
    }
    return reply.code(500).send({ error: 'guest_session_failed' })
  }
}

async function handleLocalAssetsRequest(req, reply) {
  if (!isRuntimeReady(runtimeState)) {
    return sendRuntimeNotReady(reply, runtimeState)
  }

  const assetsDir = runtimeState.resources.world?.assetsDir
  if (!assetsDir) {
    return reply.code(404).send()
  }

  const assetPath = normalizeRequestedAssetPath(req.params['*'])
  if (!assetPath) {
    return reply.code(404).send()
  }

  const resolvedRoot = path.resolve(assetsDir)
  const resolvedAssetPath = path.resolve(assetsDir, assetPath)
  if (resolvedAssetPath !== resolvedRoot && !resolvedAssetPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return reply.code(404).send()
  }

  let stats
  try {
    stats = await fs.stat(resolvedAssetPath)
  } catch {
    return reply.code(404).send()
  }
  if (!stats.isFile()) {
    return reply.code(404).send()
  }

  reply.type(resolveContentType(resolvedAssetPath))
  reply.header('Cache-Control', 'public, max-age=31536000, immutable')
  reply.header('Expires', new Date(Date.now() + 31536000000).toUTCString())
  return reply.send(fs.createReadStream(resolvedAssetPath))
}

async function handleBootstrapStatus(_req, reply) {
  reply.header('Cache-Control', 'no-store')
  return reply.code(200).send(buildBootstrapStatusPayload(runtimeState))
}

async function handleBootstrapRequest(req, reply) {
  reply.header('Cache-Control', 'no-store')

  if (!verifyRuntimeBootstrapAuthorization(req.headers.authorization, process.env)) {
    return reply.code(401).send({ error: 'invalid_bootstrap_auth' })
  }

  const binding = parseRuntimeBootstrapPayload(req.body)
  if (!binding.world.id) {
    return reply.code(400).send({
      error: 'invalid_payload',
      message: 'world.id is required',
    })
  }

  const expectedRuntimeInstanceId = resolveRuntimeBootstrapInstanceId(process.env)
  if (
    binding.runtime.instanceId
    && expectedRuntimeInstanceId
    && binding.runtime.instanceId !== expectedRuntimeInstanceId
  ) {
    return reply.code(409).send({
      error: 'runtime_instance_mismatch',
      expectedRuntimeInstanceId,
      receivedRuntimeInstanceId: binding.runtime.instanceId,
    })
  }

  const normalizedBinding = parseRuntimeBootstrapPayload(binding, {
    runtimeInstanceId: expectedRuntimeInstanceId,
  })
  logRuntimeBootstrapDebug(runtimeState, 'bootstrap_request_received', {
    bootstrapId: normalizedBinding.bootstrapId || null,
    runtimeInstanceId: normalizedBinding.runtime.instanceId || expectedRuntimeInstanceId || null,
    worldId: normalizedBinding.world.id,
    worldSlug: normalizedBinding.world.slug,
  })
  const normalizedBindingKey = serializeRuntimeBootstrapBinding(normalizedBinding)
  const existingBindingKey = runtimeState.lifecycle.bindingKey
  const existingBinding = runtimeState.lifecycle.binding
  const sameBinding = !!existingBindingKey && existingBindingKey === normalizedBindingKey

  if (existingBindingKey) {
    if (!sameBinding) {
      logRuntimeEvent('warn', 'rebind_rejected', runtimeState, {
        expectedBootstrapId: runtimeState.lifecycle.bootstrapId || existingBinding?.bootstrapId || null,
        receivedBootstrapId: normalizedBinding.bootstrapId || null,
      })
      return reply.code(409).send({
        error: 'rebind_rejected',
        status: buildBootstrapStatusPayload(runtimeState),
        expectedBootstrapId: runtimeState.lifecycle.bootstrapId || existingBinding?.bootstrapId || null,
        receivedBootstrapId: normalizedBinding.bootstrapId || null,
      })
    }

    if (runtimeState.lifecycle.state === 'bootstrapping') {
      try {
        await runtimeState.initializationPromise
      } catch (err) {
        return reply.code(500).send({
          error: 'bootstrap_failed',
          message: formatErrorMessage(err),
          status: buildBootstrapStatusPayload(runtimeState),
        })
      }
    }

    if (runtimeState.lifecycle.state === 'ready') {
      return reply.code(200).send({
        ok: true,
        idempotent: true,
        appliedKeys: [],
        status: buildBootstrapStatusPayload(runtimeState),
      })
    }
  }

  if (runtimeState.lifecycle.state === 'bootstrapping') {
    return reply.code(409).send({
      error: 'bootstrap_in_progress',
      status: buildBootstrapStatusPayload(runtimeState),
    })
  }

  if (runtimeState.lifecycle.state === 'ready') {
    return reply.code(409).send({
      error: 'runtime_already_ready',
      status: buildBootstrapStatusPayload(runtimeState),
    })
  }

  if (runtimeState.lifecycle.state === 'failed') {
    return reply.code(409).send({
      error: 'runtime_failed',
      status: buildBootstrapStatusPayload(runtimeState),
    })
  }

  const candidateEnv = { ...process.env }
  const appliedKeys = applyHostedRuntimeBootstrapPayload(candidateEnv, normalizedBinding)
  logRuntimeBootstrapDebug(runtimeState, 'bootstrap_binding_candidate_prepared', {
    appliedKeys,
    bootstrapId: normalizedBinding.bootstrapId || null,
    runtimeInstanceId: normalizedBinding.runtime.instanceId || expectedRuntimeInstanceId || null,
    worldId: normalizedBinding.world.id,
    worldSlug: normalizedBinding.world.slug,
  })

  try {
    finalizeBoundRuntimeEnv(candidateEnv)
  } catch (err) {
    return reply.code(400).send({
      error: 'invalid_payload',
      message: formatErrorMessage(err),
    })
  }

  applyEnvSnapshot(candidateEnv)
  setRuntimeLifecycleState(runtimeState, 'bootstrapping', {
    bootstrapId:
      normalizedBinding.bootstrapId
      || buildRuntimeBootstrapId({
        worldId: normalizedBinding.world.id,
        runtimeInstanceId: expectedRuntimeInstanceId || normalizedBinding.runtime.instanceId,
      }),
    binding: normalizedBinding,
    source: 'bootstrap',
    worldId: normalizedBinding.world.id,
    worldSlug: normalizedBinding.world.slug,
  })
  logRuntimeBootstrapDebug(runtimeState, 'bootstrap_binding_applied', {
    appliedKeys,
    bootstrapId: normalizedBinding.bootstrapId || null,
    runtimeInstanceId: normalizedBinding.runtime.instanceId || expectedRuntimeInstanceId || null,
    worldId: normalizedBinding.world.id,
    worldSlug: normalizedBinding.world.slug,
  })

  try {
    await initializeRuntime({ source: 'bootstrap', binding: normalizedBinding })
  } catch (err) {
    return reply.code(500).send({
      error: 'bootstrap_failed',
      message: formatErrorMessage(err),
      status: buildBootstrapStatusPayload(runtimeState),
    })
  }

  return reply.code(200).send({
    ok: true,
    appliedKeys,
    status: buildBootstrapStatusPayload(runtimeState),
  })
}

function registerCommonPlugins(app) {
  app.register(cors)
  app.register(compress)
  app.addHook('onRequest', async req => {
    if (req.url?.match(/\.spz(\?|$)/)) {
      req.headers['x-no-compression'] = 'true'
    }
  })
}

function registerCommonRoutes(app, { includeBootstrapControl = false, connectionChannel = 'main' } = {}) {
  registerCommonPlugins(app)

  app.get('/', async (_req, reply) => {
    renderClientHtml(reply, runtimeState, clientHtmlTemplateCache)
  })
  app.get('/worlds', async (_req, reply) => {
    renderClientHtml(reply, runtimeState, clientHtmlTemplateCache)
  })
  app.get('/worlds/*', async (_req, reply) => {
    renderClientHtml(reply, runtimeState, clientHtmlTemplateCache)
  })
  app.get('/auth/cli', handleCliAuthPage)
  app.get('/api/ai-docs-index', async (_req, reply) => {
    reply.send({ files: getDocsIndex() })
  })
  app.get('/assets/*', handleLocalAssetsRequest)
  app.register(statics, {
    root: publicDir,
    prefix: '/',
    decorateReply: false,
    setHeaders: res => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    },
  })
  app.register(multipart)

  app.get('/env.js', async (_req, reply) => {
    if (!isRuntimeReady(runtimeState)) {
      return sendRuntimeNotReady(reply, runtimeState)
    }
    reply.type('application/javascript').send(buildPublicEnvsCode())
  })

  app.post('/api/upload', async (_req, reply) => {
    if (!isRuntimeReady(runtimeState)) {
      return sendRuntimeNotReady(reply, runtimeState)
    }
    return reply.code(403).send({ error: 'admin_required', message: 'Use /admin/upload' })
  })

  app.get('/api/upload-check', async (_req, reply) => {
    if (!isRuntimeReady(runtimeState)) {
      return sendRuntimeNotReady(reply, runtimeState)
    }
    return reply.code(403).send({ error: 'admin_required', message: 'Use /admin/upload-check' })
  })

  app.post('/api/auth/exchange', handleAuthExchange)
  app.post('/api/auth/cli/session', handleCliAuthSessionCreate)
  app.get('/api/auth/cli/session/:sessionId', handleCliAuthSessionStatus)
  app.post('/api/auth/cli/session/:sessionId', handleCliAuthSessionComplete)
  app.get('/api/auth/cli/status', handleCliAuthStatus)
  app.post('/api/auth/cli/guest', handleCliAuthGuest)

  app.get('/healthz', async (_req, reply) => {
    const ok = runtimeState.lifecycle.state !== 'failed'
    return reply.code(ok ? 200 : 503).send({
      ok,
      state: runtimeState.lifecycle.state,
      timestamp: nowIso(),
      uptime: process.uptime(),
    })
  })

  app.get('/health', async (_req, reply) => {
    const ok = isRuntimeReady(runtimeState)
    return reply.code(ok ? 200 : 503).send({
      ok,
      state: runtimeState.lifecycle.state,
      timestamp: nowIso(),
      uptime: process.uptime(),
    })
  })

  app.get('/status', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store')
    const status = buildRuntimeStatusPayload(runtimeState)
    return reply.code(status.ok ? 200 : 503).send(status)
  })

  if (includeBootstrapControl) {
    app.post('/internal/bootstrap', handleBootstrapRequest)
    app.get('/internal/bootstrap/status', handleBootstrapStatus)
  }

  app.register(admin, {
    world: worldProxy,
    assets: assetsProxy,
    adminHtmlPath,
    getAgones: () => runtimeState.resources.agones,
    isRuntimeReady: () => isRuntimeReady(runtimeState),
    getRuntimeState: () => runtimeState.lifecycle.state,
    onConnectionCountChanged: count => updateAdminConnectionCount(connectionChannel, count),
  })

  app.route({
    method: 'GET',
    url: '/ws',
    handler: async (_req, reply) => {
      reply.code(404).send()
    },
    wsHandler: (socket, req) => {
      const connection = resolveWebSocketConnection(socket)
      if (!connection || typeof connection.on !== 'function' || typeof connection.send !== 'function') {
        req.log.error({
          received: describeWebSocketConnection(socket),
          resolved: describeWebSocketConnection(connection),
          upgrade: req.headers?.upgrade || null,
        }, 'invalid websocket connection for /ws')
        socket?.close?.(1011, 'invalid_websocket')
        return
      }
      if (!isRuntimeReady(runtimeState)) {
        connection?.close?.(1013, 'runtime_not_ready')
        return
      }
      runtimeState.resources.world.network.onConnection(connection, req.query, req)
    },
  })

  app.setErrorHandler((err, _req, reply) => {
    console.error(err)
    if (!reply.sent) {
      reply.status(500).send()
    }
  })
}

const port = process.env.PORT
const tlsConfig =
  process.env.TLS_CERT_PATH && process.env.TLS_KEY_PATH
    ? {
        cert: fs.readFileSync(process.env.TLS_CERT_PATH),
        key: fs.readFileSync(process.env.TLS_KEY_PATH),
      }
    : undefined
const directWssPort = process.env.DIRECT_WSS_PORT
const useDualPort = !!(tlsConfig && directWssPort)
const mainServerTls = tlsConfig && !directWssPort ? tlsConfig : undefined

const fastify = Fastify({
  logger: { level: 'error' },
  https: mainServerTls,
})
await fastify.register(ws)
registerCommonRoutes(fastify, { includeBootstrapControl: true, connectionChannel: 'main' })

let wssServer = null
if (useDualPort) {
  wssServer = Fastify({
    logger: { level: 'error' },
    https: tlsConfig,
  })

  await wssServer.register(ws)
  registerCommonRoutes(wssServer, { includeBootstrapControl: true, connectionChannel: 'wss' })
}

const host = process.env.HOST || process.env.BIND_HOST || '0.0.0.0'

try {
  await fastify.listen({ port, host })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${port}`)
  process.exit(1)
}

console.log(`${mainServerTls ? 'HTTPS' : 'HTTP'} server listening on port ${port}`)

if (wssServer) {
  try {
    await wssServer.listen({ port: directWssPort, host })
    console.log(`WSS server listening on port ${directWssPort} (TLS enabled)`)
  } catch (err) {
    console.error(err)
    console.error(`failed to launch WSS server on port ${directWssPort}`)
    process.exit(1)
  }
}

if (runtimeState.lifecycle.state === 'bootstrapping') {
  void initializeRuntime({
    source: runtimeState.lifecycle.source || 'startup',
    binding: runtimeState.lifecycle.binding,
  })
}

async function shutdown(reason) {
  runtimeState.resources.agonesIdleController.clearIdleShutdownTimer(reason)
  runtimeState.resources.agonesPlayerTracker.stop?.()
  if (runtimeState.resources.world?.network?.save) {
    await runtimeState.resources.world.network.save()
  }
  await runtimeState.resources.world?.storage?.close?.()
  if (runtimeState.resources.storage && runtimeState.resources.storage !== runtimeState.resources.world?.storage) {
    await runtimeState.resources.storage.close?.()
  }
  await fastify.close()
  if (wssServer) await wssServer.close()
  process.exit(0)
}

process.on('SIGINT', async () => {
  await shutdown('sigint')
})

process.on('SIGTERM', async () => {
  await shutdown('sigterm')
})
