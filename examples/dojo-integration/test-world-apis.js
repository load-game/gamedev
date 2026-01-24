// Test what world APIs are actually available

app.configure([
  {
    key: 'testWorld',
    type: 'button',
    label: 'Test World APIs',
    onClick: () => testWorldAPIs()
  }
])

console.log('🌍 World API Test')

const testWorldAPIs = () => {
  console.log('\n🔧 TESTING WORLD APIs:')
  console.log('=' .repeat(40))

  if (world) {
    // Test basic world methods that should work in normal Hyperfy worlds
    const apiMethods = [
      'isClient',
      'isServer',
      'add',
      'remove',
      'getPlayer',
      'raycast',
      'entities',
      'time',
      'delta'
    ]

    console.log('🎯 Testing World Methods:')
    apiMethods.forEach(method => {
      try {
        const exists = world[method] !== undefined
        const type = typeof world[method]
        console.log(`   ${method}: ${exists ? type : 'NOT FOUND'}`)
      } catch (e) {
        console.log(`   ${method}: ERROR - ${e.message}`)
      }
    })

    // Test core functionality
    console.log('\n🧪 Testing Core Functionality:')

    try {
      if (world.entities) {
        console.log('   world.entities: AVAILABLE')
        console.log('   entity count:', Object.keys(world.entities).length)
      } else {
        console.log('   world.entities: NOT FOUND')
      }
    } catch (e) {
      console.log('   world.entities: ERROR -', e.message)
    }

    // Try to access system-specific APIs
    console.log('\n🔧 System APIs:')
    const systemAPIs = ['web3', 'dojo', 'system']
    systemAPIs.forEach(api => {
      console.log(`   world.${api}:`, world[api] !== undefined ? 'EXISTS' : 'NOT FOUND')
    })

    // Test if we can create entities
    console.log('\n🎮 Entity Creation Test:')
    try {
      if (world.add) {
        console.log('   world.add method exists')

        // Try creating a simple test entity
        const testEntity = world.add('empty')
        if (testEntity) {
          console.log('   ✅ Can create entities')
          testEntity.position = [0, 1, 0]
          world.remove(testEntity)
          console.log('   ✅ Can remove entities')
        } else {
          console.log('   ❌ Entity creation returned null/false')
        }
      } else {
        console.log('   ❌ world.add not available')
      }
    } catch (e) {
      console.log('   ❌ Entity creation error:', e.message)
    }

    console.log('\n🎯 CONCLUSION:')
    if (world.add && world.entities) {
      console.log('   ✅ Full World APIs available - this is a normal Hyperfy world')
      console.log('   💡 Dojo should be accessible if properly initialized')
    } else {
      console.log('   ❌ Limited World APIs detected')
      console.log('   💡 This might be a viewer-only or sandbox-restricted world')
      console.log('   💡 Dojo APIs may not be exposed in this environment')
    }
  }
}

// Auto-run
setTimeout(testWorldAPIs, 1000)

console.log('✅ World API test loaded')