({
  name: 'DoF Test and Debug',
  version: '1.0.0',

  configure: [
    { type: 'section', label: '🔬 DoF Test and Debug' },
    {
      type: 'toggle',
      key: 'enabled',
      label: 'Enable Debug Mode',
      initial: true
    },
    {
      type: 'toggle',
      key: 'createTestObjects',
      label: 'Create Test Objects',
      initial: true,
      description: 'Add visible objects for raycast testing'
    },
    {
      type: 'select',
      key: 'testMode',
      label: 'Test Mode',
      options: ['basic-raycast', 'head-bone', 'player-distance', 'camera-center'],
      initial: 'basic-raycast'
    },
    {
      type: 'toggle',
      key: 'showDiagnostics',
      label: 'Show Diagnostic Info',
      initial: true
    },
    {
      type: 'toggle',
      key: 'showFocusPoint',
      label: 'Show Focus Points',
      initial: true
    }
  ])

  console.log('[DoF-Debug] Starting comprehensive DoF testing and debugging')

  // Test state
  let testState = {
    enabled: app.props.enabled,
    createObjects: app.props.createTestObjects,
    testMode: app.props.testMode,
    showDiagnostics: app.props.showDiagnostics,
    showFocus: app.props.showFocusPoint,

    // Diagnostics
    doxCount: 0,
    testObjectsCreated: [],
    lastFocus: 0,
    testResults: [],

    // Debug globals
    debugInterval: null,
    diagnosticUI: null,
    focusVisualizer: null
  }

  /**
   * Test the scene for raycast capability
   */
  function testSceneRaycastability() {
    console.log('[DoF-Debug] Testing scene raycast capability...')

    const player = world.entities.player
    const headPos = player.position.clone().add(new THREE.Vector3(0, 1.6, 0))
    const forward = new THREE.Vector3(0, 0, -1)

    // Simple raycast test
    const raycaster = new THREE.Raycaster()
    raycaster.set(headPos, forward)

    // Test against world.viewport (basic test)
    const viewport = world.viewport
    if (!viewport) {
      console.error('[DoF-Debug] No viewport available')
      return false
    }

    // Simple test - check if we can get children
    const testIntersects = raycaster.intersectObjects(viewport.children || [], true)
    console.log(`[DoF-Debug] Basic viewport test results: ${testIntersects.length} intersections`)

    return testIntersects.length > 0
  }

  /**
   * Create test objects for DoF focusing
   */
  function createDoFTestObjects() {
    if (!app.props.createTestObjects) return

    console.log('[DoF-Debug] Creating test objects...')

    // Create at different distances for visual DoF testing
    const testPositions = [
      { pos: [0, 1, 5], color: [1, 0, 0], name: 'Close Object' },
      { pos: [0, 1, 15], color: [0, 1, 0], name: 'Medium Object' },
      { pos: [0, 1, 30], color: [0, 0, 1], name: 'Far Object' },
      { pos: [0, 1, 50], color: [1, 1, 0], name: 'Very Far Object' }
    ]

    testPositions.forEach((test, i) => {
      const obj = app.create('prim', {
        position: test.pos,
        type: 'sphere',
        radius: 0.5,
        material: {
          color: test.color,
          metalness: 0.8
        }
      })

      if (obj) {
        testState.testObjectsCreated.push(obj)
        console.log(`[DoF-Debug] Created test object ${i}: ${test.name} at ${test.pos}`)
      }
    })

    // Add some movement to make objects dynamic
    if (testState.testObjectsCreated.length > 0) {
      app.on('update', (delta) => {
        testState.testObjectsCreated.forEach((obj, i) => {
          if (obj && obj.position) {
            // Simple movement for dynamic testing
            if (i % 2 === 0) {
              obj.position[1] += Math.sin(performance.now() * 0.001 + i) * 0.01
            }
          }
        })
      })
    }
  }

  /**
   * Perform comprehensive DoF tests
   */
  function performDoFTests(mode) {
    console.log(`[DoF-Debug] Testing ${mode} mode`)

    const player = world.entities.player
    if (!player) {
      console.error('[DoF-Debug] No player entity available')
      return
    }

    // Test different raycast origins
    let rayOrigin, rayDirection
    let testMethod = ''
    let resultDistance = null

    switch (mode) {
      case 'basic-raycast':
        testMethod = 'Basic Viewport Raycast'
        rayOrigin = player.position.clone().add(new THREE.Vector3(0, 1.6, 0))
        rayDirection = new THREE.Vector3(0, 0, -1)

        const raycaster = new THREE.Raycaster()
        raycaster.set(rayOrigin, rayDirection)

        const intersectables = world.stage?.scene || world.viewport
        const intersects = raycaster.intersectObjects(intersectables?.children || [], true)
        resultDistance = intersects.length > 0 ? intersects[0].distance : null
        break

      case 'head-bone':
        testMethod = 'Head Bone Raycast'

        // Check if we're in first-person mode
        if (player.firstPerson === true) {
          console.log('[DoF-Debug] Skipping head bone raycast in first-person mode')
          resultDistance = null
          break
        }

        // Use existing head bone system if available (only in third-person)
        const avatar = world.avatar
        if (avatar) {
          const headMatrix = avatar.getBoneTransform('head')
          if (headMatrix) {
            rayOrigin.setFromMatrixPosition(headMatrix)
            rayDirection.copy(new THREE.Vector3(0, 0, -1).applyMatrix4(headMatrix))

            raycaster.set(rayOrigin, rayDirection)
            const intersectables = world.stage?.scene || world.viewport
            const intersects = raycaster.intersectObjects(intersectables?.children || [], true)
            resultDistance = intersects.length > 0 ? intersects[0].distance : null
          }
        }
        break

      case 'player-distance':
        testMethod = 'Player Distance Focus'
        const cameraPos = world.camera.position.clone()
        const playerPos = player.position.clone()
        playerPos.y += 1.6 // Eye height
        resultDistance = cameraPos.distanceTo(playerPos)
        break

      case 'camera-center':
        testMethod = 'Camera Center Raycast'
        rayOrigin = world.camera.position.clone()
        rayDirection = world.camera.getWorldDirection(new THREE.Vector3())

        const centerRayscaster = new THREE.Raycaster()
        centerRayscaster.set(rayOrigin, rayDirection)
        const intersectables = world.stage?.scene || world.viewport
        const centerIntersects = centerRayscaster.intersectObjects(intersectables?.children || [], true)
        resultDistance = centerIntersects.length > 0 ? centerIntersects[0].distance : null
        break
    }

    if (resultDistance !== null) {
      testState.lastFocus = resultDistance
      testState.doxCount++

      console.log(`[DoF-Debug] ${testMethod} - Distance: ${resultDistance.toFixed(2)}m`)
      console.log(`[DoF-Debug] Success: Found ${intersects ? intersects.length : 'N/A'} intersections`)
    } else {
      console.log(`[DoF-Debug] ${testMethod} - No intersections found`)
    }

    return resultDistance
  }

  /**
   * Create diagnostic display
   */
  function createDiagnosticDisplay() {
    if (!app.props.showDiagnostics) return

    const diagnostics = app.create('ui', {
      position: [0, 0, 0],
      width: 'auto',
      height: 'auto',
      style: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '12px',
        background: 'rgba(0, 20, 40, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 1000
      }
    })

    testState.diagnosticUI = diagnostics

    updateDiagnosticDisplay()
    setInterval(updateDiagnosticDisplay, 1000)
  }

  function updateDiagnosticDisplay() {
    if (!testState.diagnosticUI) return

    const player = world.entities.player
    if (!player) return

    const testResult = performDoFTests(testState.testMode)

    let diagnosticsInfo = `🔍 DoF Debug\n\n`
    diagnosticsInfo += `Mode: ${testState.testMode}\n`
    diagnosticsInfo += `Camera: ${player.firstPerson ? 'First Person' : 'Third Person'}\n`
    diagnosticsInfo += `Tests: ${testState.doxCount}\n`
    diagnosticsInfo += `Last focus: ${(testState.lastFocus || 0).toFixed(2)}m\n`

    if (testResult !== null) {
      diagnosticsInfo += `Current: ${testResult.toFixed(2)}m\n`
    }

    diagnosticsInfo += `\nPlayer position: ${player.position.toArray().map(n => n.toFixed(1)).join(', ')}\n`

    diagnosticsInfo += `\nSystem status:\n`
    diagnosticsInfo += `Head bone raycast: ${(world.avatar && world.avatar.getBoneTransform('head') && !player.firstPerson) ? '✅' : '❌'}\n`
    diagnosticsInfo += `Viewport availability: ${world.viewport ? '✅' : '❌'}\n`

    testState.diagnosticUI.text = diagnosticsInfo
  }

  /**
   * Main initialization
   */
  function initializeTestSystem() {
    console.log('[DoF-Debug] Initializing comprehensive DoF test system')

    if (!app.props.enabled) {
      console.log('[DoF-Debug] System disabled')
      return
    }

    // Test scene raycastability
    const sceneOk = testSceneRaycastability()
    console.log(`[DoF-Debug] Scene raycastable: ${sceneOk ? '✅' : '❌'}`)

    // Create test objects
    createDoFTestObjects()

    // Create diagnostics
    createDiagnosticDisplay()

    // Enhanced update loop for continuous testing
    let testCounter = 0
    app.on('update', (delta) => {
      testCounter++
      if (testCounter % 60 === 0) { // Test every second
        const result = performDoFTests(testState.testMode)
        testState.testResults.push({
          time: performance.now(),
          mode: testState.testMode,
          focus: result,
          success: result !== null
        })
      }
    })

    console.log('[DoF-Debug] Comprehensive DoF testing system initialized successfully')
  }

  // Initialize
  let initTimer = 0
  app.on('update', (delta) => {
    initTimer++
    if (initTimer === 30) {
      initializeTestSystem()
      initTimer = Infinity
    }
  })

  // Enhanced cleanup
  app.on('destroy', () => {
    console.log('[DoF-Debug] Cleanup started')

    // Stop testing
    if (testState.debugInterval) {
      clearInterval(testState.debugInterval)
    }

    // Remove test objects
    testState.testObjectsCreated.forEach(obj => {
      if (obj && obj.remove) {
        obj.remove()
      }
    })

    // Remove UI
    if (testState.diagnosticUI) {
      testState.diagnosticUI.remove()
    }

    console.log('[DoF-Debug] Cleanup completed')
  })

  console.log('[DoF-Debug] Comprehensive testing system loaded successfully')
})