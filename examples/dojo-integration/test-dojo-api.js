// Test Dojo API availability with more debugging

app.configure([
  {
    key: 'testDojo',
    type: 'button',
    label: 'Test Dojo API',
    onClick: () => testDojoAPI()
  }
])

console.log('🔍 Dojo API Test')

const testDojoAPI = () => {
  console.log('\n🔧 TESTING DOJO API:')
  console.log('=' .repeat(40))

  console.log('📋 World object:')
  console.log('   world exists:', !!world)
  console.log('   world type:', typeof world)
  console.log('   world keys:', world ? Object.keys(world).slice(0, 10) : 'none')

  if (world) {
    console.log('\n📋 Checking dojo property:')
    console.log('   "dojo" in world:', 'dojo' in world)
    console.log('   world.hasOwnProperty("dojo"):', world.hasOwnProperty('dojo'))
    console.log('   world.dojo:', world.dojo)
    console.log('   typeof world.dojo:', typeof world.dojo)

    console.log('\n📋 Checking if systems exist:')
    if (world.systems) {
      console.log('   world.systems exists:', !!world.systems)
      console.log('   world.systems.dojo:', world.systems.dojo)
      console.log('   world.systems keys:', Object.keys(world.systems))
    } else {
      console.log('   ❌ world.systems not found')

      // Check if systems are under a different property
      const systemProps = Object.keys(world).filter(key => key.includes('system') || key.includes('dojo'))
      console.log('   Related properties:', systemProps)
    }

    // Try to access dojo directly from the systems
    try {
      if (world.systems && world.systems.dojo) {
        console.log('\n🎯 Direct system access:')
        const dojoSystem = world.systems.dojo
        console.log('   DojoSystem type:', typeof dojoSystem)
        console.log('   isConnected available:', typeof dojoSystem.isConnected)
        console.log('   isConnected():', dojoSystem.isConnected?.())
      }
    } catch (e) {
      console.log('❌ Error accessing DojoSystem:', e.message)
    }
  }

  // Wait a bit and test again
  setTimeout(() => {
    console.log('\n⏰ RETRY AFTER DELAY:')
    console.log('   world.dojo:', !!world.dojo)
    console.log('   typeof world.dojo:', typeof world.dojo)

    if (world.dojo) {
      console.log('✅ Dojo API found! Testing methods...')
      try {
        const connected = world.dojo.isConnected()
        console.log('   isConnected():', connected)
        console.log('   getNetwork():', world.dojo.getNetwork())
        console.log('   getWorldAddress():', world.dojo.getWorldAddress())
      } catch (e) {
        console.log('❌ Error calling Dojo methods:', e.message)
      }
    } else {
      console.log('❌ Still no world.dojo found')
    }
  }, 3000)
}

// Auto-run test
setTimeout(testDojoAPI, 2000)

console.log('✅ Dojo API test loaded. Click "Test Dojo API" button or wait for auto-run.')