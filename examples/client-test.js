console.log('[ClientTest] Testing world.isClient')

// Test if world.isClient actually exists
console.log('[ClientTest] world.isClient:', world.isClient)
console.log('[ClientTest] typeof world.isClient:', typeof world.isClient)
console.log('[ClientTest] world.isServer:', world.isServer)

// Test the actual boolean values
const isC = world.isClient
const isS = world.isServer

console.log('[ClientTest] isClient truthy:', !!isC)
console.log('[ClientTest] isServer truthy:', !!isS)

// Create UI to show results
try {
  const ui = app.create('ui', {
    position: [10, 10, 0],
    width: 300,
    height: 150,
    style: {
      position: 'absolute',
      top: '10px',
      left: '10px',
      background: 'rgba(0, 0, 128, 0.8)',
      color: 'white',
      fontSize: '14px',
      padding: '10px'
    }
  })

  ui.text = `isClient: ${isC}
isServer: ${isS}
Typeof isClient: ${typeof isC}
Typeof isServer: ${typeof isS}`

} catch (e) {
  console.log('[ClientTest] UI error:', e)
}

console.log('[ClientTest] Test complete')