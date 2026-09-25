import { reserveFriendTravel, takeFriendTravel } from '../friendTravel.js'
import moment from 'moment'
import { isEqual } from 'lodash-es'
import { emoteUrls } from '../extras/playerEmotes.js'
import { readPacket, writePacket } from '../packets.js'
import { storage } from '../storage.js'
import { uuid, sanitizeWsUrl } from '../utils.js'
import { hashFile, navigateToServer } from '../utils-client.js'
import { System } from './System.js'

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

  async joinFriend(token) {
    if (this.joiningFriend) throw new Error('join_busy')
    this.joiningFriend = true
    try {
      await reserveFriendTravel(token)
      this._intentionalOffline = true
      this._clearReconnect()
      globalThis.location.reload()
    } catch (error) {
      this.joiningFriend = false
      throw error
    }
  }

  suspendSession() {
    this._intentionalOffline = true
    this.sessionEpoch = (this.sessionEpoch || 0) + 1
    this.sessionWaiter?.reject(new Error('Session changed'))
    this.sessionWaiter = null
    this.destroy()
    this.queue = []
    this.identity = null
    this.world.events.emit('session-changing')
    this.world.emit('session-changing')
    this.world.agentControl?.stop('session_changed')
    this.world.companions?.destroy()
    this.world.livekit?.resetSession()
    for (const entity of this.world.entities.items.values()) {
      for (const proxy of entity.playerProxies?.values() || []) proxy.$cleanup?.()
      entity.playerProxies?.clear()
    }
    if (this.world.entities.player) this.world.entities.remove(this.world.entities.player.data.id)
  }

  reconnectSession() {
    const epoch = this.sessionEpoch
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.suspendSession()
        reject(new Error('Connection timed out. Try again.'))
      }, 45000)
      this.sessionWaiter = {
        epoch,
        resolve: () => {
          clearTimeout(timer)
          this.sessionWaiter = null
          resolve()
        },
        reject: error => {
          clearTimeout(timer)
          this.sessionWaiter = null
          reject(error)
        },
      }
      void this.connect()
    })
  }

  reconcileEntities(data) {
    const incoming = new Map(data.map(item => [item.id, item]))
    const sameInstance = this.activeInstance === this.nextInstance
    const previousEntities = [...this.world.entities.items.values()]
    for (const entity of previousEntities) {
      const next = incoming.get(entity.data.id)
      if (entity.isPlayer || !next || !sameInstance || next.blueprint !== entity.data.blueprint) {
        this.world.entities.remove(entity.data.id)
      }
    }
    for (const item of data) {
      const entity = this.world.entities.get(item.id)
      if (!entity) this.world.entities.add(item)
      else {
        // Script state is authoritative, but receiving it again must not restart
        // every app, including ambient audio and the city, on a session switch.
        const { state, ...properties } = item
        const { state: _previousState, ...previous } = entity.data
        entity.data.state = state
        if (!isEqual(previous, properties)) entity.modify(properties)
      }
    }
  }

  async connect() {
    const epoch = this.sessionEpoch
    if (globalThis.env?.PUBLIC_JOIN_URL) {
      try {
        const tabId = globalThis.sessionStorage.getItem('lobbyTab') || globalThis.crypto.randomUUID()
        globalThis.sessionStorage.setItem('lobbyTab', tabId)
        let assignment = takeFriendTravel()
        if (!assignment) {
          const response = await fetch(globalThis.env.PUBLIC_JOIN_URL, {
            method: 'POST',
            headers: {
              'x-lobby-tab': tabId,
              ...(this.activeInstance ? { 'x-lobby-instance': this.activeInstance } : {}),
            },
            credentials: 'include',
            signal: AbortSignal.timeout(45000),
          })
          assignment = await response.json()
          if (!response.ok || !assignment.wsUrl || !assignment.ticket) throw new Error('Instance unavailable')
        }
        if (epoch !== this.sessionEpoch) return
        this.nextInstance = assignment.instanceId
        const target = new URL(assignment.wsUrl)
        target.searchParams.set('admissionTicket', assignment.ticket)
        this.wsUrl = target.toString()
      } catch {
        if (epoch !== this.sessionEpoch) return
        if (this.sessionWaiter) {
          this.sessionWaiter.reject(new Error('Unable to join the world. Try again.'))
          return
        }
        this.world.emit('connectionStatus', { status: 'offline' })
        this._scheduleReconnect()
        return
      }
    }
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
      // A fresh scene avoids retaining entities from a previous instance.
      if (this.wasConnected && globalThis.env?.PUBLIC_JOIN_URL) globalThis.location.reload()
      else this.connect()
    }, this.retryDelay)
  }

  onError = e => {
    console.error('WebSocket error:', e)
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
        console.error(err)
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
    this.identity = data.identity || null
    globalThis.__runtimeAuth?.setConnectionIdentity?.(this.identity)
    this.serverTimeOffset = data.serverTime - performance.now()
    this.apiUrl = data.apiUrl
    this.maxUploadSize = data.maxUploadSize
    this.world.assetsUrl = data.assetsUrl

    // preload environment model and avatar
    // if (this.world.environment.base) {
    //   this.world.loader.preload('model', this.world.environment.base.model)
    // }
    if (data.settings.avatar) {
      this.world.loader.preload('avatar', data.settings.avatar.url)
    }
    // preload some blueprints
    for (const item of data.blueprints) {
      if (item.preload && !item.disabled) {
        if (item.model) {
          const type = item.model.endsWith('.vrm') ? 'avatar' : 'model'
          this.world.loader.preload(type, item.model)
        }
        if (item.script) {
          if (hasModuleScript(item)) {
            this.world.loader.loadFile?.(item.script).catch(err => {
              console.warn('module entry preload failed', err)
            })
          } else {
            this.world.loader.preload('script', item.script)
          }
        }
        for (const value of Object.values(item.props || {})) {
          if (value === undefined || value === null || !value?.url || !value?.type) continue
          this.world.loader.preload(value.type, value.url)
        }
      }
    }
    // preload emotes
    for (const url of emoteUrls) {
      this.world.loader.preload('emote', url)
    }
    // preload local player avatar
    for (const item of data.entities) {
      if (item.type === 'player' && item.owner === this.id) {
        const url = item.sessionAvatar || item.avatar
        this.world.loader.preload('avatar', url)
      }
    }
    this.world.loader.execPreload()

    this.world.settings.deserialize(data.settings)
    this.world.settings.setHasAdminCode(data.hasAdminCode)
    this.world.chat.authenticated = data.authenticatedChat === 1
    this.world.chat.deserialize(data.chat)
    this.world.blueprints.deserialize(data.blueprints)
    if (this.activeInstance) this.reconcileEntities(data.entities)
    else this.world.entities.deserialize(data.entities)
    this.activeInstance = this.nextInstance
    const waiter = this.sessionWaiter
    if (waiter) {
      Promise.resolve(this.world.entities.player?.ready)
        .then(() => {
          if (waiter !== this.sessionWaiter) return
          this.world.emit('disconnect', false)
          this.world.events.emit('session-changed', { playerId: this.id, account: this.identity })
          this.world.emit('session-changed')
          waiter.resolve()
        })
        .catch(error => waiter.reject(error))
    }
    this.world.livekit?.deserialize(data.livekit)
    this.world.companions?.deserialize(data.companions, data.companionProtocol)
    this.world.ai?.deserialize?.(data.ai)
    storage.set('authToken', data.authToken)
    this.world.admin?.onSnapshot?.(data)
  }

  onCompanionState = data => {
    this.world.companions?.setState(data)
  }

  onCompanionResult = data => {
    this.world.companions?.result(data)
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
    if (!entity) return console.error('onEntityModified: no entity found', data)
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
    this.world.livekit.setToken(data.token)
  }

  onLiveKitLevel = data => {
    this.world.livekit.setLevel(data.playerId, data.level)
  }

  onMute = data => {
    this.world.livekit.setMuted(data.playerId, data.muted)
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
    if (this.sessionWaiter) {
      this.sessionWaiter.reject(new Error('Connection closed. Try again.'))
      return
    }
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
