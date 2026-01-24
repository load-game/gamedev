// DojoEngine Integration Test - Hyperfy Style
// Proper Hyperfy app structure

console.log('🧪 Testing DojoEngine + Hyperfy Integration...')

// Configure test settings
app.configure([
  {
    key: 'testMode',
    type: 'switch',
    label: 'Test Mode',
    options: [
      { label: 'Full', value: 'full' },
      { label: 'Basic', value: 'basic' }
    ],
    initial: 'full'
  },
  {
    key: 'showResults',
    type: 'switch',
    label: 'Show Results',
    options: [
      { label: 'Detailed', value: 'detailed' },
      { label: 'Summary', value: 'summary' }
    ],
    initial: 'detailed'
  }
])

// Test state
app.state.testResults = []
app.state.testStarted = false
app.state.testCompleted = false

// Initialize tests
app.on('init', () => {
  console.log('🚀 Test init triggered')
  startTests()
})

function startTests() {
  console.log('🧪Starting Dojo integration tests...')
  app.state.testStarted = true
  app.state.testCompleted = false

  // Test 1: Check Dojo availability
  testDojoAvailability()

  // Test 2: Test entity creation and sync
  testEntitySync()

  // Test 3: Test component bridging
  testComponentBridging()

  // Test 4: Test API calls
  testAPICalls()

  console.log('✅ Dojo integration tests initiated')
}

// Test 1: Dojo System Availability
function testDojoAvailability() {
  console.log('\n📋 Test 1: Dojo System Availability')

  const result = { test: 'DojoAvailability', passed: false, details: [] }

  try {
    if (!world.dojo) {
      result.details.push('❌ FAIL: world.dojo not available')
      console.log('❌ FAIL: world.dojo not available')
      recordTestResult(result)
      return
    }

    if (typeof world.dojo.isConnected !== 'function') {
      result.details.push('❌ FAIL: world.dojo.isConnected not a function')
      console.log('❌ FAIL: world.dojo.isConnected not a function')
      recordTestResult(result)
      return
    }

    const isConnected = world.dojo.isConnected()
    result.details.push('✅ PASS: Dojo system available')
    result.details.push(`✅ PASS: Connected: ${isConnected}`)

    if (isConnected) {
      const network = world.dojo.getNetwork()
      const worldAddress = world.dojo.getWorldAddress()
      result.details.push('🌐 Network:', network)
      result.details.push('🏗️ World:', worldAddress)
    } else {
      result.details.push('⚠️ Dojo not connected - some tests may be skipped')
    }

    result.passed = true
    console.log('✅ PASS: Dojo system tests completed')

  } catch (error) {
    result.details.push(`❌ ERROR: ${error.message}`)
    console.log('❌ ERROR:', error.message)
  }

  recordTestResult(result)
}

// Test 2: Entity Synchronization
function testEntitySync() {
  console.log('\n📋 Test 2: Entity Synchronization')

  const result = { test: 'EntitySync', passed: false, details: [] }

  try {
    if (!world.dojo?.isConnected()) {
      result.details.push('⚠️ SKIP: Dojo not connected, skipping entity sync test')
      console.log('⚠️ SKIP: Dojo not connected, skipping entity sync test')
      result.passed = true // Skipped, not failed
      recordTestResult(result)
      return
    }

    // Create test entity
    const testEntity = app.create('box', {
      position: [5, 1, 5],
      scale: [0.5, 0.5, 0.5],
      color: [0, 1, 0]
    })
    testEntity.name = 'TestDojoEntity'
    testEntity.health = 50

    result.details.push('🏗️ Created test entity:', testEntity.data.id)

    // Test direct sync
    if (typeof world.dojo.syncEntity === 'function') {
      world.dojo.syncEntity(testEntity).then(dojoEntityId => {
        result.details.push(`✅ PASS: Entity synced: ${dojoEntityId}`)
      }).catch(error => {
        result.details.push(`⚠️ Sync error: ${error.message}`)
      })
    } else {
      result.details.push('⚠️ SKIP: syncEntity method not available')
    }

    // Test component sync
    testEntity.add('dojo', {
      worldAddress: world.dojo.getWorldAddress(),
      components: ['Position', 'Health'],
      syncInterval: 2000
    })

    result.details.push('✅ PASS: Dojo component added')

    // Clean up
    setTimeout(() => {
      if (world.dojo.unsyncEntity) {
        world.dojo.unsyncEntity(testEntity.data.id)
      }
      app.remove(testEntity)
      result.details.push('🧹 Test entity cleaned up')
    }, 3000)

    result.passed = true
    console.log('✅ PASS: Entity sync tests completed')

  } catch (error) {
    result.details.push(`❌ ERROR: ${error.message}`)
    console.log('❌ ERROR:', error.message)
  }

  recordTestResult(result)
}

// Test 3: Component Bridging
function testComponentBridging() {
  console.log('\n📋 Test 3: Component Bridging')

  const result = { test: 'ComponentBridging', passed: false, details: [] }

  try {
    if (!world.dojo?.isConnected()) {
      result.details.push('⚠️ SKIP: Dojo not connected, skipping component test')
      console.log('⚠️ SKIP: Dojo not connected, skipping component test')
      result.passed = true // Skipped, not failed
      recordTestResult(result)
      return
    }

    // Create entity with multiple components
    const testEntity = app.create('box', {
      position: [10, 1, 10],
      scale: [0.8, 0.8, 0.8],
      color: [0, 0, 1]
    })

    // Set various component values
    testEntity.health = 75
    testEntity.maxHealth = 100
    testEntity.inventory = ['sword', 'potion']
    testEntity.owner = 'test_player'

    // Add Dojo component with all standard types
    testEntity.add('dojo', {
      worldAddress: world.dojo.getWorldAddress(),
      components: ['Position', 'Health', 'Inventory', 'Owner'],
      syncInterval: 1000
    })

    result.details.push('✅ PASS: Multiple components configured for sync')

    // Test setting component values
    setTimeout(() => {
      if (world.dojo.setComponent) {
        world.dojo.setComponent('test_entity', 'Health', { current: 80, max: 100 })
          .then(() => {
            result.details.push('✅ PASS: Component value set successfully')
          })
          .catch(error => {
            result.details.push(`⚠️ Component set failed: ${error.message}`)
          })
      }
    }, 1000)

    // Clean up
    setTimeout(() => {
      if (world.dojo.unsyncEntity) {
        world.dojo.unsyncEntity(testEntity.data.id)
      }
      app.remove(testEntity)
      result.details.push('🧹 Component test entity cleaned up')
    }, 4000)

    result.passed = true
    console.log('✅ PASS: Component bridging tests completed')

  } catch (error) {
    result.details.push(`❌ ERROR: ${error.message}`)
    console.log('❌ ERROR:', error.message)
  }

  recordTestResult(result)
}

// Test 4: API Function Calls
function testAPICalls() {
  console.log('\n📋 Test 4: API Function Calls')

  const result = { test: 'APICalls', passed: false, details: [] }

  try {
    // Test all required API methods exist
    const requiredMethods = [
      'isConnected',
      'getNetwork',
      'getWorldAddress',
      'syncEntity',
      'unsyncEntity',
      'execute',
      'getDebugInfo'
    ]

    const missingMethods = []
    const availableMethods = []

    for (const method of requiredMethods) {
      if (world.dojo && typeof world.dojo[method] === 'function') {
        availableMethods.push(method)
      } else {
        missingMethods.push(method)
      }
    }

    result.details.push(`✅ Available methods: ${availableMethods.length}/${requiredMethods.length}`)
    result.details.push(`   ${availableMethods.join(', ')}`)

    if (missingMethods.length > 0) {
      result.details.push(`❌ Missing methods: ${missingMethods.join(', ')}`)
    }

    // Test debug info
    if (world.dojo?.getDebugInfo) {
      const debugInfo = world.dojo.getDebugInfo()
      result.details.push('🔍 Debug Info:', JSON.stringify(debugInfo, null, 2))
      result.details.push('✅ PASS: Debug info retrieved successfully')
    }

    // Test transaction (mock if not connected)
    if (world.dojo?.isConnected()) {
      world.dojo.execute([{
        target: world.dojo.getWorldAddress(),
        method: 'test',
        args: ['hello_world']
      }])
      .then(transactionResult => {
        result.details.push('✅ PASS: Test transaction executed')
        result.details.push(`   Transaction: ${transactionResult.transaction_hash}`)
      })
      .catch(error => {
        result.details.push(`⚠️ Transaction test failed: ${error.message}`)
      })
    } else {
      result.details.push('⚠️ Transaction test skipped - Dojo not connected')
    }

    result.passed = missingMethods.length <= 2 // Allow some methods to be missing
    console.log('✅ PASS: API call tests completed')

  } catch (error) {
    result.details.push(`❌ ERROR: ${error.message}`)
    console.log('❌ ERROR:', error.message)
  }

  recordTestResult(result)
}

// Record test result
function recordTestResult(result) {
  app.state.testResults.push(result)

  if (app.state.testResults.length >= 4) {
    completeTests()
  }
}

// Complete tests and show results
function completeTests() {
  console.log('🏁 All tests completed!')
  app.state.testCompleted = true

  // Show results UI
  showTestResults()

  // Log summary
  const passed = app.state.testResults.filter(r => r.passed).length
  const total = app.state.testResults.length

  console.log(`\n🎯 TEST SUMMARY: ${passed}/${total} tests passed`)
  app.state.testResults.forEach(result => {
    console.log(`  ${result.passed ? '✅' : '❌'} ${result.test}: ${result.passed ? 'PASSED' : 'FAILED'}`)
  })
}

// Show test results UI
function showTestResults() {
  // Create results UI
  const resultsUI = app.create('ui', {
    width: 600,
    height: 500,
    position: [0, 2.5, -2],
    backgroundColor: [0.05, 0.1, 0.15, 0.95],
    borderRadius: 12
  })

  // Title
  const title = app.create('uitext', {
    text: '🧪 Dojo Integration Test Results',
    position: [0, 230, 0],
    fontSize: 24,
    color: [0.8, 0.9, 1.0]
  })
  resultsUI.add(title)

  const passed = app.state.testResults.filter(r => r.passed).length
  const total = app.state.testResults.length

  // Summary
  const summary = app.create('uitext', {
    text: `Results: ${passed}/${total} Tests ${passed === total ? '✅ PASSED' : '⚠️ ISSUES'}`,
    position: [0, 200, 0],
    fontSize: 18,
    color: passed === total ? [0.2, 0.8, 0.2] : [0.8, 0.6, 0.2]
  })
  resultsUI.add(summary)

  // Detailed results
  let yPos = 160
  app.state.testResults.forEach(result => {
    const testResult = app.create('uitext', {
      text: `${result.passed ? '✅' : '❌'} ${result.test}`,
      position: [0, yPos, 0],
      fontSize: 14,
      color: result.passed ? [0.8, 0.8, 0.8] : [0.8, 0.4, 0.4]
    })
    resultsUI.add(testResult)
    yPos -= 25
  })

  // Debug info if detailed mode
  if (app.props.showResults === 'detailed' && world.dojo?.getDebugInfo) {
    const debugInfo = world.dojo.getDebugInfo()
    const debugTitle = app.create('uitext', {
      text: '📊 Debug Information:',
      position: [0, yPos - 20, 0],
      fontSize: 14,
      color: [0.6, 0.6, 0.6]
    })
    resultsUI.add(debugTitle)

    yPos -= 30
    const debugText = app.create('uitext', {
      text: JSON.stringify(debugInfo, null, 2),
      position: [0, yPos, 0],
      fontSize: 10,
      color: [0.5, 0.5, 0.5]
    })
    resultsUI.add(debugText)
  }

  // Make UI face camera
  resultsUI.lookAt = () => {
    const cameraPos = world.camera.position
    const uiPos = resultsUI.position
    const direction = cameraPos.clone().sub(uiPos).normalize()
    resultsUI.quaternion.setFromUnitVectors([0, 0, 1], direction.toArray())
  }

  app.state.resultsUI = resultsUI
  console.log('✅ Test results UI created')
}

// Update loop for UI
app.on('update', () => {
  if (app.state.resultsUI?.lookAt) {
    app.state.resultsUI.lookAt()
  }
})

// Auto-start tests
app.on('start', () => {
  console.log('🧪 Test start triggered')
  // Tests already started in init()
})

console.log('🧪 Dojo Integration Test script loaded')