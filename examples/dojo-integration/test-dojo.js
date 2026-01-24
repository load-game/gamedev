// DojoEngine Integration Test - Single Working Test
// Tests if Dojo is available and blockchain is connected

app.configure([
  {
    key: 'runTest',
    type: 'button',
    label: 'Test Dojo',
    onClick: () => testDojoIntegration()
  }
])

console.log('🧪 DojoEngine Integration Test')

const testDojoIntegration = async () => {
  console.log('\n🚀 Testing Dojo Integration...')

  // Test 1: Check if world.dojo exists
  console.log('📋 Checking Dojo system...')
  if (world.dojo) {
    console.log('✅ world.dojo found')

    try {
      const connected = world.dojo.isConnected()
      console.log(`ℹ️ Dojo connected: ${connected}`)

      if (connected) {
        const network = world.dojo.getNetwork?.() || 'unknown'
        const worldAddr = world.dojo.getWorldAddress?.() || 'unknown'
        console.log(`🌐 Network: ${network}`)
        console.log(`🏗️ World: ${worldAddr}`)
      }
    } catch (e) {
      console.log('⚠️ Could not get Dojo details:', e.message)
    }
  } else {
    console.log('❌ world.dojo not found')
  }

  // Test 2: Check blockchain connection
  console.log('\n📋 Checking blockchain connection...')
  try {
    const response = await fetch('http://localhost:5050', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'starknet_blockNumber',
        params: [],
        id: 1
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Katana connected - Block: ${data.result}`)
    } else {
      console.log('❌ Katana not responding')
    }
  } catch (e) {
    console.log('❌ Blockchain error:', e.message)
  }

  console.log('\n✅ Test complete')
}

// Auto-run test
setTimeout(testDojoIntegration, 1000)

console.log('✅ Test script loaded')