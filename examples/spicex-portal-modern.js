const portal = app.get('SpiceXPortal')
const rim = app.get('Rim')

app.configure([
	{
		type: 'section',
		key: 'general',
		label: 'Portal Settings'
	},
	{
		key: 'isActive',
		type: 'switch',
		label: 'Portal Active',
		options: [
			{ label: 'On', value: true },
			{ label: 'Off', value: false }
		],
		initial: true,
		description: 'Turn the portal on/off'
	},
	{
		key: 'portalName',
		type: 'text',
		label: 'Warp Destination',
		initial: 'Google',
	},
	{
		key: 'subtitle',
		type: 'text',
		label: 'Warp Description',
		initial: 'You can just go places',
	},
	{
		key: 'inactiveSubtitle',
		type: 'text',
		label: 'Inactive Description',
		initial: 'System offline - electrical fault detected',
		description: 'Text shown when portal is inactive/malfunctioning'
	},
	{
		key: 'worldUrl',
		type: 'text',
		label: 'Destination World URL',
		placeholder: 'https://google.com',
	},
	{
		key: 'newTab',
		type: 'switch',
		label: 'Open in New Tab',
		options: [
			{ label: 'Yes', value: true },
			{ label: 'No', value: false }
		],
		initial: true,
		description: 'Whether to open the world in a new tab or the current tab'
	},
	{
		type: 'section',
		key: 'audioSection',
		label: 'Audio Settings'
	},
	{
		type: 'file',
		key: 'audio',
		kind: 'audio',
		label: 'Audio File'
	},
	{
		type: 'range',
		key: 'volume',
		label: 'Volume',
		min: 0,
		max: 1,
		step: 0.1,
		initial: 0.6
	},
	{
		type: 'dropdown',
		key: 'audioType',
		label: 'Audio Type',
		options: [
			{ label: 'Music', value: 'music' },
			{ label: 'Sound Effect', value: 'sfx' }
		],
		initial: 'music'
	},
	{
		type: 'switch',
		key: 'loop',
		label: 'Loop Audio',
		options: [
			{ label: 'Loop On', value: true },
			{ label: 'Loop Off', value: false }
		],
		initial: false
	},
	{
		type: 'checkbox',
		key: 'spatial',
		label: 'Spatial Audio',
		initial: true
	},
	{
		type: 'section',
		key: 'spatialSection',
		label: 'Spatial Audio Settings'
	},
	{
		type: 'dropdown',
		key: 'distanceModel',
		label: 'Distance Model',
		options: [
			{ label: 'Linear', value: 'linear' },
			{ label: 'Inverse', value: 'inverse' },
			{ label: 'Exponential', value: 'exponential' }
		],
		initial: 'inverse'
	},
	{
		type: 'number',
		key: 'refDistance',
		label: 'Reference Distance',
		min: 0,
		max: 10,
		step: 0.1,
		initial: 1
	},
	{
		type: 'number',
		key: 'maxDistance',
		label: 'Maximum Distance',
		min: 1,
		max: 100,
		step: 1,
		initial: 40
	},
	{
		type: 'number',
		key: 'rolloffFactor',
		label: 'Rolloff Factor',
		min: 0,
		max: 10,
		step: 0.1,
		initial: 3
	},
	{
		type: 'section',
		key: 'coneSection',
		label: 'Sound Cone Settings'
	},
	{
		type: 'number',
		key: 'coneInnerAngle',
		label: 'Cone Inner Angle',
		min: 0,
		max: 360,
		step: 1,
		initial: 360
	},
	{
		type: 'number',
		key: 'coneOuterAngle',
		label: 'Cone Outer Angle',
		min: 0,
		max: 360,
		step: 1,
		initial: 360
	},
	{
		type: 'range',
		key: 'coneOuterGain',
		label: 'Cone Outer Gain',
		min: 0,
		max: 1,
		step: 0.1,
		initial: 0
	},
	{
		type: 'section',
		key: 'particleSection',
		label: 'Portal Particle Settings'
	},
	{
		key: 'useHybridParticles',
		type: 'switch',
		label: 'Use Hybrid Particle System',
		options: [
			{ label: 'On', value: true },
			{ label: 'Off', value: false }
		],
		initial: true,
		description: 'Combine built-in particles with legacy mesh particles'
	},
	{
		key: 'particleCount',
		type: 'number',
		label: 'Built-in Max Particles',
		min: 100,
		max: 1000,
		step: 50,
		initial: 300
	},
	{
		key: 'particleRate',
		type: 'number',
		label: 'Built-in Spawn Rate',
		min: 10,
		max: 100,
		step: 5,
		initial: 40
	},
	{
		key: 'particleLifetime',
		type: 'range',
		label: 'Built-in Particle Lifetime',
		min: 0.5,
		max: 3,
		step: 0.1,
		initial: 1.2
	},
	{
		key: 'portalColor',
		type: 'color',
		label: 'Portal Color',
		initial: '#00ffff'
	},
	{
		key: 'particleSpeed',
		type: 'range',
		label: 'Built-in Particle Speed',
		min: 0.5,
		max: 5,
		step: 0.1,
		initial: 2.0
	},
	{
		key: 'manualParticleCount',
		type: 'number',
		label: 'Legacy Max Particles',
		min: 50,
		max: 400,
		step: 25,
		initial: 200,
		when: [{ key: 'useHybridParticles', op: 'eq', value: true }]
	},
	{
		key: 'manualParticleRate',
		type: 'number',
		label: 'Legacy Spawn Rate',
		min: 10,
		max: 60,
		step: 5,
		initial: 30,
		when: [{ key: 'useHybridParticles', op: 'eq', value: true }]
	},
	{
		type: 'section',
		key: 'inactiveSection',
		label: 'Inactive Portal Spark Settings'
	},
	{
		key: 'sparkCount',
		type: 'number',
		label: 'Max Sparks (Inactive)',
		min: 10,
		max: 100,
		step: 5,
		initial: 50
	},
	{
		key: 'sparkRate',
		type: 'number',
		label: 'Spark Spawn Rate (Inactive)',
		min: 1,
		max: 10,
		step: 1,
		initial: 2
	},
	{
		key: 'sparkColor',
		type: 'color',
		label: 'Spark Color (Inactive)',
		initial: '#ffaa00'
	},
	{
		type: 'section',
		key: 'sparkAudioSection',
		label: 'Inactive Spark Audio Settings'
	},
	{
		key: 'sparkAudioFile',
		type: 'file',
		kind: 'audio',
		label: 'Spark Audio File',
		description: 'Audio file for electrical spark sounds (optional - defaults to procedural)'
	},
	{
		key: 'sparkAudioEnabled',
		type: 'switch',
		label: 'Enable Spark Audio',
		options: [
			{ label: 'On', value: true },
			{ label: 'Off', value: false }
		],
		initial: true,
		description: 'Play electrical spark sounds when portal is inactive'
	},
	{
		key: 'sparkAudioVolume',
		type: 'range',
		label: 'Spark Audio Volume',
		min: 0,
		max: 1,
		step: 0.1,
		initial: 0.3,
		description: 'Volume of spark audio bursts'
	},
	{
		key: 'sparkAudioPitch',
		type: 'range',
		label: 'Spark Pitch Variance',
		min: 0.5,
		max: 2,
		step: 0.1,
		initial: 1.2,
		description: 'Pitch variation for spark sounds (higher = more electric)'
	},
	{
		key: 'sparkAudioSpatial',
		type: 'checkbox',
		label: 'Spatial Spark Audio',
		initial: true,
		description: '3D spatial audio for spark sounds'
	},
	{
		key: 'portalSpin',
		type: 'switch',
		label: 'Enable Rim Spin',
		options: [
			{ label: 'On', value: true },
			{ label: 'Off', value: false }
		],
		initial: true
	}
])

// Add a static rigidbody and trigger collider to the portal
const portalBody = app.create('rigidbody')
portalBody.type = 'static'
portal.add(portalBody)

const portalCollider = app.create('collider')
portalCollider.type = 'box'
portalCollider.setSize(2, 3, 1)
portalCollider.trigger = true
portalBody.add(portalCollider)

// Audio setup
const audio = app.create('audio', {
	src: props.audio?.url,
	volume: props.volume || 0.6,
	group: props.audioType || 'music',
	loop: props.loop || false,
	spatial: props.spatial || true,
	distanceModel: props.distanceModel || 'inverse',
	refDistance: props.refDistance || 1,
	maxDistance: props.maxDistance || 40,
	rolloffFactor: props.rolloffFactor || 3,
	coneInnerAngle: props.coneInnerAngle || 360,
	coneOuterAngle: props.coneOuterAngle || 360,
	coneOuterGain: props.coneOuterGain || 0
})
portal.add(audio)

// Spark burst audio setup (for when portal is inactive)
let sparkAudio = null
if (props.sparkAudioEnabled !== false) {
	sparkAudio = app.create('audio', {
		src: props.sparkAudioFile?.url || null, // Use spark audio file if provided, otherwise null
		volume: props.sparkAudioVolume || 0.3,
		group: 'sfx',
		loop: false, // Each spark is a single shot
		spatial: props.sparkAudioSpatial !== false,
		distanceModel: 'inverse',
		refDistance: 1,
		maxDistance: 20,
		rolloffFactor: 2
	})
	portal.add(sparkAudio)

	console.log('[PORTAL] Spark audio node created and configured')

	// Note: If no audio file is provided, you could potentially generate procedural audio
	// or use a default electrical/crackling sound effect
	if (!props.sparkAudioFile?.url) {
		console.log('[PORTAL] No spark audio file specified - electrical sound effect will be simulated through volume/pitch variations')
	}
}

// Portal Configuration
const PORTAL_CONFIG = {
	UI: {
		width: 200,
		height: 80,
		yOffset: 2,
		fontSize: {
			title: 20,
			subtitle: 16
		},
		colors: {
			title: '#ffffff',
			subtitle: '#33ff00',
			background: 'rgba(0, 15, 30, 0.85)'
		},
		style: {
			padding: 15,
			borderRadius: 12,
			gap: 5
		}
	}
}

if (world.isClient) {
	// Create UI container
	const ui = app.create('ui', {
		width: PORTAL_CONFIG.UI.width,
		height: PORTAL_CONFIG.UI.height,
		backgroundColor: 'transparent'
	})
	ui.billboard = 'y'
	ui.position.y = PORTAL_CONFIG.UI.yOffset
	ui.backgroundColor = PORTAL_CONFIG.UI.colors.background
	ui.borderRadius = PORTAL_CONFIG.UI.style.borderRadius
	ui.padding = PORTAL_CONFIG.UI.style.padding
	ui.gap = PORTAL_CONFIG.UI.style.gap
	ui.justifyContent = 'center'
	ui.alignItems = 'center'
	ui.position.x = -2
	ui.position.z = 3

	// Create portal name label
	const label = app.create('uitext')
	label.value = props.portalName
	label.fontSize = PORTAL_CONFIG.UI.fontSize.title
	label.color = PORTAL_CONFIG.UI.colors.title
	label.textAlign = 'center'

	// Create subtitle label
	const subtitleLabel = app.create('uitext')
	subtitleLabel.value = props.subtitle
	subtitleLabel.fontSize = PORTAL_CONFIG.UI.fontSize.subtitle
	subtitleLabel.color = PORTAL_CONFIG.UI.colors.subtitle
	subtitleLabel.textAlign = 'center'
	subtitleLabel.position.y = -25

	ui.add(label)
	ui.add(subtitleLabel)
	portal.add(ui)

	// Original particle mesh as reference transform and visual anchor
	let particleReference = app.get('Particle')
	if (!particleReference) {
		// Create reference particle mesh at portal origin
		particleReference = app.create('mesh')
		particleReference.scale.setScalar(0.1)
		const material = {
			emissive: props.portalColor || '#00ffff',
			emissiveIntensity: 3,
			transparent: true,
			opacity: 0.7
		}
		particleReference.material = material
		particleReference.id = 'PortalParticleReference'
	}
	particleReference.active = false // Deactivate the reference mesh, but keep it as transform
	portal.add(particleReference)

	// Modern built-in particle system positioned at the reference transform
	const portalParticles = app.create('particles', {
		max: props.particleCount || 300,
		rate: props.particleRate || 40,
		life: String(props.particleLifetime || 1.2),
		speed: String(props.particleSpeed || 2.0),
		size: '0.05~0.15',
		opacity: '0.8~1.0',
		color: props.portalColor || '#00ffff',
		emissive: '2',
		shape: ['circle', 0.2, 0, true], // Emission radius matches original spawn radius
		direction: 2, // Emit horizontally (0=up, 1=down, 2=side/horizontal)
		blending: 'additive',
		space: 'world',
		rotate: '0~360' // Random rotation (string ranges allowed here)
	})

	// Create inactive particle effect - random bursts when portal is shorted out
	const inactiveParticles = app.create('particles', {
		max: props.sparkCount || 50, // Much fewer particles for spark effect
		rate: 0, // Initially 0 - we'll control bursts manually
		life: '0.3~0.8', // Shorter, more random lifetime
		speed: '1~4', // More random speed
		size: '0.02~0.08', // Smaller sparks
		opacity: '0.5~1.0', // More random opacity
		color: props.sparkColor || '#ffaa00', // Orange/yellow spark color
		emissive: '5', // Brighter emissive for sparks
		shape: ['sphere', 0.1, 1, true], // Random sphere placement
		direction: 2, // Use horizontal direction and let rotate provide randomness
		blending: 'additive',
		space: 'world',
		rotate: '0~360' // Random rotation for spark directions
	})

	// Position both particle systems at the reference transform
	portalParticles.position.copy(particleReference.position)
	inactiveParticles.position.copy(particleReference.position)
	portal.add(portalParticles)
	portal.add(inactiveParticles)

	// Get rim reference - it should already be available from line 2
	console.log('[PORTAL] Original rim reference from line 2:', rim)
	if (rim) {
		console.log('[PORTAL] Rim initial active state:', rim.active)
		console.log('[PORTAL] Rim type/check:', typeof rim, rim.constructor?.name)
	}

	// Burst timing variables for inactive particle effect
	let nextBurstTime = 0
	let burstCooldown = 0

	// Optional: Legacy manual particles for richer effect if desired
	const useLegacyParticles = props.useHybridParticles !== false
	if (useLegacyParticles) {
		const rim = app.get('Rim')

		// Configuration for manual particles using configured values
		const MANUAL_CONFIG = {
			MAX_PARTICLES: props.manualParticleCount || 200,
			SPAWN_RATE: props.manualParticleRate || 30,
			LIFETIME: 0.6,
			MIN_SPEED: 1.5,
			MAX_SPEED: 3,
			MIN_SCALE: 0.05,
			MAX_SCALE: 0.12,
			SPAWN_RADIUS: 0.2,
			BURST_INTERVAL: 0.03,
			PARTICLES_PER_BURST: 2
		}

		// Manual particle state
		const manualParticles = []
		let lastManualSpawnTime = 0

		// Spawn manual particle function
		function spawnManualParticle() {
			if (manualParticles.length >= MANUAL_CONFIG.MAX_PARTICLES) return
			if (!particleReference) return

			const particle = particleReference.clone()
			particle.active = true

			// Spawn around the reference point
			const angle = Math.random() * Math.PI * 2
			const radius = Math.random() * MANUAL_CONFIG.SPAWN_RADIUS
			particle.position.set(
				Math.cos(angle) * radius,
				Math.sin(angle) * radius,
				Math.random() * 0.3 - 0.15 // Random Z offset
			)

			// More varied velocity
			const speed = MANUAL_CONFIG.MIN_SPEED + Math.random() * (MANUAL_CONFIG.MAX_SPEED - MANUAL_CONFIG.MIN_SPEED)
			const randomAngle = Math.random() * Math.PI * 2

			particle.velocity = {
				x: Math.cos(randomAngle) * speed + (Math.random() - 0.5) * 0.5,
				y: Math.sin(randomAngle) * speed + (Math.random() - 0.5) * 0.5,
				z: (Math.random() - 0.5) * 2 // More Z movement
			}

			const startScale = MANUAL_CONFIG.MIN_SCALE + Math.random() * (MANUAL_CONFIG.MAX_SCALE - MANUAL_CONFIG.MIN_SCALE)
			particle.scale.setScalar(startScale)
			particle.rotation.z = Math.random() * Math.PI * 2

			particle.lifetime = MANUAL_CONFIG.LIFETIME * (0.8 + Math.random() * 0.4)
			particle.age = 0

			rim.add(particle)
			manualParticles.push(particle)
		}

		// Update manual particles function
		function updateManualParticles(dt) {
			// Note: portal active check moved to the update loop call
			const now = world.getTime()

			// Spawn new manual particles
			if (now - lastManualSpawnTime > MANUAL_CONFIG.BURST_INTERVAL) {
				for (let i = 0; i < MANUAL_CONFIG.PARTICLES_PER_BURST; i++) {
					spawnManualParticle()
				}
				lastManualSpawnTime = now
			}

			// Update existing manual particles
			for (let i = manualParticles.length - 1; i >= 0; i--) {
				const particle = manualParticles[i]
				particle.age += dt

				if (particle.age >= particle.lifetime) {
					rim.remove(particle)
					manualParticles.splice(i, 1)
					continue
				}

				// Update position
				particle.position.x += particle.velocity.x * dt
				particle.position.y += particle.velocity.y * dt
				particle.position.z += particle.velocity.z * dt

				particle.rotation.z += dt * (particle.velocity.x + particle.velocity.y) * 0.3

				// Scale and fade effect
				const fadeStart = particle.lifetime * 0.6
				if (particle.age > fadeStart) {
					const fade = 1 - (particle.age - fadeStart) / (particle.lifetime - fadeStart)
					if (particle.material) {
						particle.material.opacity = fade * 0.7
					}
				}
			}
		}
	}

	// Handle trigger events on the portal body
	portalBody.onTriggerEnter = e => {
		if (!props.isActive) {
			console.log('[PORTAL] Portal is inactive, ignoring trigger')
			return
		}

		if (!e.playerId) {
			console.log('[PORTAL] No playerId in trigger event, ignoring')
			return
		}

		try {
			const player = world.getPlayer(e.playerId)
			const localPlayer = world.getPlayer()
			const isLocalPlayer = player.id === localPlayer.id

			if (props.worldUrl && isLocalPlayer) {
				console.log('[PORTAL] Local player entered, opening:', props.worldUrl)
				subtitleLabel.value = 'Jumping to new world...'
				world.open(props.worldUrl, props.newTab)
			}
		} catch (err) {
			console.error('[PORTAL] Error in trigger enter:', err)
			subtitleLabel.value = props.subtitle
		}
	}

	portalBody.onTriggerExit = e => {
		if (!e.playerId) return

		try {
			const player = world.getPlayer(e.playerId)
			const localPlayer = world.getPlayer()
			const isLocalPlayer = player.id === localPlayer.id

			if (isLocalPlayer) {
				subtitleLabel.value = props.subtitle
			}
		} catch (err) {
			console.error('[PORTAL] Error in trigger exit:', err)
		}
	}

	// Listen for activation signals from activate.js or other sources
	world.on('PortalPowerSwitch', (data) => {
		if (!props.isActive) {
			props.isActive = true
			subtitleLabel.value = 'Portal powering up...'
			subtitleLabel.color = '#ffff00'
			setTimeout(() => {
				if (props.isActive) {
					subtitleLabel.value = props.subtitle
					subtitleLabel.color = PORTAL_CONFIG.UI.colors.subtitle
				}
			}, 2000)
		}
	})

	// Start the update loop
	app.on('update', dt => {
		// Update UI text based on portal state
		if (props.isActive) {
			// Active portal - show normal subtitle
			subtitleLabel.value = props.subtitle
			subtitleLabel.color = PORTAL_CONFIG.UI.colors.subtitle // Normal green color
		} else {
			// Inactive portal - show malfunction message
			subtitleLabel.value = props.inactiveSubtitle || 'System offline - electrical fault detected'
			subtitleLabel.color = '#ff6600' // Orange/red color for warning/fault
		}

		// Only play audio if portal is active
		if (props.isActive) {
			audio.play()
		} else {
			audio.pause()
		}

		// Control rim visibility and spinning - use .active not .visible
		if (rim) {
			const wasActive = rim.active
			rim.active = props.isActive
			if (wasActive !== props.isActive) {
				console.log(`[PORTAL] Rim active state changed from ${wasActive} to ${props.isActive}`)
			}
			if (props.portalSpin && props.isActive) {
				rim.rotation.z += Math.PI * 2 * dt
			}
		} else {
			console.warn('[PORTAL] Rim not available in update loop')
		}

		const now = world.getTime()

		// Reset burst timing when becoming inactive
		if (!props.isActive && nextBurstTime === 0) {
			nextBurstTime = now + 1 // First burst after 1 second
			console.log(`[PORTAL] Portal became inactive, scheduling first burst at ${nextBurstTime}`)
		}

		// Toggle particle systems based on portal state - use .active not .visible
		if (props.isActive) {
			// Full portal effect - show main particles, hide sparks
			portalParticles.active = true
			inactiveParticles.active = false

			// Keep particles playing if they support it
			if (portalParticles.play && typeof portalParticles.play === 'function') {
				portalParticles.play()
			}
		} else {
			// Inactive portal - random burst spark effect, hide main particles
			portalParticles.active = false
			inactiveParticles.active = true

			// Handle random burst timing
			if (now >= nextBurstTime && burstCooldown <= 0) {
				// Trigger a burst of sparks
				const burstSize = Math.floor(Math.random() * 15) + 5 // 5-20 particles per burst
				console.log(`[PORTAL] Triggering energy burst with ${burstSize} particles at time ${now}`)

				// Simple burst method: temporarily increase rate
				console.log(`[PORTAL] Triggering burst with ${burstSize} particles, trying simple rate method`)

				// Play spark sound with burst
				if (sparkAudio && props.sparkAudioEnabled !== false) {
					try {
						// Create more dynamic electrical spark effect
						const basePitch = props.sparkAudioPitch || 1.2
						const pitchVariation = (Math.random() - 0.5) * 0.6 // ±0.3 variation
						const effectivePitch = basePitch + pitchVariation

						// Volume varies with burst size for realism (smaller bursts = quieter)
						const burstSizeFactor = Math.min(burstSize / 20, 1) // Normalize to max 20 particles
						const volumeVariation = (Math.random() * 0.15) + 0.85 // 0.85 to 1.0
						const burstVolume = (props.sparkAudioVolume || 0.3) * volumeVariation * burstSizeFactor

						// Apply slight delay variation for more natural sound (0-50ms)
						const audioDelay = Math.random() * 50

						setTimeout(() => {
							if (sparkAudio && sparkAudio.active && sparkAudio.volume !== undefined) {
								sparkAudio.volume = Math.min(burstVolume, 1.0)
								sparkAudio.play().catch(err => {
									console.warn('[PORTAL] Spark audio playback failed:', err.message)
								})
								console.log(`[PORTAL] Playing spark audio with volume ${burstVolume.toFixed(2)} (pitch factor: ${effectivePitch.toFixed(2)})`)
							}
						}, audioDelay)

					} catch (audioError) {
						console.warn('[PORTAL] Could not play spark audio:', audioError.message)
					}
				}

                // Reset any previous burst state
                inactiveParticles.rate = 0

                // Set burst rate for a short duration
                const burstDuration = 200 // milliseconds
                inactiveParticles.rate = burstSize

                console.log(`[PORTAL] Burst rate set to ${burstSize}, will reset in ${burstDuration}ms`)

                setTimeout(() => {
                    if (inactiveParticles) {
                        inactiveParticles.rate = 0
                        console.log('[PORTAL] Burst rate reset to 0')
                    }
                }, burstDuration)

				// Set next burst time (1-4 seconds from now)
				nextBurstTime = now + (Math.random() * 3) + 1

				// Set burst cooldown (0.5-2 seconds)
				burstCooldown = (Math.random() * 1.5) + 0.5
				console.log(`[PORTAL] Next burst scheduled for ${nextBurstTime}, cooldown: ${burstCooldown}`)
			}

			// Decrease burst cooldown
			if (burstCooldown > 0) {
				burstCooldown -= dt
			}
		}

		// Update manual particles if enabled (only when active)
		if (useLegacyParticles && typeof updateManualParticles === 'function' && props.isActive) {
			updateManualParticles(dt)
		}
	})
}

console.log('[PORTAL] Modern portal setup complete with built-in particle system')