// Rig vs Player Animation Demo
// Shows the difference between playing animations on rig vs player

app.configure([
  { key: 'mode', type: 'select', options: ['rig', 'player'], initial: 'player', label: 'Animation Target' },
  { key: 'animId', type: 'text', label: 'Animation ID', placeholder: 'vrmjump30', initial: 'vrmjump30' },
  { key: 'speed', type: 'range', min: 0.5, max: 2, step: 0.1, initial: 1, label: 'Speed' },
  { key: 'gaze', type: 'toggle', label: 'Gaze Tracking', initial: false },
  { key: 'loop', type: 'toggle', label: 'Loop', initial: false }
])

if (!world.isClient) return

const control = app.control()

function updateDisplay() {
  console.log('===============================')
  console.log('Mode:', config.mode.toUpperCase())
  console.log('Animation:', config.animId)
  console.log('Speed:', config.speed)
  console.log('Gaze:', config.gaze)
  console.log('Loop:', config.loop)
  console.log('===============================')
}

function playAnimation() {
  console.log('')
  console.log('Playing animation:', config.animId)
  console.log('Target:', config.mode)

  const data = {
    anim: config.animId,
    target: config.mode,
    options: {
      speed: config.speed,
      gaze: config.gaze,
      loop: config.loop
    }
  }

  if (config.mode === 'player') {
    data.playerId = 'local'
  }

  app.emit('animlib:play', data)
}

// UI Controls
if (control.keyO) control.keyO.onPress = playAnimation
if (control.keyQ) control.keyQ.onPress = () => {
  console.log('Querying available animations...')
  app.emit('animlib:query', {})
}
if (control.keyX) control.keyX.onPress = () => {
  console.log('Stopping animation')
  app.emit('animlib:stop', { playerId: 'local' })
}
if (control.keyM) control.keyM.onPress = () => {
  config.mode = config.mode === 'rig' ? 'player' : 'rig'
  updateDisplay()
}

// Display mode on start
world.on('animlib:ready', () => {
  console.log('')
  console.log('Animation Library Ready!')
  updateDisplay()
  console.log('')
  console.log('Controls:')
  console.log('  O - Play animation')
  console.log('  Q - Query animations')
  console.log('  X - Stop animation')
  console.log('  M - Switch mode (rig/player)')
  console.log('')
})

// Show available animations when queried
world.on('animlib:available', (data) => {
  console.log('Available animations:')
  data.animations.forEach(anim => {
    console.log(`  ${anim.id} - ${anim.name}`)
  })
  console.log('')
})
