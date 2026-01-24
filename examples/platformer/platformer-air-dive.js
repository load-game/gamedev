;({
  init() {
    // Air diving system as an app
    this.activePlayers = new Map()

    console.log('[PlatformerAirDive] App initialized')
  },

  attemptAirDive(playerId) {
    const player = world.entities.get(playerId)
    if (!player || !player.isLocal) return

    // Check if already diving
    if (this.activePlayers.has(playerId)) return

    // Must be in air
    if (player.grounded) return

    // Get current velocity
    const velocity = player.capsule?.getLinearVelocity()
    if (!velocity) return

    const currentVelocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z)

    // Calculate dive direction (forward + down)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.base.quaternion)
    const diveDirection = forward
      .clone()
      .multiplyScalar(0.7)
      .add(new THREE.Vector3(0, -0.3, 0))

    // Start air diving
    this.startAirDiving(playerId, diveDirection)
  },

  startAirDiving(playerId, diveDirection) {
    const player = world.entities.get(playerId)
    if (!player) return

    // Set air diving state
    this.activePlayers.set(playerId, {
      momentum: diveDirection.multiplyScalar(15), // Initial dive force
      stamina: 100,
    })

    // Set air diving animation
    if (player.avatar) {
      player.avatar.setEmote('asset://mp-air-dive.glb?s=1.0')
    }

    console.log(`[PlatformerAirDive] Player ${playerId} started air diving`)
  },

  updateAirDiving(playerId, delta) {
    const player = world.entities.get(playerId)
    const state = this.activePlayers.get(playerId)

    if (!player || !state) return

    // Apply dive momentum
    if (state.momentum.length() > 0) {
      const diveForce = state.momentum.clone().multiplyScalar(10)

      if (player.capsule) {
        player.capsule.addForce(diveForce.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }

      // Apply friction to momentum
      state.momentum.multiplyScalar(0.95)

      // Stop diving when momentum is low
      if (state.momentum.length() < 0.1) {
        this.stopAirDiving(playerId)
      }
    }
  },

  stopAirDiving(playerId) {
    const player = world.entities.get(playerId)
    if (!player) return

    // Clear air diving state
    this.activePlayers.delete(playerId)

    // Clear animation
    if (player.avatar) {
      player.avatar.setEmote(null)
    }

    console.log(`[PlatformerAirDive] Player ${playerId} stopped air diving`)
  },

  update(delta) {
    // Update all active air diving players
    for (const [playerId, state] of this.activePlayers) {
      this.updateAirDiving(playerId, delta)
    }
  },

  cleanup() {
    // Clean up all air diving states
    for (const playerId of this.activePlayers.keys()) {
      this.stopAirDiving(playerId)
    }
    this.activePlayers.clear()
  },
})
