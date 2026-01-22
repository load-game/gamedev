// Animation Library Usage Example
// Simple demonstration of playing animations

app.configure([
  { key: 'triggerKey', type: 'text', label: 'Play Key', initial: 'G', hint: 'Key to press for random animation' }
])

if (!world.isClient) return

const control = app.control()

// Wait for library to be ready
world.on('animlib:ready', (data) => {
  console.log('✓ Animation Library ready!')
  console.log('  Rig:', data.rig)
  console.log('  Animations:', data.count)
  console.log('')
  console.log('Press [' + config.triggerKey.toUpperCase() + '] to play random animation')
})

// Play random animation when key pressed
function playRandom() {
  console.log('Querying animations...')
  app.emit('animlib:query', {})
}

// Handle response and play random
world.on('animlib:available', (data) => {
  if (!data.animations || data.animations.length === 0) {
    console.log('No animations available')
    return
  }

  const anim = data.animations[Math.floor(Math.random() * data.animations.length)]
  console.log('Playing:', anim.name)

  // Play on player (works with combined GLB files after engine fix!)
  app.emit('animlib:play', {
    anim: anim.id,
    target: 'player',  // Now works! Engine respects ?name= parameter
    playerId: 'local',
    options: {
      speed: 1.2,
      gaze: false,
      loop: false,
      cancellable: true
    }
  })

  // Note: With loop: false, character returns to idle after animation.
  // To resume locomotion (walk/run/jump animations), use this workaround:
  //
  // // Track animation state
  // let activeAnim = null
  // let animEndTime = 0
  // let isPlaying = false
  //
  // function playOnce(animId, durationMs) {
  //   app.emit('animlib:play', {
  //     anim: animId,
  //     target: 'player',
  //     playerId: 'local',
  //     options: {
  //       loop: true,        // Keep looping
  //       cancellable: true  // Can be interrupted
  //     }
  //   })
  //
  //   activeAnim = animId
  //   animEndTime = world.time + (durationMs / 1000)
  //   isPlaying = true
  // }
  //
  // // In update() loop:
  // app.on('update', (delta) => {
  //   if (isPlaying && activeAnim && world.time >= animEndTime) {
  //     player.applyEffect(null)  // Clear animation
  //     isPlaying = false
  //     activeAnim = null
  //   }
  // })
  //
  // // Use:
  // playOnce('vrmpistolshoot15', 500)  // Play for 0.5 seconds
})

// Bind key (use uppercase for control API: keyG, keyH, etc)
const keyProperty = `key${config.triggerKey.toUpperCase()}`
if (control[keyProperty]) {
  control[keyProperty].onPress = playRandom
} else {
  console.warn('Key not available:', config.triggerKey)
  console.warn('Available keys:', Object.keys(control).filter(k => k.startsWith('key')).join(', '))
}
