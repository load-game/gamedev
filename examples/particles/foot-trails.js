app.configure([
	{
		key: 'enabled',
		type: 'toggle',
		label: 'Enable Speed Trails',
		description: 'Toggle speed trails on/off for all players',
		initial: true,
	},
	{
		key: 'customModel',
		type: 'file',
		label: 'Custom Model',
		description: '.glb model to use for particle rendering',
		kind: 'model',
	},
	{
		type: 'section',
		label: 'Particle Size',
	},
	{
		key: 'minParticleScale',
		type: 'range',
		label: 'Min Particle Size',
		description: 'Smallest particle size',
		min: 0.001,
		max: 0.5,
		step: 0.001,
		initial: 0.01,
	},
	{
		key: 'maxParticleScale',
		type: 'range',
		label: 'Max Particle Size',
		description: 'Largest particle size',
		min: 0.01,
		max: 1.0,
		step: 0.01,
		initial: 0.1,
	},
	{
		key: 'scaleMultiplier',
		type: 'range',
		label: 'Scale Multiplier',
		description: 'Overall scale multiplier for all particles',
		min: 0.1,
		max: 5.0,
		step: 0.1,
		initial: 1.0,
	},
	{
		type: 'section',
		label: 'Visual Effects',
	},
	{
		key: 'particleHeightOffset',
		type: 'range',
		label: 'Particle Height Offset',
		description: 'How high above ground particles spawn',
		min: 0,
		max: 1.0,
		step: 0.01,
		initial: 0.05,
	},
	{
		key: 'particleRiseSpeed',
		type: 'range',
		label: 'Rise Speed',
		description: 'How fast particles move upward',
		min: 0,
		max: 2.0,
		step: 0.05,
		initial: 0.25,
	},
	{
		key: 'particleOpacity',
		type: 'range',
		label: 'Particle Opacity',
		description: 'How transparent particles are',
		min: 0.1,
		max: 1.0,
		step: 0.05,
		initial: 0.8,
	},
	{
		key: 'particleColor',
		type: 'color',
		label: 'Particle Color',
		description: 'Base color tint for particles',
		initial: '#ffffff',
	},
	{
		type: 'section',
		label: 'Jump Effects',
	},
	{
		key: 'enableDoubleJump',
		type: 'toggle',
		label: 'Enable Double Jump Effects',
		description: 'Create particle effects when double jumping in air',
		initial: true,
	},
	{
		key: 'doubleJumpSensitivity',
		type: 'range',
		label: 'Double Jump Sensitivity',
		description: 'How sensitive upward velocity detection is',
		min: 1,
		max: 10,
		step: 0.5,
		initial: 3,
	},
	{
		key: 'landingSensitivity',
		type: 'range',
		label: 'Landing Sensitivity',
		description: 'Minimum velocity to trigger landing effects',
		min: 1,
		max: 10,
		step: 0.5,
		initial: 2,
	},
	{
		type: 'section',
		label: 'Debug',
	},
	{
		key: 'debugLogs',
		type: 'toggle',
		label: 'Enable Debug Logs',
		initial: false,
		hint: 'Show detailed console logs for debugging',
	},
])

if (world.isClient) {
	// ===== DEBUG HELPER =====
	function debugLog(...args) {
		if (props.debugLogs) {
			console.log('[foot-trails]', ...args)
		}
	}

	// Use default particle template (like speed-trails.js)
	let particleTemplate = app.get('SpeedParticle')
	if (!particleTemplate) {
		console.error('⚠️ SpeedParticle template not found, creating default sphere')
		particleTemplate = app.create('prim', 'sphere')
		particleTemplate.scale.setScalar(0.05)
		// Move the template way down to hide it
		particleTemplate.position.set(0, -10, 0)
	}
	particleTemplate.visible = false
	world.add(particleTemplate)

	// Load custom model if provided
 let customModelTemplate = null
	let customModelLoaded = false

	if (props.customModel?.url) {
		debugLog('Loading custom model:', props.customModel.url)
		world.load('model', props.customModel.url).then(loadedModel => {
			debugLog('Custom model loaded successfully')
			// Use the first child from the model
			if (loadedModel.children && loadedModel.children.length > 0) {
				customModelTemplate = loadedModel.children[0]
			} else {
				customModelTemplate = loadedModel
			}
			// Make sure it's added to the world and hidden
			if (customModelTemplate.parent) {
				customModelTemplate.visible = false
			} else {
				customModelTemplate.visible = false
				world.add(customModelTemplate)
			}
			customModelLoaded = true
			debugLog('Custom model template ready with mesh type:', customModelTemplate.type)
		}).catch(err => {
			console.error('Failed to load custom model:', err)
			customModelLoaded = false
		})
	} else {
		debugLog('Using default particles (no custom model uploaded)')
	}

	// CONFIG exactly matching speed-trails.js working values
	const CONFIG = {
		TRAIL_RATE: 10, // Match speed-trails exactly
		TRAIL_LIFETIME: 0.5, // Match speed-trails exactly
		TRAIL_HEIGHT_OFFSET: props.particleHeightOffset || 0.05, // Match speed-trails
		TRAIL_SPREAD: 0.35, // From speed-trails
		TRAIL_MAX_SPREAD: 0.45, // From speed-trails
		TRAIL_MIN_SPEED: 0.1, // Match speed-trails exactly
		TRAIL_MAX_SPEED: 0.6, // Match speed-trails exactly
		TRAIL_MIN_SCALE: props.minParticleScale || 0.01, // Match speed-trails
		TRAIL_MAX_SCALE: props.maxParticleScale || 0.1, // Match speed-trails
		TRAIL_PARTICLES: 4, // Match speed-trails exactly
		TRAIL_RISE_SPEED: 0.25, // Match speed-trails exactly
		PLAYER_HEIGHT: 3, // Match speed-trails exactly
		MIN_SPEED_THRESHOLD: 5, // Match speed-trails exactly - CRITICAL for performance
		MAX_RISE_HEIGHT: 1.9, // From speed-trails
		SPAWN_VARIANCE: 0.2, // Match speed-trails exactly
		TRAIL_ZIGZAG: 0.15, // From speed-trails
		GROUND_CHECK_DISTANCE: 0.2, // From speed-trails
		MIN_LANDING_VELOCITY: props.landingSensitivity || 3, // Match speed-trails
		// User-configurable overrides
		SCALE_MULTIPLIER: props.scaleMultiplier || 1.0,
		PARTICLE_OPACITY: props.particleOpacity || 0.8,
		PARTICLE_COLOR: props.particleColor || '#ffffff',
		// Double jump settings - keep these minimal to avoid impact
		ENABLE_DOUBLE_JUMP: props.enableDoubleJump !== false,
		DOUBLE_JUMP_SENSITIVITY: props.doubleJumpSensitivity || 3, // Higher threshold = less frequent
		DOUBLE_JUMP_THRESHOLD: props.doubleJumpSensitivity || 3,
	}

	// State management
	const particles = []
	let lastFootPos = null
	let timeSinceLastTrail = 0
	let isInAir = false
	let wasOnGround = false
	let lastY = 0
	let lastVelocityY = 0
	let jumpCooldown = 0
	let airTime = 0

	const DOWN = new Vector3(0, -1, 0)
	const RAY_DISTANCE = 10

	// Helper functions from speed-trails.js
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

	// Create double jump burst effect (optimized for performance)
	function createDoubleJumpBurst(position, groundY) {
		const particleCount = 8 // Reduced from 12 for better performance
		const moveDir = new Vector3(1, 0, 0) // Default direction
		const perpDir = new Vector3(0, 0, 1)

		for (let i = 0; i < particleCount; i++) {
			let trail
			if (customModelLoaded && customModelTemplate) {
				trail = customModelTemplate.clone(true)
			} else {
				trail = particleTemplate.clone(true)
			}
			trail.visible = true

			// Larger scale for double jump effects
			const scale = CONFIG.TRAIL_MAX_SCALE * 1.5 * CONFIG.SCALE_MULTIPLIER
			trail.scale.multiplyScalar(scale)
			trail.initialScale = scale
			trail.targetScale = scale * 3 // Larger target scale

			// Apply user settings
			if (trail.material) {
				trail.material.color = CONFIG.PARTICLE_COLOR
				trail.material.opacity = CONFIG.PARTICLE_OPACITY
			}

			const spawnPos = position.clone()
			const angle = (Math.PI * 2 * i) / particleCount + num(-0.3, 0.3, 2)
			const radius = 0.6 * num(0.9, 1.3, 2) // Larger burst radius

			// Create circular burst pattern (like meteors.js explosion)
			spawnPos.x += Math.cos(angle) * radius
			spawnPos.z += Math.sin(angle) * radius
			spawnPos.y = groundY + CONFIG.TRAIL_HEIGHT_OFFSET + num(0.1, 0.3, 2)

			trail.position.copy(spawnPos)
			trail.groundY = groundY
			trail.initialY = spawnPos.y

			// More explosive upward velocity (inspired by meteors.js)
			const speed = CONFIG.TRAIL_MAX_SPEED * num(2, 4, 2)
			trail.velocity = {
				x: Math.cos(angle) * speed * 0.7,
				y: CONFIG.TRAIL_RISE_SPEED * num(2, 3, 2), // Stronger upward burst
				z: Math.sin(angle) * speed * 0.7,
			}

			trail.lifetime = 0
			trail.maxLifetime = CONFIG.TRAIL_LIFETIME * 1.2 // Slightly longer lifetime

			particles.push(trail)
			world.add(trail)
		}
	}

	// Update loop matching speed-trails.js
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

		// Update jump cooldown and air time
		if (jumpCooldown > 0) jumpCooldown -= delta
		if (isInAir) airTime += delta
		else airTime = 0

		// Calculate current vertical velocity
		const currentVelocityY = (player.position.y - lastY) / delta
		const velocityChange = currentVelocityY - lastVelocityY

		// Check ground state
		const wasInAir = isInAir
		const isOnGroundNow = posInfo.distanceToGround <= CONFIG.GROUND_CHECK_DISTANCE
		isInAir = !isOnGroundNow

		// Minimal jump detection - just 1 particle to avoid freeze
		if (CONFIG.ENABLE_DOUBLE_JUMP && jumpCooldown <= 0) {
			// Only detect double jumps with higher threshold to reduce frequency
			if (isInAir && airTime > 0.1 && currentVelocityY > 4) {
				debugLog('Jump detected!')
				// Create 1 particle exactly like speed-trails landing burst
				const trail = particleTemplate.clone(true)
				trail.visible = true
				const scale = CONFIG.TRAIL_MAX_SCALE * CONFIG.SCALE_MULTIPLIER
				trail.scale.multiplyScalar(scale)
				trail.groundY = posInfo.groundY
				trail.initialY = posInfo.groundY + CONFIG.TRAIL_HEIGHT_OFFSET
				trail.position.set(
					player.position.x + num(-0.1, 0.1, 2),
					trail.initialY,
					player.position.z + num(-0.1, 0.1, 2)
				)
				trail.velocity = {x: 0, y: CONFIG.TRAIL_RISE_SPEED * 2, z: 0}
				trail.lifetime = 0
				trail.maxLifetime = 0.3
				particles.push(trail)
				world.add(trail)
				jumpCooldown = 0.5
			}
		}

		// Handle landing impact (more generous detection)
		if (wasInAir && !isInAir && airTime > 0.05) { // Reduced airTime requirement from 0.1s
			const fallVelocity = Math.abs(lastVelocityY) // Use actual velocity instead of position difference
			// Also consider small hops as landing events for more feedback
			const shouldTriggerLanding = fallVelocity > CONFIG.MIN_LANDING_VELOCITY || airTime > 0.15
			if (shouldTriggerLanding) {
				debugLog('Landing impact detected! Velocity:', fallVelocity.toFixed(2), 'Air time:', airTime.toFixed(2))

				// Create landing burst
				const moveDir = footPos.clone().sub(lastFootPos).normalize()
				const perpDir = new Vector3(-moveDir.z, 0, moveDir.x)

				// Create burst of particles - optimized for performance
				const particleCount = fallVelocity > 3 ? 8 : 6 // Reduced from 12/8 to 8/6
				for (let i = 0; i < particleCount; i++) {
					let trail
					if (customModelLoaded && customModelTemplate) {
						// Clone the loaded custom model
						trail = customModelTemplate.clone(true)
						debugLog('Using custom model particle')
					} else {
						// Clone the default template
						trail = particleTemplate.clone(true)
					}
					trail.visible = true

					const scale = CONFIG.TRAIL_MAX_SCALE * (0.8 + num(0, 0.4, 2)) * CONFIG.SCALE_MULTIPLIER
					trail.scale.multiplyScalar(scale)
					trail.initialScale = scale
					trail.targetScale = scale * 2.5 // Slightly larger target scale

					// Apply user settings for landing burst
					if (trail.material) {
						trail.material.color = CONFIG.PARTICLE_COLOR
						trail.material.opacity = CONFIG.PARTICLE_OPACITY
					}

					const spawnPos = footPos.clone()
					const angle = (Math.PI * 2 * i) / particleCount + num(-0.2, 0.2, 2)
					const radius = 0.5 * num(0.8, 1.2, 2) // Slightly larger burst radius

					spawnPos.x += Math.cos(angle) * radius
					spawnPos.z += Math.sin(angle) * radius
					spawnPos.y = posInfo.groundY + CONFIG.TRAIL_HEIGHT_OFFSET

					trail.position.copy(spawnPos)
					trail.groundY = posInfo.groundY
					trail.initialY = spawnPos.y

					const speed = CONFIG.TRAIL_MAX_SPEED * (1.5 + num(0, 0.5, 2)) // More speed variation
					trail.velocity = {
						x: Math.cos(angle) * speed,
						y: CONFIG.TRAIL_RISE_SPEED * (2 + num(0, 0.5, 2)), // More upward variation
						z: Math.sin(angle) * speed,
					}

					trail.lifetime = 0
					trail.maxLifetime = CONFIG.TRAIL_LIFETIME * (0.8 + num(0, 0.4, 2)) // Variable lifetime

					particles.push(trail)
					world.add(trail)
				}
			}
		}

		// Create regular trails when on ground - exact speed-trails logic
		if (!isInAir && playerSpeed > CONFIG.MIN_SPEED_THRESHOLD) { // Match speed-trails exactly
			timeSinceLastTrail += delta * (1 + num(-0.5, 0.5, 2) * CONFIG.SPAWN_VARIANCE) // Match speed-trails

			if (timeSinceLastTrail >= 1 / CONFIG.TRAIL_RATE) {
				timeSinceLastTrail = -num(0, 0.1, 2) // Match speed-trails exactly

				const moveDir = footPos.clone().sub(lastFootPos).normalize()
				const perpDir = new Vector3(-moveDir.z, 0, moveDir.x)

				// Reduce particle count for performance, but make them more visible
				const particleCount = Math.min(CONFIG.TRAIL_PARTICLES, 4) // Cap at 4 for performance
				for (let i = 0; i < particleCount; i++) {
					let trail
					if (customModelLoaded && customModelTemplate) {
						// Clone the loaded custom model
						trail = customModelTemplate.clone(true)
						debugLog('Using custom model particle')
					} else {
						// Clone the default template
						trail = particleTemplate.clone(true)
					}
					trail.visible = true

					const scaleVariance = num(0.7, 1.0, 2)
					const initialScale = num(CONFIG.TRAIL_MIN_SCALE, CONFIG.TRAIL_MAX_SCALE * 0.5, 2) * scaleVariance * CONFIG.SCALE_MULTIPLIER
					trail.scale.multiplyScalar(initialScale)
					trail.initialScale = initialScale
					trail.targetScale = initialScale * (num(1.5, 2.5, 2) * scaleVariance)

					// Apply user settings for regular trails
					if (trail.material) {
						trail.material.color = CONFIG.PARTICLE_COLOR
						trail.material.opacity = CONFIG.PARTICLE_OPACITY
					}

					// Simple working particle spawn
					const spawnPos = footPos.clone()
					const spreadDist = num(-CONFIG.TRAIL_SPREAD, CONFIG.TRAIL_SPREAD, 2)
					spawnPos.x += perpDir.x * spreadDist
					spawnPos.z += perpDir.z * spreadDist
					spawnPos.y = posInfo.groundY + CONFIG.TRAIL_HEIGHT_OFFSET

					trail.position.copy(spawnPos)
					trail.groundY = posInfo.groundY
					trail.initialY = spawnPos.y

					trail.velocity = {
						x: num(-0.3, 0.3, 2),
						y: CONFIG.TRAIL_RISE_SPEED * 0.5 + num(0, 0.1, 2),
						z: num(-0.3, 0.3, 2),
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
		lastVelocityY = currentVelocityY
		wasOnGround = !isInAir

		// Simple working particle update loop
		for (let i = particles.length - 1; i >= 0; i--) {
			const particle = particles[i]
			particle.lifetime += delta

			if (particle.lifetime >= particle.maxLifetime) {
				world.remove(particle)
				particles.splice(i, 1)
				continue
			}

			const lifeProgress = particle.lifetime / particle.maxLifetime

			// Simple velocity damping (back to working version)
			particle.velocity.x *= 0.98
			particle.velocity.y *= 0.98
			particle.velocity.z *= 0.98

			// Simple position update
			particle.position.x += particle.velocity.x * delta
			particle.position.y += particle.velocity.y * delta
			particle.position.z += particle.velocity.z * delta

			// Ground clamping (simple)
			if (particle.position.y < particle.groundY + CONFIG.TRAIL_HEIGHT_OFFSET) {
				particle.position.y = particle.groundY + CONFIG.TRAIL_HEIGHT_OFFSET
				particle.velocity.y = 0
			}

			// Simple scaling (back to working)
			if (particle.initialScale && particle.targetScale) {
				const targetScale = particle.initialScale + (particle.targetScale - particle.initialScale) * lifeProgress
				particle.scale.setScalar(targetScale)
			}

			// Simple fade out
			particle.opacity = (1 - lifeProgress) * CONFIG.PARTICLE_OPACITY
		}
	})
}