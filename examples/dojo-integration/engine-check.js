// Check what systems are actually loaded in the Hyperfy engine

app.configure([
  {
    key: 'checkEngine',
    type: 'button',
    label: 'Check Engine',
    onClick: () => checkEngine()
  }
])

console.log('🔧 Hyperfy Engine Check')

const checkEngine = () => {
  console.log('\n🔧 CHECKING HYPERFY ENGINE:')
  console.log('=' .repeat(50))

  console.log('📋 Basic Info:')
  console.log('   world.isClient:', world.isClient)
  console.log('   world.isServer:', world.isServer)
  console.log('   typeof world:', typeof world)

  console.log('\n🔍 DOJO SYSTEM CHECK:')
  if (world.dojo) {
    console.log('✅ world.dojo EXISTS')

    try {
      const connected = world.dojo.isConnected()
      console.log('   isConnected():', connected)
      console.log('   getNetwork():', world.dojo.getNetwork())
      console.log('   getWorldAddress():', world.dojo.getWorldAddress())

      const debugInfo = world.dojo.getDebugInfo()
      console.log('   Debug Info:', debugInfo)

    } catch (e) {
      console.log('❌ Error calling dojo methods:', e.message)
    }
  } else {
    console.log('❌ world.dojo NOT FOUND')
  }

  console.log('\n🔧 WORLD PROPERTIES:')
  try {
    // Try to get actual properties
    if (typeof Object.keys === 'function') {
      const keys = Object.keys(world)
      console.log('   World keys:', keys.slice(0, 15))

      const dojoKeys = keys.filter(key => key.toLowerCase().includes('dojo'))
      console.log('   Dojo-related keys:', dojoKeys)
    }
  } catch (e) {
    console.log('   Cannot enumerate world properties:', e.message)
  }

  console.log('\n🔧 SYSTEM REGISTRATION CHECK:')
  console.log('   world.web3:', world.web3 !== undefined ? 'EXISTS' : 'MISSING')
  console.log('   world.dojo:', world.dojo !== undefined ? 'EXISTS' : 'MISSING')

  // Check for other expected world APIs
  const expectedAPIs = ['add', 'remove', 'getPlayer', 'raycast', 'time', 'delta']
  expectedAPIs.forEach(api => {
    const type = typeof world[api]
    console.log(`   world.${api}:`, type)
  })

  console.log('\n🎮 APP AVAILABILITY:')
  console.log('   app available:', !!app)
  console.log('   app.configure:', typeof app.configure)
  console.log('   app.create:', typeof app.create)

  console.log('\n🔧 COMPLETE!')
}

// Auto-run after 1 second
setTimeout(checkEngine, 1000)

console.log('✅ Engine check loaded - auto-running in 1 second')