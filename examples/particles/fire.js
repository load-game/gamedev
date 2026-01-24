// Realistic Fire Effect for Hyperfy
// This script creates a customizable, realistic fire effect with extensive configuration options

// Initialize app configuration
app.configure(() => {
  return [
    {
      type: 'section',
      key: 'presets',
      label: 'Fire Presets',
    },
    {
      key: 'presetName',
      type: 'text',
      label: 'Preset Name',
      initial: 'My Custom Fire',
    },
    {
      key: 'savePreset',
      type: 'button',
      label: 'Save Current Settings',
      options: [{ value: false, label: 'Save Preset' }],
      initial: false,
    },
    {
      key: 'loadPreset',
      type: 'dropdown',
      label: 'Load Preset',
      options: [
        { value: 'default', label: 'Default Fire' },
        { value: 'small', label: 'Small Fire' },
        { value: 'medium', label: 'Medium Fire' },
        { value: 'large', label: 'Large Fire' },
        { value: 'torch', label: 'Torch' },
        // Dynamic presets will be added here
      ],
      initial: 'medium',
    },
    {
      type: 'section',
      key: 'appearance',
      label: 'Fire Appearance',
    },
    {
      key: 'baseColor',
      type: 'color',
      label: 'Base Color',
      initial: '#ff3800',
    },
    {
      key: 'glowIntensity',
      type: 'range',
      label: 'Glow Intensity',
      min: 0.5,
      max: 5,
      step: 0.1,
      initial: 2,
    },
    {
      key: 'opacity',
      type: 'range',
      label: 'Opacity',
      min: 0.1,
      max: 1.0,
      step: 0.05,
      initial: 0.7,
    },
    {
      type: 'section',
      key: 'particles',
      label: 'Particle Settings',
    },
    {
      key: 'maxParticles',
      type: 'number',
      label: 'Max Particles',
      min: 50,
      max: 1000,
      step: 50,
      initial: 400,
    },
    {
      key: 'spawnRate',
      type: 'number',
      label: 'Spawn Rate (per sec)',
      min: 10,
      max: 200,
      step: 5,
      initial: 60,
    },
    {
      key: 'lifetime',
      type: 'range',
      label: 'Particle Lifetime (sec)',
      min: 0.5,
      max: 5.0,
      step: 0.1,
      initial: 1.5,
    },
    {
      key: 'spawnRadius',
      type: 'range',
      label: 'Spawn Radius',
      min: 0.05,
      max: 1.0,
      step: 0.05,
      initial: 0.2,
    },
    {
      key: 'minScale',
      type: 'range',
      label: 'Min Particle Size',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      initial: 0.05,
    },
    {
      key: 'maxScale',
      type: 'range',
      label: 'Max Particle Size',
      min: 0.05,
      max: 1.0,
      step: 0.01,
      initial: 0.1,
    },
    {
      type: 'section',
      key: 'physics',
      label: 'Fire Physics',
    },
    {
      key: 'minSpeed',
      type: 'range',
      label: 'Min Speed',
      min: 0.1,
      max: 5.0,
      step: 0.1,
      initial: 1.0,
    },
    {
      key: 'maxSpeed',
      type: 'range',
      label: 'Max Speed',
      min: 0.5,
      max: 10.0,
      step: 0.1,
      initial: 2.0,
    },
    {
      key: 'gravity',
      type: 'range',
      label: 'Gravity',
      min: -2.0,
      max: 2.0,
      step: 0.1,
      initial: -0.5,
    },
    {
      key: 'turbulence',
      type: 'range',
      label: 'Turbulence',
      min: 0.0,
      max: 2.0,
      step: 0.05,
      initial: 0.3,
    },
    {
      key: 'smoke',
      type: 'section',
      label: 'Smoke Settings',
    },
    {
      key: 'enableSmoke',
      type: 'switch',
      label: 'Enable Smoke',
      options: [
        { value: true, label: 'On' },
        { value: false, label: 'Off' },
      ],
      initial: false,
    },
    {
      key: 'smokeColor',
      type: 'color',
      label: 'Smoke Color',
      initial: '#444444',
      when: [{ key: 'enableSmoke', op: 'eq', value: true }],
    },
    {
      key: 'smokeOpacity',
      type: 'range',
      label: 'Smoke Opacity',
      min: 0.1,
      max: 1.0,
      step: 0.05,
      initial: 0.3,
      when: [{ key: 'enableSmoke', op: 'eq', value: true }],
    },
    {
      key: 'smokeRatio',
      type: 'range',
      label: 'Smoke Ratio',
      min: 0.0,
      max: 1.0,
      step: 0.05,
      initial: 0.2,
      when: [{ key: 'enableSmoke', op: 'eq', value: true }],
    },
  ]
})

// Define default preset configurations
const defaultPresets = {
  default: {
    maxParticles: 400,
    spawnRate: 60,
    lifetime: 1.5,
    minSpeed: 1.0,
    maxSpeed: 2.0,
    minScale: 0.05,
    maxScale: 0.1,
    spawnRadius: 0.2,
    gravity: -0.5,
    turbulence: 0.3,
    baseColor: '#ff3800',
    glowIntensity: 2,
    opacity: 0.7,
    enableSmoke: false,
  },
  small: {
    maxParticles: 150,
    spawnRate: 30,
    lifetime: 1.0,
    minSpeed: 0.7,
    maxSpeed: 1.5,
    minScale: 0.03,
    maxScale: 0.08,
    spawnRadius: 0.1,
    gravity: -0.4,
    turbulence: 0.2,
    baseColor: '#ff3800',
    glowIntensity: 1.8,
    opacity: 0.7,
    enableSmoke: false,
  },
  medium: {
    maxParticles: 400,
    spawnRate: 60,
    lifetime: 1.5,
    minSpeed: 1.0,
    maxSpeed: 2.0,
    minScale: 0.05,
    maxScale: 0.12,
    spawnRadius: 0.2,
    gravity: -0.5,
    turbulence: 0.3,
    baseColor: '#ff3800',
    glowIntensity: 2,
    opacity: 0.7,
    enableSmoke: false,
  },
  large: {
    maxParticles: 800,
    spawnRate: 120,
    lifetime: 2.0,
    minSpeed: 1.2,
    maxSpeed: 2.5,
    minScale: 0.08,
    maxScale: 0.2,
    spawnRadius: 0.4,
    gravity: -0.6,
    turbulence: 0.4,
    baseColor: '#ff3800',
    glowIntensity: 2.2,
    opacity: 0.7,
    enableSmoke: true,
    smokeColor: '#444444',
    smokeOpacity: 0.3,
    smokeRatio: 0.2,
  },
  torch: {
    maxParticles: 200,
    spawnRate: 40,
    lifetime: 1.2,
    minSpeed: 1.0,
    maxSpeed: 2.2,
    minScale: 0.04,
    maxScale: 0.1,
    spawnRadius: 0.08,
    gravity: -0.7,
    turbulence: 0.25,
    baseColor: '#ff5500',
    glowIntensity: 2.5,
    opacity: 0.7,
    enableSmoke: false,
  },
}

// Create our particle template for fire
let particleTemplate
try {
  // Try to get the template first in case it exists
  particleTemplate = app.get('FireParticle')

  // If not found, create our own template
  if (!particleTemplate) {
    console.log('[FIRE] Creating custom fire particle template')
    particleTemplate = app.create('mesh')

    // Set template properties
    particleTemplate.scale.set(0.1, 0.1, 0.1)

    // Create material for the template
    const material = {
      emissive: app.config.baseColor || '#ff3800',
      emissiveIntensity: app.config.glowIntensity || 2,
      transparent: true,
      opacity: app.config.opacity || 0.7,
    }
    particleTemplate.material = material

    // Set an ID for reference
    particleTemplate.id = 'FireParticle'
  }

  // Hide the template
  particleTemplate.visible = false
} catch (error) {
  console.error('[FIRE] Error creating particle template:', error)

  // Create a fallback simple template
  particleTemplate = app.create('mesh')
  particleTemplate.scale.set(0.1, 0.1, 0.1)
  particleTemplate.visible = false
}

// Create smoke particle template if enabled
let smokeTemplate
if (app.config.enableSmoke) {
  try {
    smokeTemplate = app.get('SmokeParticle')

    if (!smokeTemplate) {
      console.log('[FIRE] Creating smoke particle template')
      smokeTemplate = app.create('mesh')

      smokeTemplate.scale.set(0.2, 0.2, 0.2)

      const smokeMaterial = {
        color: app.config.smokeColor || '#444444',
        transparent: true,
        opacity: app.config.smokeOpacity || 0.3,
      }
      smokeTemplate.material = smokeMaterial

      smokeTemplate.id = 'SmokeParticle'
    }

    smokeTemplate.visible = false
  } catch (error) {
    console.error('[FIRE] Error creating smoke template:', error)
    app.config.enableSmoke = false
  }
}

// Server-side preset management
if (world.isServer) {
  // Store for fire presets
  const FIRE_PRESETS_KEY = 'fire_presets'

  // Initialize presets if not already set
  const initializePresets = () => {
    const existingPresets = world.get(FIRE_PRESETS_KEY)
    if (!existingPresets) {
      // Set default presets
      world.set(FIRE_PRESETS_KEY, defaultPresets)
      console.log('[FIRE] Initialized default presets')
      return defaultPresets
    }
    return existingPresets
  }

  // Make sure we have presets
  const presets = initializePresets()

  // Handle save preset requests
  app.on('savePreset', data => {
    if (!data || !data.name || !data.preset) {
      console.error('[FIRE] Invalid preset data:', data)
      return
    }

    try {
      const presets = world.get(FIRE_PRESETS_KEY) || {}
      const presetName = data.name

      // Save the new preset
      presets[presetName] = data.preset
      world.set(FIRE_PRESETS_KEY, presets)

      console.log(`[FIRE] Saved preset "${presetName}"`)

      // Broadcast updated presets to all clients
      app.send('presetsUpdated', { presets })
    } catch (error) {
      console.error('[FIRE] Error saving preset:', error)
    }
  })

  // Handle get presets requests
  app.on('getPresets', () => {
    try {
      const presets = world.get(FIRE_PRESETS_KEY) || defaultPresets
      app.send('presetsUpdated', { presets })
    } catch (error) {
      console.error('[FIRE] Error getting presets:', error)
    }
  })

  // Initialize by broadcasting presets to all clients
  app.send('presetsUpdated', { presets })
}

// Configure based on selected preset or settings
const CONFIG = {
  BURST_INTERVAL: 0.05, // Time between particle bursts (seconds)
}

// Apply configuration values
CONFIG.MAX_PARTICLES = app.config.maxParticles || 400
CONFIG.SPAWN_RATE = app.config.spawnRate || 60
CONFIG.LIFETIME = app.config.lifetime || 1.5
CONFIG.MIN_SPEED = app.config.minSpeed || 1.0
CONFIG.MAX_SPEED = app.config.maxSpeed || 2.0
CONFIG.MIN_SCALE = app.config.minScale || 0.05
CONFIG.MAX_SCALE = app.config.maxScale || 0.1
CONFIG.SPAWN_RADIUS = app.config.spawnRadius || 0.2
CONFIG.GRAVITY = app.config.gravity || -0.5
CONFIG.TURBULENCE = app.config.turbulence || 0.3
CONFIG.PARTICLES_PER_BURST = Math.ceil(CONFIG.SPAWN_RATE * CONFIG.BURST_INTERVAL)

// Add smoke configuration if enabled
if (app.config.enableSmoke) {
  CONFIG.SMOKE_RATIO = app.config.smokeRatio || 0.2
  CONFIG.SMOKE_LIFETIME = CONFIG.LIFETIME * 1.5
  CONFIG.SMOKE_MIN_SCALE = CONFIG.MIN_SCALE * 2
  CONFIG.SMOKE_MAX_SCALE = CONFIG.MAX_SCALE * 3
  CONFIG.SMOKE_SPAWN_HEIGHT = 0.2
}

console.log(`[FIRE] Initializing fire effect with ${CONFIG.MAX_PARTICLES} particles`)

if (world.isClient) {
  console.log('[FIRE] Initializing client-side particle system')

  // Particle pool tracking - Use separate arrays for fire and smoke particles
  const fireParticles = []
  const inactiveFireIndices = []
  const smokeParticles = []
  const inactiveSmokeIndices = []
  let timeSinceLastBurst = 0

  // Track available presets
  let availablePresets = defaultPresets

  // Handle preset list updates from server
  app.on('presetsUpdated', data => {
    console.log('[FIRE] Received updated presets from server')
    if (data && data.presets) {
      availablePresets = data.presets
    }
  })

  // Request presets from server when client loads
  app.send('getPresets')

  // Handle preset saving
  app.on('config', () => {
    // Check if we need to save a preset
    if (app.config.savePreset === true) {
      const presetName = app.config.presetName || 'Custom Preset'

      // Collect current settings
      const preset = {
        maxParticles: app.config.maxParticles,
        spawnRate: app.config.spawnRate,
        lifetime: app.config.lifetime,
        minSpeed: app.config.minSpeed,
        maxSpeed: app.config.maxSpeed,
        minScale: app.config.minScale,
        maxScale: app.config.maxScale,
        spawnRadius: app.config.spawnRadius,
        gravity: app.config.gravity,
        turbulence: app.config.turbulence,
        baseColor: app.config.baseColor,
        glowIntensity: app.config.glowIntensity,
        opacity: app.config.opacity,
        enableSmoke: app.config.enableSmoke,
        smokeColor: app.config.smokeColor,
        smokeOpacity: app.config.smokeOpacity,
        smokeRatio: app.config.smokeRatio,
      }

      // Send to server for saving
      app.send('savePreset', { name: presetName, preset })
      console.log(`[FIRE] Saving preset "${presetName}"`)

      // Reset save toggle
      setTimeout(() => {
        app.config = { ...app.config, savePreset: false }
      }, 100)
    }

    // Handle preset loading
    const selectedPreset = app.config.loadPreset
    if (selectedPreset && availablePresets[selectedPreset]) {
      console.log(`[FIRE] Loading preset "${selectedPreset}"`)
      const preset = availablePresets[selectedPreset]

      // Apply preset settings without using app.config
      CONFIG.MAX_PARTICLES = preset.maxParticles || 400
      CONFIG.SPAWN_RATE = preset.spawnRate || 60
      CONFIG.LIFETIME = preset.lifetime || 1.5
      CONFIG.MIN_SPEED = preset.minSpeed || 1.0
      CONFIG.MAX_SPEED = preset.maxSpeed || 2.0
      CONFIG.MIN_SCALE = preset.minScale || 0.05
      CONFIG.MAX_SCALE = preset.maxScale || 0.1
      CONFIG.SPAWN_RADIUS = preset.spawnRadius || 0.2
      CONFIG.GRAVITY = preset.gravity || -0.5
      CONFIG.TURBULENCE = preset.turbulence || 0.3
      CONFIG.PARTICLES_PER_BURST = Math.ceil(CONFIG.SPAWN_RATE * CONFIG.BURST_INTERVAL)

      // Update material properties for new particles
      if (particleTemplate && particleTemplate.material) {
        particleTemplate.material.emissive = preset.baseColor || '#ff3800'
        particleTemplate.material.emissiveIntensity = preset.glowIntensity || 2
        particleTemplate.material.opacity = preset.opacity || 0.7
      }

      // Update smoke settings
      if (preset.enableSmoke) {
        CONFIG.SMOKE_RATIO = preset.smokeRatio || 0.2
        CONFIG.SMOKE_LIFETIME = CONFIG.LIFETIME * 1.5
        CONFIG.SMOKE_MIN_SCALE = CONFIG.MIN_SCALE * 2
        CONFIG.SMOKE_MAX_SCALE = CONFIG.MAX_SCALE * 3
        CONFIG.SMOKE_SPAWN_HEIGHT = 0.2

        // Update smoke template
        if (smokeTemplate && smokeTemplate.material) {
          smokeTemplate.material.color = preset.smokeColor || '#444444'
          smokeTemplate.material.opacity = preset.smokeOpacity || 0.3
        }
      }
    }
  })

  // Get camera control for particle billboarding
  let control
  try {
    control = app.control()
  } catch (error) {
    console.error('[FIRE] Error getting control:', error)
    // Create a fallback control with camera
    control = { camera: { position: new Vector3() } }
  }

  // Initialize fire particle pool
  try {
    console.log('[FIRE] Initializing particle pool')
    for (let i = 0; i < CONFIG.MAX_PARTICLES; i++) {
      try {
        const particle = particleTemplate.clone(true)
        if (!particle) {
          console.warn(`[FIRE] Failed to clone particle ${i}, skipping`)
          continue
        }

        particle.visible = false

        // Add metadata to particle as custom properties (avoid setting 'type' directly)
        particle.velocity = new Vector3()
        particle.lifetime = 0
        particle.active = false
        particle.maxScale = 0 // Will be set when spawned
        particle.temperature = 1.0 // For color variation

        fireParticles.push(particle)
        inactiveFireIndices.push(i)
        app.add(particle)
      } catch (particleError) {
        console.error(`[FIRE] Error creating particle ${i}:`, particleError)
      }
    }
    console.log(`[FIRE] Created ${fireParticles.length} fire particles`)

    // Initialize smoke particles if enabled
    if (app.config.enableSmoke && smokeTemplate) {
      const smokeCount = Math.floor(CONFIG.MAX_PARTICLES * CONFIG.SMOKE_RATIO)
      console.log(`[FIRE] Initializing ${smokeCount} smoke particles`)

      for (let i = 0; i < smokeCount; i++) {
        try {
          const smoke = smokeTemplate.clone(true)
          if (!smoke) {
            console.warn(`[FIRE] Failed to clone smoke particle ${i}, skipping`)
            continue
          }

          smoke.visible = false
          smoke.velocity = new Vector3()
          smoke.lifetime = 0
          smoke.active = false
          smoke.maxScale = 0 // Will be set when spawned

          smokeParticles.push(smoke)
          inactiveSmokeIndices.push(i)
          app.add(smoke)
        } catch (smokeError) {
          console.error(`[FIRE] Error creating smoke particle ${i}:`, smokeError)
        }
      }
      console.log(`[FIRE] Created ${smokeParticles.length} smoke particles`)
    }
  } catch (poolError) {
    console.error('[FIRE] Error initializing particle pool:', poolError)
  }

  // Get an available particle from the pool
  function getParticle(isSmoke = false) {
    try {
      if (isSmoke) {
        if (inactiveSmokeIndices.length === 0) return null
        const index = inactiveSmokeIndices.pop()
        return smokeParticles[index]
      } else {
        if (inactiveFireIndices.length === 0) return null
        const index = inactiveFireIndices.pop()
        return fireParticles[index]
      }
    } catch (error) {
      console.error('[FIRE] Error getting particle:', error)
      return null
    }
  }

  // Spawn a new fire particle
  function spawnFireParticle() {
    try {
      const particle = getParticle(false)
      if (!particle) return

      // Random position within spawn radius (concentrated at base)
      const angle = num(0, 1, 2) * Math.PI * 2
      const radius = Math.pow(num(0, 1, 2), 0.5) * CONFIG.SPAWN_RADIUS // Square root for more concentration in center
      particle.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)

      // Velocity mostly upward with slight variation
      const speed = CONFIG.MIN_SPEED + num(0, 1, 2) * (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED)
      const horizontalDirection = num(0, 1, 2) * Math.PI * 2
      const horizontalStrength = 0.2 // Mostly vertical movement

      // Set velocity
      if (!particle.velocity) {
        particle.velocity = new Vector3()
      }

      particle.velocity.set(
        speed * horizontalStrength * Math.cos(horizontalDirection),
        speed * (0.8 + 0.2 * num(0, 1, 2)), // Mostly upward
        speed * horizontalStrength * Math.sin(horizontalDirection)
      )

      // Random scale for variation
      const scale = CONFIG.MIN_SCALE + num(0, 1, 2) * (CONFIG.MAX_SCALE - CONFIG.MIN_SCALE)
      particle.scale.set(scale, scale, scale)

      // Set fire particle color variations
      const baseColor = app.config.baseColor || '#ff3800'
      // Randomly adjust color to add variation (slightly brighter or more yellowish)
      const colorVariation = num(0, 1, 2)
      let particleColor = baseColor

      // Add color variations for more realistic fire
      if (colorVariation > 0.7) {
        particleColor = '#ffb800' // More yellow for some particles
      } else if (colorVariation > 0.4) {
        particleColor = '#ff5500' // More orange for some particles
      }

      if (particle.material) {
        particle.material.emissive = particleColor
        particle.material.emissiveIntensity = app.config.glowIntensity || 2
        particle.material.opacity = app.config.opacity || 0.7
      }

      // Reset particle state
      particle.lifetime = 0
      particle.visible = true
      particle.active = true
      particle.maxScale = scale * 1.5 // Store max scale for growth effect
      particle.temperature = 1.0 // Start at full heat
    } catch (error) {
      console.error('[FIRE] Error spawning fire particle:', error)
    }
  }

  // Spawn a new smoke particle if smoke is enabled
  function spawnSmokeParticle() {
    if (!app.config.enableSmoke || !smokeTemplate) return

    try {
      const smoke = getParticle(true)
      if (!smoke) return

      // Position smoke particle slightly above fire base
      const angle = num(0, 1, 2) * Math.PI * 2
      const radius = Math.pow(num(0, 1, 2), 0.5) * CONFIG.SPAWN_RADIUS
      smoke.position.set(
        Math.cos(angle) * radius,
        CONFIG.SMOKE_SPAWN_HEIGHT, // Start smoke slightly above fire base
        Math.sin(angle) * radius
      )

      // Slower upward velocity for smoke
      const speed = CONFIG.MIN_SPEED * 0.5 + num(0, 1, 2) * 0.3
      const horizontalDirection = num(0, 1, 2) * Math.PI * 2
      const horizontalStrength = 0.3 // More horizontal drift than fire

      if (!smoke.velocity) {
        smoke.velocity = new Vector3()
      }

      smoke.velocity.set(
        speed * horizontalStrength * Math.cos(horizontalDirection),
        speed * 0.7, // Slower upward drift
        speed * horizontalStrength * Math.sin(horizontalDirection)
      )

      // Larger scale for smoke
      const scale = CONFIG.SMOKE_MIN_SCALE + num(0, 1, 2) * (CONFIG.SMOKE_MAX_SCALE - CONFIG.SMOKE_MIN_SCALE)
      smoke.scale.set(scale, scale, scale)

      // Set smoke material properties
      if (smoke.material) {
        smoke.material.color = app.config.smokeColor || '#444444'
        smoke.material.opacity = 0 // Start invisible and fade in
      }

      // Reset smoke state
      smoke.lifetime = 0
      smoke.visible = true
      smoke.active = true
      smoke.maxScale = scale * 1.2
    } catch (error) {
      console.error('[FIRE] Error spawning smoke particle:', error)
    }
  }

  // Update fire particles
  app.on('update', delta => {
    // Continuous particle emission
    timeSinceLastBurst += delta
    if (timeSinceLastBurst >= CONFIG.BURST_INTERVAL) {
      timeSinceLastBurst = 0
      // Spawn fire particles
      for (let i = 0; i < CONFIG.PARTICLES_PER_BURST; i++) {
        spawnFireParticle()
      }

      // Spawn smoke particles with lower frequency if enabled
      if (app.config.enableSmoke && num(0, 1) < 0.3) {
        const smokeCount = Math.max(1, Math.floor(CONFIG.PARTICLES_PER_BURST * CONFIG.SMOKE_RATIO))
        for (let i = 0; i < smokeCount; i++) {
          spawnSmokeParticle()
        }
      }
    }

    // Update active fire particles
    for (let i = 0; i < fireParticles.length; i++) {
      const particle = fireParticles[i]
      if (!particle.active) continue

      // Add turbulence/flickering to simulate fire
      particle.velocity.x += (num(0, 1, 2) - 0.5) * CONFIG.TURBULENCE * delta
      particle.velocity.z += (num(0, 1, 2) - 0.5) * CONFIG.TURBULENCE * delta

      // Update position based on velocity
      particle.position.x += particle.velocity.x * delta
      particle.position.y += particle.velocity.y * delta
      particle.position.z += particle.velocity.z * delta

      // Apply "negative gravity" to make particles rise faster as they go up
      // More realistic fire rises faster as it heats up
      const heightFactor = Math.min(1.0, particle.position.y * 2)
      particle.velocity.y += CONFIG.GRAVITY * delta * (1 - heightFactor)

      // Make particles face camera for billboard effect
      const dx = control.camera.position.x - particle.position.x
      const dz = control.camera.position.z - particle.position.z
      const rotY = Math.atan2(dx, dz)
      particle.rotation.set(0, rotY, 0)

      // Update lifetime and check for despawn
      particle.lifetime += delta
      const lifeRatio = particle.lifetime / CONFIG.LIFETIME

      if (particle.lifetime >= CONFIG.LIFETIME) {
        particle.visible = false
        particle.active = false
        inactiveFireIndices.push(i)
      } else {
        // Scale effect - grow slightly then shrink
        let scaleMultiplier = 1.0
        if (lifeRatio < 0.3) {
          // Grow in the first 30% of lifetime
          scaleMultiplier = 1.0 + lifeRatio * 1.5
        } else {
          // Shrink for the rest
          scaleMultiplier = 1.45 - ((lifeRatio - 0.3) * 1.45) / 0.7
        }
        const currentScale = particle.maxScale * scaleMultiplier
        particle.scale.set(currentScale, currentScale, currentScale)

        // Fade out based on lifetime
        const alpha = lifeRatio < 0.7 ? 1.0 : 1.0 - (lifeRatio - 0.7) / 0.3
        if (particle.material) {
          particle.material.opacity = alpha * (app.config.opacity || 0.7)

          // Change color as fire cools - from yellow/orange to red to dark red
          if (lifeRatio > 0.5) {
            // Gradually reduce emissive intensity as particle dies
            particle.material.emissiveIntensity = (app.config.glowIntensity || 2) * (1 - (lifeRatio - 0.5) * 0.8)

            if (lifeRatio > 0.8) {
              // Shift toward darker red/orange at end of life
              particle.material.emissive = '#a32c00'
            }
          }
        }
      }
    }

    // Update active smoke particles if enabled
    if (app.config.enableSmoke) {
      for (let i = 0; i < smokeParticles.length; i++) {
        const smoke = smokeParticles[i]
        if (!smoke.active) continue

        // Apply gentle random movement to smoke
        smoke.velocity.x += (num(0, 1, 2) - 0.5) * CONFIG.TURBULENCE * 0.5 * delta
        smoke.velocity.z += (num(0, 1, 2) - 0.5) * CONFIG.TURBULENCE * 0.5 * delta

        // Update position
        smoke.position.x += smoke.velocity.x * delta
        smoke.position.y += smoke.velocity.y * delta
        smoke.position.z += smoke.velocity.z * delta

        // Apply slight upward acceleration for smoke rising
        smoke.velocity.y += 0.05 * delta

        // Make smoke face camera
        const dx = control.camera.position.x - smoke.position.x
        const dz = control.camera.position.z - smoke.position.z
        const rotY = Math.atan2(dx, dz)
        smoke.rotation.set(0, rotY, 0)

        // Update lifetime
        smoke.lifetime += delta
        const lifeRatio = smoke.lifetime / CONFIG.SMOKE_LIFETIME

        if (smoke.lifetime >= CONFIG.SMOKE_LIFETIME) {
          smoke.visible = false
          smoke.active = false
          inactiveSmokeIndices.push(i)
        } else {
          // Gradually increase scale for smoke expansion
          const smokeScale = smoke.maxScale * (1 + lifeRatio * 0.5)
          smoke.scale.set(smokeScale, smokeScale, smokeScale)

          // Fade in then out
          let smokeAlpha
          if (lifeRatio < 0.1) {
            // Fade in
            smokeAlpha = lifeRatio * 10 * (app.config.smokeOpacity || 0.3)
          } else if (lifeRatio > 0.7) {
            // Fade out
            smokeAlpha = (1 - (lifeRatio - 0.7) / 0.3) * (app.config.smokeOpacity || 0.3)
          } else {
            // Full opacity in middle of life
            smokeAlpha = app.config.smokeOpacity || 0.3
          }

          if (smoke.material) {
            smoke.material.opacity = smokeAlpha
          }
        }
      }
    }
  })
}
