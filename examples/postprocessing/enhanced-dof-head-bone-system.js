({
  name: 'Enhanced Depth of Field - Head Bone Raycast System',
  version: '1.0.0',

  configure: [
    { type: 'section', label: '🎯 Enhanced DoF - Head Bone Raycast' },
    {
      type: 'toggle',
      key: 'enabled',
      label: 'Enable Enhanced DOF',
      initial: true
    },
    {
      type: 'toggle',
      key: 'headBoneRaycast',
      label: 'Enable Head Bone Raycast',
      initial: true,
      description: 'Use player head position instead of camera center for focusing'
    },
    {
      type: 'select',
      key: 'dofMode',
      label: 'DOF Mode',
      options: ['auto-detect', 'manual-player', 'manual-world', 'reticule'],
      initial: 'auto-detect'
    },
    {
      type: 'slider',
      key: 'dofHysteresis',
      label: 'Focus Anti-Jump Threshold (m)',
      min: 0.01,
      max: 1.0,
      step: 0.01,
      initial: 0.05
    },
    {
      type: 'slider',
      key: 'dofSpeed',
      label: 'Focus Response Speed',
      min: 0.5,
      max: 20,
      step: 0.5,
      initial: 8
    },
    {
      type: 'slider',
      key: 'dofSmoothness',
      label: 'Focus Smoothness',
      min: 0.01,
      max: 0.3,
      step: 0.01,
      initial: 0.08
    },
    {
      type: 'select',
      key: 'dofPhysics',
      label: 'DOF Physics Preset',
      options: ['portrait', 'cinematic', 'hyperreal', 'soft', 'sharp'],
      initial: 'cinematic'
    },
    {
      type: 'toggle',
      key: 'showDebug',
      label: 'Show Focus Debug Info',
      initial: false
    },
    {
      type: 'toggle',
      key: 'showVisualization',
      label: 'Show Focus Visualization',
      initial: true
    }
  ])

  console.log('[EnhancedDoF-HeadBone] Initializing enhanced DoF with head bone raycast system')

  // Enhanced state management
  let dofState = {
    enabled: app.props.enabled,
    useHeadBoneRaycast: app.props.headBoneRaycast,
    dofMode: app.props.dofMode,
    physics: app.props.dofPhysics,
    focusHysteresis: app.props.dofHysteresis,
    focusSpeed: app.props.dofSpeed,
    focusSmoothness: app.props.dofSmoothness,

    // Focus tracking
    currentFocus: 10.0,
    targetFocus: 10.0,
    focusVelocity: 0,

    // Head bone tracking
    lastHeadFocus: null,
    lastCameraFocus: null,
    headPosition: new Vector3(),
    headDirection: new Vector3(),

    // Debug/visuals
    showDebug: app.props.showDebug,
    showVisualization: app.props.showVisualization,
    debugUI: null,
    visualizationObjects: {}
  }

  // Enhanced DoF physics presets
  const dofPresets = {
    portrait: { blurStrength: 0.15, bokehScale: 60, luminanceThreshold: 0.8, aperture: 1.8 },
    cinematic: { blurStrength: 0.12, bokehScale: 80, luminanceThreshold: 0.6, aperture: 2.8 },
    hyperreal: { blurStrength: 0.08, bokehScale: 100, luminanceThreshold: 0.9, aperture: 4.0 },
    soft: { blurStrength: 0.20, bokehScale: 40, luminanceThreshold: 0.5, aperture: 2.0 },
    sharp: { blurStrength: 0.05, bokehScale: 120, luminanceThreshold: 1.0, aperture: 5.6 }
  }

  // Enhanced raycaster for head bone focusing
  const raycaster = new THREE.Raycaster()
  const rayOrigin = new THREE.Vector3()
  const rayDirection = new THREE.Vector3()

  /**
   * Enhanced head bone raycast system (respects first-person mode)
   */
  function performHeadBoneRaycast() {
    if (!app.props.enabled || !dofState.useHeadBoneRaycast) return null

    const player = world.entities.player
    const avatar = world.avatar

    if (!player || !avatar) return null

    // Check if we're in first-person mode
    const isFirstPerson = player.firstPerson === true
    if (isFirstPerson) {
      console.log('[EnhancedDoF-HeadBone] First-person mode detected, skipping head bone raycast')
      return null
    }

    // Use existing head bone transform system (only in third-person)
    const headMatrix = avatar.getBoneTransform('head')
    if (!headMatrix) return null

    // Get head position and orientation
    const headPos = new Vector3().setFromMatrixPosition(headMatrix)
    const headQuat = new Quaternion().setFromRotationMatrix(headMatrix)
    const headDir = new Vector3(0, 0, -1).applyQuaternion(headQuat)

    rayOrigin.copy(headPos)
    rayDirection.copy(headDir)

    // Perform raycast using existing world infrastructure
    raycaster.set(rayOrigin, rayDirection)

    // Get intersectable objects (world.scene contains all objects for raycasting)
    const intersectables = world.stage?.scene || world.viewport
    if (!intersectables) return null

    const intersects = raycaster.intersectObjects(intersectables.children || [], true)

    if (intersects.length > 0) {
      return {
        distance: intersects[0].distance,
        position: intersects[0].point.clone(),
        object: intersects[0].object,
        headPosition: headPos.clone(),
        headDirection: headDir.clone()
      }
    }

    // Fallback to player distance
    const playerDistance = player.position ? headPos.distanceTo(player.position) + 10 : 10
    return {
      distance: playerDistance,
      position: player.position ? headPos.clone().add(headDir.clone().multiplyScalar(playerDistance)) : headPos.clone(),
      object: null,
      headPosition: headPos.clone(),
      headDirection: headDir.clone()
    }
  }

  /**
   * Enhanced focus calculation with head bone prioritization
   */
  function calculateEnhancedFocus() {
    if (!app.props.enabled) return dofState.currentFocus

    const player = world.entities.player
    if (!player) return dofState.currentFocus

    let focusResult = null

    // Priority 1: Head bone raycast (most accurate)
    if (dofState.useHeadBoneRaycast) {
      focusResult = performHeadBoneRaycast()
      if (focusResult) {
        console.log(`[EnhancedDoF-HeadBone] Head focus: ${focusResult.distance.toFixed(2)}m at ${focusResult.position.toArray().map(n => n.toFixed(2)).join(', ')}`)
        dofState.lastHeadFocus = focusResult.distance

        // Track head position for visualization
        dofState.headPosition.copy(focusResult.headPosition)
        dofState.headDirection.copy(focusResult.headDirection)
      }
    }

    // Priority 2: Enhanced camera-center raycast (fallback)
    if (!focusResult) {
      focusResult = performEnhancedCameraCenterRaycast()
      if (focusResult) {
        console.log(`[EnhancedDoF-HeadBone] Camera focus: ${focusResult.distance.toFixed(2)}m`)
        dofState.lastCameraFocus = focusResult.distance
      }
    }

    // Priority 3: Distance to player (final fallback)
    if (!focusResult) {
      focusResult = performPlayerDistanceFocus()
      if (focusResult) {
        console.log(`[EnhancedDoF-HeadBone] Player distance focus: ${focusResult.distance.toFixed(2)}m`)
      }
    }

    return focusResult ? focusResult.distance : dofState.currentFocus
  }

  /**
   * Enhanced camera-center raycast (fallback)
   */
  function performEnhancedCameraCenterRaycast() {
    const camera = world.camera
    if (!camera) return null

    const cameraPos = camera.position.clone()
    const cameraDir = camera.getWorldDirection(new Vector3())

    rayOrigin.copy(cameraPos)
    rayDirection.copy(cameraDir)

    raycaster.set(rayOrigin, rayDirection)

    const intersectables = world.stage?.getIntersectables() || world.viewport
    if (!intersectables) return null

    const intersects = raycaster.intersectObjects(intersectables.children || [], true)

    if (intersects.length > 0) {
      return {
        distance: intersects[0].distance,
        position: intersects[0].point.clone(),
        object: intersects[0].object,
        headPosition: cameraPos.clone(),
        headDirection: cameraDir.clone()
      }
    }

    return null
  }

  /**
   * Player distance fallback focus
   */
  function performPlayerDistanceFocus() {
    const player = world.entities.player
    if (!player) return null

    // Calculate distance from camera to player with head height offset
    const cameraPos = world.camera.position.clone()
    const playerPos = player.position.clone()
    playerPos.y += 1.6 // Eye height offset

    return Math.max(cameraPos.distanceTo(playerPos), 2.0)
  }

  /**
   * Enhanced focus smoothing with hysteresis
   */
  function applyEnhancedFocusSmoothing(newTarget) {
    const previousTarget = dofState.targetFocus

    if (previousTarget === null) return newTarget

    // Apply hysteresis to prevent focus jumping
    const delta = Math.abs(newTarget - previousTarget)

    if (delta < dofState.focusHysteresis) {
      // Maintain current focus - prevents tiny micro-adjustments
      return previousTarget
    }

    // Larger change - allow new focus with enhanced smoothing
    const lerpFactor = Math.min(dofState.focusSpeed * 0.02, 1.0)
    const smoothedValue = THREE.MathUtils.lerp(previousTarget, newTarget, lerpFactor)

    // Velocity-based smoothing for natural motion
    dofState.focusVelocity *= 0.9
    dofState.focusVelocity += (newTarget - previousTarget) / delta * 0.1

    return smoothedValue + (dofState.focusVelocity * 0.03)
  }

  /**
   * Create enhanced DoF visualization
   */
  function createFocusVisualization() {
    if (!app.props.showVisualization) return

    // Remove existing visualizations
    Object.values(dofState.visualizationObjects).forEach(obj => {
      if (obj) obj.remove()
    })
    dofState.visualizationObjects = {}

    const headRay = performHeadBoneRaycast()
    if (!headRay) return

    // Visual indicator for head position
    const headIndicator = app.create('particles', {
      position: headRay.headPosition.toArray(),
      particleCount: 5,
      color: [0.2, 0.5, 1, 0.9],
      size: 0.05,
      velocity: 2,
      lifespan: 1.0,
      gravity: -1,
      spread: 0.3
    })

    // Visual indicator for focus point
    const focusIndicator = app.create('particles', {
      position: headRay.position.toArray(),
      particleCount: 10,
      color: [1, 0.3, 0.2, 0.9],
      size: 0.08,
      velocity: 3,
      lifespan: 0.8,
      gravity: -2,
      spread: 0.5
    })

    dofState.visualizationObjects.head = headIndicator
    dofState.visualizationObjects.focus = focusIndicator

    setTimeout(() => {
      headIndicator.remove()
      focusIndicator.remove()
    }, 1000)
  }

  /**
   * Create debug UI for focus information
   */
  function createDebugUI() {
    if (!app.props.showDebug) return

    if (dofState.debugUI) {
      dofState.debugUI.remove()
    }

    dofState.debugUI = app.create('ui', {
      position: [0, 0, 0],
      width: 'auto',
      height: 'auto',
      style: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '10px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '5px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 999,
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }
    })

    updateDebugDisplay()
    setInterval(updateDebugDisplay, 500)
  }

  function updateDebugDisplay() {
    if (!dofState.debugUI) return

    const player = world.entities.player
    const headRay = performHeadBoneRaycast()
    const cameraRay = performEnhancedCameraCenterRaycast()

    let debugInfo = '🎯 Enhanced DOF Debug\n\n'
    debugInfo += `Mode: ${dofState.dofMode}\n`
    debugInfo += `Head bone raycast: ${dofState.lastHeadFocus ? '✅' : '❌'}\n`
    debugInfo += `Camera raycast: ${dofState.lastCameraFocus ? '✅' : '❌'}\n`
    debugInfo += `\nFocus Distance:\n`
    debugInfo += `${dofState.targetFocus:.2f}m (${headRay ? headRay.distance.toFixed(2) : 'N/A'})\n`
    debugInfo += `Smooth: ${dofState.currentFocus.toFixed(2)}m\n`
    debugInfo += `Hysteresis: ${dofState.focusHysteresis}m\n`

    dofState.debugUI.text = debugInfo
  }

  /**
   * Enhanced update cycle
   */
  function updateEnhancedFocus(dt) {
    if (!app.props.enabled) return

    // Calculate enhanced focus
    const newTarget = calculateEnhancedFocus()

    if (newTarget !== null && !isNaN(newTarget)) {
      // Apply smoothing with hysteresis
      const smoothedTarget = applyEnhancedFocusSmoothing(newTarget)
      dofState.targetFocus = smoothedTarget

      // Smooth interpolation
      const lerpFactor = Math.min(dofState.focusSpeed * 0.02 * dt * 60, 1.0)
      dofState.currentFocus = THREE.MathUtils.lerp(
        dofState.currentFocus,
        dofState.targetFocus,
        lerpFactor
      )

      // Create visualization if requested
      if (app.props.showVisualization) {
        createFocusVisualization()
      }
    }

    // Update world camera focus
    if (world.camera && world.prefs.dofEnabled) {
      const normalizedValue = dofState.currentFocus / 100 // Normalize to camera far plane

      if (world.camera.circleOfConfusionMaterial) {
        world.camera.circleOfConfusionMaterial.uniforms.focusDistance.value = normalizedValue
      }
    }
  }

  /**
   * Enhanced DoF application
   */
  function applyEnhancedDoF() {
    if (!app.props.enabled) return

    // Apply the enhanced focus calculations
    updateEnhancedFocus(1.0 / 60) // Assume 60fps for delta

    // Create/update debug display
    if (app.props.showDebug) {
      updateDebugDisplay()
    }
  }

  /**
   * Initialize the system
   */
  function initializeEnhancedDOF() {
    console.log('[EnhancedDoF-HeadBone] Initializing enhanced depth of field system')

    if (!app.props.enabled) {
      console.log('[EnhancedDoF-HeadBone] System disabled in configuration')
      return
    }

    // Create debug visualization
    if (app.props.showDebug) {
      createDebugUI()
    }

    // Set up enhanced DoF update
    app.on('update', applyEnhancedDoF)

    console.log(`[EnhancedDoF-HeadBone] Enhanced DoF initialized - Mode: ${app.props.dofMode}, Head bone: ${app.props.headBoneRaycast}`)
  }

  // Initialize after brief delay
  let initTimer = 0
  app.on('update', (delta) => {
    initTimer++
    if (initTimer === 30) { // ~0.5 seconds at 60fps
      initializeEnhancedDOF()
      initTimer = Infinity // Prevent re-initialization
    }
  })

  // Handle configuration changes
  app.on('change', () => {
    // Update state from configuration
    dofState.enabled = app.props.enabled
    dofState.useHeadBoneRaycast = app.props.headBoneRaycast
    dofState.dofMode = app.props.dofMode
    dofState.focusHysteresis = app.props.dofHysteresis
    dofState.focusSpeed = app.props.dofSpeed
    dofState.focusSmoothness = app.props.dofSmoothness
    dofState.showDebug = app.props.showDebug
    dofState.showVisualization = app.props.showVisualization

    // Debug state changes
    if (app.props.showDebug !== dofState.showDebug) {
      if (app.props.showDebug) {
        createDebugUI()
      } else {
        if (dofState.debugUI) dofState.debugUI.remove()
      }
    }

    console.log(`[EnhancedDoF-HeadBone] Configuration updated - Head bone: ${app.props.headBoneRaycast}, Mode: ${app.props.dofMode}`)
  })

  // Cleanup
  app.on('destroy', () => {
    console.log('[EnhancedDoF-HeadBone] Cleanup started')

    // Remove event listeners
    if (dofState.debugUI) {
      dofState.debugUI.remove()
      dofState.debugUI = null
    }

    Object.values(dofState.visualizationObjects).forEach(obj => {
      if (obj && obj.remove) obj.remove()
    })

    console.log('[EnhancedDoF-HeadBone] Cleanup completed')
  })

  console.log('[EnhancedDoF-HeadBone] Enhanced depth of field system loaded successfully')
})