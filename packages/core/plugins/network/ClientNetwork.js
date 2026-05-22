import moment from 'moment'
import { emoteUrls } from '../../extras/playerEmotes.js'
import { readPacket, writePacket } from '../../packets.js'
import { storage } from '../storage/local.js'
import { uuid, sanitizeWsUrl } from '../../utils.js'
import { hashFile, navigateToServer } from '../../utils-client.js'
import { System } from '../../systems/System.js'

function hasModuleScript(blueprint) {
  if (!blueprint) return false
  if (typeof blueprint.scriptRef === 'string' && blueprint.scriptRef.trim()) return true
  const scriptFiles = blueprint.scriptFiles
  return scriptFiles && typeof scriptFiles === 'object' && !Array.isArray(scriptFiles)
}

/**
 * Client Network System
 *
 * - runs on the client
 * - provides abstract network methods matching ServerNetwork
 *
 */
export class ClientNetwork extends System {
  constructor(world) {
    super(world)
    this.ids = -1
    this.ws = null
    this.apiUrl = null
    this.id = null
    this.isClient = true
    this.queue = []
  }

  init({ wsUrl, name, avatar }) {
    this.retryDelay = 10000
    this.wsUrl = wsUrl
    this.connectParams = { name, avatar }
    this.wasConnected = false
    this._intentionalOffline = false
    this._reconnectTimer = null
    this.isOffline = !wsUrl
    this._registerCommands()
    if (wsUrl) this.connect()
  }

  _registerCommands() {
    this.world.chat.bindCommand('connect', ({ value }) => {
      const clean = sanitizeWsUrl(value)
      if (!clean) {
        this.world.chat.add({ body: 'Usage: /connect wss://host/ws' })
        return
      }
      navigateToServer(clean)
    })
    this.world.chat.bindCommand('offline', () => {
      this._intentionalOffline = true
      this._clearReconnect()
      this.ws?.close()
    })
    this.world.chat.bindCommand('reconnect', () => {
      navigateToServer()
    })
  }

  connect() {
    const authToken = storage.get('authToken')
    let url = this.wsUrl
    try {
      const parsed = new URL(this.wsUrl)
      if (authToken && !parsed.searchParams.get('authToken')) {
        parsed.searchParams.set('authToken', authToken)
      }
      if (this.connectParams.name) parsed.searchParams.set('name', this.connectParams.name)
      if (this.connectParams.avatar) parsed.searchParams.set('avatar', this.connectParams.avatar)
      url = parsed.toString()
    } catch {
      const [base, query = ''] = this.wsUrl.split('?')
      const params = new URLSearchParams(query)
      if (authToken && !params.get('authToken')) {
        params.set('authToken', authToken)
      }
      if (this.connectParams.name) params.set('name', this.connectParams.name)
      if (this.connectParams.avatar) params.set('avatar', this.connectParams.avatar)
      const nextQuery = params.toString()
      url = nextQuery ? `${base}?${nextQuery}` : base
    }
    this.ws = new WebSocket(url)
    this.ws.binaryType = 'arraybuffer'
    this.ws.addEventListener('open', this.onOpen)
    this.ws.addEventListener('message', this.onPacket)
    this.ws.addEventListener('close', this.onClose)
    this.ws.addEventListener('error', this.onError)
  }

  onOpen = () => {
    this.wasConnected = true
    this.isOffline = false
    this._intentionalOffline = false
    this._clearReconnect()
    this.world.emit('connectionStatus', { status: 'connected' })
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  _scheduleReconnect() {
    if (this._intentionalOffline || this._reconnectTimer) return
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this.connect()
    }, this.retryDelay)
  }

  onError = e => {
    this.world.logs?.add('client', 'error', ['WebSocket error:', e])
  }

  preFixedUpdate() {
    this.flush()
  }

  send(name, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    // console.log('->', name, data)
    const packet = writePacket(name, data)
    this.ws.send(packet)
  }

  async upload(file) {
    {
      // first check if we even need to upload it
      const hash = await hashFile(file)
      const ext = file.name.split('.').pop().toLowerCase()
      const filename = `${hash}.${ext}`
      const url = `${this.apiUrl}/upload-check?filename=${filename}`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.exists) return // console.log('already uploaded:', filename)
    }
    // then upload it
    const form = new FormData()
    form.append('file', file)
    const url = `${this.apiUrl}/upload`
    await fetch(url, {
      method: 'POST',
      body: form,
    })
  }

  enqueue(method, data) {
    this.queue.push([method, data])
  }

  flush() {
    while (this.queue.length) {
      try {
        const [method, data] = this.queue.shift()
        this[method]?.(data)
      } catch (err) {
        this.world.logs?.add('client', 'error', [err])
      }
    }
  }

  getTime() {
    return (performance.now() + this.serverTimeOffset) / 1000 // seconds
  }

  onPacket = e => {
    const [method, data] = readPacket(e.data)
    this.enqueue(method, data)
    // console.log('<-', method, data)
  }

  onSnapshot(data) {
    this.id = data.id
    this.serverTimeOffset = data.serverTime - performance.now()
    this.apiUrl = data.apiUrl
    this.maxUploadSize = data.maxUploadSize
    this.world.assetsUrl = data.assetsUrl

    // preload environment model and avatar
    // if (this.world.environment.base) {
    //   this.world.loader.preload('model', this.world.environment.base.model)
    // }
    if (data.settings.avatar) {
      this.world.loader?.preload?.('avatar', data.settings.avatar.url)
    }
    // preload some blueprints
    for (const item of data.blueprints) {
      if (item.preload && !item.disabled) {
        if (item.model) {
          const type = item.model.endsWith('.vrm') ? 'avatar' : 'model'
          this.world.loader?.preload?.(type, item.model)
        }
        if (item.script) {
          if (hasModuleScript(item)) {
            this.world.loader?.loadFile?.(item.script).catch(err => {
              this.world.logs?.add('client', 'warn', ['module entry preload failed', err])
            })
          } else {
            this.world.loader?.preload?.('script', item.script)
          }
        }
        for (const value of Object.values(item.props || {})) {
          if (value === undefined || value === null || !value?.url || !value?.type) continue
          this.world.loader?.preload?.(value.type, value.url)
        }
      }
    }
    // preload emotes
    for (const url of emoteUrls) {
      this.world.loader?.preload?.('emote', url)
    }
    // preload local player avatar
    for (const item of data.entities) {
      if (item.type === 'player' && item.owner === this.id) {
        const url = item.sessionAvatar || item.avatar
        this.world.loader?.preload?.('avatar', url)
      }
    }
    this.world.loader?.execPreload?.()

    this.world.settings.deserialize(data.settings)
    this.world.settings.setHasAdminCode(data.hasAdminCode)
    this.world.chat.deserialize(data.chat)
    this.world.blueprints.deserialize(data.blueprints)
    this.world.entities.deserialize(data.entities)
    this.world.livekit?.deserialize(data.livekit)
    this.world.ai?.deserialize?.(data.ai)
    storage.set('authToken', data.authToken)
    this.world.admin?.onSnapshot?.(data)
  }

  onSettingsModified = data => {
    this.world.settings.set(data.key, data.value)
  }

  onChatAdded = msg => {
    this.world.chat.add(msg, false)
  }

  onChatCleared = () => {
    this.world.chat.clear()
  }

  onBlueprintAdded = blueprint => {
    this.world.blueprints.add(blueprint)
  }

  onBlueprintModified = change => {
    this.world.blueprints.modify(change)
  }

  onBlueprintRemoved = data => {
    const id = typeof data === 'string' ? data : data?.id
    if (!id) return
    this.world.blueprints.remove(id)
  }

  onEntityAdded = data => {
    this.world.entities.add(data)
  }

  onEntityModified = data => {
    const entity = this.world.entities.get(data.id)
    if (!entity) {
      this.world.logs?.add('client', 'warn', ['onEntityModified: no entity found', data])
      return
    }
    entity.modify(data)
  }

  onEntityEvent = event => {
    const [id, version, name, data] = event
    const entity = this.world.entities.get(id)
    entity?.onEvent(version, name, data)
  }

  onScriptAiProposal = data => {
    this.world.emit?.('script-ai-proposal', data)
  }

  onScriptAiEvent = data => {
    this.world.emit?.('script-ai-event', data)
  }

  onEntityRemoved = id => {
    this.world.entities.remove(id)
  }

  onPlayerTeleport = data => {
    this.world.entities.player?.teleport(data)
  }

  onPlayerPush = data => {
    this.world.entities.player?.push(data.force)
  }

  onPlayerSessionAvatar = data => {
    this.world.entities.player?.setSessionAvatar(data.avatar)
  }

  onLivekitToken = data => {
    this.world.livekit?.setToken?.(data.token)
  }

  onLiveKitLevel = data => {
    this.world.livekit?.setLevel?.(data.playerId, data.level)
  }

  onMute = data => {
    this.world.livekit?.setMuted?.(data.playerId, data.muted)
  }

  onServerLog = data => {
    this.world.logs?.add('server', data.level, data.args)
  }

  onServerLogHistory = data => {
    this.world.logs?.addBatch('server', data)
  }

  onPong = time => {
    this.world.emit('ping', Math.round(performance.now() - time))
    this.world.stats?.onPong(time)
  }

  onKick = code => {
    this.world.emit('kick', code)
  }

  onClose = code => {
    this.isOffline = true
    if (this.wasConnected) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `You have been disconnected.`,
        createdAt: moment().toISOString(),
      })
      this.world.emit('disconnect', code || true)
    } else {
      this.world.emit('connectionStatus', { status: 'offline' })
    }
    this._scheduleReconnect()
  }

  destroy() {
    this._clearReconnect()
    if (this.ws) {
      this.ws.removeEventListener('open', this.onOpen)
      this.ws.removeEventListener('message', this.onPacket)
      this.ws.removeEventListener('close', this.onClose)
      this.ws.removeEventListener('error', this.onError)
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
  }
}
