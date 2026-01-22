// Animation Library System
// Event-driven animation management
// Attach this script to an app, configure the rig and GLB

app.configure([
  { key: 'rig', type: 'text', label: 'Rig Node ID', placeholder: 'VrmRig', initial: 'VrmRig', hint: 'ID of the SkinnedMesh node (for discovery)' },
  { key: 'emoteGLB', type: 'file', kind: 'emote', label: 'Emote Library GLB', hint: 'Same GLB file used on the rig - for player animation URLs' },
  { key: 'debug', type: 'toggle', label: 'Debug', initial: false }
])

if (!world.isClient) return

// Validate config
if (!config.rig) {
  console.error('Please configure Rig Node ID')
  return
}

if (!props.emoteGLB) {
  console.error('Please select the Emote Library GLB file')
  console.error('This should be the same GLB used on your rig node')
  return
}

// Get references
const rig = app.get(config.rig)
const glbUrl = props.emoteGLB.url

if (!rig) {
  console.error('Rig not found:', config.rig)
  console.error('Make sure you have a SkinnedMesh node with that ID')
  return
}

if (!rig.anims || rig.anims.length === 0) {
  console.error('No animations found on rig:', config.rig)
  console.error('Make sure it is a SkinnedMesh with animations')
  return
}

// Debug logging
function debugLog(...args) {
  if (config.debug) {
    console.log('[AnimLib]', ...args)
  }
}

debugLog('Rig:', config.rig)
debugLog('GLB URL:', glbUrl)
debugLog('Found', rig.anims.length, 'animations')

// Store animations
const animations = {}

rig.anims.forEach(animName => {
  const id = animName.toLowerCase().replace(/[^a-z0-9]/g, '')
  animations[id] = {
    id: id,
    name: animName
  }
  debugLog('  -', animName, '→', id)
})

// Get player by ID
function getPlayer(playerId) {
  if (playerId === 'local') return world.getPlayer()
  if (playerId === world.getPlayer().id) return world.getPlayer()
  // TODO: Support other players
  return world.getPlayer()
}

// Build animation URL
function buildAnimationUrl(animName, options = {}) {
  const baseUrl = glbUrl.split('?')[0]
  const params = []

  // Animation name - must be included for player animations
  params.push(`name=${encodeURIComponent(animName)}`)

  // Animation speed
  if (options.speed) params.push(`s=${options.speed}`)

  // Gaze tracking
  if (options.gaze) params.push('g=1')

  // Loop - explicitly set to 0 or 1 (don't rely on default)
  params.push(`l=${options.loop ? 1 : 0}`)

  const query = params.join('&')
  return `${baseUrl}?${query}`
}

// Set up event listeners
world.on('animlib:play', (data) => {
  if (!data || !data.anim) return

  const anim = animations[data.anim]
  if (!anim) {
    debugLog('Animation not found:', data.anim)
    return
  }

  // Determine target
  const target = data.target || 'player'
  const playerId = data.playerId || 'local'

  if (target === 'rig') {
    // Play on rig
    if (!rig.play) {
      debugLog('Error: Rig does not have play() method')
      return
    }
    rig.play({ name: anim.name })
    debugLog('Playing on rig:', anim.name)
  } else {
    // Play on player
    const player = getPlayer(playerId)
    if (!player) {
      debugLog('Player not found:', playerId)
      return
    }

    const url = buildAnimationUrl(anim.name, data.options || {})

    debugLog('URL built for player:', url)
    debugLog('  - Animation:', anim.name)
    debugLog('  - Options:', data.options || {})

    player.applyEffect({
      emote: url,
      cancellable: (data.options && data.options.cancellable) !== false
    })

    debugLog('Playing on player:', playerId, 'anim:', anim.name, 'URL:', url)
  }
})

world.on('animlib:query', (data) => {
  const animList = Object.values(animations)
  app.emit('animlib:available', {
    animations: animList,
    count: animList.length,
    rig: config.rig,
    glb: glbUrl
  })
})

world.on('animlib:stop', (data) => {
  const playerId = data ? data.playerId || 'local' : 'local'
  const player = getPlayer(playerId)
  if (player) {
    player.applyEffect(null)
    debugLog('Stopped animation on player:', playerId)
  }
})

// Mark as ready (emit on world so other apps can listen)
world.emit('animlib:ready', {
  count: Object.keys(animations).length,
  rig: config.rig,
  glb: glbUrl
})

debugLog('Animation Library ready with', Object.keys(animations).length, 'animations')
