// Debug script to trace potion state management
// This will help identify why isCollected is not resetting

console.log('[Potion Debug] State tracing script loaded')

// Track the potion app we created
let potionApp = null

// Try to find the stamina potion app
function findPotion() {
  // Look for apps with stamina-boost-potion.js src
  const apps = world.query(({ app }) => app.props.src?.includes('stamina-boost-potion'))
  if (apps.length > 0) {
    potionApp = apps[0]
    console.log('[Potion Debug] Found potion app:', potionApp.id)
    return true
  }
  return false
}

// Check potion state every 2 seconds
setInterval(() => {
  if (!potionApp && !findPotion()) {
    console.log('[Potion Debug] No potion found in world')
    return
  }

  // Log all props to see current state
  console.log('[Potion Debug] Potion state check:')
  console.log('  - App ID:', potionApp.id)
  console.log('  - Config:', {
    boostDuration: potionApp.props.boostDuration,
    respawnDelay: potionApp.props.respawnDelay,
    debugMode: potionApp.props.debugMode
  })

  // Try to access the script's internal state
  // Note: This won't work due to SES isolation, but worth trying
  console.log('[Potion Debug] Note: Internal state (isCollected, respawnTimer) cannot be accessed from outside the app')
}, 2000)

// Listen for all potion-related events
world.on('*', (event, data) => {
  if (event.includes('potion:') || event.includes('stamina:boost:')) {
    console.log(`[Potion Debug] Event: ${event}`, data)
  }
})

console.log('[Potion Debug] Monitoring potion events...')
console.log('[Potion Debug] Walk into a stamina potion to see the full event flow')
