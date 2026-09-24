import { System } from './System.js'

export class ClientCompanions extends System {
  constructor(world) {
    super(world)
    this.agents = []
    this.pending = new Map()
    this.protocol = 0
    this.landmarks = new Map()
  }

  deserialize(data, protocol) {
    this.protocol = protocol || 0
    this.setState(data || [])
  }

  setState(data) {
    const previous = this.agents.find(agent => agent.id === this.world.network.id)
    const next = data.find(agent => agent.id === this.world.network.id)
    this.agents = data
    if (previous?.generation !== next?.generation || previous?.ownerPlayerId !== next?.ownerPlayerId) {
      this.world.agentControl?.stop('pairing_changed')
    }
    this.emit('change', this.agents)
    this.world.events.emit('companions', this.agents)
  }

  request(action, params = {}) {
    if (this.protocol !== 1) return Promise.reject(new Error('This server needs the companion update.'))
    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('Companion request timed out'))
      }, 15000)
      this.pending.set(requestId, { resolve, reject, timer })
      this.world.network.send('companionRequest', { ...params, action, requestId })
    })
  }

  result(data) {
    const pending = this.pending.get(data.requestId)
    if (!pending) return
    this.pending.delete(data.requestId)
    clearTimeout(pending.timer)
    if (data.error) pending.reject(new Error(data.error))
    else pending.resolve(data.value)
  }

  destroy() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Disconnected'))
    }
    this.pending.clear()
  }
}
