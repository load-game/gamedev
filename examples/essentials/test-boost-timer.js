// Simple test for boost timer
// Add this to verify timer is working

console.log('[Boost Timer Test] Starting timer test')

let testTimer = 2.0  // 2 seconds
let isActive = false

app.on('update', (dt) => {
  if (isActive) {
    testTimer -= dt
    console.log('[Boost Timer Test] Timer:', testTimer.toFixed(3), 'dt:', dt.toFixed(3))

    if (testTimer <= 0) {
      isActive = false
      testTimer = 0
      console.log('[Boost Timer Test] Timer finished!')
    }
  }
})

// Start test after 1 second
app.setTimeout(() => {
  isActive = true
  testTimer = 2.0
  console.log('[Boost Timer Test] Starting 2-second timer')
}, 1000)

console.log('[Boost Timer Test] Test configured - waiting to start')
