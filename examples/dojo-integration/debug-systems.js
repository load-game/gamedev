// Debug script to check what systems are loaded

app.configure([
  {
    key: 'debugSystems',
    type: 'button',
    label: 'Debug Systems',
    onClick: () => debugSystems()
  }
])

console.log('🔍 System Debug Tool')

const debugSystems = () => {
  console.log('\n🔧 DEBUGGING HYPERFY SYSTEMS:')
  console.log('=' .repeat(40))

  console.log('📋 World object available:', !!world)
  console.log('📋 App object available:', !!app)

  if (world) {
    console.log('\n🌍 World Systems:')
    if (world.systems) {
      Object.keys(world.systems).forEach(key => {
        console.log(`   ✅ ${key}:`, typeof world.systems[key])
      })
    } else {
      console.log('   ❌ world.systems not available')
    }

    console.log('\n🌍 World Properties:')
    Object.keys(world).forEach(key => {
      if (key !== 'systems') {
        console.log(`   • ${key}:`, typeof world[key])
      }
    })
  }

  // Check specifically for dojo
  console.log('\n🎯 Dojo Check:')
  console.log('   world.dojo:', !!world.dojo)
  console.log('   world.systems.dojo:', !!(world.systems && world.systems.dojo))

  // Check if we're in development mode
  console.log('\n🛠️  Environment:')
  console.log('   world.isClient:', world?.isClient)
  console.log('   world.isServer:', world?.isServer)
  console.log('   NODE_ENV:', typeof process !== 'undefined' ? process.env?.NODE_ENV : 'not available')

  console.log('\n✅ Debug complete')
}

// Auto-run debug
setTimeout(debugSystems, 1000)

console.log('✅ Debug script loaded. Click "Debug Systems" button or wait for auto-run.')