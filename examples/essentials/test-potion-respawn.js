// Test script to verify stamina potion respawn works correctly
// Attach this to test multiple collection capability

console.log('[Potion Respawn Test] Test script loaded')

let collectionCount = 0
let testStartTime = Date.now()

// Listen for potion collection events
world.on('potion:collected', ({ playerId, duration, position }) => {
  collectionCount++
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1)
  console.log(`[Potion Respawn Test] COLLECTION #${collectionCount} at ${elapsed}s`)
  console.log(`  - Player: ${playerId}`)
  console.log(`  - Duration: ${duration}s`)
  console.log(`  - Position: [${position.map(n => n.toFixed(2)).join(', ')}]`)

  if (collectionCount === 1) {
    console.log('[Potion Respawn Test] ✅ First collection successful!')
    console.log('[Potion Respawn Test] Waiting for respawn...')
  } else if (collectionCount === 2) {
    console.log('[Potion Respawn Test] ✅ Second collection successful!')
    console.log('[Potion Respawn Test] TEST PASSED - Potion can be collected multiple times')
  } else if (collectionCount > 2) {
    console.log(`[Potion Respawn Test] ✅ Collection #${collectionCount} successful!`)
  }
})

// Check stamina boost events
world.on('stamina:boost:start', ({ playerId, duration, unlimited }) => {
  console.log('[Potion Respawn Test] Boost activated:', {
    playerId,
    duration,
    unlimited
  })
})

// Log potion show/hide events
world.on('potion:show', ({ potionId }) => {
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1)
  console.log(`[Potion Respawn Test] Potion visible at ${elapsed}s (ID: ${potionId})`)
})

world.on('potion:hide', ({ potionId }) => {
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1)
  console.log(`[Potion Respawn Test] Potion hidden at ${elapsed}s (ID: ${potionId})`)
})

// Status check every 10 seconds
setInterval(() => {
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1)
  console.log(`[Potion Respawn Test] Status: ${collectionCount} collections in ${elapsed}s`)
}, 10000)

console.log('[Potion Respawn Test] Ready - walk into a stamina potion to begin testing')
console.log('[Potion Respawn Test] Expected: Collect → Wait for respawn → Collect again')
