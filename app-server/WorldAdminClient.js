import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { uuid } from './utils.js'
import { readPacket, writePacket } from '../src/core/packets.js'
import {
  normalizeWorldAdminBaseUrl,
  toWsUrl,
  joinUrl,
  normalizePacketData,
  createAppServerError,
  assertWorldAuthTokenActive,
  buildWorldAdminResponseError,
  buildWorldAdminHeaders,
  resolveWorldAdminAuth,
} from './helpers.js'

export class WorldAdminClient extends EventEmitter {
  constructor({ worldUrl, adminCode, authToken, fetchImpl, webSocketFactory } = {}) {
    super()
    this.worldUrl = normalizeWorldAdminBaseUrl(worldUrl)
    this.auth = resolveWorldAdminAuth({ adminCode, authToken })
    this.adminCode = this.auth.adminCode
    this.authToken = this.auth.authToken
    this.fetchImpl = typeof fetchImpl === 'function' ? fetchImpl : (...args) => fetch(...args)
    this.webSocketFactory =
      typeof webSocketFactory === 'function' ? webSocketFactory : (url, options) => new WebSocket(url, options)
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
    return buildWorldAdminHeaders(
      {
        adminCode: this.adminCode,
        authToken: this.authToken,
      },
      extra
    )
  }

  buildAdminAuthPayload(subscriptions = { snapshot: false, players: false, runtime: false }) {
    const payload = { subscriptions }
    if (this.authToken) {
      payload.authToken = this.authToken
    } else if (this.adminCode) {
      payload.code = this.adminCode
    }
    return payload
  }

  assertAuthReady() {
    assertWorldAuthTokenActive(this.authToken)
  }

  async createResponseError(response, fallbackCode) {
    return buildWorldAdminResponseError(response, fallbackCode)
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return
    this.assertAuthReady()

    await new Promise((resolve, reject) => {
      const ws = this.webSocketFactory(this.wsAdminUrl, {
        headers: this.adminHeaders(),
      })
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      const onOpen = () => {
        ws.send(writePacket('adminAuth', this.buildAdminAuthPayload()))
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
          cleanup()
          this._attachListeners(ws)
          resolve()
          return
        }

        if (method === 'onAdminAuthError') {
          cleanup()
          reject(createAppServerError(data?.error || 'auth_error'))
        }
      }

      const onError = err => {
        cleanup()
        reject(err instanceof Error ? err : new Error('ws_error'))
      }

      const onClose = () => {
        cleanup()
        reject(new Error('ws_closed'))
      }

      const cleanup = () => {
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
          pending.resolve(data)
        } else {
          const err = new Error(data.error || 'error')
          err.code = data.error
          err.current = data.current
          err.lock = data.lock
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
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.ws.send(writePacket('adminCommand', message))
    })
  }

  async getSnapshot() {
    this.assertAuthReady()
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/snapshot'), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `snapshot_failed:${res.status}`)
    }
    return res.json()
  }

  async getChanges({ cursor, limit } = {}) {
    this.assertAuthReady()
    const params = new URLSearchParams()
    if (cursor !== undefined && cursor !== null && cursor !== '') {
      params.set('cursor', String(cursor))
    }
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      params.set('limit', String(Math.floor(limit)))
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : ''
    const res = await this.fetchImpl(joinUrl(this.httpBase, `/admin/changes${suffix}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `changes_failed:${res.status}`)
    }
    return res.json()
  }

  async getBlueprint(id) {
    this.assertAuthReady()
    const res = await this.fetchImpl(joinUrl(this.httpBase, `/admin/blueprints/${encodeURIComponent(id)}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `blueprint_failed:${res.status}`)
    }
    const data = await res.json()
    return data.blueprint
  }

  async removeBlueprint(id) {
    this.assertAuthReady()
    const res = await this.fetchImpl(joinUrl(this.httpBase, `/admin/blueprints/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `blueprint_remove_failed:${res.status}`)
    }
    return res.json().catch(() => ({ ok: true }))
  }

  async setSpawn({ position, quaternion }) {
    this.assertAuthReady()
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/spawn'), {
      method: 'PUT',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ position, quaternion }),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `spawn_failed:${res.status}`)
    }
    return res.json()
  }

  async uploadAsset({ filename, buffer, mimeType }) {
    this.assertAuthReady()
    const check = await this.fetchImpl(joinUrl(this.httpBase, `/admin/upload-check?filename=${encodeURIComponent(filename)}`), {
      headers: this.adminHeaders(),
    })
    if (!check.ok) {
      throw await this.createResponseError(check, `upload_check_failed:${check.status}`)
    }
    const { exists } = await check.json()
    if (exists) return { ok: true, filename, exists: true }

    const form = new FormData()
    const file = new File([buffer], filename, { type: mimeType || 'application/octet-stream' })
    form.set('file', file)

    const upload = await this.fetchImpl(joinUrl(this.httpBase, '/admin/upload'), {
      method: 'POST',
      headers: this.adminHeaders(),
      body: form,
    })
    if (!upload.ok) {
      throw await this.createResponseError(upload, `upload_failed:${upload.status}`)
    }
    return upload.json()
  }

  async getDeployLockStatus({ scope } = {}) {
    this.assertAuthReady()
    const suffix = scope ? `?scope=${encodeURIComponent(scope)}` : ''
    const res = await this.fetchImpl(joinUrl(this.httpBase, `/admin/deploy-lock${suffix}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `deploy_lock_status_failed:${res.status}`)
    }
    return res.json()
  }

  async acquireDeployLock({ owner, ttl, scope } = {}) {
    this.assertAuthReady()
    const payload = { owner, ttl }
    if (scope) payload.scope = scope
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `deploy_lock_failed:${res.status}`)
    }
    return res.json()
  }

  async renewDeployLock({ token, ttl, scope } = {}) {
    this.assertAuthReady()
    const payload = { token, ttl }
    if (scope) payload.scope = scope
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'PUT',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `deploy_lock_renew_failed:${res.status}`)
    }
    return res.json()
  }

  async releaseDeployLock({ token, scope } = {}) {
    this.assertAuthReady()
    const payload = { token }
    if (scope) payload.scope = scope
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'DELETE',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `deploy_lock_release_failed:${res.status}`)
    }
    return res.json()
  }

  async createDeploySnapshot({ ids, target, note, lockToken, scope } = {}) {
    this.assertAuthReady()
    const payload = { ids, target, note, lockToken }
    if (scope) payload.scope = scope
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/deploy-snapshots'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `snapshot_failed:${res.status}`)
    }
    return res.json()
  }

  async rollbackDeploySnapshot({ id, lockToken, scope } = {}) {
    this.assertAuthReady()
    const payload = { id, lockToken }
    if (scope) payload.scope = scope
    const res = await this.fetchImpl(joinUrl(this.httpBase, '/admin/deploy-snapshots/rollback'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw await this.createResponseError(res, `rollback_failed:${res.status}`)
    }
    return res.json()
  }
}
