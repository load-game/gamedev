// Simple Stamina Potion - Toggles LOD visibility with heal.js style particles
// Particles active when potion is available, disabled when collected

if (!world.isClient) return

const lod = app.get('LOD')
const body = app.get('AreaTrigger')

if (!body || !lod) {
  console.error('[Stamina Potion] Missing required nodes: AreaTrigger or LOD')
  return
}

app.configure([
  {
    key: 'boostDuration',
    type: 'number',
    label: 'Boost Duration',
    hint: 'How long unlimited stamina lasts in seconds',
    initial: 10,
  },
  {
    key: 'respawnTime',
    type: 'number',
    label: 'Respawn Time',
    hint: 'Seconds before potion reappears',
    initial: 30,
  },
])

// Initialize particles after a short delay to ensure everything is loaded
setTimeout(() => {
  if (!particles && lod && lod.position) {
    particles = createPotionParticles()
    console.log('[Stamina Potion] Particles created and active')
  }
}, 100)

let isCollected = false
let respawnTimer = 0
let bobTime = 0
let particles = null

const bobAmplitude = 0.05 // Bob up/down by 5cm
const bobSpeed = 1.5 // Bob cycles per second
const initialY = body.position ? body.position.y : 0

// Create particles that will be active when potion is available
function createPotionParticles() {
  const p = app.create('particles', {
    shape: ['circle', 0.5, 0.5],
    direction: 1,
    speed: '0.5',
    size: '0.015', // Very small particles for subtle effect
    rate: 15, // Lower rate for subtle emission
    life: '2',
    emissive: '100', // Lower emissive for subtlety
    color: '#00ff00', // Green for stamina
    alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
    velocityOrbital: new Vector3(0.2, 0.5, 0.2), // Tight orbit around potion
    looping: true,
  })
  app.add(p)
  p.position.copy(lod.position)
  p.position.y += 0.5 // 50cm above potion (original position)
  return p
}

function collect(playerId) {
  if (isCollected) return

  isCollected = true
  lod.active = false // Hide LOD mesh (the visible potion)

  // Hide particles when potion is collected (if they exist)
  if (particles) {
    particles.active = false
  }

  // Give unlimited stamina
  world.emit(`stamina:set:${playerId}`, { value: 100 })
  world.emit('stamina:boost:start', {
    playerId,
    duration: config.boostDuration,
    unlimited: true,
  })

  respawnTimer = parseFloat(config.respawnTime) || 30
  console.log('[Stamina Potion] Collected, respawn in', respawnTimer, 'seconds')
}

// Handle collection when player enters trigger
body.onTriggerEnter = hit => {
  if (!hit?.playerId || isCollected) return
  collect(hit.playerId)
}

app.keepActive = true // Ensure update loop runs

app.on('update', dt => {
  // Handle respawn timer
  if (isCollected) {
    respawnTimer -= dt
    if (respawnTimer <= 0) {
      isCollected = false
      lod.active = true // Show LOD mesh again (potion reappears)
      respawnTimer = 0
      // Show particles when potion respawns (if they exist)
      if (particles) {
        particles.active = true
      }
      console.log('[Stamina Potion] Respawned and visible again')
    }
  }

  // Bobbing animation for AreaTrigger when potion is visible
  if (!isCollected && body.position) {
    bobTime += dt * bobSpeed
    const bobOffset = Math.sin(bobTime) * bobAmplitude
    body.position.y = initialY + bobOffset
  }
})

console.log('[Stamina Potion] With heal.js style particles loaded')
