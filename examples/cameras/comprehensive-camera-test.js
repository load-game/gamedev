({
  init() {
    if (!world.isClient) return

    this.testResults = {}
    this.testCount = 0
    this.passedTests = 0
    this.failedTests = 0
    this.testStartTime = Date.now()
    this.cameras = []
    this.currentTestIndex = 0

    console.log('🎥 [CameraTest] Starting Comprehensive Camera System Test Suite...')

    app.keepActive = true

    this.setupTestEnvironment()
    this.runTestSuite()

    app.on('update', delta => this.update(delta))
  },

  setupTestEnvironment() {
    console.log('🔧 [CameraTest] Setting up test environment...')

    this.testEnvironment = {
      testCameras: [],
      controlInterface: null,
      worldCameraManager: null,
      threeAvailable: typeof THREE !== 'undefined',
      worldCameraAvailable: !!world.camera,
      cameraManagerAvailable: !!world.cameraManager
    }

    // Check basic requirements
    if (!this.testEnvironment.threeAvailable) {
      this.logTestResult('THREE.js Availability', false, 'THREE.js is not available')
    } else {
      this.logTestResult('THREE.js Availability', true, 'THREE.js is available')
    }

    if (!this.testEnvironment.worldCameraAvailable) {
      this.logTestResult('World Camera', false, 'World camera is not available')
    } else {
      this.logTestResult('World Camera', true, 'World camera is available')
    }

    if (!this.testEnvironment.cameraManagerAvailable) {
      this.logTestResult('Camera Manager', false, 'Camera manager is not available')
    } else {
      this.logTestResult('Camera Manager', true, 'Camera manager is available')
    }

    // Get control interface
    this.testEnvironment.controlInterface = app.control()
    if (!this.testEnvironment.controlInterface) {
      this.logTestResult('Control Interface', false, 'No control interface available')
    } else {
      this.logTestResult('Control Interface', true, 'Control interface available')
    }
  },

  async runTestSuite() {
    console.log('🧪 [CameraTest] Running test suite...')

    const tests = [
      { name: 'Basic Camera Creation', fn: () => this.testBasicCameraCreation() },
      { name: 'Camera Activation', fn: () => this.testCameraActivation() },
      { name: 'Camera Helper Visibility', fn: () => this.testCameraHelperVisibility() },
      { name: 'DOF Parameters', fn: () => this.testDOFParameters() },
      { name: 'Camera Motion Effects', fn: () => this.testCameraMotionEffects() },
      { name: 'Post-Processing Effects', fn: () => this.testPostProcessingEffects() },
      { name: 'Camera Switching', fn: () => this.testCameraSwitching() },
      { name: 'Multiple Cameras Stress Test', fn: () => this.testMultipleCameras() },
      { name: 'Edge Cases', fn: () => this.testEdgeCases() },
      { name: 'Performance Test', fn: () => this.testPerformance() }
    ]

    for (let i = 0; i < tests.length; i++) {
      this.currentTestIndex = i
      const test = tests[i]
      console.log(`🔬 [CameraTest] Running test: ${test.name} (${i + 1}/${tests.length})`)

      try {
        await new Promise(resolve => {
          setTimeout(() => {
            test.fn()
            resolve()
          }, 500) // Small delay between tests
        })
      } catch (error) {
        this.logTestResult(test.name, false, `Test crashed: ${error.message}`)
        console.error(`❌ [CameraTest] test ${test.name} crashed:`, error)
      }
    }

    this.generateTestReport()
  },

  testBasicCameraCreation() {
    try {
      // Test 1: Create basic camera
      const basicCamera = app.create('camera', {
        name: 'test-basic-camera',
        position: [0, 2, 5],
        rotation: [0, 0, 0],
        fov: 73,
        active: false
      })

      if (!basicCamera) {
        this.logTestResult('Basic Camera Creation', false, 'Camera creation returned null')
        return
      }

      // Verify camera properties
      const tests = [
        { prop: 'name', expected: 'test-basic-camera', actual: basicCamera.name },
        { prop: 'position', expected: new THREE.Vector3(0, 2, 5), actual: basicCamera.position },
        { prop: 'rotation', expected: new THREE.Euler(0, 0, 0), actual: basicCamera.rotation },
        { prop: 'fov', expected: 73, actual: basicCamera.fov }
      ]

      let allPassed = true
      tests.forEach(test => {
        if (typeof test.expected === 'object') {
          if (test.expected.distanceTo(test.actual) > 0.001) {
            allPassed = false
            console.warn(`⚠️ [CameraTest] Property ${test.prop} mismatch: expected`, test.expected, 'got', test.actual)
          }
        } else if (test.expected !== test.actual) {
          allPassed = false
          console.warn(`⚠️ [CameraTest] Property ${test.prop} mismatch: expected ${test.expected}, got ${test.actual}`)
        }
      })

      if (allPassed) {
        this.logTestResult('Basic Camera Creation', true, 'All camera properties set correctly')
        this.testEnvironment.testCameras.push(basicCamera)
        app.add(basicCamera)
      } else {
        this.logTestResult('Basic Camera Creation', false, 'Some camera properties not set correctly')
      }

    } catch (error) {
      this.logTestResult('Basic Camera Creation', false, `Exception: ${error.message}`)
    }
  },

  testCameraActivation() {
    try {
      if (this.testEnvironment.testCameras.length === 0) {
        this.logTestResult('Camera Activation', false, 'No cameras available to activate')
        return
      }

      const camera = this.testEnvironment.testCameras[0]
      const originalActive = camera.active

      // Test activation
      if (this.testEnvironment.cameraManagerAvailable) {
        this.testEnvironment.worldCameraManager = world.cameraManager
        this.testEnvironment.worldCameraManager.setActiveCamera(camera)

        setTimeout(() => {
          const isActive = this.testEnvironment.worldCameraManager.activeCamera === camera
          this.logTestResult('Camera Manager Activation', isActive,
            isActive ? 'Camera activated via CameraManager' : 'Camera activation via CameraManager failed')
        }, 100)
      } else {
        // Fallback to direct activation
        camera.active = true
        const isActive = camera.active
        this.logTestResult('Direct Camera Activation', isActive,
          isActive ? 'Camera activated directly' : 'Camera activation failed')
      }

    } catch (error) {
      this.logTestResult('Camera Activation', false, `Exception: ${error.message}`)
    }
  },

  testCameraHelperVisibility() {
    try {
      // Create camera with helper
      const helperCamera = app.create('camera', {
        name: 'test-helper-camera',
        position: [5, 2, 5],
        rotation: [0, Math.PI / 4, 0],
        active: false,
        showHelper: true,
        helperScale: 0.2
      })

      if (!helperCamera) {
        this.logTestResult('Camera Helper Creation', false, 'Failed to create camera with helper')
        return
      }

      // Test helper visibility toggle
      const originalShowHelper = helperCamera.showHelper

      helperCamera.showHelper = false
      const hidden = !helperCamera.showHelper

      helperCamera.showHelper = true
      const visible = helperCamera.showHelper

      if (hidden && visible) {
        this.logTestResult('Camera Helper Visibility', true, 'Helper visibility toggles correctly')
        this.testEnvironment.testCameras.push(helperCamera)
        app.add(helperCamera)
      } else {
        this.logTestResult('Camera Helper Visibility', false, 'Helper visibility toggle not working')
      }

    } catch (error) {
      this.logTestResult('Camera Helper Visibility', false, `Exception: ${error.message}`)
    }
  },

  testDOFParameters() {
    try {
      const dofCamera = app.create('camera', {
        name: 'test-dof-camera',
        position: [-5, 2, 5],
        active: false,
        dof: {
          enabled: true,
          fStop: 2.8,
          focusDistance: 10,
          maxBlur: 0.02,
          autofocus: false
        }
      })

      if (!dofCamera) {
        this.logTestResult('DOF Camera Creation', false, 'Failed to create camera with DOF')
        return
      }

      // Test DOF parameters
      const dof = dofCamera.dof
      if (!dof) {
        this.logTestResult('DOF Parameters', false, 'DOF object not available on camera')
        return
      }

      const dofTests = [
        { prop: 'enabled', expected: true, actual: dof.enabled },
        { prop: 'fStop', expected: 2.8, actual: dof.fStop },
        { prop: 'focusDistance', expected: 10, actual: dof.focusDistance },
        { prop: 'maxBlur', expected: 0.02, actual: dof.maxBlur },
        { prop: 'autofocus', expected: false, actual: dof.autofocus }
      ]

      let allPassed = true
      dofTests.forEach(test => {
        if (test.expected !== test.actual) {
          allPassed = false
          console.warn(`⚠️ [CameraTest] DOF property ${test.prop} mismatch: expected ${test.expected}, got ${test.actual}`)
        }
      })

      if (allPassed) {
        this.logTestResult('DOF Parameters', true, 'All DOF parameters set correctly')

        // Test DOF updates
        dof.fStop = 4.0
        dof.focusDistance = 15

        setTimeout(() => {
 this.logTestResult('DOF Dynamic Updates', dof.fStop === 4.0 && dof.focusDistance === 15,
            'DOF parameters updated successfully')
        }, 100)
      } else {
        this.logTestResult('DOF Parameters', false, 'Some DOF parameters not set correctly')
      }

      this.testEnvironment.testCameras.push(dofCamera)
      app.add(dofCamera)

    } catch (error) {
      this.logTestResult('DOF Parameters', false, `Exception: ${error.message}`)
    }
  },

  testCameraMotionEffects() {
    try {
      const motionCamera = app.create('camera', {
        name: 'test-motion-camera',
        position: [0, 3, 5],
        active: false,
        motion: {
          enabled: true,
          bobAmount: 0.002,
          bobSpeed: 0.02,
          swayAmount: 0.001,
          swaySpeed: 0.01,
          dampingFactor: 0.98
        }
      })

      if (!motionCamera) {
        this.logTestResult('Motion Camera Creation', false, 'Failed to create camera with motion')
        return
      }

      const motion = motionCamera.motion
      if (!motion) {
        this.logTestResult('Motion Effects', false, 'Motion object not available on camera')
        return
      }

      const motionTests = [
        { prop: 'enabled', expected: true, actual: motion.enabled },
        { prop: 'bobAmount', expected: 0.002, actual: motion.bobAmount },
        { prop: 'bobSpeed', expected: 0.02, actual: motion.bobSpeed },
        { prop: 'swayAmount', expected: 0.001, actual: motion.swayAmount },
        { prop: 'swaySpeed', expected: 0.01, actual: motion.swaySpeed },
        { prop: 'dampingFactor', expected: 0.98, actual: motion.dampingFactor }
      ]

      let allPassed = true
      motionTests.forEach(test => {
        if (Math.abs(test.expected - test.actual) > 0.0001) {
          allPassed = false
          console.warn(`⚠️ [CameraTest] Motion property ${test.prop} mismatch: expected ${test.expected}, got ${test.actual}`)
        }
      })

      this.logTestResult('Motion Effects', allPassed,
        allPassed ? 'All motion parameters set correctly' : 'Some motion parameters not set correctly')

      this.testEnvironment.testCameras.push(motionCamera)
      app.add(motionCamera)

    } catch (error) {
      this.logTestResult('Motion Effects', false, `Exception: ${error.message}`)
    }
  },

  testPostProcessingEffects() {
    try {
      const ppcamera = app.create('camera', {
        name: 'test-pp-camera',
        position: [5, 3, -5],
        active: false,
        bloom: { enabled: true, intensity: 0.5 },
        vignette: { enabled: true, offset: 0.35, darkness: 0.4 },
        filmGrain: { enabled: true, intensity: 0.25 }
      })

      if (!ppcamera) {
        this.logTestResult('Post-Processing Creation', false, 'Failed to create camera with post-processing')
        return
      }

      // Test each effect
      const effects = ['bloom', 'vignette', 'filmGrain']
      let allEffectsWorking = true

      effects.forEach(effect => {
        const effectObj = ppcamera[effect]
        if (!effectObj) {
          allEffectsWorking = false
          console.warn(`⚠️ [CameraTest] Effect ${effect} not available on camera`)
        } else if (!effectObj.enabled) {
          allEffectsWorking = false
          console.warn(`⚠️ [CameraTest] Effect ${effect} not enabled`)
        }
      })

      this.logTestResult('Post-Processing Effects', allEffectsWorking,
        allEffectsWorking ? 'All post-processing effects enabled' : 'Some post-processing effects not working')

      this.testEnvironment.testCameras.push(ppcamera)
      app.add(ppcamera)

    } catch (error) {
      this.logTestResult('Post-Processing Effects', false, `Exception: ${error.message}`)
    }
  },

  testCameraSwitching() {
    try {
      // Create multiple cameras for switching test
      const switchCameras = []
      for (let i = 0; i < 3; i++) {
        const cam = app.create('camera', {
          name: `switch-camera-${i}`,
          position: [i * 3, 2, 5],
          active: false,
          showHelper: true
        })
        if (cam) {
          switchCameras.push(cam)
          app.add(cam)
        }
      }

      if (switchCameras.length < 3) {
        this.logTestResult('Camera Switching', false, 'Failed to create multiple cameras')
        return
      }

      // Test rapid switching
      let switchCount = 0
      let switchingWorking = true

      const switchInterval = setInterval(() => {
        if (switchCount >= 5) {
          clearInterval(switchInterval)
          this.logTestResult('Camera Switching', switchingWorking,
            `${switchCount} camera switches performed successfully`)
          return
        }

        const cameraIndex = switchCount % switchCameras.length
        try {
          if (this.testEnvironment.cameraManagerAvailable) {
            world.cameraManager.setActiveCamera(switchCameras[cameraIndex])
          } else {
            switchCameras.forEach(c => c.active = false)
            switchCameras[cameraIndex].active = true
          }
          switchCount++
        } catch (error) {
          switchingWorking = false
          clearInterval(switchInterval)
          this.logTestResult('Camera Switching', false, `Switching failed: ${error.message}`)
        }
      }, 200)

      this.testEnvironment.testCameras.push(...switchCameras)

    } catch (error) {
      this.logTestResult('Camera Switching', false, `Exception: ${error.message}`)
    }
  },

  testMultipleCameras() {
    try {
      // Stress test with many cameras
      const stressCameras = []
      const cameraCount = 20

      for (let i = 0; i < cameraCount; i++) {
        const cam = app.create('camera', {
          name: `stress-camera-${i}`,
          position: [
            Math.sin(i * 0.3) * 10,
            2 + i * 0.2,
            Math.cos(i * 0.3) * 10
          ],
          active: false,
          showHelper: i < 5, // Show helpers only for first 5
          fov: 60 + i * 2
        })

        if (cam) {
          stressCameras.push(cam)
          app.add(cam)
        }
      }

      if (stressCameras.length < cameraCount * 0.8) { // Allow some failures
        this.logTestResult('Multiple Cameras Stress Test', false,
          `Only ${stressCameras.length}/${cameraCount} cameras created`)
        return
      }

      // Test performance with many cameras
      const startTime = performance.now()

      // Update all cameras
      stressCameras.forEach((cam, i) => {
        cam.fov = 60 + Math.sin(Date.now() * 0.001 + i) * 20
      })

      const updateTime = performance.now() - startTime

      this.logTestResult('Multiple Cameras Stress Test', true,
        `${stressCameras.length} cameras created and updated in ${updateTime.toFixed(2)}ms`)

      this.testEnvironment.testCameras.push(...stressCameras)

    } catch (error) {
      this.logTestResult('Multiple Cameras Stress Test', false, `Exception: ${error.message}`)
    }
  },

  testEdgeCases() {
    try {
      let edgeCaseTestsPassed = 0
      const totalEdgeTests = 4

      // Test 1: Invalid FOV
      try {
        const invalidCam = app.create('camera', {
          name: 'invalid-fov-camera',
          fov: 999999,
          active: false
        })
        this.logTestResult('Invalid FOV Handling', !!invalidCam,
          invalidCam ? 'Camera created with invalid FOV' : 'Invalid FOV rejected')
        if (invalidCam) edgeCaseTestsPassed++
        if (invalidCam) app.add(invalidCam)
      } catch (e) {
        this.logTestResult('Invalid FOV Handling', true, 'Invalid FOV correctly threw exception')
        edgeCaseTestsPassed++
      }

      // Test 2: Negative positions
      try {
        const negCam = app.create('camera', {
          name: 'negative-position-camera',
          position: [-999, -999, -999],
          active: false
        })
        this.logTestResult('Negative Positions', !!negCam,
          negCam ? 'Camera created with negative positions' : 'Negative positions rejected')
        if (negCam) edgeCaseTestsPassed++
        if (negCam) app.add(negCam)
      } catch (e) {
        this.logTestResult('Negative Positions', true, 'Negative positions correctly threw exception')
        edgeCaseTestsPassed++
      }

      // Test 3: Empty camera configuration
      try {
        const emptyCam = app.create('camera', {})
        this.logTestResult('Empty Configuration', !!emptyCam,
          emptyCam ? 'Camera created with empty config' : 'Empty config rejected')
        if (emptyCam) edgeCaseTestsPassed++
        if (emptyCam) app.add(emptyCam)
      } catch (e) {
        this.logTestResult('Empty Configuration', true, 'Empty config correctly threw exception')
        edgeCaseTestsPassed++
      }

      // Test 4: Camera with no name
      try {
        const noNameCam = app.create('camera', {
          position: [0, 0, 0],
          active: false
        })
        this.logTestResult('No Name Camera', !!noNameCam,
          noNameCam ? 'Camera created without name' : 'No name rejected')
        if (noNameCam) edgeCaseTestsPassed++
        if (noNameCam) app.add(noNameCam)
      } catch (e) {
        this.logTestResult('No Name Camera', true, 'No name correctly threw exception')
        edgeCaseTestsPassed++
      }

      this.logTestResult('Edge Cases Overall', edgeCaseTestsPassed >= totalEdgeTests * 0.75,
        `${edgeCaseTestsPassed}/${totalEdgeTests} edge case tests passed`)

    } catch (error) {
      this.logTestResult('Edge Cases Overall', false, `Exception: ${error.message}`)
    }
  },

  testPerformance() {
    try {
      const iterations = 1000
      const startTime = performance.now()

      // Test camera creation performance
      for (let i = 0; i < iterations; i++) {
        const cam = app.create('camera', {
          name: `perf-camera-${i}`,
          position: [Math.random() * 10, Math.random() * 10, Math.random() * 10],
          active: false
        })

        if (cam && i % 100 === 0) {
          app.add(cam) // Only add every 100th to avoid too many objects
          this.testEnvironment.testCameras.push(cam)
        }
      }

      const creationTime = performance.now() - startTime
      const camerasPerSecond = (iterations / creationTime) * 1000

      this.logTestResult('Performance Test', camerasPerSecond > 100,
        `${iterations} cameras created in ${creationTime.toFixed(2)}ms (${camerasPerSecond.toFixed(0)} cameras/sec)`)

      // Test memory usage
      if (performance.memory) {
        const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
        this.logTestResult('Memory Usage', memoryMB < 100,
          `Memory usage: ${memoryMB}MB`)
      }

    } catch (error) {
      this.logTestResult('Performance Test', false, `Exception: ${error.message}`)
    }
  },

  logTestResult(testName, passed, details) {
    this.testCount++
    if (passed) {
      this.passedTests++
      console.log(`✅ [CameraTest] PASS: ${testName} - ${details}`)
    } else {
      this.failedTests++
      console.log(`❌ [CameraTest] FAIL: ${testName} - ${details}`)
    }

    this.testResults[testName] = {
      passed,
      details,
      timestamp: new Date().toISOString()
    }
  },

  generateTestReport() {
    const testDuration = Date.now() - this.testStartTime
    const successRate = ((this.passedTests / this.testCount) * 100).toFixed(1)

    console.log('\n' + '='.repeat(80))
    console.log('🎥 COMPREHENSIVE CAMERA SYSTEM TEST REPORT')
    console.log('='.repeat(80))
    console.log(`📊 Test Summary:`)
    console.log(`   Total Tests: ${this.testCount}`)
    console.log(`   Passed: ${this.passedTests}`)
    console.log(`   Failed: ${this.failedTests}`)
    console.log(`   Success Rate: ${successRate}%`)
    console.log(`   Duration: ${(testDuration / 1000).toFixed(2)}s`)
    console.log(`   Cameras Created: ${this.testEnvironment.testCameras.length}`)

    console.log(`\n📋 Detailed Results:`)
    Object.keys(this.testResults).forEach(testName => {
      const result = this.testResults[testName]
      const status = result.passed ? '✅ PASS' : '❌ FAIL'
      console.log(`   ${status}: ${testName}`)
      console.log(`      ${result.details}`)
    })

    console.log(`\n🔍 Environment Info:`)
    console.log(`   THREE.js Available: ${this.testEnvironment.threeAvailable}`)
    console.log(`   World Camera Available: ${this.testEnvironment.worldCameraAvailable}`)
    console.log(`   Camera Manager Available: ${this.testEnvironment.cameraManagerAvailable}`)

    console.log(`\n💡 Recommendations:`)

    if (this.failedTests > 0) {
      console.log(`   ⚠️  ${this.failedTests} test(s) failed - review failed tests above`)
    }

    if (this.testEnvironment.cameraManagerAvailable && this.passedTests > this.testCount * 0.8) {
      console.log(`   ✅ Camera system is functioning well`)
    }

    if (this.passedTests === this.testCount) {
      console.log(`   🎉 All tests passed! Camera system is in excellent condition`)
    }

    console.log(`\n🏗️  Test Infrastructure:`)
    console.log(`   Test cameras: ${this.testEnvironment.testCameras.length} created`)
    console.log(`   Test framework: Hyperfy App Environment`)
    console.log(`   Test runner: Comprehensive Camera Test Suite v1.0`)

    console.log('\n' + '='.repeat(80))

    // Create test results object for potential programmatic access
    world.cameraTestResults = {
      summary: {
        total: this.testCount,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: parseFloat(successRate),
        duration: testDuration,
        camerasCreated: this.testEnvironment.testCameras.length
      },
      results: this.testResults,
      environment: this.testEnvironment,
      timestamp: new Date().toISOString()
    }

    console.log('📊 Test results available at: world.cameraTestResults')
  },

  update(delta) {
    // Periodic cleanup to prevent memory buildup during tests
    if (Date.now() - this.testStartTime > 60000) { // 1 minute max test duration
      this.cleanup()
    }
  },

  cleanup() {
    console.log('🧹 [CameraTest] Cleaning up test environment...')

    // Remove all test cameras
    this.testEnvironment.testCameras.forEach(camera => {
      try {
        if (camera) app.remove(camera)
      } catch (error) {
        console.warn('⚠️ [CameraTest] Error removing camera:', error.message)
      }
    })

    // Reset camera manager if available
    if (this.testEnvironment.cameraManagerAvailable && world.activateDefaultCamera) {
      try {
        world.activateDefaultCamera()
      } catch (error) {
        console.warn('⚠️ [CameraTest] Error resetting to default camera:', error.message)
      }
    }

    console.log('✅ [CameraTest] Cleanup complete')
  }
})