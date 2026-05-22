import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { uuid } from './utils.js'
import { readPacket, writePacket } from '../plugins/network/packets.js'
import { normalizeWorldAdminBaseUrl, toWsUrl, joinUrl, normalizePacketData } from './helpers.js'
import { debugLog, fetchWithTimeout, readTimeoutMs, summarizeToken } from './debug.js'

const DEFAULT_ADMIN_WS_CONNECT_TIMEOUT_MS = 15_000
const DEFAULT_ADMIN_HTTP_TIMEOUT_MS = 15_000

function getAdminWsConnectTimeoutMs() {
  return readTimeoutMs('WORLD_ADMIN_CONNECT_TIMEOUT_MS', DEFAULT_ADMIN_WS_CONNECT_TIMEOUT_MS)
}

function getAdminHttpTimeoutMs() {
  return readTimeoutMs('WORLD_ADMIN_REQUEST_TIMEOUT_MS', DEFAULT_ADMIN_HTTP_TIMEOUT_MS)
}

function createTimeoutError(code, timeoutMs, extra = {}) {
  const error = new Error(`${code}:${timeoutMs}`)
  error.code = code
  error.timeoutMs = timeoutMs
  Object.assign(error, extra)
  return error
}

function describeCloseEvent(event) {
  if (!event || typeof event !== 'object') return {}
  const code = typeof event.code === 'number' ? event.code : null
  let reason = null
  if (typeof event.reason === 'string' && event.reason.trim()) {
    reason = event.reason.trim()
  } else if (Buffer.isBuffer(event.reason)) {
    reason = event.reason.toString('utf8').trim() || null
  }
  return {
    ...(code !== null ? { code } : {}),
    ...(reason ? { reason } : {}),
  }
}

export class WorldAdminClient extends EventEmitter {
  constructor({ worldUrl, adminCode, authToken }) {
    super()
    this.worldUrl = normalizeWorldAdminBaseUrl(worldUrl)
    this.adminCode = adminCode || null
    this.authToken = authToken || null
    this.ws = null
    this.pending = new Map()
  }

  get httpBase() {
    return this.worldUrl
  }

  get wsBase() {
    return toWsUrl(this.worldUrl)
  }

  get wsAdminUrl() {
    return joinUrl(this.wsBase, '/admin')
  }

  adminHeaders(extra = {}) {
    const headers = { ...extra }
    if (this.adminCode) headers['X-Admin-Code'] = this.adminCode
    if (this.authToken) headers.authorization = `Bearer ${this.authToken}`
    return headers
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    const timeoutMs = getAdminWsConnectTimeoutMs()
    debugLog('admin-client', 'connect:start', {
      worldUrl: this.worldUrl,
      wsAdminUrl: this.wsAdminUrl,
      timeoutMs,
      hasAdminCode: !!this.adminCode,
      hasAuthToken: !!this.authToken,
    })

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsAdminUrl, {
        headers: this.adminHeaders(),
      })
      ws.binaryType = 'arraybuffer'
      this.ws = ws
      let settled = false
      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        debugLog('admin-client', 'connect:timeout', {
          worldUrl: this.worldUrl,
          wsAdminUrl: this.wsAdminUrl,
          timeoutMs,
        })
        cleanup()
        try {
          ws.close()
        } catch {}
        reject(createTimeoutError('admin_connect_timeout', timeoutMs, { worldUrl: this.worldUrl }))
      }, timeoutMs)

      const onOpen = () => {
        debugLog('admin-client', 'connect:socket_open', {
          worldUrl: this.worldUrl,
          wsAdminUrl: this.wsAdminUrl,
        })
        ws.send(
          writePacket('adminAuth', {
            code: this.adminCode,
            authToken: this.authToken,
            subscriptions: { snapshot: false, players: false, runtime: false },
          })
        )
        debugLog('admin-client', 'connect:auth_sent', {
          worldUrl: this.worldUrl,
        })
      }

      const onMessage = async event => {
        let packet
        try {
          packet = await normalizePacketData(event.data)
        } catch (err) {
          console.error(err)
          return
        }
        const [method, data] = readPacket(packet)
        if (!method) return
        if (method === 'onAdminAuthOk') {
          if (settled) return
          settled = true
          cleanup()
          debugLog('admin-client', 'connect:auth_ok', {
            worldUrl: this.worldUrl,
            capabilities: data?.capabilities || null,
          })
          this._attachListeners(ws)
          resolve()
          return
        }

        if (method === 'onAdminAuthError') {
          if (settled) return
          settled = true
          cleanup()
          debugLog('admin-client', 'connect:auth_error', {
            worldUrl: this.worldUrl,
            error: data?.error || 'auth_error',
          })
          reject(new Error(data?.error || 'auth_error'))
        }
      }

      const onError = err => {
        if (settled) return
        settled = true
        cleanup()
        debugLog('admin-client', 'connect:error', {
          worldUrl: this.worldUrl,
          error: err?.message || String(err),
        })
        reject(err instanceof Error ? err : new Error('ws_error'))
      }

      const onClose = event => {
        if (settled) return
        settled = true
        cleanup()
        debugLog('admin-client', 'connect:closed', {
          worldUrl: this.worldUrl,
          ...describeCloseEvent(event),
        })
        reject(new Error('ws_closed'))
      }

      const cleanup = () => {
        clearTimeout(timeoutId)
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('message', onMessage)
        ws.removeEventListener('error', onError)
        ws.removeEventListener('close', onClose)
      }

      ws.addEventListener('open', onOpen)
      ws.addEventListener('message', onMessage)
      ws.addEventListener('error', onError)
      ws.addEventListener('close', onClose)
    })
  }

  _attachListeners(ws) {
    ws.addEventListener('message', async event => {
      let packet
      try {
        packet = await normalizePacketData(event.data)
      } catch (err) {
        console.error(err)
        return
      }
      const [method, data] = readPacket(packet)
      if (!method) return

      if (method === 'onAdminResult') {
        const requestId = data?.requestId
        if (!requestId) return
        const pending = this.pending.get(requestId)
        if (!pending) return
        this.pending.delete(requestId)
        if (data.ok) {
          debugLog('admin-client', 'request:ok', {
            worldUrl: this.worldUrl,
            requestId,
          })
          pending.resolve(data)
        } else {
          const err = new Error(data.error || 'error')
          err.code = data.error
          err.current = data.current
          err.lock = data.lock
          debugLog('admin-client', 'request:error', {
            worldUrl: this.worldUrl,
            requestId,
            error: data?.error || 'error',
            lock: data?.lock || null,
          })
          pending.reject(err)
        }
        return
      }

      const type = method.slice(2)
      if (type) {
        const name = type.charAt(0).toLowerCase() + type.slice(1)
        if (name === 'blueprintAdded' || name === 'blueprintModified') {
          this.emit('message', { type: name, blueprint: data })
          return
        }
        if (name === 'blueprintRemoved') {
          const id = data?.id || data
          this.emit('message', { type: name, id })
          return
        }
        if (name === 'entityAdded' || name === 'entityModified') {
          this.emit('message', { type: name, entity: data })
          return
        }
        if (name === 'entityRemoved') {
          this.emit('message', { type: name, id: data })
          return
        }
        if (name === 'settingsModified') {
          this.emit('message', { type: name, data })
          return
        }
        if (name === 'spawnModified') {
          this.emit('message', { type: name, spawn: data })
          return
        }
        this.emit('message', { type: name, data })
        return
      }

      this.emit('message', { type: null, data })
    })

    ws.addEventListener('close', () => {
      debugLog('admin-client', 'socket:disconnect', {
        worldUrl: this.worldUrl,
        pendingRequests: this.pending.size,
      })
      for (const pending of this.pending.values()) {
        pending.reject(new Error('ws_closed'))
      }
      this.pending.clear()
      this.emit('disconnect')
    })
  }

  request(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not_connected'))
    }
    const requestId = uuid()
    const message = {
      type,
      requestId,
      source: 'app-server',
      actor: 'app-server',
      ...payload,
    }
    debugLog('admin-client', 'request:send', {
      worldUrl: this.worldUrl,
      type,
      requestId,
      hasLockToken: typeof payload?.lockToken === 'string' && !!payload.lockToken.trim(),
      lockToken: summarizeToken(payload?.lockToken),
    })
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.ws.send(writePacket('adminCommand', message))
    })
  }

  async getSnapshot() {
    const url = joinUrl(this.httpBase, '/admin/snapshot')
    const timeoutMs = getAdminHttpTimeoutMs()
    debugLog('admin-client', 'snapshot:start', {
      worldUrl: this.worldUrl,
      url,
      timeoutMs,
    })
    let res
    try {
      res = await fetchWithTimeout(
        url,
        {
          headers: this.adminHeaders(),
        },
        {
          timeoutMs,
        }
      )
    } catch (err) {
      if (err?.name === 'AbortError') {
        debugLog('admin-client', 'snapshot:timeout', {
          worldUrl: this.worldUrl,
          url,
          timeoutMs,
        })
        throw createTimeoutError('snapshot_timeout', timeoutMs, { url })
      }
      debugLog('admin-client', 'snapshot:error', {
        worldUrl: this.worldUrl,
        url,
        error: err?.message || String(err),
      })
      throw err
    }
    if (!res.ok) {
      debugLog('admin-client', 'snapshot:response_error', {
        worldUrl: this.worldUrl,
        url,
        status: res.status,
      })
      throw new Error(`snapshot_failed:${res.status}`)
    }
    debugLog('admin-client', 'snapshot:ok', {
      worldUrl: this.worldUrl,
      url,
      status: res.status,
    })
    return res.json()
  }

  async getChanges({ cursor, limit } = {}) {
    const params = new URLSearchParams()
    if (cursor !== undefined && cursor !== null && cursor !== '') {
      params.set('cursor', String(cursor))
    }
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      params.set('limit', String(Math.floor(limit)))
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : ''
    const url = joinUrl(this.httpBase, `/admin/changes${suffix}`)
    const timeoutMs = getAdminHttpTimeoutMs()
    debugLog('admin-client', 'changes:start', {
      worldUrl: this.worldUrl,
      url,
      timeoutMs,
    })
    let res
    try {
      res = await fetchWithTimeout(
        url,
        {
          headers: this.adminHeaders(),
        },
        {
          timeoutMs,
        }
      )
    } catch (err) {
      if (err?.name === 'AbortError') {
        debugLog('admin-client', 'changes:timeout', {
          worldUrl: this.worldUrl,
          url,
          timeoutMs,
        })
        throw createTimeoutError('changes_timeout', timeoutMs, { url })
      }
      debugLog('admin-client', 'changes:error', {
        worldUrl: this.worldUrl,
        url,
        error: err?.message || String(err),
      })
      throw err
    }
    if (!res.ok) {
      debugLog('admin-client', 'changes:response_error', {
        worldUrl: this.worldUrl,
        url,
        status: res.status,
      })
      throw new Error(`changes_failed:${res.status}`)
    }
    debugLog('admin-client', 'changes:ok', {
      worldUrl: this.worldUrl,
      url,
      status: res.status,
    })
    return res.json()
  }

  async getBlueprint(id) {
    const res = await fetch(joinUrl(this.httpBase, `/admin/blueprints/${encodeURIComponent(id)}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw new Error(`blueprint_failed:${res.status}`)
    }
    const data = await res.json()
    return data.blueprint
  }

  async removeBlueprint(id) {
    const res = await fetch(joinUrl(this.httpBase, `/admin/blueprints/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = new Error(data?.error || `blueprint_remove_failed:${res.status}`)
      err.code = data?.error || 'blueprint_remove_failed'
      throw err
    }
    return res.json().catch(() => ({ ok: true }))
  }

  async setSpawn({ position, quaternion }) {
    const res = await fetch(joinUrl(this.httpBase, '/admin/spawn'), {
      method: 'PUT',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ position, quaternion }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = data?.error ? `spawn_failed:${data.error}` : `spawn_failed:${res.status}`
      throw new Error(err)
    }
    return res.json()
  }

  async uploadAsset({ filename, buffer, mimeType }) {
    const check = await fetch(joinUrl(this.httpBase, `/admin/upload-check?filename=${encodeURIComponent(filename)}`), {
      headers: this.adminHeaders(),
    })
    if (!check.ok) {
      throw new Error(`upload_check_failed:${check.status}`)
    }
    const { exists } = await check.json()
    if (exists) return { ok: true, filename, exists: true }

    const form = new FormData()
    const file = new File([buffer], filename, { type: mimeType || 'application/octet-stream' })
    form.set('file', file)

    const upload = await fetch(joinUrl(this.httpBase, '/admin/upload'), {
      method: 'POST',
      headers: this.adminHeaders(),
      body: form,
    })
    if (!upload.ok) {
      throw new Error(`upload_failed:${upload.status}`)
    }
    return upload.json()
  }

  async getDeployLockStatus({ scope } = {}) {
    const suffix = scope ? `?scope=${encodeURIComponent(scope)}` : ''
    debugLog('admin-client', 'deploy_lock:status_start', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
    })
    const res = await fetch(joinUrl(this.httpBase, `/admin/deploy-lock${suffix}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      debugLog('admin-client', 'deploy_lock:status_error', {
        worldUrl: this.worldUrl,
        scope: scope || 'global',
        status: res.status,
      })
      throw new Error(`deploy_lock_status_failed:${res.status}`)
    }
    const data = await res.json()
    debugLog('admin-client', 'deploy_lock:status_ok', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
      locked: !!data?.locked,
      owner: data?.owner || null,
      expiresInMs: data?.expiresInMs ?? null,
    })
    return data
  }

  async acquireDeployLock({ owner, ttl, scope } = {}) {
    const payload = { owner, ttl }
    if (scope) payload.scope = scope
    debugLog('admin-client', 'deploy_lock:acquire_start', {
      worldUrl: this.worldUrl,
      owner: owner || null,
      ttl: ttl ?? null,
      scope: scope || 'global',
    })
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      debugLog('admin-client', 'deploy_lock:acquire_error', {
        worldUrl: this.worldUrl,
        owner: owner || null,
        scope: scope || 'global',
        status: res.status,
        error: data?.error || `deploy_lock_failed:${res.status}`,
        lock: data?.lock || null,
      })
      const err = new Error(data?.error || `deploy_lock_failed:${res.status}`)
      err.code = data?.error || 'deploy_lock_failed'
      err.lock = data?.lock
      throw err
    }
    const data = await res.json()
    debugLog('admin-client', 'deploy_lock:acquire_ok', {
      worldUrl: this.worldUrl,
      owner: owner || null,
      scope: scope || 'global',
      token: summarizeToken(data?.token),
    })
    return data
  }

  async renewDeployLock({ token, ttl, scope } = {}) {
    const payload = { token, ttl }
    if (scope) payload.scope = scope
    debugLog('admin-client', 'deploy_lock:renew_start', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
      ttl: ttl ?? null,
      token: summarizeToken(token),
    })
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'PUT',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      debugLog('admin-client', 'deploy_lock:renew_error', {
        worldUrl: this.worldUrl,
        scope: scope || 'global',
        status: res.status,
        error: data?.error || `deploy_lock_renew_failed:${res.status}`,
        lock: data?.lock || null,
        token: summarizeToken(token),
      })
      const err = new Error(data?.error || `deploy_lock_renew_failed:${res.status}`)
      err.code = data?.error || 'deploy_lock_renew_failed'
      err.lock = data?.lock
      throw err
    }
    const data = await res.json()
    debugLog('admin-client', 'deploy_lock:renew_ok', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
      token: summarizeToken(token),
    })
    return data
  }

  async releaseDeployLock({ token, scope } = {}) {
    const payload = { token }
    if (scope) payload.scope = scope
    debugLog('admin-client', 'deploy_lock:release_start', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
      token: summarizeToken(token),
    })
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'DELETE',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      debugLog('admin-client', 'deploy_lock:release_error', {
        worldUrl: this.worldUrl,
        scope: scope || 'global',
        status: res.status,
        error: data?.error || `deploy_lock_release_failed:${res.status}`,
        lock: data?.lock || null,
        token: summarizeToken(token),
      })
      const err = new Error(data?.error || `deploy_lock_release_failed:${res.status}`)
      err.code = data?.error || 'deploy_lock_release_failed'
      err.lock = data?.lock
      throw err
    }
    const data = await res.json()
    debugLog('admin-client', 'deploy_lock:release_ok', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
      token: summarizeToken(token),
    })
    return data
  }

  async createDeploySnapshot({ ids, target, note, lockToken, scope } = {}) {
    const payload = { ids, target, note, lockToken }
    if (scope) payload.scope = scope
    debugLog('admin-client', 'deploy_snapshot:create_start', {
      worldUrl: this.worldUrl,
      ids: Array.isArray(ids) ? ids.length : 0,
      target: target || null,
      note: note || null,
      scope: scope || 'global',
      lockToken: summarizeToken(lockToken),
    })
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-snapshots'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      debugLog('admin-client', 'deploy_snapshot:create_error', {
        worldUrl: this.worldUrl,
        scope: scope || 'global',
        status: res.status,
        error: data?.error || `snapshot_failed:${res.status}`,
        lock: data?.lock || null,
        lockToken: summarizeToken(lockToken),
      })
      const err = new Error(data?.error || `snapshot_failed:${res.status}`)
      err.code = data?.error || 'snapshot_failed'
      err.lock = data?.lock
      throw err
    }
    const data = await res.json()
    debugLog('admin-client', 'deploy_snapshot:create_ok', {
      worldUrl: this.worldUrl,
      scope: scope || 'global',
      id: data?.id || null,
      lockToken: summarizeToken(lockToken),
    })
    return data
  }

  async rollbackDeploySnapshot({ id, lockToken, scope } = {}) {
    const payload = { id, lockToken }
    if (scope) payload.scope = scope
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-snapshots/rollback'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = new Error(data?.error || `rollback_failed:${res.status}`)
      err.code = data?.error || 'rollback_failed'
      err.lock = data?.lock
      throw err
    }
    return res.json()
  }
}
