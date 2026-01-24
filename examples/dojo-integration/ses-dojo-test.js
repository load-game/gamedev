// SES-safe Dojo test - works within Hyperfy sandbox

app.configure([
  {
    key: 'testDojo',
    type: 'button',
    label: 'Test Dojo SES',
    onClick: () => testDojoInSES()
  }
])

console.log('🔒 SES-Safe Dojo Test')

const testDojoInSES = () => {
  console.log('\n🔧 TESTING DOJO IN SES SANDBOX:')
  console.log('=' .repeat(40))

  // Test world object safely
  console.log('📋 World object (SES-safe):')
  console.log('   world exists:', !!world)
  console.log('   typeof world:', typeof world)

  // Test specific properties without hasOwnProperty
  try {
    if (world) {
      console.log('   world.dojo:', world.dojo !== undefined ? 'exists' : 'not found')
      console.log('   world.systems:', world.systems !== undefined ? 'exists' : 'not found')
      console.log('   world.isClient:', world.isClient)
      console.log('   world.isServer:', world.isServer)

      // Test all enumerable properties (SES-safe way)
      console.log('')
      console.log('🔍 Available world properties:')
      let foundDojo = false
      if (typeof world === 'object') {
        try {
          for (let key in world) {
            console.log(`   ${key}: ${typeof world[key]}`)
            if (key === 'dojo') foundDojo = true
          }
        } catch (e) {
          console.log('   Cannot enumerate world properties (SES restriction)')
        }
      }

      // Test direct dojo access
      console.log('')
      console.log('🎯 Direct Dojo Tests:')
      if (world.dojo) {
        console.log('✅ world.dojo FOUND!')
        foundDojo = true

        // Test dojo methods safely
        try {
          const isConnected = world.dojo.isConnected()
          console.log('   isConnected():', isConnected)

          if (isConnected) {
            console.log('   getNetwork():', world.dojo.getNetwork())
            console.log('   getWorldAddress():', world.dojo.getWorldAddress())
          }
        } catch (e) {
          console.log('   ❌ Error calling dojo methods:', e.message)
        }
      } else {
        console.log('❌ world.dojo not found')
      }

      // Test systems.dojo if systems exists
      if (world.systems) {
        console.log('')
        console.log('🔧 Systems access:')
        console.log('   world.systems exists:', !!world.systems)

        if (world.systems.dojo) {
          console.log('✅ world.systems.dojo FOUND!')
          try {
            const systemConnected = world.systems.dojo.isConnected()
            console.log('   system.isConnected():', systemConnected)
          } catch (e) {
            console.log('   ❌ Error accessing system:', e.message)
          }
        } else {
          console.log('❌ world.systems.dojo not found')
        }
      }

      console.log('')
      if (foundDojo) {
        console.log('🎉 DOJO INTEGRATION IS WORKING!')
      } else {
        console.log('⚠️ Dojo not found - this might be a world without Dojo enabled')
        console.log('💡 Try a different world or check world configuration')
      }
    }
  } catch (e) {
    console.log('❌ Error testing world:', e.message)
  }
}

// Try to access world.dojo immediately
setTimeout(() => {
  console.log('🔍 Quick check after 1 second...')
  if (world && world.dojo) {
    console.log('✅ world.dojo immediately available')
    console.log('   Connected:', world.dojo.isConnected())
  } else {
    console.log('❌ world.dojo not immediately available')
  }
}, 1000)

// Auto-run full test
setTimeout(testDojoInSES, 2000)

console.log('✅ SES-safe Dojo test loaded')