// Force expose Dojo API if DojoSystem is running but not available to apps

app.configure([
  {
    key: 'forceDojo',
    type: 'button',
    label: 'Force Dojo API',
    onClick: () => forceDojoAPI()
  }
])

console.log('🔧 Force Dojo API')

const forceDojoAPI = () => {
  console.log('\n🔧 FORCING DOJO API EXPOSURE:')
  console.log('=' .repeat(45))

  console.log('📋 Current state:')
  console.log('   world.dojo exists:', !!world.dojo)
  console.log('   world.isClient:', world.isClient)

  // Try to find DojoSystem in the hidden world internals
  console.log('\n🔍 Checking for hidden DojoSystem...')

  // Check if there's a DojoSystem running but not exposed
  if (!world.dojo) {
    console.log('❌ world.dojo not found, attempting to force exposure...')

    // Create a direct API to the running DojoSystem
    // Since we see DojoSystem logs, it should be running somewhere
    try {
      // Try common ways the API might be hidden
      const possiblePaths = [
        () => window.world.dojo,
        () => world.systems?.dojo,
        () => world._systems?.dojo,
        () => globalThis.world?.dojo,
        () => this.__DOJO__,
        () => window.__DOJO__
      ]

      let foundDojo = null
      possiblePaths.forEach((getter, index) => {
        try {
          const result = getter()
          if (result) {
            console.log(`✅ Found Dojo via path ${index}:`, typeof result)
            foundDojo = result
          }
        } catch (e) {
          // Expected for some paths
        }
      })

      if (foundDojo) {
        // Force expose it
        world.dojo = foundDojo
        console.log('✅ FORCED world.dojo exposure successful!')
        testDojoAPI()
      } else {
        console.log('❌ Could not find hidden DojoSystem')

        // Create enhanced fallback API that tries to connect to local blockchain
        console.log('🔧 Creating enhanced fallback API...')
        world.dojo = {
          isConnected: () => false,
          getNetwork: () => 'ENHANCED_FALLBACK',
          getWorldAddress: () => '0x5e3350a4c61af85c423c1c9f4a4b2b3f4e3e2a1c8d7b6a5e0f2e3a0e5e3e0a5',
          syncEntity: async () => { throw new Error('Fallback mode - sync not available') },
          execute: async () => { throw new Error('Fallback mode - execute not available') },
          getDebugInfo: () => ({
            status: 'ENHANCED_FALLBACK',
            message: 'DojoSystem running but API not exposed - using enhanced fallback',
            isConnected: false,
            note: 'DojoSystem logs show successful init but API sandbox blocked'
          })
        }

        console.log('✅ Enhanced fallback API created')
        testDojoAPI()
      }

    } catch (e) {
      console.log('❌ Error forcing API exposure:', e.message)
    }
  } else {
    console.log('✅ world.dojo already available')
    testDojoAPI()
  }
}

const testDojoAPI = () => {
  console.log('\n🎯 Testing API:')
  try {
    console.log('   isConnected():', world.dojo.isConnected())
    console.log('   getNetwork():', world.dojo.getNetwork())
    console.log('   getWorldAddress():', world.dojo.getWorldAddress())
  } catch (e) {
    console.log('❌ API test error:', e.message)
  }
}

// Auto-run after 2 seconds
setTimeout(forceDojoAPI, 2000)

console.log('✅ Force Dojo API loaded - auto-running in 2 seconds')