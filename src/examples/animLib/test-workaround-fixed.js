// Test Locomotion Workaround - Fixed for Hyperfy SES
// No setTimeout/clearTimeout - uses update loop for timing

app.configure([
  { key: 'triggerKey', type: 'text', label: 'Play Key', initial: 'H', hint: 'Key to test workaround' },
  { key: 'autoTest', type: 'toggle', label: 'Auto Test', initial: false, hint: 'Automatically test all animations' }
])

if (!world.isClient) return

const control = app.control()
const player = world.getPlayer()

// Animation state
let activeAnim = null
let animEndTime = 0
let isPlaying = false

// Animation durations (in seconds) - calculated from @frame count @ 30fps
const animDurations = {
  vrmroll35: 1.2,              // 35 frames
  vrmpistolshoot15: 0.5,       // 15 frames
  vrmjumpstart32: 1.1,         // 32 frames
  vrmspellsimpleshoot12: 0.4   // 12 frames
}

// Animation order for cycling
const animOrder = [
  { id: 'vrmroll35', name: 'Roll', duration: animDurations.vrmroll35 },
  { id: 'vrmpistolshoot15', name: 'Pistol Shoot', duration: animDurations.vrmpistolshoot15 },
  { id: 'vrmjumpstart32', name: 'Jump Start', duration: animDurations.vrmjumpstart32 },
  { id: 'vrmspellsimpleshoot12', name: 'Spell Shoot', duration: animDurations.vrmspellsimpleshoot12 }
]

let currentIndex = 0

console.log('=== Locomotion Workaround Test (SES-Compatible) ===')
console.log('')
console.log('This test uses update() loop instead of setTimeout')
console.log('Press [', config.triggerKey.toUpperCase(), '] to test animations')
console.log('')

function playAnimation(animId, animName, duration) {
  console.log('')
  console.log('Playing:', animName)
  console.log('Duration:', duration.toFixed(2), 'seconds')
  console.log('')

  // Play animation with loop:true (workaround)
  app.emit('animlib:play', {
    anim: animId,
    target: 'player',
    playerId: 'local',
    options: {
      speed: 1,
      gaze: false,
      loop: true,        // KEY: Keep looping
      cancellable: true  // KEY: Allow interruption
    }
  })

  // Track animation (will stop in update loop)
  activeAnim = { id: animId, name: animName }
  animEndTime = world.time + duration
  isPlaying = true

  console.log('Animation started. Start moving to test locomotion resume.')
}

// Bind key
const keyProperty = `key${config.triggerKey.toUpperCase()}`
if (control[keyProperty]) {
  control[keyProperty].onPress = () => {
    const anim = animOrder[currentIndex % animOrder.length]
    playAnimation(anim.id, anim.name, anim.duration)
    currentIndex++
  }

  console.log('✓ Key bound: Press [', config.triggerKey.toUpperCase(), ']')
  console.log('')
} else {
  console.error('Key not available:', config.triggerKey)
}

// Auto-test all animations (if enabled)
if (config.autoTest) {
  console.log('Auto-test enabled!')
  console.log('Will cycle through all animations automatically...')
  console.log('')

  let autoTestStartTime = 0
  let autoTestIndex = 0

  world.on('animlib:ready', () => {
    autoTestStartTime = world.time + 1  // Start after 1 second
  })

  app.on('update', () => {
    if (autoTestStartTime > 0 && !isPlaying && world.time >= autoTestStartTime) {
      const anim = animOrder[autoTestIndex % animOrder.length]
      playAnimation(anim.id, anim.name, anim.duration)
      autoTestIndex++
      autoTestStartTime = world.time + 3  // Next animation in 3 seconds
    }
  })
}

// Update loop - handles animation timing
app.on('update', (delta) => {
  if (!isPlaying || !activeAnim) return

  // Check if animation should end
  if (world.time >= animEndTime) {
    // Stop animation manually (workaround)
    player.applyEffect(null)

    console.log('Animation cleared. Locomotion should resume.')
    console.log('✓ Try walking/running now')
    console.log('')

    // Reset state
    isPlaying = false
    activeAnim = null
    animEndTime = 0
  }
})

console.log('Test script ready!')
console.log('Start moving, then press key to trigger animation')
console.log('After animation, locomotion should resume automatically')
