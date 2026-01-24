;({
  init() {
    // Climbing system as an app
    this.activePlayers = new Map()

    console.log('[PlatformerClimbing] App initialized')
  },

  attemptClimbStart(playerId) {
    const player = world.entities.get(playerId)
    if (!player || !player.isLocal) return

    // Check if already climbing
    if (this.activePlayers.has(playerId)) return

    // Check for wall in front
    const wallHit = this.checkWallInFront(player)
    if (!wallHit) return

    // Check if wall is climbable (not too steep)
    const wallAngle = Math.acos(wallHit.normal.y) * (180 / Math.PI)
    if (wallAngle > 45) return // Too steep to climb

    // Start climbing
    this.startClimbing(playerId, wallHit)
  },

  checkWallInFront(player) {
    const pose = player.capsule?.getGlobalPose()
    if (!pose) return null

    const origin = new THREE.Vector3(pose.p.x, pose.p.y, pose.p.z)

    // Cast ray forward from player
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.base.quaternion)
    const hitMask = Layers.environment.group | Layers.prop.group

    return world.physics.raycast(origin, forward, 1.5, hitMask)
  },

  startClimbing(playerId, wallHit) {
    const player = world.entities.get(playerId)
    if (!player) return

    // Set climbing state
    this.activePlayers.set(playerId, {
      wallHit,
      direction: 0, // -1 down, 0 idle, 1 up
      stamina: 100,
    })

    // Set climbing animation
    if (player.avatar) {
      player.avatar.setEmote('asset://mp-climb-idle.glb?s=1.0')
    }

    console.log(`[PlatformerClimbing] Player ${playerId} started climbing`)
  },

  updateClimbing(playerId, delta) {
    const player = world.entities.get(playerId)
    const state = this.activePlayers.get(playerId)

    if (!player || !state) return

    // Drain stamina
    state.stamina -= 2 * delta // 2 per second
    if (state.stamina <= 0) {
      this.stopClimbing(playerId)
      return
    }

    // Check for wall in front
    const wallHit = this.checkWallInFront(player)
    if (!wallHit) {
      this.stopClimbing(playerId)
      return
    }

    // Handle climbing movement
    if (state.direction !== 0) {
      const climbSpeed = 3
      const climbDirection = new THREE.Vector3(0, state.direction, 0)
      const climbForce = climbDirection.multiplyScalar(climbSpeed * 10)

      // Apply climbing force
      if (player.capsule) {
        player.capsule.addForce(climbForce.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }

      // Set animation based on direction
      let animation = 'asset://mp-climb-idle.glb?s=1.0'
      if (state.direction > 0) {
        animation = 'asset://mp-climb-up.glb?s=1.2'
      } else if (state.direction < 0) {
        animation = 'asset://mp-climb-down.glb?s=1.2'
      }

      if (player.avatar) {
        player.avatar.setEmote(animation)
      }
    }
  },

  stopClimbing(playerId) {
    const player = world.entities.get(playerId)
    if (!player) return

    // Clear climbing state
    this.activePlayers.delete(playerId)

    // Clear animation
    if (player.avatar) {
      player.avatar.setEmote(null)
    }

    console.log(`[PlatformerClimbing] Player ${playerId} stopped climbing`)
  },

  update(delta) {
    // Update all active climbing players
    for (const [playerId, state] of this.activePlayers) {
      this.updateClimbing(playerId, delta)
    }
  },

  cleanup() {
    // Clean up all climbing states
    for (const playerId of this.activePlayers.keys()) {
      this.stopClimbing(playerId)
    }
    this.activePlayers.clear()
  },
})
