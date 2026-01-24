// Quick test for potion respawn
// Just add this to world and check console logs

console.log('[Respawn Test] Starting quick test...')

// Keep track of collections
let collections = []
const testStart = Date.now()

world.on('potion:collected', (data) => {
  const time = ((Date.now() - testStart) / 1000).toFixed(1)
  collections.push({ time, ...data })
  console.log(`[Respawn Test] COLLECTION #${collections.length} at ${time}s`)
  console.log('  Data:', JSON.stringify(data, null, 2))

  if (collections.length >= 2) {
    console.log('[Respawn Test] ✅ SUCCESS - Multiple collections work!')
    const first = parseFloat(collections[0].time)
    const second = parseFloat(collections[1].time)
    console.log(`[Respawn Test] Time between collections: ${(second - first).toFixed(1)}s`)
  }
})

// Show all stamina-related events
world.on('*', (event, data) => {
  if (event.includes('stamina') || event.includes('potion')) {
    console.log(`[Respawn Test] Event: ${event}`, data)
  }
})

console.log('[Respawn Test] Ready! Collect a stamina potion twice to verify respawn works')
