// Test what world properties are available in app sandbox

console.log('[WorldDetect] Starting world property detection')

// Check if we even have world object
console.log('[WorldDetect] world exists:', typeof world !== 'undefined')

if (typeof world !== 'undefined') {
  console.log('[WorldDetect] world type:', typeof world)
  console.log('[WorldDetect] world constructor:', world?.constructor?.name)

  // Try to access known properties
  const testProps = [
    'isClient', 'isServer', 'client', 'server',
    'controls', 'entities', 'player', 'camera',
    'system', 'systems'
  ]

  testProps.forEach(prop => {
    const exists = world && prop in world
    const value = exists ? world[prop] : undefined
    console.log(`[WorldDetect] world.${prop}:`, exists ? 'EXISTS' : 'NOT_FOUND', typeof value)
  })

  // Log entire world object (might be restricted)
  try {
    console.log('[WorldDetect] world keys:', Object.keys(world))
  } catch (e) {
    console.log('[WorldDetect] Cannot enumerate world keys:', e.message)
  }

  // Test controls access
  try {
    if (world.controls) {
      console.log('[WorldDetect] world.controls exists, type:', typeof world.controls)
      console.log('[WorldDetect] setTouchBtn available:', typeof world.controls.setTouchBtn)
    }
  } catch (e) {
    console.log('[WorldDetect] Controls access error:', e.message)
  }

} else {
  console.log('[WorldDetect] No world object available')
}

// Alternative detection methods
console.log('[WorldDetect] typeof window:', typeof window)
console.log('[WorldDetect] typeof document:', typeof document)
console.log('[WorldDetect] typeof app:', typeof app)

// Simple UI to display results
try {
  const ui = app.create('ui', {
    position: [10, 10, 0],
    width: 400,
    height: 300,
    style: {
      position: 'absolute',
      top: '10px',
      left: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      fontSize: '12px',
      fontFamily: 'monospace',
      padding: '10px',
      overflow: 'auto'
    }
  })

  ui.text = `World Detection Results:
world exists: ${typeof world !== 'undefined'}
controls: ${world && world.controls ? 'YES' : 'NO'}
Check browser console for details`

} catch (e) {
  console.log('[WorldDetect] UI creation failed:', e.message)
}

console.log('[WorldDetect] Detection complete')