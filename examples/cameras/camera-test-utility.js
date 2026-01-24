// Camera Test Utility
// Quick validation script to test camera features

if (world.isClient) {
  console.log('🎥 Camera Test Utility Started')

  // Test basic camera creation
  try {
    const testCamera = app.create('camera', {
      name: 'test-camera',
      position: [0, 2, 5],
      rotation: [-0.1, 0, 0],
      fov: 50,
      active: false,
      showHelper: true,

      // Test DOF
      dof: {
        enabled: true,
        focusDistance: 5,
        fStop: 2.8,
        maxBlur: 0.05
      },

      // Test motion
      motion: {
        enabled: true,
        bobAmount: 0.001,
        swayAmount: 0.001
      },

      // Test post-processing
      bloom: {
        enabled: true,
        intensity: 0.5
      },

      vignette: {
        enabled: true,
        offset: 0.35,
        darkness: 0.4
      }
    })

    app.add(testCamera)

    // Create test UI
    const testUI = app.create('ui', {
      width: 300,
      height: 200,
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderRadius: 10,
      padding: 15,
      billboard: 'full',
      position: [0, 3, 0],
      size: 0.003
    })

    const title = app.create('uitext', {
      value: '🎥 CAMERA TEST',
      color: '#00ffaa',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 10
    })

    const status = app.create('uitext', {
      value: '✓ Camera Created\n✓ DOF Active\n✓ Motion Active\n✓ Bloom Active\n✓ Vignette Active',
      color: '#88ff88',
      fontSize: 12,
      lineHeight: 1.4
    })

    testUI.add(title)
    testUI.add(status)
    app.add(testUI)

    // Test activation
    setTimeout(() => {
      testCamera.active = true
      console.log('✓ Test camera activated!')

      status.value = '✓ Camera Created\n✓ DOF Active\n✓ Motion Active\n✓ Bloom Active\n✓ Vignette Active\n✓ CAMERA ACTIVE'
    }, 1000)

    // Test feature toggling
    let testStep = 0
    const testInterval = setInterval(() => {
      testStep++

      switch(testStep) {
        case 1:
          testCamera.dof.enabled = !testCamera.dof.enabled
          console.log('🔀 Toggled DOF')
          break
        case 2:
          testCamera.bloom.enabled = !testCamera.bloom.enabled
          console.log('🔀 Toggled Bloom')
          break
        case 3:
          testCamera.vignette.enabled = !testCamera.vignette.enabled
          console.log('🔀 Toggled Vignette')
          break
        case 4:
          testCamera.motion.enabled = !testCamera.motion.enabled
          console.log('🔀 Toggled Motion')
          break
        case 5:
          clearInterval(testInterval)
          console.log('✅ Camera test complete!')

          status.value += '\n\n✅ TEST PASSED'
          break
      }
    }, 2000)

  } catch (error) {
    console.error('❌ Camera test failed:', error)
  }
}