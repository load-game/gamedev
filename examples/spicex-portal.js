const portal = app.get('SpiceXPortal')
const rim = app.get('Rim')
const particle = app.get('Particle')

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
	}
])

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

// Add a static rigidbody and trigger collider to the portal
const portalBody = app.create('rigidbody')
portalBody.type = 'static'
portal.add(portalBody)
portal.add(audio)

const portalCollider = app.create('collider')
portalCollider.type = 'box'
portalCollider.setSize(2, 3, 1) // Adjust size as needed for your portal
portalCollider.trigger = true
portalBody.add(portalCollider)

// Create our own particle template instead of looking for an existing one
let particleTemplate;
try {
	// Try to get the template first in case it exists
	particleTemplate = particle

	// If not found, create our own template
	if (!particleTemplate) {
		console.log('[PORTAL] Creating custom portal particle template');
		particleTemplate = app.create('mesh');

		// Set template properties
		particleTemplate.scale.set(0.1, 0.1, 0.1);

		// Create material for the template - using a bright blue portal color
		const material = {
			emissive: '#00ffff',
			emissiveIntensity: 3,
			transparent: true,
			opacity: 0.7
		};
		particleTemplate.material = material;

		// Set an ID for reference
		particleTemplate.id = 'PortalParticle';
	}

	// Hide the template
	particleTemplate.visible = false;
} catch (error) {
	console.error('[PORTAL] Error creating particle template:', error);

	// Create a fallback simple template
	particleTemplate = app.create('mesh');
	particleTemplate.scale.set(0.1, 0.1, 0.1);
	particleTemplate.visible = false;
}

// Configuration for the particle system
const CONFIG = {
	MAX_PARTICLES: 400,
	SPAWN_RATE: 60,
	LIFETIME: 0.8, // shorter lifetime for more chaos
	MIN_SPEED: 3, // faster for more energy
	MAX_SPEED: 6,
	MIN_SCALE: 0.05,
	MAX_SCALE: 0.15,
	SPAWN_RADIUS: 0.3, // slightly larger spawn area
	GRAVITY: 0,
	BURST_INTERVAL: 0.02, // more frequent bursts
	PARTICLES_PER_BURST: 3, // fewer per burst but more frequent
	TURBULENCE: 1, // more randomness
	RIM_SPIN_SPEED: 1,
	Z_SPEED_MIN: 2, // Minimum Z velocity (negative for outward)
	Z_SPEED_MAX: -0.5 // Maximum Z velocity (smaller negative for variation)
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
			background: 'rgba(0, 15, 30, 0.85)' // Dark blue-ish background with high opacity
		},
		style: {
			padding: 15,
			borderRadius: 12,
			gap: 5 // Space between title and subtitle
		}
	}
};

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

	// Particle system state
	const particles = []
	let lastSpawnTime = 0

	// Create a new particle
	function spawnParticle() {
		if (particles.length >= CONFIG.MAX_PARTICLES) return

		const particle = particleTemplate.clone()
		particle.visible = true

		// Random position within spawn radius
		const angle = Math.random() * Math.PI * 2
		const radius = Math.random() * CONFIG.SPAWN_RADIUS

		particle.position.set(
			Math.cos(angle) * radius,
			Math.sin(angle) * radius,
			0
		)

		// Random direction for true entropy
		const randomAngle = Math.random() * Math.PI * 2
		const speed = CONFIG.MIN_SPEED + Math.random() * (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED)

		// Random Z speed between min and max
		const zSpeed = CONFIG.Z_SPEED_MIN + Math.random() * (CONFIG.Z_SPEED_MAX - CONFIG.Z_SPEED_MIN)

		// Velocity in random direction with extra chaos and controlled Z movement
		particle.velocity = {
			x: Math.cos(randomAngle) * speed + (Math.random() - 0.5) * CONFIG.TURBULENCE,
			y: Math.sin(randomAngle) * speed + (Math.random() - 0.5) * CONFIG.TURBULENCE,
			z: zSpeed + (Math.random() - 0.5) * CONFIG.TURBULENCE * 0.5 // Z movement with less turbulence
		}

		// Random starting scale
		const startScale = CONFIG.MIN_SCALE + Math.random() * (CONFIG.MAX_SCALE - CONFIG.MIN_SCALE)
		particle.scale.setScalar(startScale)

		// Randomize rotation for more chaos
		particle.rotation.z = Math.random() * Math.PI * 2

		particle.lifetime = CONFIG.LIFETIME * (0.8 + Math.random() * 0.4) // Randomize lifetime
		particle.age = 0

		rim.add(particle)
		particles.push(particle)
	}

	// Update particle positions and remove dead particles
	function updateParticles(dt) {
		// Only update particles if portal is active
		if (!props.isActive) return

		const now = world.getTime()

		// Spawn new particles
		if (now - lastSpawnTime > CONFIG.BURST_INTERVAL) {
			for (let i = 0; i < CONFIG.PARTICLES_PER_BURST; i++) {
				spawnParticle()
			}
			lastSpawnTime = now
		}

		// Update existing particles
		for (let i = particles.length - 1; i >= 0; i--) {
			const particle = particles[i]
			particle.age += dt

			if (particle.age >= particle.lifetime) {
				rim.remove(particle)
				particles.splice(i, 1)
				continue
			}

			// Update position with some added chaos
			particle.position.x += particle.velocity.x * dt
			particle.position.y += particle.velocity.y * dt
			particle.position.z += particle.velocity.z * dt

			// Add some rotation to the particles
			particle.rotation.z += dt * (particle.velocity.x + particle.velocity.y) * 0.5

			// Fade out
			const fadeStart = particle.lifetime * 0.5 // Start fading earlier
			if (particle.age > fadeStart) {
				const fade = 1 - (particle.age - fadeStart) / (particle.lifetime - fadeStart)
				particle.material.opacity = fade * 0.7
			}
		}

		// Only spin rim if portal is active
		if (props.isActive) {
			rim.rotation.z += CONFIG.RIM_SPIN_SPEED * Math.PI * 2 * dt
		}
	}

	// Handle trigger events on the portal body
	portalBody.onTriggerEnter = e => {
		// Only process trigger if portal is active
		if (!props.isActive) {
			console.log('[PORTAL] Portal is inactive, ignoring trigger')
			return
		}

		console.log('[PORTAL] Trigger Enter Event:', e)
		if (!e.playerId) {
			console.log('[PORTAL] No playerId in trigger event, ignoring')
			return
		}

		try {
			console.log('[PORTAL] Checking world URL:', props.worldUrl)
			if (props.worldUrl) {
				const player = world.getPlayer(e.playerId)
				const localPlayer = world.getPlayer() // Get local player without ID
				const isLocalPlayer = player.id === localPlayer.id // Compare IDs

				console.log('[PORTAL] Player entered:', player, 'isLocal check:', {
					playerId: player.id,
					localPlayerId: localPlayer.id,
					isLocalPlayer
				})

				// Only proceed if this is the local player
				if (isLocalPlayer) {
					console.log('[PORTAL] Local player entered, preparing to jump to:', props.worldUrl)
					subtitleLabel.value = 'Jumping to new world...'
					console.log('[PORTAL] Opening world URL:', props.worldUrl, 'newTab:', props.newTab)
					world.open(props.worldUrl, props.newTab)
				} else {
					console.log('[PORTAL] Remote player entered, ignoring')
				}
			} else {
				console.log('[PORTAL] No world URL configured')
			}
		} catch (err) {
			console.error('[PORTAL] Error in trigger enter:', err)
			subtitleLabel.value = props.subtitle
		}
	}

	portalBody.onTriggerExit = e => {
		console.log('[PORTAL] Trigger Exit Event:', e)
		if (!e.playerId) {
			console.log('[PORTAL] No playerId in exit event, ignoring')
			return
		}

		try {
			const player = world.getPlayer(e.playerId)
			const localPlayer = world.getPlayer()
			const isLocalPlayer = player.id === localPlayer.id

			console.log('[PORTAL] Player exited:', player, 'isLocal check:', {
				playerId: player.id,
				localPlayerId: localPlayer.id,
				isLocalPlayer
			})

			// Only reset subtitle for local player
			if (isLocalPlayer) {
				console.log('[PORTAL] Local player exited, resetting subtitle')
				subtitleLabel.value = props.subtitle
			} else {
				console.log('[PORTAL] Remote player exited, ignoring')
			}
		} catch (err) {
			console.error('[PORTAL] Error in trigger exit:', err)
		}
	}

	// Log initial portal setup
	console.log('[PORTAL] Setup complete:', {
		portal,
		portalBody,
		portalCollider,
		worldUrl: props.worldUrl,
		newTab: props.newTab
	})

	// Start the update loop
	app.on('update', dt => {
		updateParticles(dt)
		// Only play audio if portal is active
		if (props.isActive) {
			audio.play()
		} else {
			audio.pause()
		}
	})
}
