;({
  init() {
    // Ledge hanging system as an app
    this.activePlayers = new Map()

    console.log('[PlatformerLedge] App initialized')
  },

  attemptLedgeGrab(playerId) {
    const player = world.entities.get(playerId)
    if (!player || !player.isLocal) return

    // Check if already hanging
    if (this.activePlayers.has(playerId)) return

    // Check for ledge below player
    const ledgeHit = this.checkLedgeBelow(player)
    if (!ledgeHit) return

    // Start ledge hanging
    this.startLedgeHanging(playerId, ledgeHit)
  },

  checkLedgeBelow(player) {
    const pose = player.capsule?.getGlobalPose()
    if (!pose) return null

    const origin = new THREE.Vector3(pose.p.x, pose.p.y - 1, pose.p.z)

    // Cast ray downward
    const down = new THREE.Vector3(0, -1, 0)
    const hitMask = Layers.environment.group | Layers.prop.group

    return world.physics.raycast(origin, down, 2, hitMask)
  },

  startLedgeHanging(playerId, ledgeHit) {
    const player = world.entities.get(playerId)
    if (!player) return

    // Set ledge hanging state
    this.activePlayers.set(playerId, {
      ledgePosition: ledgeHit.point.clone(),
      direction: 0, // -1 left, 0 idle, 1 right
      stamina: 100,
    })

    // Position player at ledge
    player.base.position.copy(ledgeHit.point)
    player.base.position.y += 0.5 // Adjust height

    // Set ledge hanging animation
    if (player.avatar) {
      player.avatar.setEmote('asset://mp-ledge-hanging-idle.glb?s=1.0')
    }

    console.log(`[PlatformerLedge] Player ${playerId} grabbed ledge`)
  },

  updateLedgeHanging(playerId, delta) {
    const player = world.entities.get(playerId)
    const state = this.activePlayers.get(playerId)

    if (!player || !state) return

    // Drain stamina
    state.stamina -= 1 * delta // 1 per second
    if (state.stamina <= 0) {
      this.stopLedgeHanging(playerId)
      return
    }

    // Check if still hanging on ledge
    if (!this.checkLedgeStillValid(player, state.ledgePosition)) {
      this.stopLedgeHanging(playerId)
      return
    }

    // Handle ledge movement
    if (state.direction !== 0) {
      const ledgeSpeed = 2
      const moveDirection = new THREE.Vector3(state.direction, 0, 0)
      const moveForce = moveDirection.multiplyScalar(ledgeSpeed * 10)

      // Apply horizontal movement force
      if (player.capsule) {
        player.capsule.addForce(moveForce.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }

      // Set animation
      const animation =
        state.direction !== 0 ? 'asset://mp-ledge-hanging-moving.glb?s=1.2' : 'asset://mp-ledge-hanging-idle.glb?s=1.0'

      if (player.avatar) {
        player.avatar.setEmote(animation)
      }
    }
  },

  checkLedgeStillValid(player, ledgePosition) {
    if (!ledgePosition) return false

    // Check if player is still near the ledge
    const distance = player.base.position.distanceTo(ledgePosition)
    return distance < 1.5
  },

  stopLedgeHanging(playerId) {
    const player = world.entities.get(playerId)
    if (!player) return

    // Clear ledge hanging state
    this.activePlayers.delete(playerId)

    // Clear animation
    if (player.avatar) {
      player.avatar.setEmote(null)
    }

    console.log(`[PlatformerLedge] Player ${playerId} released ledge`)
  },

  update(delta) {
    // Update all active ledge hanging players
    for (const [playerId, state] of this.activePlayers) {
      this.updateLedgeHanging(playerId, delta)
    }
  },

  cleanup() {
    // Clean up all ledge hanging states
    for (const playerId of this.activePlayers.keys()) {
      this.stopLedgeHanging(playerId)
    }
    this.activePlayers.clear()
  },
})
