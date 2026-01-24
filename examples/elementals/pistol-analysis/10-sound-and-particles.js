// ===== SOUND AND PARTICLE EFFECTS =====
// Helper function to play sound effects
function playSound(soundType) {
  const soundUrl = props[soundType]?.url
  if (!soundUrl) return

  const audio = app.create('audio')
  audio.src = soundUrl
  audio.spatial = true
  audio.volume = 0.8
  audio.group = 'sfx'

  // Configure spatial audio properties for better 3D sound
  audio.distanceModel = 'exponential'
  audio.refDistance = 1
  audio.maxDistance = 50
  audio.rolloffFactor = 2

  // Position at muzzle if available, otherwise at pistol position
  if (muzzleBone && muzzleBone.matrixWorld && world.isClient) {
    const muzzlePos = new Vector3()
    muzzlePos.setFromMatrixPosition(muzzleBone.matrixWorld)
    audio.position.copy(muzzlePos)
    debugLog(`Playing spatial sound at muzzle position:`, muzzlePos.toArray())
  } else if (pistolSkin) {
    audio.position.copy(pistolSkin.position)
    debugLog(`Playing spatial sound at pistol position:`, pistolSkin.position.toArray())
  }

  world.add(audio)
  audio.play()
  debugLog(`Spatial gunshot sound played - other players should hear this!`)

  // Auto-cleanup after sound finishes
  setTimeout(() => {
    world.remove(audio)
  }, 2000)
}

// Helper function to create muzzle flash burst
function createMuzzleFlash() {
  if (!props.enableParticles || !muzzleBone || !muzzleBone.matrixWorld) return

  // Create particle-based muzzle flash
  const muzzleFlash = app.create('particles', {
    shape: ['sphere', 0.1, 1],
    direction: 1,
    rate: 0,
    max: 30,
    bursts: [{ time: 0, count: 30 }],
    color: props.muzzleFlashColor || '#ffaa00',
    size: '0.05~0.15',
    alphaOverLife: '1,1|1,0',
    emissive: '10',
    speed: '2~5',
    life: '0.1~0.3',
  })

  // Position at muzzle bone
  const muzzlePos = new Vector3()
  muzzlePos.setFromMatrixPosition(muzzleBone.matrixWorld)
  muzzleFlash.position.copy(muzzlePos)

  world.add(muzzleFlash)

  // Remove after particles fade
  setTimeout(() => {
    world.remove(muzzleFlash)
  }, 500)
}

// Helper function to create shell casing ejection
function createShellEjection() {
  if (!props.enableParticles || !ejectBone || !ejectBone.matrixWorld) return

  const shellCasing = app.create('particles', {
    shape: ['sphere', 0.02, 0.5], // Smaller, more detailed particles
    direction: 1,
    rate: 0,
    max: 8,
    bursts: [
      { time: 0, count: 8 }, // Fewer, more realistic count
    ],
    color: props.shellCasingColor || '#c0c0c0', // Metallic silver
    size: '0.008~0.015', // Much smaller particles
    alphaOverLife: '1,1|0.8,0',
    emissive: '0.5', // Subtle glow
    speed: '1~3', // Slower, more realistic
    life: '0.5~1.2', // Longer life for visibility
    gravity: '0.5', // Add gravity for realistic fall
  })

  // Position at ejection bone
  const ejectPos = new Vector3()
  ejectPos.setFromMatrixPosition(ejectBone.matrixWorld)
  shellCasing.position.copy(ejectPos)

  world.add(shellCasing)

  // Remove after particles fade
  setTimeout(() => {
    world.remove(shellCasing)
  }, 1500)
}

// Helper function to create bullet trail particle
function createBulletTrail(startPos, direction) {
  if (!props.enableParticles) return null

  const trail = app.create('particles', {
    shape: ['sphere', 0.01, 1],
    direction: 1,
    rate: 0,
    color: props.bulletTrailColor || '#ffff00',
    rateOverDistance: 50,
    life: '0.05~0.15',
    size: '0.005~0.015',
    alphaOverLife: '1,1|1,0',
    emissive: '8',
  })

  trail.position.copy(startPos)
  world.add(trail)

  return trail
}

// Helper function to create impact spark effect
function createImpactSparks(position) {
  if (!props.enableParticles) return

  const sparks = app.create('particles', {
    shape: ['sphere', 0.1, 1],
    direction: 1,
    rate: 0,
    max: 15,
    bursts: [{ time: 0, count: 15 }],
    color: props.impactSparkColor || '#ff8800',
    size: '0.02~0.08',
    alphaOverLife: '1,1|1,0',
    emissive: '10',
    speed: '1~4',
    life: '0.1~0.3',
    force: new Vector3(0, -5, 0),
  })

  sparks.position.copy(position)
  world.add(sparks)

  // Play impact sound
  playSound('impactSound')

  // Remove after particles fade
  setTimeout(() => {
    world.remove(sparks)
  }, 400)
}
