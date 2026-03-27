import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { uuid } from './utils.js'
import { readPacket, writePacket } from '../src/core/packets.js'
import { normalizeWorldAdminBaseUrl, toWsUrl, joinUrl, normalizePacketData } from './helpers.js'

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

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsAdminUrl, {
        headers: this.adminHeaders(),
      })
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      const onOpen = () => {
        ws.send(
          writePacket('adminAuth', {
            code: this.adminCode,
            authToken: this.authToken,
            subscriptions: { snapshot: false, players: false, runtime: false },
          })
        )
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
          reject(new Error(data?.error || 'auth_error'))
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
    const res = await fetch(joinUrl(this.httpBase, '/admin/snapshot'), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw new Error(`snapshot_failed:${res.status}`)
    }
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
    const res = await fetch(joinUrl(this.httpBase, `/admin/changes${suffix}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw new Error(`changes_failed:${res.status}`)
    }
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
    const res = await fetch(joinUrl(this.httpBase, `/admin/deploy-lock${suffix}`), {
      headers: this.adminHeaders(),
    })
    if (!res.ok) {
      throw new Error(`deploy_lock_status_failed:${res.status}`)
    }
    return res.json()
  }

  async acquireDeployLock({ owner, ttl, scope } = {}) {
    const payload = { owner, ttl }
    if (scope) payload.scope = scope
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = new Error(data?.error || `deploy_lock_failed:${res.status}`)
      err.code = data?.error || 'deploy_lock_failed'
      err.lock = data?.lock
      throw err
    }
    return res.json()
  }

  async renewDeployLock({ token, ttl, scope } = {}) {
    const payload = { token, ttl }
    if (scope) payload.scope = scope
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'PUT',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = new Error(data?.error || `deploy_lock_renew_failed:${res.status}`)
      err.code = data?.error || 'deploy_lock_renew_failed'
      err.lock = data?.lock
      throw err
    }
    return res.json()
  }

  async releaseDeployLock({ token, scope } = {}) {
    const payload = { token }
    if (scope) payload.scope = scope
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-lock'), {
      method: 'DELETE',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = new Error(data?.error || `deploy_lock_release_failed:${res.status}`)
      err.code = data?.error || 'deploy_lock_release_failed'
      err.lock = data?.lock
      throw err
    }
    return res.json()
  }

  async createDeploySnapshot({ ids, target, note, lockToken, scope } = {}) {
    const payload = { ids, target, note, lockToken }
    if (scope) payload.scope = scope
    const res = await fetch(joinUrl(this.httpBase, '/admin/deploy-snapshots'), {
      method: 'POST',
      headers: this.adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const err = new Error(data?.error || `snapshot_failed:${res.status}`)
      err.code = data?.error || 'snapshot_failed'
      err.lock = data?.lock
      throw err
    }
    return res.json()
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
