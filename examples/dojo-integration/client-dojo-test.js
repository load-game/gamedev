// Client-side only Dojo test - proper Hyperfy Hypscript format

app.configure([
  {
    key: 'clientDojoTest',
    type: 'button',
    label: 'Test Client Dojo',
    onClick: () => testClientDojo()
  }
])

console.log('🌐 CLIENT-SIDE DOJO TEST LOADING')

const testClientDojo = () => {
  console.log('')
  console.log('🔧 TESTING CLIENT DOJO API:')
  console.log('=' .repeat(40))

  // Verify we're on the client
  if (!world.isClient) {
    console.log('❌ NOT RUNNING ON CLIENT!')
    console.log('   world.isClient:', world.isClient)
    console.log('   world.isServer:', world.isServer)
    return
  }

  console.log('✅ RUNNING ON CLIENT SIDE')
  console.log('   Browser:', typeof window !== 'undefined')

  // Test for Dojo API
  console.log('\n🎯 Testing world.dojo:')
  if (world.dojo) {
    console.log('✅ world.dojo FOUND!')

    try {
      const connected = world.dojo.isConnected()
      console.log('   isConnected():', connected)

      if (connected) {
        console.log('   getNetwork():', world.dojo.getNetwork())
        console.log('   getWorldAddress():', world.dojo.getWorldAddress())

        // Test debug info
        const debug = world.dojo.getDebugInfo()
        console.log('   Debug info:', debug)
      }

      console.log('🎉 DOJO INTEGRATION WORKING ON CLIENT!')

      // Try a simple entity sync test
      testEntitySync()

    } catch (e) {
      console.log('❌ Error calling dojo methods:', e.message)
    }
  } else {
    console.log('❌ world.dojo not found on client')

    // Check what IS available
    console.log('\n🔍 Available client world properties:')
    let propCount = 0
    try {
      for (let key in world) {
        if (propCount < 10) { // Limit to first 10 properties
          console.log(`   ${key}: ${typeof world[key]}`)
          propCount++
        }
      }
      if (propCount === 0) {
        console.log('   Cannot enumerate world properties (SES restriction)')
      }
    } catch (e) {
      console.log('   Cannot enumerate world properties:', e.message)
    }

    // Test specific important properties
    console.log('\n🔧 Specific property tests:')
    console.log('   world.web3:', world.web3 !== undefined ? 'EXISTS' : 'NOT FOUND')
    console.log('   world.add:', typeof world.add)
    console.log('   world.entities:', world.entities !== undefined ? 'EXISTS' : 'NOT FOUND')
  }
}

const testEntitySync = () => {
  console.log('\n🎮 Testing Entity Sync:')

  try {
    // Create a simple test entity
    const testEntity = app.create('empty', {
      position: [0, 1, 0]
    })

    console.log('✅ Test entity created')

    // Try to sync it with Dojo
    if (world.dojo && typeof world.dojo.syncEntity === 'function') {
      console.log('🔄 Attempting entity sync...')

      world.dojo.syncEntity(testEntity).then(dojoId => {
        console.log('✅ Entity synced with Dojo:', dojoId)
      }).catch(err => {
        console.log('❌ Entity sync failed:', err.message)
      })
    } else {
      console.log('❌ world.dojo.syncEntity not available')
    }

  } catch (e) {
    console.log('❌ Entity sync test error:', e.message)
  }
}

// Auto-run test after 3 seconds
setTimeout(() => {
  console.log('\n🚀 AUTO-RUNNING CLIENT DOJO TEST...')
  testClientDojo()
}, 3000)

console.log('✅ Client Dojo test loaded - running auto-test in 3 seconds')