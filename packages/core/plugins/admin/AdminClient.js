import { readPacket, writePacket } from '../../packets.js'
import { storage } from '../storage/local.js'
import { uuid } from '../../utils.js'
import { hashFile } from '../../utils-client.js'
import { System } from '../../systems/System.js'

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
  return {
    worldId: normalizeRuntimeCredentialValue(data.worldId),
    hasAdminCode: !!data.hasAdminCode,
    adminCodeAuthSupported:
      data.adminCodeAuthSupported === undefined ? !!data.hasAdminCode : !!data.adminCodeAuthSupported,
    adminCode: normalizeRuntimeCredentialValue(data.adminCode),
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
    this.requireCode = false
    this.adminCodeAuthSupported = false
    this.runtimeCredentials = null
    this.onRank = ({ playerId } = {}) => {
      const localPlayerId = this.world.entities?.player?.data?.id || null
      if (!this.adminUrl || !localPlayerId || playerId !== localPlayerId) return
      this.error = null
      this.runtimeCredentials = null
      this.disconnect()
      this.connect()
    }
  }

  init({ adminUrl, requireAdminCode } = {}) {
    this.code = storage.get('adminCode')
    this.refreshAuthToken()
    this.world.on?.('rank', this.onRank)
    if (adminUrl) {
      this.adminUrl = normalizeAdminUrl(adminUrl)
      this.requireCode = !!requireAdminCode
      this.adminCodeAuthSupported = !!requireAdminCode
      this.connect()
    }
  }

  onSnapshot(data) {
    this.adminUrl = normalizeAdminUrl(data.adminUrl) || deriveAdminUrl(data.apiUrl)
    this.adminCodeAuthSupported =
      data.adminCodeAuthSupported === undefined ? !!data.hasAdminCode : !!data.adminCodeAuthSupported
    this.requireCode = this.adminCodeAuthSupported
    this.runtimeCredentials = null
    this.refreshAuthToken(data.authToken)
    this.connect()
  }

  setCode(code) {
    this.code = code
    this.runtimeCredentials = null
    storage.set('adminCode', code)
    this.world.emit('admin-code', code)
    this.error = null
    this.disconnect()
    this.connect()
  }

  refreshAuthToken(nextToken) {
    const tokenCandidate = typeof nextToken === 'string' ? nextToken : storage.get('authToken')
    const token = typeof tokenCandidate === 'string' ? tokenCandidate.trim() : ''
    this.authToken = token || null
    return this.authToken
  }

  hasAuthCredential() {
    return !!(this.code || this.refreshAuthToken())
  }

  connect() {
    if (this.ws || !this.adminUrl) return
    if (this.requireCode && !this.hasAuthCredential()) {
      this.error = 'missing_code'
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
    this.sendPacket('adminAuth', {
      code: this.code,
      authToken: this.refreshAuthToken(),
      subscriptions: { snapshot: false, players: false, runtime: false },
      networkId: this.world.network?.id || null,
    })
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

  destroy() {
    this.world.off?.('rank', this.onRank)
    this.disconnect()
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
    if (this.requireCode && !this.hasAuthCredential()) {
      const err = new Error('admin_code_missing')
      err.code = 'admin_code_missing'
      return Promise.reject(err)
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
    if (this.requireCode && !this.hasAuthCredential()) throw new Error('admin_code_missing')
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
    if (this.code) headers['X-Admin-Code'] = this.code
    const authToken = this.refreshAuthToken()
    if (authToken) headers.authorization = `Bearer ${authToken}`
    return Object.keys(headers).length > 0 ? headers : undefined
  }

  async acquireDeployLock({ owner, ttl, scope } = {}) {
    if (!this.adminUrl) throw new Error('admin_url_missing')
    if (this.requireCode && !this.hasAuthCredential()) throw new Error('admin_code_missing')
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
    if (this.requireCode && !this.hasAuthCredential()) throw new Error('admin_code_missing')
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
    if (this.requireCode && !this.hasAuthCredential()) throw new Error('admin_code_missing')
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
    if (this.requireCode && !this.hasAuthCredential()) throw new Error('admin_code_missing')
    const headers = {
      'Content-Type': 'application/json',
      ...this.getDeployHeaders(),
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
