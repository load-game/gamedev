import * as THREE from '../extras/three.js'
import { System } from './System.js'
import { Layers } from '../extras/Layers.js'
import { findAgentPath } from '../agentNavigation.js'

const mask = Layers.environment.group | Layers.prop.group
const valid = p => Array.isArray(p) && p.length === 3 && p.every(v => Number.isFinite(v) && Math.abs(v) < 100000)
const flatDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])

export class AgentControl extends System {
  constructor(world) {
    super(world)
    this.time = 0
    this.enabled = false
    this.direction = null
    this.motion = { state: 'idle' }
    this.actionIds = new WeakMap()
    this.nextAction = 1
  }

  enable({ headless = false } = {}) {
    if (headless) this.world.client.enableAgentTicks()
    this.enabled = true
    this.direction = new THREE.Vector3()
    this.world.events.emit('agentControl', true)
    return this.observe()
  }

  stop(reason = 'stopped') {
    this.direction?.set(0, 0, 0)
    this.cancelInteraction()
    this.progressPosition = null
    this.goal = null
    this.route = []
    this.motion = { state: reason }
    return this.motion
  }

  walkTo(position) {
    if (!this.enabled || !valid(position)) throw new Error('invalid_destination')
    this.stop()
    this.goal = { position: [...position], expires: performance.now() + 60000 }
    this.plan()
    return this.motion
  }

  follow(playerId) {
    if (!this.enabled || !this.world.entities.players.has(playerId) || playerId === this.world.network.id)
      throw new Error('player_not_found')
    this.stop()
    const target = this.world.entities.players.get(playerId)
    if (
      !this.visible(
        target.base.position
          .clone()
          .add(new THREE.Vector3(0, 1, 0))
          .toArray()
      )
    )
      throw new Error('player_not_visible')
    this.goal = { playerId }
    this.plan()
    return this.motion
  }

  face(position) {
    if (!valid(position)) throw new Error('invalid_position')
    const player = this.world.entities.player
    const origin = player.base.position
    player.cam.rotation.y = Math.atan2(origin.x - position[0], origin.z - position[2])
    return { facing: position }
  }

  step(from, to) {
    // Sample the floor at both edges and sweep torso/head clearance using the
    // engine's collision scene. Actual movement still uses PlayerLocal physics.
    const delta = new THREE.Vector3(to[0] - from[0], 0, to[2] - from[2])
    const distance = delta.length()
    if (!distance) return from
    delta.normalize()
    const side = new THREE.Vector3(-delta.z, 0, delta.x)
    for (const offset of [-0.35, 0, 0.35]) {
      for (const height of [0.05, 0.3, 1, 1.6]) {
        const origin = new THREE.Vector3(from[0], from[1] + height, from[2]).addScaledVector(side, offset)
        if (this.world.physics.raycast(origin, delta, distance + 0.35, mask)) return null
      }
    }
    let floor
    // Check intermediate ground too, so a route cannot cross a narrow gap.
    for (let t = 0.5; t <= 1; t += 0.5) {
      const origin = new THREE.Vector3(from[0] + (to[0] - from[0]) * t, from[1] + 0.65, from[2] + (to[2] - from[2]) * t)
      const hit = this.world.physics.raycast(origin, new THREE.Vector3(0, -1, 0), 1.2, mask)
      if (!hit || hit.normal.y < 0.65 || Math.abs(hit.point.y - from[1]) > 0.55) return null
      floor = hit.point.y
    }
    return [to[0], floor, to[2]]
  }

  plan() {
    const player = this.world.entities.player
    if (!player?.base || !this.goal) return
    const from = player.base.position.toArray()
    const target = this.goal.playerId
      ? this.world.entities.players.get(this.goal.playerId)?.base?.position.toArray()
      : this.goal.position
    if (!target || flatDistance(from, target) > 35) {
      this.stop('target_lost')
      return
    }
    this.lastPlan = this.time
    if (this.goal.playerId && flatDistance(from, target) < 2.5) {
      this.direction.set(0, 0, 0)
      this.route = []
      this.motion = { state: 'following', playerId: this.goal.playerId }
      this.face(target)
      return
    }
    const route = findAgentPath(from, target, (a, b) => this.step(a, b))
    if (!route) {
      this.stop('unreachable')
      return
    }
    this.route = route
    if (!this.progressPosition) {
      this.progressPosition = from
      this.progressAt = this.time
    }
    this.motion = {
      state: this.goal.playerId ? 'following' : 'walking',
      destination: target,
      playerId: this.goal.playerId || null,
    }
  }

  cancelInteraction() {
    const pending = this.interaction
    this.interaction = null
    if (pending) {
      pending.node.onCancel()
      pending.resolve({ cancelled: true })
    }
  }

  update(delta) {
    this.time += delta * 1000
    const pending = this.interaction
    if (pending) {
      if (!this.canReach(pending.node)) this.cancelInteraction()
      else {
        pending.remaining -= delta
        if (pending.remaining <= 0) {
          this.interaction = null
          try {
            pending.node.onTrigger({ playerId: this.world.entities.player.data.id })
            pending.resolve({ triggered: pending.node.label })
          } catch (error) {
            pending.reject(error)
          }
        }
      }
    }
    if (!this.enabled || !this.goal || !this.world.entities.player?.base) return
    const now = this.time,
      from = this.world.entities.player.base.position.toArray()
    if (this.goal.expires && performance.now() > this.goal.expires) {
      this.stop('timed_out')
      return
    }
    if (this.goal.playerId) {
      const target = this.world.entities.players.get(this.goal.playerId)?.base?.position.toArray()
      if (!target || flatDistance(from, target) > 35) {
        this.stop('target_lost')
        return
      }
      if (flatDistance(from, target) < 2) {
        this.direction.set(0, 0, 0)
        this.route = []
        this.progressPosition = null
        return
      }
      if (now - this.lastPlan > 1500) this.plan()
    }
    if (!this.goal) return
    while (this.route?.length && flatDistance(from, this.route[0]) < 0.4) this.route.shift()
    if (!this.route?.length) {
      if (this.goal.playerId) this.direction.set(0, 0, 0)
      else this.stop('arrived')
      return
    }
    if (flatDistance(from, this.progressPosition) > 0.3) {
      this.progressAt = now
      this.progressPosition = from
    } else if (now - this.progressAt > 4000) {
      this.stop('blocked')
      return
    }
    const next = this.route[0]
    if (!this.step(from, next)) {
      this.plan()
      return
    }
    this.direction.set(next[0] - from[0], 0, next[2] - from[2]).normalize()
    this.face(next)
  }

  visible(position) {
    const player = this.world.entities.player
    if (!player?.base || !valid(position)) return false
    const origin = player.base.position.clone().add(new THREE.Vector3(0, 1.6, 0))
    const delta = new THREE.Vector3(...position).sub(origin)
    const distance = delta.length()
    if (distance > 30) return false
    if (distance < 0.1) return true
    const hit = this.world.physics.raycast(origin, delta.normalize(), distance, mask)
    return !hit || hit.distance >= distance - 0.5
  }

  observe() {
    const player = this.world.entities.player
    if (!player?.base) return { ready: false }
    const position = player.base.position.toArray()
    const describe = item => ({ ...item, distance: Math.round(flatDistance(position, item.position) * 10) / 10 })
    const landmarks = [...this.world.companions.landmarks.values()]
      .filter(item => this.visible(item.position))
      .map(describe)
    const players = [...this.world.entities.players.values()]
      .filter(
        p =>
          p !== player &&
          this.visible(
            p.base?.position
              .clone()
              .add(new THREE.Vector3(0, 1, 0))
              .toArray()
          )
      )
      .map(p => describe({ id: p.data.id, name: p.data.name, position: p.base.position.toArray() }))
    const actions = this.world.actions.nodes
      .filter(node => this.visible(node.worldPos.toArray()))
      .map(node => {
        if (!this.actionIds.has(node)) this.actionIds.set(node, `action-${this.nextAction++}`)
        return describe({
          id: this.actionIds.get(node),
          label: node.label,
          position: node.worldPos.toArray(),
          inReach: node.worldPos.distanceTo(player.base.position) <= node.distance,
        })
      })
    return {
      ready: true,
      position,
      motion: this.motion,
      landmarks: landmarks.sort((a, b) => a.distance - b.distance).slice(0, 60),
      players,
      actions: actions.sort((a, b) => a.distance - b.distance).slice(0, 30),
      observedAt: Date.now(),
    }
  }

  canReach(node) {
    return (
      this.world.actions.nodes.includes(node) &&
      this.visible(node.worldPos.toArray()) &&
      node.worldPos.distanceTo(this.world.entities.player.base.position) <= node.distance
    )
  }

  interact(id) {
    const node = this.world.actions.nodes.find(item => this.actionIds.get(item) === id)
    if (!this.enabled || !node || !this.canReach(node)) throw new Error('action_out_of_reach')
    this.stop()
    node.onStart()
    return new Promise((resolve, reject) => {
      this.interaction = { node, remaining: Math.max(0, node.duration), resolve, reject }
    })
  }

  destroy() {
    this.stop('disconnected')
  }
}
