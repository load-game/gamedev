import moment from 'moment'
import { uuid } from '../../utils.js'
import { syncLobbyProfilePatch } from '../../profileSync.js'
import { System } from '../../systems/System.js'

/**
 * Chat System
 *
 * - Runs on both the server and client.
 * - Stores and handles chat messages
 * - Provides subscribe hooks for client UI
 *
 */

const CHAT_MAX_MESSAGES = 50

export class Chat extends System {
  constructor(world) {
    super(world)
    this.msgs = []
    this.listeners = new Set()
    this.commands = {} // cmd -> Function
  }

  add(msg, broadcast) {
    if (!msg.id) msg.id = uuid()
    if (!msg.createdAt) moment().toISOString()
    // add to chat messages
    this.msgs = [...this.msgs, msg]
    if (this.msgs.length > CHAT_MAX_MESSAGES) {
      this.msgs.shift()
    }
    for (const callback of this.listeners) {
      callback(this.msgs)
    }
    if (msg.fromId) {
      const player = this.world.entities.getPlayer(msg.fromId)
      player?.chat(msg.body)
    }
    // emit chat event
    const readOnly = Object.freeze({ ...msg })
    this.world.events.emit('chat', readOnly)
    // maybe broadcast
    if (broadcast) {
      this.world.network.send('chatAdded', msg)
    }
  }

  command(text) {
    if (this.world.network.isServer) return
    const playerId = this.world.network.id
    const cmd = text.slice(1).split(' ')[0] // "/foo bar" -> "foo"
    const value = text.slice(1 + cmd.length + 1) // "/foo bar" -> "bar"
    const args = text // "/foo bar" -> ["foo", "bar"]
      .slice(1)
      .split(' ')
      .map(str => str.trim())
      .filter(str => !!str)
    const callback = this.commands[cmd]
    if (callback) {
      return callback({ playerId, cmd, value, args })
    }
    if (cmd === 'name') {
      void this.handleNameCommand(value)
      return
    }
    if (cmd === 'admin' && value) {
      this.world.admin?.setCode?.(value)
    }
    if (cmd === 'spawn') {
      const op = (args[1] || value || '').toLowerCase()
      if (!op) return
      const admin = this.world.admin
      if (!admin?.spawnModify) return
      if (admin.requireCode && !admin.code) {
        this.add(
          {
            id: uuid(),
            from: null,
            fromId: null,
            body: 'Admin code required. Use /admin <code> first.',
            createdAt: moment().toISOString(),
          },
          false
        )
        return
      }
      if (op !== 'set' && op !== 'clear') {
        this.add(
          {
            id: uuid(),
            from: null,
            fromId: null,
            body: 'Usage: /spawn set | /spawn clear',
            createdAt: moment().toISOString(),
          },
          false
        )
        return
      }
      admin.spawnModify(op, { networkId: playerId })
      const body = op === 'set' ? 'Spawn set.' : 'Spawn cleared.'
      this.add(
        {
          id: uuid(),
          from: null,
          fromId: null,
          body,
          createdAt: moment().toISOString(),
        },
        false
      )
      return
    }
    if (cmd !== 'admin') {
      this.world.events.emit('command', { playerId, cmd, value, args })
    }
    this.world.network.send('command', { cmd, value, args })
  }

  async handleNameCommand(value) {
    const name = typeof value === 'string' ? value.trim() : ''
    if (!name) {
      this.add(
        {
          id: uuid(),
          from: null,
          fromId: null,
          body: 'Usage: /name <display-name>',
          createdAt: moment().toISOString(),
        },
        false
      )
      return
    }

    const result = await syncLobbyProfilePatch({ name })
    if (!result.ok) {
      this.world.emit('toast', result.error?.message || 'Unable to update profile')
      return
    }
    this.world.entities.player?.setName(name)
  }

  clear(broadcast) {
    this.msgs = []
    for (const callback of this.listeners) {
      callback(this.msgs)
    }
    if (broadcast) {
      this.world.network.send('chatCleared')
    }
  }

  send(text) {
    // only available as a client
    if (!this.world.network.isClient) return
    const player = this.world.entities.player
    const data = {
      id: uuid(),
      from: player.data.name,
      fromId: player.data.id,
      body: text,
      createdAt: moment().toISOString(),
    }
    this.add(data, true)
    return data
  }

  serialize() {
    return this.msgs
  }

  deserialize(msgs) {
    this.msgs = msgs
    for (const callback of this.listeners) {
      callback(msgs)
    }
  }

  subscribe(callback) {
    this.listeners.add(callback)
    callback(this.msgs)
    return () => {
      this.listeners.delete(callback)
    }
  }

  bindCommand(cmd, callback) {
    this.commands[cmd] = callback
  }

  destroy() {
    this.msgs = []
    this.listeners.clear()
  }
}
