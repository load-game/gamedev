({
  name: 'Realistic Cinematic DOF System',
  version: '2.0.0',

  configure: [
    { type: 'section', label: '🎬 Realistic Cinematic DOF' },
    {
      type: 'toggle',
      key: 'enabled',
      label: 'Enable Realistic DOF',
      initial: true
    },
    {
      type: 'select',
      key: 'lensPreset',
      label: 'Lens Type',
      options: ['50mm f1.4', '85mm f1.4', '35mm f1.8', '24-70mm f2.8', '135mm f2.0'],
      initial: '50mm f1.4',
      description: 'Real-world lens characteristics'
    },
    {
      type: 'select',
      key: 'focusMode',
      label: 'Focus Mode',
      options: ['single-af', 'continuous-af', 'manual', 'predictive-af'],
      initial: 'predictive-af',
      description: 'Autofocus behavior mode'
    },
    {
      type: 'slider',
      key: 'autofocusSpeed',
      label: 'Autofocus Response',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      initial: 0.8,
      description: 'Real-world AF speed (lower = more realistic lag)'
    },
    {
      type: 'slider',
      key: 'focusBreathing',
      label: 'Focus Breathing',
      min: 0.0,
      max: 0.15,
      step: 0.01,
      initial: 0.05,
      description: 'Lens focal length change when focusing'
    },
    {
      type: 'slider',
      key: 'bokehQuality',
      label: 'Bokeh Smoothness',
      min: 0.5,
      max: 2.0,
      step: 0.1,
      initial: 1.2,
      description: 'Quality of out-of-focus areas (higher = smoother)'
    },
    {
      type: 'toggle',
      key: 'showFocusPlane',
      label: 'Show Focus Plane Debug',
      initial: false
    },
    {
      type: 'toggle',
      key: 'adaptiveBokeh',
      label: 'Adaptive Bokeh',
      initial: true,
      description: 'Bokeh adapts to scene brightness'
    }
  ])

  console.log('[Realistic-DoF] Loading cinematic DOF system with real-world camera physics')

  // Realistic lens database
  const lensDatabase = {
    '50mm f1.4': {
      fStop: 1.4,
      focalLength: 50,
      apertureBlades: 8,
     CoC: 0.03,
      minFocus: 0.45,
      focusBreathing: 0.03,
      bokehCharacter: 'smooth'
    },
    '85mm f1.4': {
      fStop: 1.4,
      focalLength: 85,
      apertureBlades: 9,
     CoC: 0.035,
      minFocus: 0.85,
      focusBreathing: 0.02,
      bokehCharacter: 'creamy'
    },
    '35mm f1.8': {
      fStop: 1.8,
      focalLength: 35,
      apertureBlades: 7,
     CoC: 0.02,
      minFocus: 0.25,
      focusBreathing: 0.06,
      bokehCharacter: 'natural'
    },
    '24-70mm f2.8': {
      fStop: 2.8,
      focalLength: 50,
      apertureBlades: 9,
     CoC: 0.03,
      minFocus: 0.35,
      focusBreathing: 0.04,
      bokehCharacter: 'balanced'
    },
    '135mm f2.0': {
      fStop: 2.0,
      focalLength: 135,
      apertureBlades: 9,
     CoC: 0.05,
      minFocus: 0.87,
      focusBreathing: 0.01,
      bokehCharacter: ' telephoto-compression'
    }
  }

  // Realistic DOF state with camera physics
  let realisticDoF = {
    enabled: app.props.enabled,
    lens: lensDatabase[app.props.lensPreset],
    focusMode: app.props.focusMode,
    autofocusSpeed: app.props.autofocusSpeed,
    focusBreathing: app.props.focusBreathing,
    bokehQuality: app.props.bokehQuality,
    showFocusPlane: app.props.showFocusPlane,
    adaptiveBokeh: app.props.adaptiveBokeh,

    // Real-world focus tracking with lag and prediction
    currentFocus: 5.0,
    targetFocus: 5.0,
    focusHistory: [],
    afState: {
      isHunting: false,
      lastDirection: 0,
      predictionTime: 0,
      lagTimer: 0,
      responseDelay: 0.08, // Real AF systems have 80ms lag
    },

    // Focus breathing (lens focal length changes)
    breathingAmount: 0,
    breathingVelocity: 0,

    // Bokeh quality tracking
    sceneBrightness: 0.5,
    bokehIntensity: 1.0,

    // Debug visualization
    focusPlaneMesh: null,
    debugUI: null,
  }

  // Convert fStop to realistic DOF parameters
  function calculateRealisticDoF(focusDistance, fStop, focalLength) {
    // Circle of confusion calculation (depth of field formula)
    const CoC = realisticDoF.lens.CoC
    const nearLimit = (focusDistance * fStop * CoC) / (fStop * CoC + focusDistance - fStop)
    const farLimit = (focusDistance * fStop * CoC) / (fStop * CoC - focusDistance + fStop)

    // Hyperfocal distance
    const hyperfocal = (focalLength * focalLength) / (fStop * CoC)

    // Total depth of field
    const totalDoF = farLimit - nearLimit

    return {
      nearLimit: Math.max(nearLimit, 0),
      farLimit: Math.min(farLimit, hyperfocal),
      hyperfocal: hyperfocal,
      totalDoF: totalDoF,
      inFocus: focusDistance
    }
  }

  // Realistic autofocus with lag and prediction
  function performRealisticAutofocus(newFocusTarget) {
    if (!app.props.enabled) return

    const af = realisticDoF.afState
    af.lagTimer += 1 / 60

    // Real AF systems have response delay
    if (af.lagTimer < af.responseDelay) {
      return realisticDoF.currentFocus
    }

    const delta = newFocusTarget - realisticDoF.targetFocus
    const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0

    // Update direction tracking
    if (direction !== 0 && af.lastDirection !== direction) {
      af.isHunting = true
      af.predictionTime = 0
    }
    af.lastDirection = direction

    // Focus prediction (anticipate subject movement)
    if (realisticDoF.focusHistory.length > 3) {
      const recent = realisticDoF.focusHistory.slice(-5)
      const velocity = (recent[recent.length - 1].focus - recent[0].focus) / recent.length
      const acceleration = (recent[recent.length - 1].focus - 2 * recent[recent.length - 2].focus + recent[recent.length - 3].focus)

      // Predict future position
      const predictionTime = 0.1 // 100ms ahead
      const predictedFocus = newFocusTarget + velocity * predictionTime + 0.5 * acceleration * predictionTime * predictionTime

      newFocusTarget = predictedFocus
    }

    // Apply focus breathing (lens focal length changes when focusing)
    const breathingDelta = newFocusTarget - realisticDoF.targetFocus
    realisticDoF.breathingVelocity = THREE.MathUtils.lerp(
      realisticDoF.breathingVelocity,
      breathingDelta,
      0.1
    )
    realisticDoF.breathingAmount = realisticDoF.breathingVelocity * app.props.focusBreathing

    // Update target focus
    realisticDoF.targetFocus = newFocusTarget

    // Smooth interpolation with realistic response curve
    const responseCurve = Math.pow(app.props.autofocusSpeed, 1.5)
    const lerpFactor = Math.min(responseCurve * 0.02, 0.15) // Cap at 15% per frame
    realisticDoF.currentFocus = THREE.MathUtils.lerp(
      realisticDoF.currentFocus,
      realisticDoF.targetFocus,
      lerpFactor
    )

    return realisticDoF.currentFocus
  }

  // Enhanced raycast with better focus detection
  function performEnhancedRaycast() {
    const player = world.entities.player
    if (!player) return null

    const camera = world.camera
    if (!camera) return null

    const raycaster = new THREE.Raycaster()
    const rayOrigin = new THREE.Vector3()
    const rayDirection = new THREE.Vector3()

    // Determine ray origin based on camera mode
    const isFirstPerson = player.firstPerson === true

    if (isFirstPerson && !world.avatar) {
      // Pure first-person: use camera center
      rayOrigin.copy(camera.position)
      rayDirection.copy(camera.getWorldDirection(new THREE.Vector3()))
    } else if (world.avatar) {
      // Third-person: use head bone if available
      const headMatrix = world.avatar.getBoneTransform('head')
      if (headMatrix) {
        rayOrigin.setFromMatrixPosition(headMatrix)
        const headQuat = new THREE.Quaternion().setFromRotationMatrix(headMatrix)
        rayDirection.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat))
      } else {
        // Fallback to camera
        rayOrigin.copy(camera.position)
        rayDirection.copy(camera.getWorldDirection(new THREE.Vector3()))
      }
    }

    raycaster.set(rayOrigin, rayDirection)

    // Get intersectables
    const intersectables = world.stage?.scene || world.viewport
    if (!intersectables) return null

    const intersects = raycaster.intersectObjects(intersectables.children || [], true)

    if (intersects.length > 0) {
      // Find the most relevant focus target
      const relevantIntersects = intersects.filter(hit => {
        const obj = hit.object
        return obj && obj.visible && !obj.userData.ignoreFocus
      })

      if (relevantIntersects.length > 0) {
        return relevantIntersects[0].distance
      }

      return intersects[0].distance
    }

    return null
  }

  // Calculate scene brightness for adaptive bokeh
  function calculateSceneBrightness() {
    // Simple heuristic based on camera exposure
    // In a real implementation, this would sample actual pixels
    const baseBrightness = 0.5

    // Adjust based on time of day or environment (simplified)
    const timeOfDay = (performance.now() / 1000 / 60 / 60) % 24
    let brightnessModifier = 1.0

    if (timeOfDay < 6 || timeOfDay > 20) {
      brightnessModifier = 0.7 // Night
    } else if (timeOfDay < 8 || timeOfDay > 18) {
      brightnessModifier = 0.85 // Dawn/dusk
    }

    realisticDoF.sceneBrightness = baseBrightness * brightnessModifier
  }

  // Apply realistic bokeh characteristics
  function applyRealisticBokeh(dofParams) {
    if (!world.camera || !world.prefs.dofEnabled) return

    const lens = realisticDoF.lens
    const camera = world.camera

    // Calculate realistic blur based on lens parameters
    const focusDistance = dofParams.inFocus
    const distanceFromFocus = Math.abs(focusDistance - dofParams.inFocus)
    const blurAmount = Math.min(distanceFromFocus * 0.02 * lens.fStop, lens.fStop * 0.1)

    // Apply bokeh quality multiplier
    const qualityMultiplier = app.props.bokehQuality
    const finalBlur = blurAmount * qualityMultiplier

    // Update camera's DOF material
    if (camera.circleOfConfusionMaterial) {
      camera.circleOfConfusionMaterial.uniforms.focusDistance.value = focusDistance / 100
      camera.circleOfConfusionMaterial.uniforms.maxBlur.value = finalBlur
      camera.circleOfConfusionMaterial.uniforms.luminanceThreshold.value = lens.fStop / 10
      camera.circleOfConfusionMaterial.uniforms.luminanceGain.value = 2.0 / lens.fStop

      // Set bokeh to circular (realistic)
      camera.circleOfConfusionMaterial.uniforms.pentagon.value = false
      camera.circleOfConfusionMaterial.uniforms.shapeBlur.value = lens.apertureBlades * 0.2
    }
  }

  // Create focus plane visualization
  function createFocusPlaneVisualization(dofParams) {
    if (!app.props.showFocusPlane) return

    // Remove existing
    if (realisticDoF.focusPlaneMesh) {
      realisticDoF.focusPlaneMesh.remove()
      realisticDoF.focusPlaneMesh = null
    }

    const camera = world.camera
    if (!camera) return

    // Create a plane at the focus distance
    const planeDistance = dofParams.inFocus
    const direction = camera.getWorldDirection(new THREE.Vector3())
    const focusPoint = camera.position.clone().add(direction.multiplyScalar(planeDistance))

    // Create simple focus indicator
    const indicator = app.create('prim', {
      position: focusPoint.toArray(),
      type: 'sphere',
      radius: 0.05,
      material: {
        color: [1, 0.5, 0],
        emissive: [0.5, 0.25, 0],
        emissiveIntensity: 0.5,
        metalness: 0.8
      }
    })

    if (indicator) {
      realisticDoF.focusPlaneMesh = indicator

      // Auto-remove after 2 seconds
      setTimeout(() => {
        if (indicator && indicator.remove) {
          indicator.remove()
        }
        if (realisticDoF.focusPlaneMesh === indicator) {
          realisticDoF.focusPlaneMesh = null
        }
      }, 2000)
    }
  }

  // Main update loop
  function updateRealisticDoF(delta) {
    if (!app.props.enabled) return

    // Calculate scene brightness
    calculateSceneBrightness()

    // Perform raycast to get focus target
    const raycastFocus = performEnhancedRaycast()

    // Use raycast focus or maintain current
    let newFocusTarget = raycastFocus || realisticDoF.currentFocus

    // Clamp to lens minimum focus distance
    newFocusTarget = Math.max(newFocusTarget, realisticDoF.lens.minFocus)

    // Apply realistic autofocus
    const smoothFocus = performRealisticAutofocus(newFocusTarget)

    // Calculate realistic DOF parameters
    const dofParams = calculateRealisticDoF(
      smoothFocus,
      realisticDoF.lens.fStop,
      realisticDoF.lens.focalLength
    )

    // Track focus history
    realisticDoF.focusHistory.push({
      focus: smoothFocus,
      time: performance.now()
    })

    if (realisticDoF.focusHistory.length > 10) {
      realisticDoF.focusHistory.shift()
    }

    // Apply bokeh
    applyRealisticBokeh(dofParams)

    // Create visualization
    if (app.props.showFocusPlane) {
      createFocusPlaneVisualization(dofParams)
    }

    // Update debug UI
    if (realisticDoF.debugUI) {
      updateDebugUI(dofParams)
    }
  }

  // Create debug UI
  function createDebugUI() {
    realisticDoF.debugUI = app.create('ui', {
      position: [0, 0, 0],
      width: 'auto',
      height: 'auto',
      style: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: '1px solid rgba(255, 150, 0, 0.5)',
        borderRadius: '6px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 999
      }
    })

    setInterval(() => {
      const dofParams = calculateRealisticDoF(
        realisticDoF.currentFocus,
        realisticDoF.lens.fStop,
        realisticDoF.lens.focalLength
      )
      updateDebugUI(dofParams)
    }, 250)
  }

  function updateDebugUI(dofParams) {
    if (!realisticDoF.debugUI) return

    const info = `🎬 Realistic Cinematic DOF

Lens: ${app.props.lensPreset}
Mode: ${app.props.focusMode}

Focus Distance: ${realisticDoF.currentFocus.toFixed(2)}m
Target: ${realisticDoF.targetFocus.toFixed(2)}m

Optical Parameters:
f/${realisticDoF.lens.fStop} | ${realisticDoF.lens.focalLength}mm
Aperture Blades: ${realisticDoF.lens.apertureBlades}

Depth of Field:
Near: ${(dofParams.nearLimit || 0).toFixed(2)}m
Far: ${(dofParams.farLimit || 0).toFixed(2)}m
Total: ${(dofParams.totalDoF || 0).toFixed(2)}m

AF State: ${realisticDoF.afState.isHunting ? 'Hunting' : 'Locked'}
AF Speed: ${app.props.autofocusSpeed.toFixed(1)}
Breathing: ${(realisticDoF.breathingAmount * 100).toFixed(2)}%`

    realisticDoF.debugUI.text = info
  }

  // Initialize system
  function initializeRealisticDoF() {
    console.log('[Realistic-DoF] Initializing realistic cinematic DOF system')

    if (!app.props.enabled) {
      console.log('[Realistic-DoF] System disabled')
      return
    }

    // Update lens
    realisticDoF.lens = lensDatabase[app.props.lensPreset]
    console.log(`[Realistic-DoF] Loaded lens: ${app.props.lensPreset}`)

    // Create debug UI
    createDebugUI()

    // Set up update loop
    app.on('update', updateRealisticDoF)

    console.log(`[Realistic-DoF] Initialized - ${app.props.lensPreset}, Mode: ${app.props.focusMode}`)
  }

  // Initialize after delay
  let initTimer = 0
  app.on('update', (delta) => {
    initTimer++
    if (initTimer === 60) {
      initializeRealisticDoF()
      initTimer = Infinity
    }
  })

  // Handle configuration changes
  app.on('change', () => {
    realisticDoF.enabled = app.props.enabled
    realisticDoF.lens = lensDatabase[app.props.lensPreset]
    realisticDoF.focusMode = app.props.focusMode
    realisticDoF.autofocusSpeed = app.props.autofocusSpeed
    realisticDoF.focusBreathing = app.props.focusBreathing
    realisticDoF.bokehQuality = app.props.bokehQuality
    realisticDoF.showFocusPlane = app.props.showFocusPlane
    realisticDoF.adaptiveBokeh = app.props.adaptiveBokeh

    console.log(`[Realistic-DoF] Configuration updated: ${app.props.lensPreset}`)
  })

  // Cleanup
  app.on('destroy', () => {
    console.log('[Realistic-DoF] Cleaning up')

    if (realisticDoF.focusPlaneMesh) {
      realisticDoF.focusPlaneMesh.remove()
    }

    if (realisticDoF.debugUI) {
      realisticDoF.debugUI.remove()
    }

    console.log('[Realistic-DoF] Cleanup completed')
  })

  console.log('[Realistic-DoF] Realistic cinematic DOF system loaded')
})