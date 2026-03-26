import { readPacket, writePacket } from '../packets'
import { storage } from '../storage'
import { uuid } from '../utils'
import { hashFile } from '../utils-client'
import { System } from './System'

function normalizeAdminUrl(url) {
  if (!url) return null
  return url.replace(/\/admin\/?$/, '')
}

function deriveAdminUrl(apiUrl) {
  if (!apiUrl) return null
  return normalizeAdminUrl(apiUrl.replace(/\/api\/?$/, ''))
}

function joinUrl(base, path) {
  return `${base.replace(/\/$/, '')}${path}`
}

function toWsUrl(baseUrl) {
  const wsBase = baseUrl.replace(/^http/, 'ws')
  return joinUrl(wsBase, '/admin')
}

export const RUNTIME_CREDENTIAL_COMMAND = 'runtime_credentials_get'
export const ADMIN_SHUTDOWN_COMMAND = 'agones_shutdown'

function normalizeRuntimeCredentialValue(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeRuntimeCredentials(data) {
  if (!data || typeof data !== 'object') return null
  const adminAuthKind = normalizeAdminAuthKind(data.adminAuthKind)
  const adminCode =
    adminAuthKind === ADMIN_AUTH_KIND_ADMIN_CODE ? normalizeRuntimeCredentialValue(data.adminCode) : null
  return {
    worldId: normalizeRuntimeCredentialValue(data.worldId),
    adminAuthKind,
    hasAdminCode: adminAuthKind === ADMIN_AUTH_KIND_ADMIN_CODE && !!data.hasAdminCode,
    adminCode,
  }
}

const ADMIN_AUTH_KIND_ADMIN_CODE = 'admin_code'
const ADMIN_AUTH_KIND_PLAYER_TOKEN = 'player_token'

function normalizeAdminAuthKind(value) {
  return value === ADMIN_AUTH_KIND_PLAYER_TOKEN ? ADMIN_AUTH_KIND_PLAYER_TOKEN : ADMIN_AUTH_KIND_ADMIN_CODE
}

function normalizeAuthMetadata(value) {
  if (!value || typeof value !== 'object') return null
  const kind = normalizeAdminAuthKind(value?.admin?.kind)
  return {
    usesLobbyIdentity: !!value?.usesLobbyIdentity,
    usesLocalIdentity: value?.usesLocalIdentity === undefined ? !value?.usesLobbyIdentity : !!value.usesLocalIdentity,
    admin: {
      kind,
      codeConfigured: kind === ADMIN_AUTH_KIND_ADMIN_CODE && !!value?.admin?.codeConfigured,
      openAccess: kind === ADMIN_AUTH_KIND_ADMIN_CODE && !!value?.admin?.openAccess,
    },
  }
}

export class AdminClient extends System {
  constructor(world) {
    super(world)
    this.ws = null
    this.adminUrl = null
    this.connected = false
    this.authenticated = false
    this.error = null
    this.queue = []
    this.pending = new Map()
    this.code = null
    this.authToken = null
    this.deployLockToken = null
    this.deployLockScope = null
    this.auth = null
    this.runtimeCredentials = null
  }

  init({ adminUrl, requireAdminCode, auth } = {}) {
    if (adminUrl) {
      this.adminUrl = normalizeAdminUrl(adminUrl)
      this.setAuthMetadata(
        auth || {
          admin: {
            kind: ADMIN_AUTH_KIND_ADMIN_CODE,
            codeConfigured: !!requireAdminCode,
            openAccess: !requireAdminCode,
          },
        }
      )
      this.connect()
    }
  }

  onSnapshot(data) {
    this.adminUrl = normalizeAdminUrl(data.adminUrl) || deriveAdminUrl(data.apiUrl)
    this.setAuthMetadata(data.auth)
    this.runtimeCredentials = null
    this.syncPreferredCredentials({ nextAuthToken: data.authToken })
    this.connect()
  }

  setCode(code) {
    const normalized = normalizeRuntimeCredentialValue(code)
    storage.set('adminCode', normalized)
    if (this.requiresPlayerToken()) {
      this.code = null
      return
    }
    this.code = normalized
    this.runtimeCredentials = null
    this.world.emit('admin-code', normalized)
    this.error = null
    this.disconnect()
    this.connect()
  }

  refreshAuthToken(nextToken) {
    if (!this.requiresPlayerToken()) {
      this.authToken = null
      return null
    }
    const tokenCandidate = typeof nextToken === 'string' ? nextToken : storage.get('authToken')
    const token = typeof tokenCandidate === 'string' ? tokenCandidate.trim() : ''
    this.authToken = token || null
    return this.authToken
  }

  syncPreferredCredentials({ nextAuthToken } = {}) {
    if (this.requiresPlayerToken()) {
      this.code = null
      this.refreshAuthToken(nextAuthToken)
      return
    }
    this.authToken = null
    this.code = normalizeRuntimeCredentialValue(storage.get('adminCode'))
  }

  setAuthMetadata(auth) {
    this.auth = normalizeAuthMetadata(auth)
    this.syncPreferredCredentials()
  }

  get adminAuthKind() {
    return this.auth?.admin?.kind || null
  }

  requiresPlayerToken() {
    return this.adminAuthKind === ADMIN_AUTH_KIND_PLAYER_TOKEN
  }

  requiresAdminCode() {
    return this.adminAuthKind === ADMIN_AUTH_KIND_ADMIN_CODE && !!this.auth?.admin?.codeConfigured
  }

  allowsOpenAccess() {
    return this.adminAuthKind === ADMIN_AUTH_KIND_ADMIN_CODE && !!this.auth?.admin?.openAccess
  }

  getMissingAuthError() {
    if (this.requiresPlayerToken() && !this.refreshAuthToken()) {
      const err = new Error('player_session_missing')
      err.code = 'player_session_missing'
      return err
    }
    if (!this.allowsOpenAccess() && this.requiresAdminCode() && !this.code) {
      const err = new Error('admin_code_missing')
      err.code = 'admin_code_missing'
      return err
    }
    return null
  }

  shouldShowAdminCodePrompt() {
    return this.adminAuthKind !== ADMIN_AUTH_KIND_PLAYER_TOKEN
  }

  getCredentialRequiredMessage() {
    if (this.requiresPlayerToken()) {
      return 'Player session required.'
    }
    if (this.requiresAdminCode()) {
      return 'Admin code required.'
    }
    return 'Admin authentication required.'
  }

  getCredentialHelpMessage() {
    if (this.requiresPlayerToken()) {
      return 'Player session required. Sign in to this hosted world first.'
    }
    if (this.requiresAdminCode()) {
      return 'Admin code required. Use /admin <code>.'
    }
    return 'Admin authentication required.'
  }

  getInvalidCredentialMessage() {
    if (this.requiresPlayerToken()) {
      return 'Player session expired or is invalid.'
    }
    if (this.requiresAdminCode()) {
      return 'Invalid admin code.'
    }
    return 'Admin authentication failed.'
  }

  getAdminAccessRequiredMessage() {
    return 'Admin access required.'
  }

  getDeployAccessRequiredMessage() {
    return 'Deploy access required.'
  }

  hasAuthCredential() {
    if (this.requiresPlayerToken()) return !!this.refreshAuthToken()
    if (this.requiresAdminCode()) return !!this.code
    if (this.allowsOpenAccess()) return true
    return !!(this.code || this.refreshAuthToken())
  }

  connect() {
    if (this.ws || !this.adminUrl) return
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) {
      this.error = missingAuthError.code
      return
    }
    const wsUrl = toWsUrl(this.adminUrl)
    this.ws = new WebSocket(wsUrl)
    this.ws.binaryType = 'arraybuffer'
    this.ws.addEventListener('open', this.onOpen)
    this.ws.addEventListener('message', this.onMessage)
    this.ws.addEventListener('close', this.onClose)
    this.ws.addEventListener('error', this.onError)
  }

  disconnect() {
    this.runtimeCredentials = null
    if (!this.ws) return
    this.ws.removeEventListener('open', this.onOpen)
    this.ws.removeEventListener('message', this.onMessage)
    this.ws.removeEventListener('close', this.onClose)
    this.ws.removeEventListener('error', this.onError)
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close()
    }
    this.ws = null
    this.connected = false
    this.authenticated = false
    this.failPending('connection_error')
  }

  onOpen = () => {
    this.connected = true
    this.authenticated = false
    this.error = null
    const payload = {
      subscriptions: { snapshot: false, players: false, runtime: false },
      networkId: this.world.network?.id || null,
    }
    const authToken = this.refreshAuthToken()
    if (this.requiresPlayerToken()) {
      if (authToken) payload.authToken = authToken
    } else if (this.code) {
      payload.code = this.code
    }
    this.sendPacket('adminAuth', payload)
  }

  onMessage = event => {
    const [method, data] = readPacket(event.data)
    if (!method) return
    if (method === 'onAdminAuthOk') {
      this.authenticated = true
      this.flushQueue()
      return
    }
    if (method === 'onAdminAuthError') {
      this.error = data?.error || 'auth_error'
      this.runtimeCredentials = null
      this.failPending(this.error)
      return
    }
    if (method === 'onAdminResult' && data) {
      const requestId = data.requestId
      if (requestId && this.pending.has(requestId)) {
        const pending = this.pending.get(requestId)
        this.pending.delete(requestId)
        if (pending?.timeout) clearTimeout(pending.timeout)
        if (data.ok === false) {
          const err = new Error(data.error || 'error')
          err.code = data.error || 'error'
          if (data.lock) err.lock = data.lock
          if (data.current) err.current = data.current
          pending.reject(err)
        } else {
          pending.resolve(data)
        }
        return
      }
      if (data.ok === false) {
        this.error = data.error || 'error'
      }
      return
    }
  }

  onClose = () => {
    this.connected = false
    this.authenticated = false
    this.runtimeCredentials = null
    this.ws = null
    this.failPending('connection_error')
  }

  onError = () => {
    this.error = 'connection_error'
    this.runtimeCredentials = null
    this.failPending(this.error)
  }

  flushQueue() {
    if (!this.authenticated) return
    while (this.queue.length) {
      const msg = this.queue.shift()
      this.sendPacket('adminCommand', msg)
    }
  }

  sendPacket(name, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(writePacket(name, payload))
    }
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      this.sendPacket('adminCommand', payload)
    } else {
      this.queue.push(payload)
      this.connect()
    }
  }

  request(payload, { timeoutMs = 10000 } = {}) {
    if (!this.adminUrl) {
      const err = new Error('admin_url_missing')
      err.code = 'admin_url_missing'
      return Promise.reject(err)
    }
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) {
      return Promise.reject(missingAuthError)
    }
    const requestId = uuid()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId)
        const err = new Error('timeout')
        err.code = 'timeout'
        reject(err)
      }, timeoutMs)
      this.pending.set(requestId, { resolve, reject, timeout })
      this.send({ ...payload, requestId })
    })
  }

  failPending(code, extra = {}) {
    if (!this.pending.size) return
    for (const [requestId, pending] of this.pending.entries()) {
      if (pending?.timeout) clearTimeout(pending.timeout)
      const err = new Error(code || 'error')
      err.code = code || 'error'
      Object.assign(err, extra)
      pending.reject(err)
      this.pending.delete(requestId)
    }
  }

  async upload(file) {
    if (!this.adminUrl) throw new Error('admin_url_missing')
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) throw missingAuthError
    const hash = await hashFile(file)
    const ext = file.name.split('.').pop().toLowerCase()
    const filename = `${hash}.${ext}`
    const headers = this.getDeployHeaders()
    const checkUrl = joinUrl(this.adminUrl, `/admin/upload-check?filename=${encodeURIComponent(filename)}`)
    const checkResp = await fetch(checkUrl, { headers })
    if (checkResp.status === 403) throw new Error('admin_required')
    const data = await checkResp.json()
    if (data.exists) return
    const form = new FormData()
    form.append('file', file)
    const uploadUrl = joinUrl(this.adminUrl, '/admin/upload')
    const uploadResp = await fetch(uploadUrl, { method: 'POST', body: form, headers })
    if (!uploadResp.ok) {
      let error = null
      try {
        error = await uploadResp.json()
      } catch {
        // ignore non-JSON error payloads
      }
      if (error?.error) {
        const err = new Error(error.error)
        err.code = error.error
        if (error.maxUploadSize !== undefined) {
          err.maxUploadSize = error.maxUploadSize
        }
        throw err
      }
      throw new Error('upload_failed')
    }
  }

  getDeployHeaders() {
    const headers = {}
    if (this.requiresPlayerToken()) {
      const authToken = this.refreshAuthToken()
      if (authToken) headers.authorization = `Bearer ${authToken}`
    } else if (this.code) {
      headers['X-Admin-Code'] = this.code
    }
    return Object.keys(headers).length > 0 ? headers : undefined
  }

  async acquireDeployLock({ owner, ttl, scope } = {}) {
    if (!this.adminUrl) throw new Error('admin_url_missing')
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) throw missingAuthError
    const headers = this.getDeployHeaders() || {}
    const payload = {}
    if (owner) payload.owner = owner
    if (ttl) payload.ttl = ttl
    if (scope) payload.scope = scope
    const res = await fetch(joinUrl(this.adminUrl, '/admin/deploy-lock'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    })
    if (res.status === 403) {
      const error = new Error('admin_required')
      error.code = 'admin_required'
      throw error
    }
    if (res.status === 409) {
      let data = null
      try {
        data = await res.json()
      } catch {
        // ignore non-JSON error payloads
      }
      const code = data?.error || 'locked'
      const error = new Error(code)
      error.code = code
      error.lock = data?.lock
      throw error
    }
    if (!res.ok) {
      const error = new Error('deploy_lock_failed')
      error.code = 'deploy_lock_failed'
      throw error
    }
    const data = await res.json()
    this.deployLockToken = data?.token || null
    this.deployLockScope = scope || null
    return data
  }

  async releaseDeployLock(token, scope) {
    if (!this.adminUrl) throw new Error('admin_url_missing')
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) throw missingAuthError
    const lockToken = token || this.deployLockToken
    if (!lockToken) return { ok: true }
    const lockScope = scope || this.deployLockScope
    const payload = { token: lockToken }
    if (lockScope) payload.scope = lockScope
    const headers = this.getDeployHeaders() || {}
    const res = await fetch(joinUrl(this.adminUrl, '/admin/deploy-lock'), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    })
    if (res.status === 403) {
      const error = new Error('admin_required')
      error.code = 'admin_required'
      throw error
    }
    if (!res.ok) {
      let data = null
      try {
        data = await res.json()
      } catch {
        // ignore non-JSON error payloads
      }
      const code = data?.error || 'deploy_lock_release_failed'
      const error = new Error(code)
      error.code = code
      throw error
    }
    if (lockToken === this.deployLockToken) {
      this.deployLockToken = null
      this.deployLockScope = null
    }
    try {
      return await res.json()
    } catch {
      return { ok: true }
    }
  }

  blueprintAdd(blueprint, { ignoreNetworkId, lockToken, request, timeoutMs } = {}) {
    const payload = {
      type: 'blueprint_add',
      blueprint,
      networkId: ignoreNetworkId,
      lockToken,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  blueprintModify(change, { ignoreNetworkId, lockToken, request, timeoutMs } = {}) {
    const payload = {
      type: 'blueprint_modify',
      change,
      networkId: ignoreNetworkId,
      lockToken,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  async blueprintRemove(id) {
    if (!this.adminUrl) throw new Error('admin_url_missing')
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) throw missingAuthError
    const headers = this.getDeployHeaders()
    const url = joinUrl(this.adminUrl, `/admin/blueprints/${encodeURIComponent(id)}`)
    const res = await fetch(url, { method: 'DELETE', headers })
    if (res.status === 403) throw new Error('admin_required')
    if (!res.ok) {
      let error = null
      try {
        const data = await res.json()
        error = data?.error || null
      } catch {
        // ignore non-JSON error payloads
      }
      throw new Error(error || `blueprint_remove_failed:${res.status}`)
    }
    try {
      return await res.json()
    } catch {
      return { ok: true }
    }
  }

  entityAdd(entity, { ignoreNetworkId, request, timeoutMs } = {}) {
    const payload = {
      type: 'entity_add',
      entity,
      networkId: ignoreNetworkId,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  entityModify(change, { ignoreNetworkId, request, timeoutMs } = {}) {
    const payload = {
      type: 'entity_modify',
      change,
      networkId: ignoreNetworkId,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  entityRemove(id, { ignoreNetworkId, request, timeoutMs } = {}) {
    const payload = {
      type: 'entity_remove',
      id,
      networkId: ignoreNetworkId,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  settingsModify({ key, value }, { ignoreNetworkId, request, timeoutMs } = {}) {
    const payload = {
      type: 'settings_modify',
      key,
      value,
      networkId: ignoreNetworkId,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  spawnModify(op, { networkId, request, timeoutMs } = {}) {
    const targetId = networkId || this.world.network?.id || null
    const payload = {
      type: 'spawn_modify',
      op,
      networkId: targetId,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  modifyRank(playerId, rank, { request, timeoutMs } = {}) {
    const payload = {
      type: 'modify_rank',
      playerId,
      rank,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  kick(playerId, { request, timeoutMs } = {}) {
    const payload = {
      type: 'kick',
      playerId,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  mute(playerId, muted, { request, timeoutMs } = {}) {
    const payload = {
      type: 'mute',
      playerId,
      muted,
    }
    if (request) return this.request(payload, { timeoutMs })
    this.send(payload)
  }

  async runClean({ dryrun } = {}) {
    if (!this.adminUrl) throw new Error('admin_url_missing')
    const missingAuthError = this.getMissingAuthError()
    if (missingAuthError) throw missingAuthError
    const headers = {
      'Content-Type': 'application/json',
      ...(this.getDeployHeaders() || {}),
    }
    const res = await fetch(joinUrl(this.adminUrl, '/admin/clean'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ dryrun: !!dryrun }),
    })
    if (res.status === 403) {
      const error = new Error('admin_required')
      error.code = 'admin_required'
      throw error
    }
    if (!res.ok) {
      let data = null
      try {
        data = await res.json()
      } catch {
        // ignore non-JSON error payloads
      }
      const code = data?.error || `clean_failed:${res.status}`
      const error = new Error(code)
      error.code = code
      throw error
    }
    try {
      return await res.json()
    } catch {
      return { ok: true }
    }
  }

  async getRuntimeCredentials({ forceRefresh = false, timeoutMs = 10000 } = {}) {
    if (!forceRefresh && this.runtimeCredentials) {
      return this.runtimeCredentials
    }
    const data = await this.request({ type: RUNTIME_CREDENTIAL_COMMAND }, { timeoutMs })
    const credentials = normalizeRuntimeCredentials(data?.credentials)
    if (!credentials) {
      const error = new Error('invalid_response')
      error.code = 'invalid_response'
      throw error
    }
    this.runtimeCredentials = credentials
    return credentials
  }

  async requestAgonesShutdown({ timeoutMs = 10000 } = {}) {
    return this.request({ type: ADMIN_SHUTDOWN_COMMAND }, { timeoutMs })
  }
}
