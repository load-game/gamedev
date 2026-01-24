let lastConfig = null
let sky = null
const SPEED = 1.6 // Slower speed for more gradual movement
let daysPassed = 0
let previousHour = 0
let cycleStartTime = Date.now()
let fogParticleSystem = null
app.keepActive = true
// Weather system variables
const WEATHER_TYPES = {
	CLEAR: 'clear',
	CLOUDY: 'cloudy',
	RAIN: 'rain',
	STORM: 'storm',
	RADSTORM: 'radstorm',
	DUSTSTORM: 'duststorm',
	FOGGY: 'foggy',
	NUCLEAR: 'nuclear',
	// Combined weather types
	RAINY_CLOUDS: 'rainyclouds',
	THUNDER_STORM: 'thunderstorm',
	RAD_CLOUDS: 'radclouds',
	DUST_CLOUDS: 'dustclouds',
	WASTELAND_STORM: 'wastelandstorm'
}

// Particle systems for different weather types
let activeWeatherSystems = {}
let currentWeather = WEATHER_TYPES.CLEAR
let weatherTransitioning = false
let weatherTransitionTime = 0
let weatherTimer = 0
let weatherDuration = 0
let randomWeatherEnabled = false

// Create UI with Pip-Boy style
const ui = app.create('ui', {
	lit: true,
	doubleside: true,
	width: 170,
	height: 80,
	backgroundColor: 'rgba(0, 50, 0, 0)', // Made fully transparent
	borderRadius: 10,
	padding: 10,
	display: 'flex'
})
ui.position.set(0, 3, -1) // Lowered Y from 4 to 2.5
ui.billboard = 'y'
app.add(ui)

// Create time display view
const timeView = app.create('uiview', {
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'center',
	alignItems: 'center',
	width: 150,
	height: 70,
	padding: 4
})

// Time of day display
const timeText = app.create('uitext', {
	padding: 5,
	textAlign: 'center',
	value: 'Time: 00:00',
	color: '#00ff00', // Keep Pip-Boy green
	textShadow: '0 0 10px #00ff00', // Add glow effect
	fontSize: 18,
	backgroundColor: 'rgba(0, 0, 0, 0)' // Fully transparent background
})

// Days passed display
const daysText = app.create('uitext', {
	padding: 5,
	textAlign: 'center',
	value: 'Days Passed: 0',
	color: '#00ff00', // Keep Pip-Boy green
	textShadow: '0 0 10px #00ff00', // Add glow effect
	fontSize: 18,
	backgroundColor: 'rgba(0, 0, 0, 0)' // Fully transparent background
})

// Add UI elements
ui.add(timeView)
timeView.add(timeText)
timeView.add(daysText)

// Add this function to calculate days based on elapsed time
function updateDaysPassed() {
	const currentTime = Date.now()
	const elapsedMs = currentTime - cycleStartTime
	const dayLengthMs = (24 / SPEED) * 1000 // Convert speed to real milliseconds for a full day

	// Calculate complete days
	const completeDays = Math.floor(elapsedMs / dayLengthMs)

	if (completeDays > daysPassed) {
		daysPassed = completeDays
	}
}

// Modify the update handler for UI
app.on('update', delta => {
	if (app.config.autoRotate) {
		updateSunPosition(delta)
	}

	// Update fog animation if enabled
	if (app.config.fogAnimation) {
		updateFogAnimation(delta)
	}

	// Update weather system
	if (randomWeatherEnabled) {
		updateWeatherSystem(delta, app.config)
	}

	// Update UI display
	// Update days passed based on real time
	if (app.config.autoRotate) {
		updateDaysPassed()
	}

	// Update time display
	const hour24 = app.config.timeOfDay || 0  // Changed from 12 to 0
	const hours = Math.floor(hour24)
	const minutes = Math.floor((hour24 % 1) * 60)

	// Format time in Pip-Boy style
	const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
	timeText.value = `Time: ${timeString}`
	daysText.value = `Days in ⊬⟒⌖⋉⎍: ${daysPassed}`

	// Add rotation update to keep UI facing camera
	if (ui && app.camera) {
		const angle = Math.atan2(
			app.camera.position.x - ui.position.x,
			app.camera.position.z - ui.position.z
		)
		ui.rotation.y = angle
	}
})

function calculateSolarPosition(hour24) {
	// Convert hour to decimal time (0-1), using modulo for smooth wrapping
	const time = (hour24 % 24) / 24

	// Convert time to solar angle (-π to π)
	const solarAngle = (time * 2 * Math.PI) - Math.PI

	// Set latitude for Mojave Desert (approximately 35°N) in radians
	const latitude = 35 * (Math.PI / 180)

	// Calculate solar declination for Mojave Desert
	// Using typical summer declination for New Vegas setting
	const declination = -10 * (Math.PI / 180)  // Adjusted for Mojave's characteristic angle

	// Calculate solar elevation (height above horizon)
	const elevation = Math.asin(
		Math.sin(latitude) * Math.sin(declination) +
		Math.cos(latitude) * Math.cos(declination) * Math.cos(solarAngle)
	)

	// Calculate solar azimuth with Mojave's characteristic east-west bias
	const azimuth = Math.atan2(
		-Math.cos(declination) * Math.sin(solarAngle),
		Math.cos(latitude) * Math.sin(declination) -
		Math.sin(latitude) * Math.cos(declination) * Math.cos(solarAngle)
	) + (5 * (Math.PI / 180))  // Slight offset for Mojave's characteristic angle

	// Convert spherical coordinates (azimuth, elevation) to Cartesian (x,y,z)
	const coselevation = Math.cos(elevation)
	// Maintain the correct orientation with Mojave characteristics
	const x = -Math.cos(azimuth) * coselevation
	const y = Math.sin(elevation) * 0.85  // Slightly lower height to match Mojave
	const z = Math.sin(azimuth) * coselevation

	return new Vector3(x, y, z)
}

function calculateSunIntensity(hour24) {
	// Normalize hour to 0-24 range
	const normalizedHour = hour24 % 24

	// Define key times of day
	const DAWN_START = 5    // Dawn begins
	const SUNRISE = 6       // Sunrise
	const NOON = 12         // Peak brightness
	const SUNSET = 18       // Sunset
	const DUSK_END = 19     // Dusk ends

	// Calculate base intensity based on time of day
	let intensity
	if (normalizedHour < DAWN_START) {
		// Night (midnight to dawn start)
		intensity = 0.15 // Slightly brighter night
	} else if (normalizedHour < SUNRISE) {
		// Dawn (increasing brightness)
		const progress = (normalizedHour - DAWN_START) / (SUNRISE - DAWN_START)
		intensity = 0.15 + (0.85 * progress) // More dramatic dawn
	} else if (normalizedHour < NOON) {
		// Morning (increasing to peak)
		const progress = (normalizedHour - SUNRISE) / (NOON - SUNRISE)
		intensity = 1.0 + (0.8 * progress) // Higher peak brightness
	} else if (normalizedHour < SUNSET) {
		// Afternoon (decreasing from peak)
		const progress = (normalizedHour - NOON) / (SUNSET - NOON)
		intensity = 1.8 - (0.8 * progress) // Gradual decrease from peak
	} else if (normalizedHour < DUSK_END) {
		// Dusk (decreasing to night)
		const progress = (normalizedHour - SUNSET) / (DUSK_END - SUNSET)
		intensity = 1.0 - (0.85 * progress) // More dramatic dusk
	} else {
		// Night (dusk end to midnight)
		intensity = 0.15 // Slightly brighter night
	}

	return intensity
}

function castRayForFog(origin, direction, maxDistance) {
	const hit = app.raycast(origin, direction, maxDistance)
	return hit ? hit.distance : maxDistance
}

function updateFogBasedOnEnvironment(camera, sky) {
	if (!camera || !camera.position) return { min: 100, avg: 100 }

	// Cast rays in a sphere pattern for better environment detection
	const directions = [
		new Vector3(1, 0, 0),    // Right
		new Vector3(-1, 0, 0),   // Left
		new Vector3(0, 1, 0.5),  // Up-forward
		new Vector3(0, -1, 0.5), // Down-forward
		new Vector3(0, 0, 1),    // Forward
		new Vector3(0, 0, -1),   // Back
	]

	let minDistance = 100 // Default distance if no hits
	let avgDistance = 0
	let samples = 0

	try {
		for (const dir of directions) {
			const distance = castRayForFog(camera.position, dir, 100)
			minDistance = Math.min(minDistance, distance)
			avgDistance += distance
			samples++
		}
	} catch (e) {
		console.warn('Ray casting failed:', e)
		return { min: 100, avg: 100 }
	}

	return {
		min: minDistance,
		avg: samples > 0 ? avgDistance / samples : 100
	}
}

function updateSunPosition(delta) {
	if (!sky) return

	let hour24 = app.config.timeOfDay || 0

	if (app.config.autoRotate) {
		// Increment time smoothly and wrap using modulo
		let newTime = (hour24 + SPEED * delta) % 24
		previousHour = newTime

		// Update time of day with 1 decimal place
		app.config.timeOfDay = parseFloat(newTime.toFixed(1))

		// Rotate sky background with day cycle
		if (sky.bg) {
			// Calculate rotation based on time of day (complete 360° rotation)
			const rotation = (newTime / 24) * Math.PI * 2
			sky.bgRotation = rotation
		}
	}

	// Update sun direction
	sky.sunDirection = calculateSolarPosition(app.config.timeOfDay)

	// Calculate intensity based on time of day and sun height
	const sunHeight = sky.sunDirection.y
	const timeBasedIntensity = calculateSunIntensity(app.config.timeOfDay)
	const heightFactor = Math.max(0.1, (sunHeight + 1) / 2)

	// Combine time-based intensity with height factor
	sky.sunIntensity = timeBasedIntensity * heightFactor * app.config.intensity

	// Enhanced fog color blending
	if (sky.fogColor && sky.sunColor) {
		const timeOfDay = app.config.timeOfDay || 0
		const isDaytime = timeOfDay > 6 && timeOfDay < 18
		const isDawnDusk = (timeOfDay > 5 && timeOfDay < 7) || (timeOfDay > 17 && timeOfDay < 19)

		const baseFogColor = hexToRGB(sky.fogColor)
		const sunColor = hexToRGB(sky.sunColor)

		// Enhanced color mixing based on time of day
		let mixFactor
		if (isDawnDusk) {
			mixFactor = 0.7 // Strong color mixing at dawn/dusk
		} else if (isDaytime) {
			mixFactor = Math.max(0, sky.sunDirection.y * 0.5) // Subtle mixing during day
		} else {
			mixFactor = 0.1 // Minimal mixing at night
		}

		const mixedColor = {
			r: Math.floor(baseFogColor.r * (1 - mixFactor) + sunColor.r * mixFactor),
			g: Math.floor(baseFogColor.g * (1 - mixFactor) + sunColor.g * mixFactor),
			b: Math.floor(baseFogColor.b * (1 - mixFactor) + sunColor.b * mixFactor)
		}

		sky.fogColor = rgbToHex(mixedColor)
	}

	// Update fog height parameters
	if (typeof app.config.fogHeight !== 'undefined') {
		sky.fogHeight = app.config.fogHeight * 2
		sky.fogFalloff = app.config.fogFalloff || 1.5
	}

	// Only configure if auto-rotating
	if (app.config.autoRotate) {
		app.configure()
	}
}

// Add update handler for continuous movement
app.on('update', delta => {
	if (app.config.autoRotate) {
		updateSunPosition(delta)
	}
})

// Utility functions for color manipulation
function hexToRGB(hex) {
	const r = parseInt(hex.slice(1, 3), 16)
	const g = parseInt(hex.slice(3, 5), 16)
	const b = parseInt(hex.slice(5, 7), 16)
	return { r, g, b }
}

function rgbToHex({ r, g, b }) {
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function createNoisePattern() {
	const noiseScale = 0.1
	const noiseSpeed = 0.5
	let time = 0

	return {
		update: (delta) => {
			time += delta * noiseSpeed
			return {
				x: Math.sin(time) * Math.cos(time * 0.5) * noiseScale,
				y: Math.cos(time * 0.7) * noiseScale,
				z: Math.sin(time * 0.8) * Math.cos(time * 0.3) * noiseScale
			}
		}
	}
}

// Create noise pattern instance
const fogNoise = createNoisePattern()

function updateFogAnimation(delta) {
	if (!sky || !app.camera) return

	const noise = fogNoise.update(delta)
	const basePos = sky.fogPosition || { x: 0, y: 0, z: 0 }
	const time = Date.now() * 0.001

	// More natural wave-based movement
	const waveX = Math.sin(time * 0.2) * Math.cos(time * 0.1) * 2
	const waveY = Math.cos(time * 0.15) * Math.sin(time * 0.12) * 1
	const waveZ = Math.sin(time * 0.1) * Math.cos(time * 0.08) * 2

	// Smoother position blending
	sky.fogPosition = {
		x: basePos.x + waveX + noise.x,
		y: basePos.y + waveY + noise.y,
		z: basePos.z + waveZ + noise.z
	}

	// Dynamic fog density based on environment and time
	if (typeof sky.fogDensity !== 'undefined') {
		const baseDensity = app.config.fogDensity * 100
		const timeOfDay = app.config.timeOfDay || 0
		const isDawnDusk = (timeOfDay > 5 && timeOfDay < 7) || (timeOfDay > 17 && timeOfDay < 19)
		const timeFactor = isDawnDusk ? 1.5 : 1.0 // Thicker fog at dawn/dusk

		// Get environment info with safety check
		const envInfo = updateFogBasedOnEnvironment(app.camera, sky)
		const envFactor = Math.max(0.8, 1 - (envInfo.min / 100)) // Denser in enclosed spaces

		sky.fogDensity = baseDensity * timeFactor * envFactor
	}

	// Update fog distances based on environment
	const envInfo = updateFogBasedOnEnvironment(app.camera, sky)

	if (typeof app.config.fogNear !== 'undefined') {
		const baseFogNear = app.config.fogNear
		sky.fogNear = Math.min(baseFogNear, envInfo.min * 0.5)
	}

	if (typeof app.config.fogFar !== 'undefined') {
		const baseFogFar = app.config.fogFar
		sky.fogFar = Math.min(baseFogFar, envInfo.avg * 2)
	}
}

// Weather System Functions

function createWeatherParticleSystem(type, config) {
	try {
		// Parameters for different particle types
		let particleParams = {}

		// Log the texture resources available
		console.log(`Creating ${type} particle system with config:`, {
			rainTexture: config.rainTexture?.url ? 'Available' : 'Missing',
			defaultParticleTexture: config.defaultParticleTexture?.url ? 'Available' : 'Missing',
			particleDensity: config.particleDensity || 1.0
		})

		switch (type) {
			case WEATHER_TYPES.RAIN:
				particleParams = {
					image: config.rainTexture?.url || config.defaultParticleTexture?.url,
					// Use a taller box shape like nuclear particles
					shape: ['box', 150, 80, 150, 1, 'volume', true],
					// Significantly increase the rate for more particles
					rate: config.particleDensity ? config.particleDensity * 1200 : 12000,
					// Slightly longer life for more natural fall
					life: '0.8~1.2',
					duration: 0,
					loop: true,
					size: '1.2~2',
					color: '#E3E3E3',
					// Keep same speed
					speed: '15~25',
					// Use nuclear-like direction settings
					direction: -0.2, // Slight angle like nuclear
					directionSpread: 0.4, // Some spread but less than nuclear
					alpha: '0.5~0.7',
					blending: 'normal',
					// Remove rotation parameters
					// Keep turbulence like nuclear particles but less intense
					turbulence: '0.8',
					turbulenceSpeed: '0.2',
					// Boost initial bursts for more immediate particles
					bursts: [
						{ time: 0, count: 1000 },
						{ time: 0.2, count: 600 },
						{ time: 0.4, count: 400 },
						{ time: 0.6, count: 200 }
					]
				}

				// Verify we have a texture for rain
				if (!particleParams.image) {
					console.error('No rain texture available! Using fallback square')
					particleParams.shape = 'square'
					delete particleParams.image
				}
				break

			case WEATHER_TYPES.STORM:
				particleParams = {
					image: config.rainTexture?.url || config.defaultParticleTexture?.url,
					// Use a taller box shape like nuclear particles
					shape: ['box', 200, 100, 200, 1, 'volume', true],
					// Significantly increase the rate for more particles
					rate: config.particleDensity ? config.particleDensity * 2400 : 24000,
					// Slightly longer life for more natural fall
					life: '0.6~1.0',
					duration: 0,
					loop: true,
					size: '1.2~2',
					color: '#E3E3E3',
					// Keep same speed
					speed: '30~45',
					// Use nuclear-like direction settings
					direction: -0.2, // Slight angle like nuclear
					directionSpread: 0.5, // More spread for storm
					alpha: '0.6~0.8',
					blending: 'normal',
					// Remove rotation parameters
					// Keep turbulence like nuclear particles but less intense
					turbulence: '1.2',
					turbulenceSpeed: '0.25',
					// Boost initial bursts for more immediate particles
					bursts: [
						{ time: 0, count: 2000 },
						{ time: 0.15, count: 1200 },
						{ time: 0.3, count: 800 },
						{ time: 0.45, count: 400 }
					]
				}

				// Verify we have a texture for storm
				if (!particleParams.image) {
					console.error('No storm texture available! Using fallback square')
					particleParams.shape = 'square'
					delete particleParams.image
				}
				break

			case WEATHER_TYPES.RADSTORM:
				particleParams = {
					image: config.radstormTexture?.url || config.defaultParticleTexture?.url,
					shape: ['sphere', 150, 100, 150, 1, 'volume', true],
					rate: config.particleDensity ? config.particleDensity * 400 : 4000,
					life: '6',
					duration: 0,
					loop: true,
					size: '0.3~0.7',
					color: '#7CFC00',
					speed: '1~8',
					direction: 0,
					directionSpread: 1,
					alpha: '0.4~0.8',
					rotate: '0~360',
					blending: 'additive',
					emissive: '5',
					bursts: [
						{ time: 0, count: 100 },
						{ time: 1, count: 50 },
						{ time: 2, count: 200 }
					]
				}
				break

			case WEATHER_TYPES.DUSTSTORM:
				particleParams = {
					image: config.dustTexture?.url || config.defaultParticleTexture?.url,
					shape: ['box', 250, 60, 250, 1, 'volume', true],
					rate: config.particleDensity ? config.particleDensity * 800 : 8000,
					life: '5~10',
					duration: 0,
					loop: true,
					size: '0.4~1.2',
					color: '#CD853F',
					speed: '5~15',
					direction: 0.8,
					directionSpread: 0.8,
					alpha: '0.3~0.6',
					rotate: '0~360',
					rotateVelocity: '10~30',
					blending: 'normal',
					turbulence: '2',
					turbulenceSpeed: '0.4'
				}
				break

			case WEATHER_TYPES.FOGGY:
				particleParams = {
					image: config.fogParticleTexture?.url || config.defaultParticleTexture?.url,
					shape: ['box', 100, 20, 100, 1, 'volume', true],
					rate: config.particleDensity ? config.particleDensity * 100 : 1000,
					life: '15',
					duration: 0,
					loop: true,
					size: '3~8',
					color: '#E6E6FA',
					speed: '0.1~0.3',
					direction: 0.1,
					directionSpread: 0.1,
					alpha: '0.01~0.08',
					alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
					rotate: '0~360',
					blending: 'normal'
				}
				break

			case WEATHER_TYPES.NUCLEAR:
				particleParams = {
					image: config.ashTexture?.url || config.defaultParticleTexture?.url,
					shape: ['box', 300, 150, 300, 1, 'volume', true],
					rate: config.particleDensity ? config.particleDensity * 500 : 5000,
					life: '8~15',
					duration: 0,
					loop: true,
					size: '0.3~0.8',
					color: '#A9A9A9',
					speed: '0.8~3',
					direction: -0.2,
					directionSpread: 0.6,
					alpha: '0.3~0.6',
					rotate: '0~360',
					rotateVelocity: '5~15',
					blending: 'normal',
					turbulence: '1.5',
					turbulenceSpeed: '0.3',
					bursts: [
						{ time: 0, count: 200 },
						{ time: 5, count: 300 },
						{ time: 10, count: 200 }
					]
				}
				break

			case WEATHER_TYPES.CLOUDY:
				particleParams = {
					image: config.cloudTexture?.url || config.defaultParticleTexture?.url,
					shape: ['box', 300, 30, 300, 1, 'volume', true],
					rate: config.particleDensity ? config.particleDensity * 5 : 50,
					life: '30',
					duration: 0,
					loop: true,
					size: '15~30',
					color: '#F5F5F5',
					speed: '0.5~1.0',
					direction: 0.9,
					directionSpread: 0.3,
					alpha: '0.3~0.7',
					alphaOverLife: '0,0|0.05,0.7|0.95,0.7|1,0',
					rotate: '0~15',
					blending: 'normal'
				}
				break
		}

		console.log(`Creating particles for weather type: ${type} with parameters:`,
			JSON.stringify({
				type,
				image: particleParams.image ? 'Available' : 'Missing',
				rate: particleParams.rate,
				size: particleParams.size,
				life: particleParams.life,
				turbulence: particleParams.turbulence || 'None',
				bursts: particleParams.bursts ? 'Yes' : 'No'
			})
		)

		// Create the particles
		const particles = app.create('particles', particleParams)

		if (!particles) {
			console.error(`Failed to create particles for ${type}`)
			return null
		}

		console.log(`Successfully created particles for ${type}`)

		// Set position and rotation based on weather type
		switch (type) {
			case WEATHER_TYPES.RAIN:
			case WEATHER_TYPES.STORM:
				// Higher position like nuclear for better fall effect
				particles.position.y = 40

				// Keep neutral rotation for the particle system
				particles.rotation.x = 0
				particles.rotation.y = 0
				particles.rotation.z = 0

				// Log position
				console.log(`Set ${type} particles position and rotation:`, {
					position: particles.position,
					rotation: particles.rotation
				})
				break
			case WEATHER_TYPES.RADSTORM:
				particles.position.y = 40 // Higher for more dramatic effect
				break
			case WEATHER_TYPES.DUSTSTORM:
				particles.position.y = 20 // Higher for more visible effect
				break
			case WEATHER_TYPES.FOGGY:
				particles.position.y = 5
				break
			case WEATHER_TYPES.NUCLEAR:
				particles.position.y = 40 // Higher for more dramatic effect
				break
			case WEATHER_TYPES.CLOUDY:
				particles.position.y = 20
				break
		}

		// Ensure the particles are active and visible
		if (particles) {
			particles.active = true
			particles.visible = true

			// Double check position after setting
			console.log(`Final ${type} particle system position:`,
				particles.position ?
					`x:${particles.position.x}, y:${particles.position.y}, z:${particles.position.z}` :
					'No position property found'
			)
		}

		return particles
	} catch (err) {
		console.error(`Error creating ${type} weather particles:`, err)
		return null
	}
}

function createLightningStrike(x, z) {
	try {
		// Get lightning height from config or use default
		const lightningHeight = app.config.lightningHeight || 200

		// Create lightning bolt particles - using rectangle instead of 'line'
		const lightningBolt = app.create('particles', {
			image: app.config.lightningTexture?.url || app.config.defaultParticleTexture?.url,
			// Use a taller rectangle with proper proportions
			shape: ['rectangle', 4, lightningHeight, 4], // Slightly wider bolt (2→4)
			rate: 0, // No continuous emission
			bursts: [
				{ time: 0, count: 15 } // More particles for better coverage
			],
			life: '0.3~0.5', // Short life for quick flash
			duration: 0.4,
			loop: false,
			size: '50~200', // Wider size range for variation
			color: '#f8f8ff', // Slightly blue-white
			emissive: '40', // Intense glow
			alpha: '0.9~1.0',
			blending: 'additive',
			// Add variance in direction for forking effect
			directionSpread: 0.3,
			// Add spread from the main bolt
			speedSpread: 3
		})

		// Position the bolt to reach from sky to ground
		lightningBolt.position.set(x, app.config.lightningStartHeight || 0, z) // Use configurable starting height
		lightningBolt.rotation.x = 180 * (Math.PI / 180) // Point down

		// Add to scene
		app.add(lightningBolt)

		// Remove after effect ends
		setTimeout(() => {
			app.remove(lightningBolt)
		}, 600)

		return lightningBolt
	} catch (err) {
		console.error('Error creating lightning bolt effect:', err)
		return null
	}
}

function createLightningEffect(config) {
	try {
		// Create a full-screen lightning flash effect
		const lightning = app.create('ui', {
			width: 5000,
			height: 5000,
			backgroundColor: 'rgba(255, 255, 255, 0)',
			position: [0, 0, 0]
		})

		if (!lightning) {
			console.error('Failed to create lightning UI element')
			return null
		}

		console.log('Lightning UI created successfully')

		// Use lightning texture if provided
		if (config.lightningTexture?.url) {
			lightning.backgroundImage = config.lightningTexture.url
			lightning.backgroundSize = 'cover'
			lightning.backgroundPosition = 'center'
		}

		// Add actual lightning bolt particles for visible strikes
		const triggerLightning = () => {
			// Flash on
			lightning.backgroundColor = 'rgba(255, 255, 255, 0.8)'
			console.log('Lightning flash triggered')

			// Create 1-3 lightning bolts at random positions
			const boltsCount = Math.floor(Math.random() * 3) + 1
			for (let i = 0; i < boltsCount; i++) {
				// Random position around player (or camera)
				const distance = 50 + Math.random() * 200
				const angle = Math.random() * Math.PI * 2
				const x = Math.cos(angle) * distance
				const z = Math.sin(angle) * distance

				// Slight delay between bolts
				setTimeout(() => {
					createLightningStrike(x, z)
				}, i * 100)
			}

			// Play thunder sound if available
			if (config.thunderSound?.url) {
				const thunder = app.create('audio', {
					src: config.thunderSound.url,
					spatial: false,
					volume: 0.3
				})

				app.add(thunder)
				thunder.play()
				console.log('Thunder sound played')

				// Clean up sound after playback
				setTimeout(() => app.remove(thunder), 5000)
			}

			// Flash off
			setTimeout(() => {
				lightning.backgroundColor = 'rgba(255, 255, 255, 0)'

				// Schedule next lightning if still stormy
				if (currentWeather === WEATHER_TYPES.STORM) {
					const nextFlash = 2000 + Math.random() * 8000
					console.log(`Scheduling next lightning in ${Math.round(nextFlash)}ms`)
					setTimeout(triggerLightning, nextFlash)
				}
			}, 200)
		}

		// Start lightning sequence
		console.log('Starting initial lightning sequence')
		setTimeout(triggerLightning, 2000)

		return lightning
	} catch (err) {
		console.error('Error creating lightning effect:', err)
		return null
	}
}

function setCombinedWeather(type, config) {
	try {
		console.log(`Setting combined weather to: ${type}`)

		// Clean up existing weather systems
		cleanupWeatherSystems()

		// Update current weather
		currentWeather = type

		// Update weather status text in UI
		updateWeatherUI()

		// Define weather components for each combined type
		let weatherComponents = []

		switch (type) {
			case WEATHER_TYPES.RAINY_CLOUDS:
				weatherComponents = [
					{ type: WEATHER_TYPES.CLOUDY, heightOffset: 30, densityMultiplier: 0.5 }, // Lowered from 80 to 30
					{ type: WEATHER_TYPES.RAIN, heightOffset: 0, densityMultiplier: 0.8 }
				]
				break

			case WEATHER_TYPES.THUNDER_STORM:
				weatherComponents = [
					{ type: WEATHER_TYPES.CLOUDY, heightOffset: 40, densityMultiplier: 0.7 }, // Lowered from 100 to 40
					{ type: WEATHER_TYPES.RAIN, heightOffset: 0, densityMultiplier: 1.2 },
					{ type: WEATHER_TYPES.STORM, heightOffset: 0, densityMultiplier: 0, enableLightning: true }
				]
				break

			case WEATHER_TYPES.RAD_CLOUDS:
				weatherComponents = [
					{ type: WEATHER_TYPES.CLOUDY, heightOffset: 35, densityMultiplier: 0.4 }, // Lowered from 90 to 35
					{ type: WEATHER_TYPES.RADSTORM, heightOffset: 20, densityMultiplier: 0.6 }
				]
				break

			case WEATHER_TYPES.DUST_CLOUDS:
				weatherComponents = [
					{ type: WEATHER_TYPES.CLOUDY, heightOffset: 45, densityMultiplier: 0.3 }, // Lowered from 120 to 45
					{ type: WEATHER_TYPES.DUSTSTORM, heightOffset: 0, densityMultiplier: 0.8 }
				]
				break

			case WEATHER_TYPES.WASTELAND_STORM:
				weatherComponents = [
					{ type: WEATHER_TYPES.CLOUDY, heightOffset: 50, densityMultiplier: 0.5 }, // Lowered from 120 to 50
					{ type: WEATHER_TYPES.RAIN, heightOffset: 0, densityMultiplier: 0.7 },
					{ type: WEATHER_TYPES.DUSTSTORM, heightOffset: 10, densityMultiplier: 0.4 },
					{ type: WEATHER_TYPES.STORM, heightOffset: 0, densityMultiplier: 0, enableLightning: true }
				]
				break

			default:
				console.warn(`Unknown combined weather type: ${type}`)
				return
		}

		// Set fog and sky effects based on the combined weather
		if (type === WEATHER_TYPES.THUNDER_STORM) {
			if (sky) {
				sky.fogDensity = (config.fogDensity || 0.4) * 150
				sky.fogColor = '#464646'
			}
		} else if (type === WEATHER_TYPES.RAD_CLOUDS) {
			if (sky) {
				sky.fogColor = '#a8f0a8'
				sky.fogDensity = (config.fogDensity || 0.3) * 120
			}
		} else if (type === WEATHER_TYPES.DUST_CLOUDS) {
			if (sky) {
				sky.fogColor = '#b5651d'
				sky.fogDensity = (config.fogDensity || 0.5) * 180
				sky.sunIntensity = sky.sunIntensity * 0.5
			}
		} else if (type === WEATHER_TYPES.WASTELAND_STORM) {
			if (sky) {
				sky.fogColor = '#5a5a4f'
				sky.fogDensity = (config.fogDensity || 0.6) * 180
				sky.sunIntensity = sky.sunIntensity * 0.4
			}
		}

		// Create particle systems for each component
		console.log(`Creating ${weatherComponents.length} weather components for combined weather`)

		// Track systems for cleanup
		activeWeatherSystems.components = []

		// Process each weather component
		weatherComponents.forEach((component, index) => {
			try {
				if (component.densityMultiplier > 0) {
					// Clone config and adjust density
					const componentConfig = { ...config }
					componentConfig.particleDensity = (config.particleDensity || 1.0) * component.densityMultiplier

					// Create the particle system
					console.log(`Creating weather component ${index + 1}: ${component.type} with density ${componentConfig.particleDensity}`)
					const particleSystem = createWeatherParticleSystem(component.type, componentConfig)

					if (particleSystem) {
						// Apply height offset if specified
						if (component.heightOffset !== undefined && component.heightOffset !== 0) {
							particleSystem.position.y += component.heightOffset
							console.log(`Applied height offset of ${component.heightOffset} to ${component.type}`)
						}

						// Add to scene
						app.add(particleSystem)

						// Track for cleanup
						activeWeatherSystems.components.push(particleSystem)
						console.log(`Added ${component.type} component to scene`)
					}
				}

				// Handle lightning separately for storm components
				if (component.type === WEATHER_TYPES.STORM && component.enableLightning) {
					console.log('Setting up lightning for combined weather')
					setupLightningSystem(config)
				}

				// Handle audio for rain or storm
				if ((component.type === WEATHER_TYPES.RAIN || component.type === WEATHER_TYPES.STORM) && config.rainSound?.url) {
					try {
						console.log('Adding rain sound for combined weather')
						const rainAudio = app.create('audio', {
							src: config.rainSound.url,
							loop: true,
							spatial: false,
							volume: 0.2
						})

						app.add(rainAudio)
						rainAudio.play()
						activeWeatherSystems.rainAudio = rainAudio
						console.log('Rain sound playing')
					} catch (err) {
						console.error('Error creating rain audio:', err)
					}
				}
			} catch (err) {
				console.error(`Error creating weather component ${component.type}:`, err)
			}
		})

		console.log('Combined weather setup complete')
	} catch (err) {
		console.error('Error setting combined weather:', err)
		// Reset to clear weather on error
		currentWeather = WEATHER_TYPES.CLEAR
		cleanupWeatherSystems()
		if (weatherText) {
			weatherText.value = 'Weather: Clear (Error Recovery)'
		}
	}
}

// Extract lightning setup to a separate function for reuse
function setupLightningSystem(config) {
	try {
		// Setup lightning strike scheduler without full-screen flash
		console.log('Setting up lightning strike scheduler')

		// Function to schedule lightning strikes
		const scheduleLightningStrikes = () => {
			if (currentWeather !== WEATHER_TYPES.STORM &&
				currentWeather !== WEATHER_TYPES.THUNDER_STORM &&
				currentWeather !== WEATHER_TYPES.WASTELAND_STORM) return

			// Create 1-3 lightning bolts at random positions
			const boltsCount = Math.floor(Math.random() * 3) + 1
			console.log(`Creating ${boltsCount} lightning bolts`)

			// Store lightning positions to ensure variety
			const lightningPositions = []

			for (let i = 0; i < boltsCount; i++) {
				// Random position around player (or camera) with much greater variance
				// Use different radius for each bolt
				const distance = 50 + Math.random() * 350 // Much wider radius (50-400 instead of 50-250)
				const angle = Math.random() * Math.PI * 2
				const x = Math.cos(angle) * distance
				const z = Math.sin(angle) * distance

				// Check if this position is too close to another bolt
				let tooClose = false
				for (const pos of lightningPositions) {
					const dx = x - pos.x
					const dz = z - pos.z
					const distSq = dx * dx + dz * dz
					if (distSq < 5000) { // Min distance of ~70 units between bolts
						tooClose = true
						break
					}
				}

				// If too close, try again with different position
				if (tooClose && lightningPositions.length > 0) {
					i--
					continue
				}

				// Store this position
				lightningPositions.push({ x, z })

				// More variance in delay timing between bolts (100-1000ms)
				const delay = i * 100 + Math.random() * 900

				// Slight delay between bolts
				setTimeout(() => {
					createLightningStrike(x, z)
				}, delay)
			}

			// Play thunder sound if available
			if (config.thunderSound?.url) {
				const thunder = app.create('audio', {
					src: config.thunderSound.url,
					spatial: false,
					volume: 0.9
				})

				app.add(thunder)
				thunder.play()
				console.log('Thunder sound played')

				// Clean up sound after playback
				setTimeout(() => app.remove(thunder), 5000)
			}

			// Schedule next lightning if still stormy (more variable timing)
			if (currentWeather === WEATHER_TYPES.STORM ||
				currentWeather === WEATHER_TYPES.THUNDER_STORM ||
				currentWeather === WEATHER_TYPES.WASTELAND_STORM) {
				// More variable timing for natural effect (3-15 seconds)
				const nextFlash = 3000 + Math.random() * 12000
				console.log(`Scheduling next lightning in ${Math.round(nextFlash)}ms`)
				setTimeout(scheduleLightningStrikes, nextFlash)
			}
		}

		// Start lightning sequence
		console.log('Starting initial lightning sequence')
		setTimeout(scheduleLightningStrikes, 2000)
	} catch (err) {
		console.error('Error creating lightning system:', err)
	}
}

function setWeather(type, config) {
	try {
		console.log(`Setting weather to: ${type}`)

		// Check if this is a combined weather type
		const combinedTypes = [
			WEATHER_TYPES.RAINY_CLOUDS,
			WEATHER_TYPES.THUNDER_STORM,
			WEATHER_TYPES.RAD_CLOUDS,
			WEATHER_TYPES.DUST_CLOUDS,
			WEATHER_TYPES.WASTELAND_STORM
		]

		if (combinedTypes.includes(type)) {
			setCombinedWeather(type, config)
			return
		}

		// Clean up existing weather systems
		cleanupWeatherSystems()

		// Update current weather
		currentWeather = type

		// Update weather status text in UI
		updateWeatherUI()

		// No particles needed for clear weather
		if (type === WEATHER_TYPES.CLEAR) {
			return
		}

		// Create new particle systems based on weather type
		console.log(`Attempting to create particle system for ${type}`)
		const mainParticleSystem = createWeatherParticleSystem(type, config)

		// Check if particle system was created successfully
		if (mainParticleSystem) {
			console.log(`Adding ${type} particle system to scene`)
			try {
				app.add(mainParticleSystem)
				activeWeatherSystems.main = mainParticleSystem

				// Verify the particle system was added properly
				setTimeout(() => {
					if (mainParticleSystem.parent) {
						console.log(`${type} particle system added successfully with parent:`, mainParticleSystem.parent)
					} else {
						console.warn(`${type} particle system has no parent after adding to scene!`)
					}
				}, 500)
			} catch (addErr) {
				console.error(`Error adding ${type} particle system to scene:`, addErr)
			}
		} else {
			console.warn(`Failed to create particle system for weather type: ${type}`)
		}

		// Add secondary effects based on weather type
		if (type === WEATHER_TYPES.STORM) {
			console.log('Adding lightning effect for storm')
			setupLightningSystem(config)

			// Add rain sound if available
			if (config.rainSound?.url) {
				try {
					console.log('Adding rain sound')
					const rainAudio = app.create('audio', {
						src: config.rainSound.url,
						loop: true,
						spatial: false,
						volume: 0.7
					})

					app.add(rainAudio)
					rainAudio.play()
					activeWeatherSystems.rainAudio = rainAudio
					console.log('Rain sound playing')
				} catch (err) {
					console.error('Error creating rain audio:', err)
				}
			}

			// Modify sky and fog for stormy weather
			if (sky) {
				sky.fogDensity = (config.fogDensity || 0.4) * 150
				sky.fogColor = '#464646'
			}
		} else if (type === WEATHER_TYPES.RAIN) {
			// Add rain sound if available
			if (config.rainSound?.url) {
				try {
					console.log('Adding rain sound')
					const rainAudio = app.create('audio', {
						src: config.rainSound.url,
						loop: true,
						spatial: false,
						volume: 0.5
					})

					app.add(rainAudio)
					rainAudio.play()
					activeWeatherSystems.rainAudio = rainAudio
					console.log('Rain sound playing')
				} catch (err) {
					console.error('Error creating rain audio:', err)
				}
			}

			// Slightly increase fog for rain
			if (sky) {
				sky.fogDensity = (config.fogDensity || 0.3) * 130
				sky.fogColor = '#6b6b6b'
			}
		}

		// Continue with existing code for other weather types...
		else if (type === WEATHER_TYPES.RADSTORM) {
			try {
				// No screen overlay for radstorms anymore, just keep particle effects
				console.log('Setting up radstorm without screen overlay')
			} catch (err) {
				console.error('Error setting up radstorm:', err)
			}

			// Modify sky for rad storm (keep this part)
			if (sky) {
				sky.fogColor = '#a8f0a8'
				sky.fogDensity = (config.fogDensity || 0.3) * 120
			}
		} else if (type === WEATHER_TYPES.DUSTSTORM) {
			// Modify sky for dust storm
			if (sky) {
				sky.fogColor = '#b5651d'
				sky.fogDensity = (config.fogDensity || 0.5) * 180
				sky.sunIntensity = sky.sunIntensity * 0.5 // Dim sun during dust storm
			}
		} else if (type === WEATHER_TYPES.FOGGY) {
			// Just increase fog density
			if (sky) {
				sky.fogDensity = (config.fogDensity || 0.4) * 200
			}
		} else if (type === WEATHER_TYPES.NUCLEAR) {
			try {
				// No screen overlay for nuclear weather anymore, just keep particle effects
				console.log('Setting up nuclear weather without screen overlay')
			} catch (err) {
				console.error('Error setting up nuclear weather:', err)
			}

			// Modify sky for nuclear weather (keep this part)
			if (sky) {
				sky.fogColor = '#545454'
				sky.fogDensity = (config.fogDensity || 0.4) * 140
				sky.sunIntensity = sky.sunIntensity * 0.3 // Very dim sun
			}
		} else if (type === WEATHER_TYPES.CLOUDY) {
			// Just reduce sun intensity
			if (sky) {
				sky.sunIntensity = sky.sunIntensity * 0.7
			}
		}

		// Log successful weather change
		console.log(`Weather set to ${type} successfully`)
		console.log(`Active weather systems:`, Object.keys(activeWeatherSystems))

	} catch (error) {
		console.error('Error setting weather:', error)
		// Reset to clear weather on error
		currentWeather = WEATHER_TYPES.CLEAR
		cleanupWeatherSystems()
		if (weatherText) {
			weatherText.value = 'Weather: Clear (Error Recovery)'
		}
	}
}

function cleanupWeatherSystems() {
	try {
		console.log('Cleaning up weather systems:', Object.keys(activeWeatherSystems))

		// Remove all active weather particle systems
		Object.entries(activeWeatherSystems).forEach(([key, system]) => {
			try {
				// Handle components array differently
				if (key === 'components' && Array.isArray(system)) {
					system.forEach((component, index) => {
						try {
							if (component && component.parent) {
								console.log(`Removing component ${index} from scene`)
								app.remove(component)
							}
						} catch (compErr) {
							console.error(`Error removing component ${index}:`, compErr)
						}
					})
					return
				}

				// Don't attempt to remove null systems
				if (!system) {
					console.log(`Skipping cleanup of ${key} - system is null`)
					return
				}

				// Special handling for audio - stop it before removing
				if (key === 'rainAudio' && system && typeof system.stop === 'function') {
					try {
						console.log('Stopping rain audio')
						system.stop()
					} catch (audioErr) {
						console.error('Error stopping audio:', audioErr)
					}
				}

				// Check if the system is still in the scene before removal
				if (system.parent) {
					console.log(`Removing ${key} from scene`)
					app.remove(system)
				} else {
					console.log(`${key} already removed from scene (no parent)`)
				}
			} catch (removeErr) {
				console.error(`Error removing weather system '${key}':`, removeErr)
			}
		})

		// Reset active systems
		console.log('Clearing activeWeatherSystems dictionary')
		activeWeatherSystems = {}

		// Reset sky modifications if needed
		if (sky) {
			try {
				console.log('Resetting sky parameters')
				updateSunPosition() // This will reset sun intensity
			} catch (skyErr) {
				console.error('Error resetting sky:', skyErr)
			}
		}

		console.log('Weather systems cleanup complete')
	} catch (err) {
		console.error('Error in cleanupWeatherSystems:', err)
		// Force reset of active systems on error
		activeWeatherSystems = {}
	}
}

function updateWeatherUI() {
	// Add a weather status text to UI if not already there
	if (!weatherText) {
		weatherText = app.create('uitext', {
			padding: 5,
			textAlign: 'center',
			value: 'Weather: Clear',
			color: '#00ff00', // Pip-Boy green
			textShadow: '0 0 10px #00ff00', // Add glow effect
			fontSize: 18,
			backgroundColor: 'rgba(0, 0, 0, 0)' // Fully transparent background
		})
		timeView.add(weatherText)
	}

	// Convert weather type to a readable format with Fallout style descriptions
	let weatherName = 'Clear'
	let weatherDescription = ''

	switch (currentWeather) {
		case WEATHER_TYPES.CLOUDY:
			weatherName = 'Cloudy'
			weatherDescription = 'Low Radiation'
			break
		case WEATHER_TYPES.RAIN:
			weatherName = 'Rainy'
			weatherDescription = 'Minor Rad +1'
			break
		case WEATHER_TYPES.STORM:
			weatherName = 'Thunder Storm'
			weatherDescription = 'Hazardous +4'
			break
		case WEATHER_TYPES.RADSTORM:
			weatherName = '☢ RAD STORM ☢'
			weatherDescription = 'Hazardous +4'
			break
		case WEATHER_TYPES.DUSTSTORM:
			weatherName = 'Dust Storm'
			weatherDescription = 'Low Visibility'
			break
		case WEATHER_TYPES.FOGGY:
			weatherName = 'Radiation Fog'
			weatherDescription = 'Minor Rad +2'
			break
		case WEATHER_TYPES.NUCLEAR:
			weatherName = '☢☢☢ FALLOUT ☢☢☢'
			weatherDescription = 'LETHAL +12'
			break
		case WEATHER_TYPES.RAINY_CLOUDS:
			weatherName = 'Rainy Clouds'
			weatherDescription = 'Minor Rad +2'
			break
		case WEATHER_TYPES.THUNDER_STORM:
			weatherName = '☢ WASTELAND STORM ☢'
			weatherDescription = 'Hazardous +5'
			break
		case WEATHER_TYPES.RAD_CLOUDS:
			weatherName = '☢ RAD CLOUDS ☢'
			weatherDescription = 'Hazardous +3'
			break
		case WEATHER_TYPES.DUST_CLOUDS:
			weatherName = 'Dust Clouds'
			weatherDescription = 'Low Visibility +1'
			break
		case WEATHER_TYPES.WASTELAND_STORM:
			weatherName = '☢☢ WASTELAND MAELSTROM ☢☢'
			weatherDescription = 'DEADLY +8'
			break
		default:
			weatherName = 'Clear'
			weatherDescription = 'No Radiation'
	}

	// Update weather text with appropriate warnings for severe weather
	if (currentWeather === WEATHER_TYPES.STORM ||
		currentWeather === WEATHER_TYPES.RADSTORM ||
		currentWeather === WEATHER_TYPES.NUCLEAR ||
		currentWeather === WEATHER_TYPES.THUNDER_STORM ||
		currentWeather === WEATHER_TYPES.WASTELAND_STORM) {
		weatherText.color = '#ff9900' // Warning orange for severe weather
		weatherText.textShadow = '0 0 10px #ff4400'
	} else {
		weatherText.color = '#00ff00' // Normal Pip-Boy green
		weatherText.textShadow = '0 0 10px #00ff00'
	}

	// Update weather text with Fallout-style formatting
	weatherText.value = `Weather: ${weatherName}\n${weatherDescription}`
}

function randomizeWeather(config) {
	try {
		// Skip if transitioning
		if (weatherTransitioning) return

		// Determine weights based on time of day
		const timeOfDay = app.config.timeOfDay || 0
		const isDaytime = timeOfDay > 6 && timeOfDay < 18
		const isDawn = timeOfDay > 5 && timeOfDay < 7
		const isDusk = timeOfDay > 17 && timeOfDay < 19
		const isNight = timeOfDay < 6 || timeOfDay > 18

		// Adjust probabilities based on time
		let weights = {
			[WEATHER_TYPES.CLEAR]: 40,
			[WEATHER_TYPES.CLOUDY]: 25,
			[WEATHER_TYPES.RAIN]: 15,
			[WEATHER_TYPES.STORM]: 8,
			[WEATHER_TYPES.FOGGY]: 5,
			[WEATHER_TYPES.DUSTSTORM]: 3,
			[WEATHER_TYPES.RADSTORM]: 2,
			[WEATHER_TYPES.NUCLEAR]: 2
		}

		// Adjust for time of day
		if (isDawn || isDusk) {
			weights[WEATHER_TYPES.FOGGY] += 15
			weights[WEATHER_TYPES.CLOUDY] += 5
		}

		if (isNight) {
			weights[WEATHER_TYPES.STORM] += 5
			weights[WEATHER_TYPES.RADSTORM] += 3
			weights[WEATHER_TYPES.NUCLEAR] += 2
		}

		if (isDaytime) {
			weights[WEATHER_TYPES.CLEAR] += 10
			weights[WEATHER_TYPES.DUSTSTORM] += 5
		}

		// Store the current weather to avoid the same one
		const previousWeather = currentWeather

		// Build a weighted list
		const weightedList = []
		Object.entries(weights).forEach(([type, weight]) => {
			// Skip the current weather to ensure a change
			if (type !== previousWeather) {
				for (let i = 0; i < weight; i++) {
					weightedList.push(type)
				}
			}
		})

		// Make sure we have at least one option
		if (weightedList.length === 0) {
			// Fallback to clear weather if no options available
			setWeather(WEATHER_TYPES.CLEAR, config)
			weatherDuration = 120 + Math.random() * 120 // 2-4 minutes
			weatherTimer = 0
			return
		}

		// Pick a random weather from the weighted list
		const randomIndex = Math.floor(Math.random() * weightedList.length)
		const newWeather = weightedList[randomIndex]

		// Set the new weather
		try {
			setWeather(newWeather, config)
		} catch (weatherErr) {
			console.error('Error setting random weather:', weatherErr)
			// Fall back to clear weather
			try {
				setWeather(WEATHER_TYPES.CLEAR, config)
			} catch (e) {
				// Last resort - just update current weather type
				currentWeather = WEATHER_TYPES.CLEAR
			}
		}

		// Set a random duration for this weather
		weatherDuration = 120 + Math.random() * 480 // 2-10 minutes
		weatherTimer = 0
	} catch (err) {
		console.error('Error in randomizeWeather:', err)
		// Make sure timer gets reset even on error
		weatherTimer = 0
		weatherDuration = 120
	}
}

function updateWeatherSystem(delta, config) {
	try {
		// Skip if random weather is disabled
		if (!randomWeatherEnabled) return

		// Update weather timer
		weatherTimer += delta

		// Check if it's time to change weather
		if (weatherTimer >= weatherDuration) {
			randomizeWeather(config)
		}

		// Position the weather effects to follow the camera
		if (app.camera && Object.keys(activeWeatherSystems).length > 0) {
			try {
				// Get camera position
				const camPos = app.camera.position

				// If we have a main particle system, update its position
				if (activeWeatherSystems.main && camPos) {
					try {
						// Keep height the same, but follow camera X/Z
						const currentY = activeWeatherSystems.main.position.y
						activeWeatherSystems.main.position.x = camPos.x
						activeWeatherSystems.main.position.z = camPos.z

						// Every 5 seconds, log the current position to verify it's working
						const now = Date.now()
						if (!this.lastPositionLog || now - this.lastPositionLog > 5000) {
							this.lastPositionLog = now
							console.log(`Weather System: ${currentWeather} at position:`, {
								x: activeWeatherSystems.main.position.x,
								y: activeWeatherSystems.main.position.y,
								z: activeWeatherSystems.main.position.z,
								visible: activeWeatherSystems.main.visible,
								active: activeWeatherSystems.main.active
							})

							// Force visibility if somehow not visible
							if (!activeWeatherSystems.main.visible) {
								console.log('Weather particles not visible - making visible')
								activeWeatherSystems.main.visible = true
							}
						}
					} catch (posErr) {
						console.error('Error updating particle position:', posErr)
					}
				} else if (currentWeather !== WEATHER_TYPES.CLEAR && !activeWeatherSystems.main) {
					// If we should have particles but don't, recreate them
					console.log(`Weather system (${currentWeather}) missing particles, recreating...`)
					setWeather(currentWeather, config)
				}
			} catch (camErr) {
				console.error('Error with camera position:', camErr)
			}
		}
	} catch (err) {
		console.error('Error in updateWeatherSystem:', err)
	}
}

// Create a weather text UI element
let weatherText = null

app.configure(() => {
	// Get current values or use defaults
	const currentTimeOfDay = app.config?.timeOfDay ?? 0
	const currentAutoRotate = app.config?.autoRotate ?? false
	const currentIntensity = app.config?.intensity ?? 1
	const currentFogNear = app.config?.fogNear ?? 1
	const currentFogFar = app.config?.fogFar ?? 1000
	const currentFogColor = app.config?.fogColor ?? '#808080'
	const currentFogHeight = app.config?.fogHeight ?? 0
	const currentFogFalloff = app.config?.fogFalloff ?? 1

	// Create sky if it doesn't exist
	if (!sky) {
		sky = app.create('sky')
		app.add(sky)
	}

	// Update sky properties
	sky.bg = app.config.sky?.url
	sky.hdr = app.config.hdr?.url
	sky.sunTexture = app.config.sunTexture?.url // Add sun texture support
	sky.sunTextureScale = app.config.sunTextureScale || 1
	sky.fogNear = app.config.fogNear || 0
	sky.fogFar = app.config.fogFar || 500
	sky.fogColor = app.config.fogColor || '#808080'
	sky.fogDensity = (app.config.fogDensity || 0.2) * 100
	sky.fogHeight = app.config.fogHeight || 2
	sky.fogFalloff = app.config.fogFalloff || 1.5
	sky.sunColor = app.config.sunColor

	// Add fog position properties
	sky.fogPosition = {
		x: app.config.fogPositionX || 0,
		y: app.config.fogPositionY || 0,
		z: app.config.fogPositionZ || 0
	}

	// Initialize sky rotation if auto-rotate is enabled
	if (app.config.autoRotate && sky.bg) {
		const rotation = (app.config.timeOfDay / 24) * Math.PI * 2
		sky.bgRotation = rotation
	}

	// Update sun position
	updateSunPosition()

	// Initialize weather system if random weather is enabled
	randomWeatherEnabled = app.config.randomWeather || false

	// Initialize with selected weather if not using random weather
	if (!randomWeatherEnabled && app.config.weatherType && app.config.weatherType !== currentWeather) {
		setWeather(app.config.weatherType, app.config)
	}

	return [
		{
			key: 'sky',
			label: 'Sky',
			type: 'file',
			kind: 'texture',
			onChange: (value) => {
				if (sky) {
					sky.bg = value?.url
				}
			}
		},
		{
			key: 'hdr',
			label: 'HDR',
			type: 'file',
			kind: 'hdr',
			onChange: (value) => {
				if (sky) sky.hdr = value?.url
			}
		},
		{
			key: 'autoRotate',
			label: '10-Minute Day Cycle',
			type: 'switch',
			options: [
				{ value: false, label: 'Off' },
				{ value: true, label: 'On' }
			],
			initial: currentAutoRotate,
			onChange: (value) => {
				if (value) {
					cycleStartTime = Date.now() // Reset cycle start time when auto-rotate is enabled
					daysPassed = 0 // Reset days when starting new auto-rotate
				}
			}
		},
		{
			key: 'timeOfDay',
			label: 'Time of Day',
			type: 'number',
			min: 0,
			max: 24,
			step: 0.1,
			initial: 0,
			dp: 1,
			onChange: () => updateSunPosition()
		},
		{
			key: 'intensity',
			label: 'Intensity',
			type: 'number',
			min: 0,
			max: 10,
			step: 0.1,
			initial: currentIntensity,
			dp: 1,
			onChange: () => updateSunPosition()
		},

		// Weather System Configuration
		{
			type: 'section',
			key: 'weatherSection',
			label: 'WASTELAND WEATHER SYSTEM'
		},
		{
			key: 'randomWeather',
			label: 'Random Weather',
			type: 'switch',
			options: [
				{ value: false, label: 'Off' },
				{ value: true, label: 'On' }
			],
			initial: app.config?.randomWeather || false,
			onChange: (value) => {
				randomWeatherEnabled = value
				if (value) {
					// Initialize with random weather
					randomizeWeather(app.config)
				} else {
					// Clear weather when turning off random weather
					setWeather(WEATHER_TYPES.CLEAR, app.config)
				}
			}
		},
		{
			key: 'weatherType',
			label: 'Weather Type',
			type: 'switch',
			options: [
				// Basic weather types
				{ value: WEATHER_TYPES.CLEAR, label: 'Clear' },
				{ value: WEATHER_TYPES.CLOUDY, label: 'Cloudy' },
				{ value: WEATHER_TYPES.RAIN, label: 'Rain' },
				{ value: WEATHER_TYPES.STORM, label: 'Storm' },
				{ value: WEATHER_TYPES.RADSTORM, label: 'Rad Storm' },
				{ value: WEATHER_TYPES.DUSTSTORM, label: 'Dust Storm' },
				{ value: WEATHER_TYPES.FOGGY, label: 'Foggy' },
				{ value: WEATHER_TYPES.NUCLEAR, label: 'Nuclear' },
				// Combined weather types
				{ value: WEATHER_TYPES.RAINY_CLOUDS, label: 'Rainy Clouds' },
				{ value: WEATHER_TYPES.THUNDER_STORM, label: 'Thunder Storm' },
				{ value: WEATHER_TYPES.RAD_CLOUDS, label: 'Rad Clouds' },
				{ value: WEATHER_TYPES.DUST_CLOUDS, label: 'Dust Clouds' },
				{ value: WEATHER_TYPES.WASTELAND_STORM, label: 'Wasteland Storm' }
			],
			initial: app.config?.weatherType || WEATHER_TYPES.CLEAR,
			onChange: (value) => {
				if (!randomWeatherEnabled) {
					setWeather(value, app.config)
				}
			}
		},
		{
			key: 'particleDensity',
			label: 'Particle Density',
			type: 'number',
			min: 0.1,
			max: 50.0,
			step: 0.1,
			initial: app.config?.particleDensity || 1.0,
			dp: 1,
			onChange: (value) => {
				// Recreate current weather with new density
				if (currentWeather !== WEATHER_TYPES.CLEAR) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'defaultParticleTexture',
			label: 'Default Particle',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				// Recreate current weather with new texture
				if (currentWeather !== WEATHER_TYPES.CLEAR) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'rainTexture',
			label: 'Rain Particle',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				if (currentWeather === WEATHER_TYPES.RAIN || currentWeather === WEATHER_TYPES.STORM) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'dustTexture',
			label: 'Dust Particle',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				if (currentWeather === WEATHER_TYPES.DUSTSTORM) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'radstormTexture',
			label: 'Radstorm Particle',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				if (currentWeather === WEATHER_TYPES.RADSTORM) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'fogParticleTexture',
			label: 'Fog Particle',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				if (currentWeather === WEATHER_TYPES.FOGGY) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'ashTexture',
			label: 'Ash Particle',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				if (currentWeather === WEATHER_TYPES.NUCLEAR) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'cloudTexture',
			label: 'Cloud Texture',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				if (currentWeather === WEATHER_TYPES.CLOUDY) {
					setWeather(currentWeather, app.config)
				}
			}
		},
		{
			key: 'thunderSound',
			label: 'Thunder Sound',
			type: 'file',
			kind: 'audio',
			onChange: () => {
				// No need to recreate, will be used when next thunder happens
			}
		},
		{
			key: 'rainSound',
			label: 'Rain Sound',
			type: 'file',
			kind: 'audio',
			onChange: (value) => {
				// Stop existing rain sound if there is one
				if (activeWeatherSystems.rainAudio) {
					app.remove(activeWeatherSystems.rainAudio)
					delete activeWeatherSystems.rainAudio
				}

				// If rain or storm is active, create new rain sound
				if ((currentWeather === WEATHER_TYPES.RAIN || currentWeather === WEATHER_TYPES.STORM) && value?.url) {
					const rainAudio = app.create('audio')
					rainAudio.src = value.url
					rainAudio.loop = true
					rainAudio.spatial = false
					rainAudio.volume = 0.5
					app.add(rainAudio)
					rainAudio.play()
					activeWeatherSystems.rainAudio = rainAudio
				}
			}
		},
		{
			key: 'lightningTexture',
			label: 'Lightning Texture',
			type: 'file',
			kind: 'texture',
			onChange: () => {
				// Will be used for next lightning
				if (currentWeather === WEATHER_TYPES.STORM) {
					// If we have an active storm, recreate it to use new lightning texture
					setWeather(WEATHER_TYPES.STORM, app.config)
				}
			}
		},

		// Fog Configuration
		{
			type: 'section',
			key: 'fogSection',
			label: 'FOG PARAMETERS'
		},
		{
			key: 'fogNear',
			label: 'Fog Start Distance',
			type: 'number',
			min: 0,
			max: 100, // Reduced max for closer fog
			step: 0.5,
			initial: 0,
			dp: 1,
			onChange: (value) => {
				if (sky) sky.fogNear = Math.max(0.01, value * 0.5)
			}
		},
		{
			key: 'fogFar',
			label: 'Fog End Distance',
			type: 'number',
			min: 10,
			max: 2000, // Extended back to 2000 for longer distance fog
			step: 10,
			initial: 500,
			dp: 0,
			onChange: (value) => {
				if (sky) sky.fogFar = value
			}
		},
		{
			key: 'fogColor',
			label: 'Fog Color (hex)',
			type: 'text',
			placeholder: '#808080',
			initial: currentFogColor,
			onChange: (value) => {
				if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
					if (sky) sky.fogColor = value
				}
			}
		},
		{
			key: 'fogDensity',
			label: 'Fog Thickness',
			type: 'number',
			min: 0,
			max: 1,
			step: 0.05,
			initial: 0.2,
			dp: 2,
			onChange: (value) => {
				if (sky) sky.fogDensity = value * 100 // Much stronger multiplier
			}
		},
		{
			key: 'fogHeight',
			label: 'Fog Height',
			type: 'number',
			min: -5,
			max: 10,
			step: 0.5,
			initial: 2,
			dp: 1,
			onChange: (value) => {
				if (sky) sky.fogHeight = value * 2 // Amplify height effect
			}
		},
		{
			key: 'fogFalloff',
			label: 'Fog Falloff',
			type: 'number',
			min: 0.1,
			max: 3,
			step: 0.1,
			initial: 1.5,
			dp: 1,
			onChange: (value) => {
				if (sky) sky.fogFalloff = value
			}
		},

		// Sun Configuration
		{
			type: 'section',
			key: 'sunSection',
			label: 'SUN PARAMETERS'
		},
		{
			key: 'sunColor',
			label: 'Sun Color (hex)',
			type: 'text',
			placeholder: '#ffffff',
			initial: app.config?.sunColor ?? '#ffffff',
			onChange: (value) => {
				if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
					if (sky) sky.sunColor = value
				}
			}
		},
		{
			key: 'sunTexture',
			label: 'Sun Texture',
			type: 'file',
			kind: 'texture',
			onChange: (value) => {
				if (sky) {
					sky.sunTexture = value?.url
				}
			}
		},
		{
			key: 'sunTextureScale',
			label: 'Sun Size',
			type: 'number',
			min: 0.1,
			max: 2,
			step: 0.1,
			initial: 1,
			dp: 1,
			onChange: (value) => {
				if (sky && sky.sunTexture) {
					sky.sunTextureScale = value
				}
			}
		},

		// Fog Position Configuration
		{
			type: 'section',
			key: 'fogPositionSection',
			label: 'FOG POSITION'
		},
		{
			key: 'fogPositionX',
			label: 'Fog Position X',
			type: 'number',
			min: -100,
			max: 100,
			step: 1,
			initial: 0,
			dp: 0,
			onChange: (value) => {
				if (sky) sky.fogPosition.x = value
			}
		},
		{
			key: 'fogPositionY',
			label: 'Fog Position Y',
			type: 'number',
			min: -50,
			max: 100,
			step: 1,
			initial: 0,
			dp: 0,
			onChange: (value) => {
				if (sky) sky.fogPosition.y = value
			}
		},
		{
			key: 'fogPositionZ',
			label: 'Fog Position Z',
			type: 'number',
			min: -100,
			max: 100,
			step: 1,
			initial: 0,
			dp: 0,
			onChange: (value) => {
				if (sky) sky.fogPosition.z = value
			}
		},
		{
			key: 'resetFogPosition',
			label: 'Reset Fog Position',
			type: 'button',
			onChange: () => {
				if (sky) {
					sky.fogPosition = { x: 0, y: 0, z: 0 }
					// Update the config values
					app.config.fogPositionX = 0
					app.config.fogPositionY = 0
					app.config.fogPositionZ = 0
					app.configure()
				}
			}
		},
		{
			key: 'fogAnimation',
			label: 'Animate Fog',
			type: 'switch',
			options: [
				{ value: false, label: 'Off' },
				{ value: true, label: 'On' }
			],
			initial: true,
			onChange: (value) => {
				if (!value && sky) {
					// Reset to base position when animation is disabled
					sky.fogPosition = {
						x: app.config.fogPositionX || 0,
						y: app.config.fogPositionY || 0,
						z: app.config.fogPositionZ || 0
					}
				}
			}
		},
		{
			key: 'fogAnimationSpeed',
			label: 'Fog Animation Speed',
			type: 'number',
			min: 0.1,
			max: 2.0,
			step: 0.1,
			initial: 1.0,
			dp: 1,
			onChange: (value) => {
				if (fogNoise) {
					fogNoise.speed = value
				}
			}
		},
		{
			key: 'lightningHeight',
			label: 'Lightning Height',
			type: 'number',
			min: 100,
			max: 1000,
			step: 10,
			initial: 200,
			dp: 0,
			onChange: (value) => {
				// No need to recreate, will be used when next lightning happens
			}
		},
		{
			key: 'lightningStartHeight',
			label: 'Lightning Start Height',
			type: 'number',
			min: 0,
			max: 200,
			step: 10,
			initial: 0,
			dp: 0,
			onChange: (value) => {
				// No need to recreate, will be used when next lightning happens
			}
		}
	]
})