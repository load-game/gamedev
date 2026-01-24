app.configure([
  {
    key: 'enabled',
    type: 'toggle',
    label: 'Enable Speed Trails',
    description: 'Toggle speed trails on/off for all players',
    initial: true,
  },
])

if (world.isClient) {
  const speedParticle = app.get('SpeedParticle')
  if (!speedParticle) {
    console.error('SpeedParticle particle template not found')
    return
  }
  speedParticle.visible = false

  // Add jump detection to existing CONFIG
  const CONFIG = {
    // Keep all original CONFIG values exactly as they were
    TRAIL_RATE: 10,
    TRAIL_LIFETIME: 0.5,
    TRAIL_HEIGHT_OFFSET: 0.05,
    TRAIL_SPREAD: 0.35,
    TRAIL_MAX_SPREAD: 0.45,
    TRAIL_MIN_SPEED: 0.1,
    TRAIL_MAX_SPEED: 0.6,
    TRAIL_MIN_SCALE: 0.01,
    TRAIL_MAX_SCALE: 0.1,
    TRAIL_PARTICLES: 4,
    TRAIL_RISE_SPEED: 0.25,
    PLAYER_HEIGHT: 3,
    MIN_SPEED_THRESHOLD: 5,
    MAX_RISE_HEIGHT: 1.9,
    SPAWN_VARIANCE: 0.2,
    TRAIL_ZIGZAG: 0.15,

    // Add only these new configs
    GROUND_CHECK_DISTANCE: 0.2,
    MIN_LANDING_VELOCITY: 3,
  }

  // Keep original state management
  const particles = []
  let lastFootPos = null
  let timeSinceLastTrail = 0

  // Add only these new state variables
  let isInAir = false
  let lastY = 0

  const DOWN = new Vector3(0, -1, 0)
  const RAY_DISTANCE = 10

  // Modified to include ground distance
  function getPositionInfo(playerPos) {
    const hit = world.raycast(playerPos, DOWN, RAY_DISTANCE)

    if (hit && hit.point) {
      const groundY = hit.point.y
      const footPos = playerPos.clone()
      footPos.y = groundY

      return {
        groundY,
        footPos,
        distanceToGround: playerPos.y - groundY,
      }
    }

    const footPos = playerPos.clone()
    footPos.y -= CONFIG.PLAYER_HEIGHT
    return {
      groundY: footPos.y,
      footPos,
      distanceToGround: CONFIG.PLAYER_HEIGHT,
    }
  }

  // Keep all original helper functions exactly as they were
  function getPlayerVelocity(currentPos, lastPos, delta) {
    if (!lastPos) return 0
    const distance = currentPos.distanceTo(lastPos)
    return distance / delta
  }

  function getSpreadMultiplier(lifeProgress) {
    const peak = 0.5
    const x = lifeProgress - peak
    const variance = 0.15
    const bellCurve = Math.exp(-(x * x) / (2 * variance * variance))

    const baseSpread = CONFIG.TRAIL_SPREAD
    const maxSpreadIncrease = CONFIG.TRAIL_MAX_SPREAD - CONFIG.TRAIL_SPREAD
    return baseSpread + maxSpreadIncrease * bellCurve
  }

  function randomizeSpawnPosition(basePos, moveDir) {
    const angle = num(0, Math.PI * 2, 2)
    const radius = num(0, CONFIG.TRAIL_SPREAD * 0.5, 2)

    basePos.x += Math.cos(angle) * radius
    basePos.z += Math.sin(angle) * radius

    basePos.x += moveDir.x * num(-0.5, 0.5, 2) * 0.3
    basePos.z += moveDir.z * num(-0.5, 0.5, 2) * 0.3

    return basePos
  }

  app.on('update', delta => {
    if (!props.enabled) return

    const player = world.getPlayer()
    if (!player?.position) return

    const posInfo = getPositionInfo(player.position)
    const footPos = posInfo.footPos

    if (!lastFootPos) {
      lastFootPos = footPos.clone()
      lastY = player.position.y
      return
    }

    const playerSpeed = getPlayerVelocity(footPos, lastFootPos, delta)

    // Check ground state
    const wasInAir = isInAir
    isInAir = posInfo.distanceToGround > CONFIG.GROUND_CHECK_DISTANCE

    // Check landing impact
    if (wasInAir && !isInAir) {
      const fallVelocity = Math.abs(lastY - player.position.y) / delta
      if (fallVelocity > CONFIG.MIN_LANDING_VELOCITY) {
        // Create landing burst using existing trail system
        const moveDir = footPos.clone().sub(lastFootPos).normalize()
        const perpDir = new Vector3(-moveDir.z, 0, moveDir.x)

        // Create burst of particles
        for (let i = 0; i < 8; i++) {
          const trail = speedParticle.clone(true)
          trail.visible = true

          const scale = CONFIG.TRAIL_MAX_SCALE * (0.8 + num(0, 0.4, 2))
          trail.scale.multiplyScalar(scale)
          trail.initialScale = scale
          trail.targetScale = scale * 2

          const spawnPos = footPos.clone()
          const angle = (Math.PI * 2 * i) / 8 + num(-0.2, 0.2, 2)
          const radius = 0.4 * num(0.8, 1.2, 2)

          spawnPos.x += Math.cos(angle) * radius
          spawnPos.z += Math.sin(angle) * radius
          spawnPos.y = posInfo.groundY + CONFIG.TRAIL_HEIGHT_OFFSET

          trail.position.copy(spawnPos)
          trail.groundY = posInfo.groundY
          trail.initialY = spawnPos.y

          const speed = CONFIG.TRAIL_MAX_SPEED * 1.5
          trail.velocity = {
            x: Math.cos(angle) * speed,
            y: CONFIG.TRAIL_RISE_SPEED * 2,
            z: Math.sin(angle) * speed,
          }

          trail.lifetime = 0
          trail.maxLifetime = CONFIG.TRAIL_LIFETIME

          particles.push(trail)
          world.add(trail)
        }
      }
    }

    // Only create regular trails when on ground
    if (!isInAir && playerSpeed > CONFIG.MIN_SPEED_THRESHOLD) {
      timeSinceLastTrail += delta * (1 + num(-0.5, 0.5, 2) * CONFIG.SPAWN_VARIANCE)

      if (timeSinceLastTrail >= 1 / CONFIG.TRAIL_RATE) {
        timeSinceLastTrail = -num(0, 0.1, 2)

        const moveDir = footPos.clone().sub(lastFootPos).normalize()
        const perpDir = new Vector3(-moveDir.z, 0, moveDir.x)

        for (let i = 0; i < CONFIG.TRAIL_PARTICLES; i++) {
          const trail = speedParticle.clone(true)
          trail.visible = true

          const scaleVariance = num(0.7, 1.0, 2)
          const initialScale = num(CONFIG.TRAIL_MIN_SCALE, CONFIG.TRAIL_MAX_SCALE * 0.5, 2) * scaleVariance
          trail.scale.multiplyScalar(initialScale)
          trail.initialScale = initialScale
          trail.targetScale = initialScale * (num(1.5, 2.5, 2) * scaleVariance)

          const spawnPos = footPos.clone()
          randomizeSpawnPosition(spawnPos, moveDir)

          trail.moveDir = moveDir.clone()
          trail.perpVector = perpDir.clone()
          trail.basePos = spawnPos.clone()

          const spreadDist = num(-CONFIG.TRAIL_SPREAD, CONFIG.TRAIL_SPREAD, 2)
          spawnPos.x += perpDir.x * spreadDist
          spawnPos.z += perpDir.z * spreadDist
          spawnPos.y = posInfo.groundY + CONFIG.TRAIL_HEIGHT_OFFSET + num(0, 0.05, 2)

          trail.position.copy(spawnPos)
          trail.groundY = posInfo.groundY
          trail.initialY = spawnPos.y
          trail.spreadOffset = spreadDist

          trail.zigzagPhase = num(0, Math.PI * 2, 2)
          trail.zigzagSpeed = num(5, 10, 2)

          const speed = num(CONFIG.TRAIL_MIN_SPEED, CONFIG.TRAIL_MAX_SPEED, 2)
          const angleVariance = num(-0.5, 0.5, 2) * Math.PI * 0.25
          const vx = Math.cos(angleVariance) * moveDir.x - Math.sin(angleVariance) * moveDir.z
          const vz = Math.sin(angleVariance) * moveDir.x + Math.cos(angleVariance) * moveDir.z

          trail.velocity = {
            x: vx * speed * 0.5 + num(-0.3, 0.3, 2),
            y: CONFIG.TRAIL_RISE_SPEED * 0.5 + num(0, 0.1, 2),
            z: vz * speed * 0.5 + num(-0.3, 0.3, 2),
          }

          trail.lifetime = num(0, 0.1, 2)
          trail.maxLifetime = CONFIG.TRAIL_LIFETIME + num(-0.2, 0.2, 2)

          particles.push(trail)
          world.add(trail)
        }
      }
    }

    lastFootPos.copy(footPos)
    lastY = player.position.y

    // Keep original particle update loop exactly as is
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i]
      particle.lifetime += delta

      if (particle.lifetime >= particle.maxLifetime) {
        world.remove(particle)
        particles.splice(i, 1)
      } else {
        const lifeProgress = particle.lifetime / particle.maxLifetime

        const currentSpread = getSpreadMultiplier(lifeProgress)
        const spreadRatio = currentSpread / CONFIG.TRAIL_SPREAD

        particle.velocity.x *= 0.98
        particle.velocity.z *= 0.98

        const newPos = particle.basePos ? particle.basePos.clone() : particle.position.clone()
        newPos.x += particle.velocity.x * delta
        newPos.z += particle.velocity.z * delta

        if (particle.perpVector && particle.spreadOffset) {
          const zigzagAmount =
            Math.sin(particle.zigzagPhase + particle.lifetime * particle.zigzagSpeed) *
            CONFIG.TRAIL_ZIGZAG *
            (1 - lifeProgress)

          const totalSpread = particle.spreadOffset * spreadRatio + zigzagAmount
          newPos.x += particle.perpVector.x * totalSpread
          newPos.z += particle.perpVector.z * totalSpread
        }

        const maxHeight = particle.initialY + CONFIG.MAX_RISE_HEIGHT
        if (particle.position.y >= maxHeight) {
          particle.velocity.y = Math.min(0, particle.velocity.y)
        }

        newPos.y += particle.velocity.y * delta
        particle.position.copy(newPos)

        const minHeight = particle.groundY + CONFIG.TRAIL_HEIGHT_OFFSET + num(0, 0.02, 2)
        if (particle.position.y < minHeight) {
          particle.position.y = minHeight
          particle.velocity.y = Math.max(0, particle.velocity.y)
        }

        if (particle.initialScale && particle.targetScale) {
          const scaleProgress = lifeProgress + num(-0.05, 0.05, 2)
          const targetScale = particle.initialScale + (particle.targetScale - particle.initialScale) * scaleProgress
          particle.scale.setScalar(targetScale)
        }

        const heightFade = Math.max(0, 1 - (particle.position.y - particle.groundY) / 2)
        particle.opacity = (1 - lifeProgress) * heightFade * num(0.9, 1.0, 2)

        if (particle.zigzagPhase !== undefined) {
          particle.zigzagPhase += delta * particle.zigzagSpeed
        }
      }
    }
  })
}
