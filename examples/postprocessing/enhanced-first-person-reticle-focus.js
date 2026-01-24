({
  name: 'Enhanced First-Person Reticle Focus Demo',
  version: '1.0.0',

  configure: [
    { type: 'section', label: '🎯 First-Person Reticle Focus Demo' },
    {
      type: 'toggle',
      key: 'enabled',
      label: 'Enable Enhanced Focus',
      initial: true
    },
    {
      type: 'toggle',
      key: 'showFocusPoints',
      label: 'Show Focus Visualization',
      initial: true,
      description: 'Visual indicators at reticle focus points'
    },
    {
      type: 'slider',
      key: 'focusSpeed',
      label: 'Focus Response Speed',
      min: 0.1,
      max: 5,
      step: 0.1,
      initial: 2
    },
    {
      type: 'select',
      key: 'testMode',
      label: 'Test Mode',
      options: ['first-person-reticle', 'third-person-head', 'camera-center-only'],
      initial: 'first-person-reticle'
    },
    {
      type: 'toggle',
      key: 'showRealtimeUI',
      label: 'Show Real-time Focus Info',
      initial: true
    }
  ])

  console.log('[First-Person-Reticle-Demo] Enhanced reticle-based focusing system loaded')

  // State management
  let fpState = {
    enabled: app.props.enabled,
    showVisualization: app.props.showFocusPoints,
    focusSpeed: app.props.focusSpeed,
    testMode: app.props.testMode,
    showUI: app.props.showRealtimeUI,

    // Focus tracking
    currentFocus: 10.0,
    targetFocus: 10.0,
    lastFocus: 10.0,
    focusHistory: [],

    // Camera mode tracking
    lastCameraMode: null,
    modeChangeCount: 0,

    // Visualization
    focusIndicators: [],
    uiDisplay: null
  }

  // Enhanced reticle raycast for first-person
  function getReticleFocusDistance() {
    if (!app.props.enabled) return null

    const player = world.entities.player
    if (!player) return null

    // Check camera mode
    const isFirstPerson = player.firstPerson === true

    if (fpState.lastCameraMode !== isFirstPerson) {
      fpState.modeChangeCount++
      fpState.lastCameraMode = isFirstPerson
      console.log(`[First-Person-Reticle-Demo] Camera mode changed to: ${isFirstPerson ? 'FIRST PERSON' : 'THIRD PERSON'}`)
    }

    // First-person mode: dedicated reticle focus
    if (isFirstPerson) {
      console.log('[First-Person-Reticle-Demo] Using enhanced reticle focus')

      // Use Stage's reticle raycast system
      const reticleHits = world.stage?.raycastReticle()
      if (reticleHits && reticleHits.length > 0) {
        const focusDistance = reticleHits[0].distance
        console.log(`[First-Person-Reticle-Demo] Reticle focus detected: ${focusDistance.toFixed(2)}m`)
        return focusDistance
      }

      // Fallback to camera center if reticle fails
      const cameraHits = world.stage?.raycastReticle() // Actually camera center since reticle is (0,0)
      if (cameraHits && cameraHits.length > 0) {
        const focusDistance = cameraHits[0].distance
        console.log(`[First-Person-Reticle-Demo] Camera center focus: ${focusDistance.toFixed(2)}m`)
        return focusDistance
      }
    }

    // Third-person mode: head bone focus
    else if (fpState.testMode === 'third-person-head' && world.avatar) {
      const headMatrix = world.avatar.getBoneTransform('head')
      if (headMatrix) {
        const headPos = new THREE.Vector3().setFromMatrixPosition(headMatrix)
        const headQuat = new THREE.Quaternion().setFromRotationMatrix(headMatrix)
        const headDir = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat)

        const raycaster = new THREE.Raycaster()
        raycaster.set(headPos, headDir)

        const scene = world.stage?.scene
        if (scene) {
          const intersects = raycaster.intersectObjects(scene.children, true)
          if (intersects.length > 0) {
            const focusDistance = intersects[0].distance
            console.log(`[First-Person-Reticle-Demo] Head bone focus: ${focusDistance.toFixed(2)}m`)
            return focusDistance
          }
        }
      }
    }

    // Default camera center for other modes
    else {
      const cameraHits = world.stage?.raycastReticle()
      if (cameraHits && cameraHits.length > 0) {
        const focusDistance = cameraHits[0].distance
        console.log(`[First-Person-Reticle-Demo] Camera center focus: ${focusDistance.toFixed(2)}m`)
        return focusDistance
      }
    }

    return null
  }

  // Create visual focus indicators
  function createFocusVisualization(distance, isReticle) {
    if (!app.props.showVisualization) return

    const player = world.entities.player
    if (!player || !distance) return

    // Determine focus position
    const camera = world.camera
    const direction = camera.getWorldDirection(new THREE.Vector3())
    const focusPos = camera.position.clone().add(direction.multiplyScalar(distance))

    // Create different visualizations for different focus types
    const color = isReticle ? [0.2, 0.8, 1.0, 0.9] : [1.0, 0.8, 0.2, 0.9]
    const size = isReticle ? 0.1 : 0.08

    const indicator = app.create('particles', {
      position: focusPos.toArray(),
      particleCount: 8,
      color: color,
      size: size,
      velocity: 3,
      lifespan: 1.0,
      gravity: -2,
      spread: 0.3
    })

    if (indicator) {
      fpState.focusIndicators.push(indicator)

      // Auto-remove after animation
      setTimeout(() => {
        if (indicator && indicator.remove) {
          indicator.remove()
        }
        const index = fpState.focusIndicators.indexOf(indicator)
        if (index > -1) {
          fpState.focusIndicators.splice(index, 1)
        }
      }, 1000)
    }
  }

  // Main focus update
  function updateFocus(delta) {
    if (!app.props.enabled) return

    const newFocus = getReticleFocusDistance()

    if (newFocus !== null && !isNaN(newFocus)) {
      // Smooth focus interpolation
      const lerpFactor = Math.min(app.props.focusSpeed * 0.1 * delta * 60, 1.0)
      fpState.currentFocus = THREE.MathUtils.lerp(fpState.currentFocus, newFocus, lerpFactor)

      // Track focus changes
      if (Math.abs(newFocus - fpState.lastFocus) > 0.1) {
        fpState.lastFocus = newFocus
        fpState.focusHistory.push({
          time: Date.now(),
          focus: newFocus,
          mode: world.entities.player?.firstPerson ? 'first-person' : 'third-person'
        })

        // Create visualization
        createFocusVisualization(newFocus, world.entities.player?.firstPerson)
      }

      // Update world camera focus
      if (world.camera && world.prefs.dofEnabled) {
        const normalizedValue = fpState.currentFocus / 100 // Normalize to camera far plane
        if (world.camera.circleOfConfusionMaterial) {
          world.camera.circleOfConfusionMaterial.uniforms.focusDistance.value = normalizedValue
        }
      }
    }

    // Update UI
    if (fpState.showUI) {
      updateUI()
    }

    // Cleanup old history
    if (fpState.focusHistory.length > 50) {
      fpState.focusHistory = fpState.focusHistory.slice(-30)
    }
  }

  // Real-time UI display
  function createRealtimeUI() {
    if (!app.props.showRealtimeUI) return

    fpState.uiDisplay = app.create('ui', {
      position: [0, 0, 0],
      width: 'auto',
      height: 'auto',
      style: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '12px',
        background: 'rgba(0, 10, 20, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 1000
      }
    })

    setTimeout(() => {
      if (fpState.uiDisplay) {
        updateUI()
        setInterval(updateUI, 250)
      }
    }, 1000)
  }

  function updateUI() {
    if (!fpState.uiDisplay) return

    const player = world.entities.player
    if (!player) return

    const isFirstPerson = player.firstPerson === true

    let info = '🎯 Enhanced Reticle Focus Demo\n\n'
    info += `Camera: ${isFirstPerson ? 'FIRST PERSON' : 'Third Person'}\n`
    info += `Mode: ${app.props.testMode}\n`
    info += `Mode Changes: ${fpState.modeChangeCount}\n\n`

    info += `Focus Distance:\n`
    info += `Target: ${(fpState.lastFocus || 0).toFixed(2)}m\n`
    info += `Current: ${(fpState.currentFocus || 0).toFixed(2)}m\n`
    info += `Speed: ${app.props.focusSpeed.toFixed(1)}\n\n`

    info += `Focus Hits: ${fpState.focusHistory.length}\n`
    info += `Last Hit: ${fpState.focusHistory.length > 0 ? (Date.now() - fpState.focusHistory[fpState.focusHistory.length-1].time) / 1000 : 0}s ago\n`

    fpState.uiDisplay.text = info
  }

  // Initialize system
  function initializeFirstPersonFocus() {
    console.log('[First-Person-Reticle-Demo] Initializing enhanced first-person reticle focus system')

    if (!app.props.enabled) {
      console.log('[First-Person-Reticle-Demo] System disabled')
      return
    }

    // Create test objects at different distances
    const testObjects = [
      { pos: [0, 1, 8], color: [1, 0.5, 0], name: 'Close Reticle (8m)' },
      { pos: [4, 1, 15], color: [0, 1, 0.5], name: 'Medium Right (15m)' },
      { pos: [-4, 1, 25], color: [0.5, 0, 1], name: 'Far Left (25m)' }
    ]

    testObjects.forEach((test, i) => {
      const obj = app.create('prim', {
        position: test.pos,
        type: 'sphere',
        radius: 0.8,
        material: {
          color: test.color,
          metalness: 0.2,
          roughness: 0.8
        }
      })

      if (obj) {
        console.log(`[First-Person-Reticle-Demo] Created ${test.name} test object`)
      }
    })

    // Create UI
    createRealtimeUI()

    // Set up continuous focus updates
    app.on('update', updateFocus)

    console.log('[First-Person-Reticle-Demo] System initialized successfully')
  }

  // Initialize with delay for proper load
  let initTimer = 0
  app.on('update', (delta) => {
    initTimer++
    if (initTimer === 60) { // Wait ~1 second
      initializeFirstPersonFocus()
      initTimer = Infinity
    }
  })

  // Cleanup
  app.on('destroy', () => {
    console.log('[First-Person-Reticle-Demo] Cleaning up')

    // Remove visual indicators
    fpState.focusIndicators.forEach(indicator => {
      if (indicator && indicator.remove) {
        indicator.remove()
      }
    })

    // Remove UI
    if (fpState.uiDisplay && fpState.uiDisplay.remove) {
      fpState.uiDisplay.remove()
    }

    console.log('[First-Person-Reticle-Demo] Cleanup completed')
  })

  console.log('[First-Person-Reticle-Demo] Enhanced first-person reticle focus demo loaded')
})