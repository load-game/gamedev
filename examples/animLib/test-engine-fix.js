// Test Engine Fix - Combined GLB with Player Animations
// Verify that the engine now respects the ?name= parameter

app.configure([
  { key: 'testAnimation', type: 'text', label: 'Test Animation', initial: 'VRM|PistolShoot@15', hint: 'Animation name to test' }
])

if (!world.isClient) return

console.log('=== Testing Engine Fix ===')
console.log('This test verifies that combined GLB files work with player.applyEffect()')
console.log('')

// Test 1: Direct player.applyEffect call
console.log('Test 1: Direct player.applyEffect() with name parameter')
console.log('Animation:', config.testAnimation)
console.log('')

const player = world.getPlayer()
const glbUrl = 'asset://03c758d3eef806abea5b8a1fdf15d6e5c8f527e3888ab840ab74a9a3b789e42f.glb'
const testUrl = `${glbUrl}?name=${encodeURIComponent(config.testAnimation)}`

console.log('URL:', testUrl)
console.log('')
console.log('Calling player.applyEffect()...')
console.log('Check if your player character plays the animation (not idle)!')
console.log('')

// Apply the effect
try {
  player.applyEffect({
    emote: testUrl,
    cancellable: true
  })
  console.log('✓ player.applyEffect() called successfully')
  console.log('✓ If working, you should see the animation play on your character')
} catch (e) {
  console.error('✗ Error calling player.applyEffect():', e)
}

console.log('')
console.log('Note: You may need to restart Hyperfy for the engine changes to take effect')
console.log('')

// Test 2: Using animation library
console.log('Test 2: Using animation library event system')
console.log('')

// Switch usage.js back to player mode for testing
console.log('To test with the animation library:')
console.log('1. Edit usage.js and change target to "player"')
console.log('2. Reload the app')
console.log('3. Press G to play random animations on your player')
console.log('')
console.log('Expected: Should play different animations, not just idle')
