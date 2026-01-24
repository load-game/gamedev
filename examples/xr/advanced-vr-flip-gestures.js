({
  name: 'Advanced VR Flip Gestures',
  version: '1.0.0',

  configure([
    { type: 'section', label: '🥽 Advanced VR Flip Gestures' },
    {
      type: 'toggle',
      key: 'enabled',
      label: 'Enable VR Flip Gestures',
      initial: true
    },
    {
      type: 'select',
      key: 'gestureMode',
      label: 'Gesture Recognition Mode',
      options: ['controllers', 'hands', 'hybrid'],
      initial: 'controllers'
    },
    {
      type: 'select',
      key: 'flipTrigger',
      label: 'Flip Trigger Gesture',
      options: ['controller-grip', 'controller-trigger', 'hand-pinch', 'hand-gesture', 'head-tilt', 'voice'],
      initial: 'controller-grip'
    },
    {
      type: 'select',
      key: 'backflipTrigger',
      label: 'Backflip Trigger Gesture',
      options: ['controller-overhead', 'controller-back', 'hand-upwards', 'head-back', 'voice-reverse'],
      initial: 'controller-overhead'
    },
    {
      type: 'slider',
      key: 'gestureSensitivity',
      label: 'Gesture Sensitivity (1-10)',
      min: 1,
      max: 10,
      step: 1,
      initial: 5
    },
    {
      type: 'toggle',
      key: 'hapticFeedback',
      label: 'Enable Haptic Feedback',
      initial: true
    },
    {
      type: 'toggle',
      key: 'visualConfirmation',
      label: 'Show Visual Gesture Confirmation',
      initial: true
    },
    {
      type: 'toggle',
      key: 'spatialAudio',
      label: '3D Audio Feedback',
      initial: true
    }
  ])

  console.log('[VRFlipGestures] Advanced VR flip gesture system initializing...')

  // VR-specific state
  let vrState = {
    leftController: {
      position: new Vector3(),
      rotation: new Quaternion(),
      trigger: 0,
      grip: 0,
      buttons: [false, false],
      velocity: new Vector3()
    },
    rightController: {
      position: new Vector3(),
      rotation: new Quaternion(),
      trigger: 0,
      grip: 0,
      buttons: [false, false],
      velocity: new Vector3()
    },
    head: {
      position: new Vector3(),
      rotation: new Euler(),
      velocity: new Vector3()
    },
    gestures: {
      leftFlipTriggered: false,
      rightFlipTriggered: false,
      overheadBackflip: false,
      headTiltActive: false,
      voiceActive: false
    },
    lastGestureTimes: {
      leftFlip: 0,
      rightFlip: 0,
      backflip: 0,
      headTilt: 0
    },
    gestureConfidence: 0.7
  }

  // Physics presets
  const vrPhysics = {
    controllerFlip: { up: 20, forward: 12, timing: 120 },
    handFlip: { up: 25, forward: 15, timing: 100 },
    headTiltFlip: { up: 15, forward: 8, timing: 180 },
    voiceFlip: { up: 18, forward: 10, timing: 150 }
  }

  // Flip variations for VR
  const vrFlipTypes = {
    flip: { emote: 'asset://emote-flip.glb?s=1.2&l=0', duration: 1.0, name: 'VR Flip' },
    backflip: { emote: 'asset://emote-backflip.glb?s=2.3&l=0', duration: 2.1, name: 'VR Backflip' },
    sideflip: { emote: 'asset://emote-flip.glb?s=1.4&l=0', duration: 1.2, name: 'VR Sideflip' },
    corkscrew: { emote: 'asset://emote-backflip.glb?s=1.7&l=0', duration: 2.3, name: 'VR Corkscrew' }
  }

  // VR Controller gesture tracking
  function updateControllerGestures(control) {
    if (!control) return

    // Track left controller
    if (control.xrLeftGripPose && control.xrLeftGripPose.position) {
      const leftPos = control.xrLeftGripPose.position
      vrState.leftController.position.set(leftPos.x, leftPos.y, leftPos.z)

      if (control.xrLeftGripPose.rotation) {
        const leftRot = control.xrLeftGripPose.rotation
        vrState.leftController.rotation.set(leftRot.x, leftRot.y, leftRot.z, leftRot.w)
      }
    }

    // Track right controller
    if (control.xrRightGripPose && control.xrRightGripPose.position) {
      const rightPos = control.xrRightGripPose.position
      vrState.rightController.position.set(rightPos.x, rightPos.y, rightPos.z)

      if (control.xrRightGripPose.rotation) {
        const rightRot = control.xrRightGripPose.rotation
        vrState.rightController.rotation.set(rightRot.x, rightRot.y, rightRot.z, rightRot.w)
      }
    }

    // Track button states
    vrState.leftController.trigger = control.xrLeftTrigger ? control.xrLeftTrigger.value : 0
    vrState.leftController.grip = control.xrLeftGrip ? (control.xrLeftGrip.pressed ? 1 : 0) : 0
    vrState.leftController.buttons = [
      control.xrLeftBtn1 ? control.xrLeftBtn1.pressed : false,
      control.xrLeftBtn2 ? control.xrLeftBtn2.pressed : false
    ]

    vrState.rightController.trigger = control.xrRightTrigger ? control.xrRightTrigger.value : 0
    vrState.rightController.grip = control.xrRightGrip ? (control.xrRightGrip.pressed ? 1 : 0) : 0
    vrState.rightController.buttons = [
      control.xrRightBtn1 ? control.xrRightBtn1.pressed : false,
      control.xrRightBtn2 ? control.xrRightBtn2.pressed : false
    ]
  }

  // Head tracking for head-tilt gestures
  function updateHeadTracking() {
    const player = world.entities.player
    if (!player || !player.position) return

    // Get head position and rotation
    vrState.head.position.copy(player.position)

    if (player.rotation) {
      // Convert quaternion to euler for easier tilt detection
      const euler = new Euler()
      euler.setFromQuaternion(player.rotation)
      vrState.head.rotation.copy(euler)
    }
  }

  // Advanced gesture detection
  function detectFlipGestures() {
    const now = Date.now()
    const sensitivity = app.props.gestureSensitivity / 10 // Normalize to 0.1-1.0
    const confidenceThreshold = 0.6 + (sensitivity * 0.3)

    // Reset gesture flags
    vrState.gestures.leftFlipTriggered = false
    vrState.gestures.rightFlipTriggered = false
    vrState.gestures.overheadBackflip = false

    // Controller-based flip detection
    if (app.props.gestureMode === 'controllers' || app.props.gestureMode === 'hybrid') {
      detectControllerFlipGestures(confidenceThreshold)
    }

    // Hand-based flip detection (placeholder for future hand tracking)
    if (app.props.gestureMode === 'hands' || app.props.gestureMode === 'hybrid') {
      detectHandFlipGestures(confidenceThreshold)
    }

    // Head-tilt gesture detection
    if (app.props.flipTrigger === 'head-tilt' || app.props.backflipTrigger === 'head-tilt') {
      detectHeadTiltGestures(confidenceThreshold)
    }

    // Execute detected flips
    if (vrState.gestures.leftFlipTriggered && now - vrState.lastGestureTimes.leftFlip > 800) {
      executeVRFlip('flip', 'leftController')
      vrState.lastGestureTimes.leftFlip = now
    }

    if (vrState.gestures.rightFlipTriggered && now - vrState.lastGestureTimes.rightFlip > 800) {
      executeVRFlip('flip', 'rightController')
      vrState.lastGestureTimes.rightFlip = now
    }

    if (vrState.gestures.overheadBackflip && now - vrState.lastGestureTimes.backflip > 1000) {
      executeVRFlip('backflip', 'controller')
      vrState.lastGestureTimes.backflip = now
    }
  }

  function detectControllerFlipGestures(threshold) {
    const left = vrState.leftController
    const right = vrState.rightController

    // Forward flip: Grip + Trigger combination
    if (app.props.flipTrigger === 'controller-grip') {
      // Left controller grip + trigger for left flip
      if (left.grip > threshold && left.trigger > threshold) {
        vrState.gestures.leftFlipTriggered = true
        vrState.gestureConfidence = Math.max(left.grip, left.trigger)
      }

      // Right controller grip + trigger for right flip
      if (right.grip > threshold && right.trigger > threshold) {
        vrState.gestures.rightFlipTriggered = true
        vrState.gestureConfidence = Math.max(right.grip, right.trigger)
      }
    }

    // Backflip: Overhead controller motion detection
    if (app.props.backflipTrigger === 'controller-overhead') {
      // Controller above head height signifies backflip
      const player = world.entities.player
      if (player && player.position) {
        const leftOverhead = left.position.y > player.position.y + 1.5
        const rightOverhead = right.position.y > player.position.y + 1.5

        if ((leftOverhead || rightOverhead) && (left.grip > 0.5 || right.grip > 0.5)) {
          vrState.gestures.overheadBackflip = true
          vrState.gestureConfidence = Math.max(left.grip, right.grip)
        }
      }
    }
  }

  function detectHandFlipGestures(threshold) {
    // Placeholder for future hand tracking implementation
    // Would integrate with hand tracking APIs when available

    if (app.props.flipTrigger === 'hand-pinch') {
      // Detect pinch gesture for flip
      // This would use hand tracking pose data when XR hand tracking is supported
      // For now, map to controller triggers
      detectControllerFlipGestures(threshold * 0.7) // Less strict for "hand" gestures
    }
  }

  function detectHeadTiltGestures(threshold) {
    const headRot = vrState.head.rotation
    const now = Date.now()

    // Forward flip: head tilt forward
    if (app.props.flipTrigger === 'head-tilt') {
      const forwardTilt = headRot.x > 0.1 && headRot.x < 0.5
      if (forwardTilt && now - vrState.lastGestureTimes.headTilt > 800) {
        // Double-tap head tilt for flip
        vrState.lastGestureTimes.headTilt = now
        setTimeout(() => {
          // If head stays tilted, execute flip
          if (vrState.head.rotation.x > 0.1) {
            executeVRFlip('flip', 'headTilt')
          }
        }, 200)
      }
    }
  }

  // Execute VR flip
  function executeVRFlip(flipType, triggerSource) {
    const player = world.entities.player
    if (!player) return

    const flipConfig = vrFlipTypes[flipType]
    if (!flipConfig) return

    console.log(`[VRFlipGestures] Executing ${flipConfig.name} from ${triggerSource}`)

    // Get physics based on trigger source
    let physics = vrPhysics.controllerFlip // default

    switch (triggerSource) {
      case 'leftController':
      case 'rightController':
        physics = vrPhysics.controllerFlip
        break
      case 'hand':
        physics = vrPhysics.handFlip
        break
      case 'headTilt':
        physics = vrPhysics.headTiltFlip
        break
      case 'voice':
        physics = vrPhysics.voiceFlip
        break
    }

    // VR-specific force calculation
    const upForce = new Vector3(0, physics.up, 0)
    const forwardForce = new Vector3(0, 0, -physics.forward)

    // Consider player orientation in VR space
    if (player.rotation) {
      forwardForce.applyQuaternion(player.rotation)
    }

    const totalForce = upForce.add(forwardForce)

    // Enhanced haptic feedback
    if (app.props.hapticFeedback) {
      provideHapticFeedback(triggerSource)
    }

    // Visual confirmation
    if (app.props.visualConfirmation) {
      showGestureConfirmation(triggerSource)
    }

    // Execute with VR timing
    setTimeout(() => {
      player.push(totalForce)
      if (app.props.spatialAudio) playSpatialFlipSound('whoosh', player.position)
      createVRLaunchEffect(player.position, triggerSource)
    }, 50)

    // Animation timing
    setTimeout(() => {
      player.applyEffect({
        emote: flipConfig.emote,
        duration: flipConfig.duration,
        cancellable: false
      })
    }, physics.timing)
  }

  // Haptic feedback for different VR systems
  function provideHapticFeedback(source) {
    try {
      const control = app.control()
      if (!control) return

      let hapticIntensity = 0.7
      let hapticDuration = 100

      switch (source) {
        case 'leftController':
          if (control.xrLeftHaptic) {
            control.xrLeftHaptic.pulse(hapticIntensity, hapticDuration)
          }
          break
        case 'rightController':
          if (control.xrRightHaptic) {
            control.xrRightHaptic.pulse(hapticIntensity, hapticDuration)
          }
          break
        case 'headTilt':
          // Head haptics would require special VR headset support
          // For now, simulate with audio feedback
          break
        case 'voice':
          // Voice activation haptic feedback
          break
      }

      // Enhanced haptic with gesture confidence
      const confidence = vrState.gestureConfidence
      if (confidence > 0.8) {
        hapticIntensity = 1.0
        hapticDuration = 150
      }

    } catch (e) {
      console.warn('[VRFlipGestures] Haptic feedback failed:', e)
    }
  }

  // Visual gesture confirmation
  function showGestureConfirmation(source) {
    const position = getGestureSourcePosition(source)
    if (!position) return

    let confirmationType = 'standard'
    if (vrState.gestureConfidence > 0.9) confirmationType = 'perfect'
    else if (vrState.gestureConfidence > 0.7) confirmationType = 'good'

    createGestureConfirmationEffect(position, confirmationType, source)
  }

  function getGestureSourcePosition(source) {
    const player = world.entities.player
    if (!player || !player.position) return null

    switch (source) {
      case 'leftController':
        return vrState.leftController.position.clone().add(player.position)
      case 'rightController':
        return vrState.rightController.position.clone().add(player.position)
      case 'headTilt':
        return player.position.clone().add(new Vector3(0, 1.6, 0))
      default:
        return player.position
    }
  }

  // VR-specific launch effects
  function createVRLaunchEffect(position, source) {
    if (!app.props.visualConfirmation) return

    const basePos = position.toArray ? position.toArray() : position
    const effectColor = source === 'headTilt' ? [1, 0.3, 0.8, 0.9] :
                        source.includes('Controller') ? [0.3, 0.8, 1, 0.9] :
                        [0.8, 1, 0.3, 0.9]

    const particles = app.create('particles', {
      position: basePos,
      particleCount: source.includes('Controller') ? 30 : 25,
      color: effectColor,
      size: 0.1,
      velocity: 12,
      lifespan: 0.9,
      gravity: -7,
      spread: 3
    })

    setTimeout(() => {
      if (particles) particles.remove()
    }, 1200)
  }

  // Spatial audio for VR flips
  function playSpatialFlipSound(soundType, position) {
    if (!app.props.spatialAudio || !position) return

    // VR-optimized spatial audio
    const audioConfig = {
      whoosh: { frequency: 0.8, volume: 0.6, spatial: true },
      land: { frequency: 0.4, volume: 0.8, spatial: true },
      perfect: { frequency: 1.2, volume: 0.9, spatial: true }
    }

    // Position-based audio would be implemented here
    // For now, log the intent
    console.log(`[VRFlipGestures] Playing spatial ${soundType} at`, position.toArray())
  }

  // Gesture confirmation effects
  function createGestureConfirmationEffect(position, quality, source) {
    if (!position) return

    const colors = {
      standard: [0.7, 0.7, 0.7, 0.8],
      good: [0.5, 0.9, 0.7, 0.9],
      perfect: [1.0, 0.9, 0.3, 1.0]
    }

    const effect = app.create('particles', {
      position: position.toArray(),
      particleCount: quality === 'perfect' ? 20 : 15,
      color: colors[quality],
      size: quality === 'perfect' ? 0.12 : 0.08,
      velocity: 6,
      lifespan: 0.6,
      gravity: -2,
      spread: quality === 'perfect' ? 2 : 1.5
    })

    setTimeout(() => {
      if (effect) effect.remove()
    }, 700)
  }

  // Voice command detection (placeholder)
  function setupVoiceCommands() {
    if (app.props.flipTrigger !== 'voice' && app.props.backflipTrigger !== 'voice') return

    console.log('[VRFlipGestures] Voice commands enabled (implementation depends on browser speech API)')

    // Voice command implementation would use:
    // new webkitSpeechRecognition() or SpeechRecognition
    // For now, this is a placeholder for future voice integration

    // Example structure:
    // if ('webkitSpeechRecognition' in window) {
    //   const recognition = new webkitSpeechRecognition()
    //   recognition.continuous = true
    //   recognition.onresult = handleVoiceResults
    //   recognition.start()
    // }
  }

  // Main VR gesture system
  function initializeVRGestures() {
    console.log('[VRFlipGestures] Initializing advanced VR flip gesture system')

    if (!app.props.enabled) {
      console.log('[VRFlipGestures] System disabled in configuration')
      return
    }

    if (!world.isXR) {
      console.warn('[VRFlipGestures] Not in VR mode - system disabled')
      return
    }

    console.log(`[VRFlipGestures] Mode: ${app.props.gestureMode}, Flip: ${app.props.flipTrigger}, Backflip: ${app.props.backflipTrigger}`)

    // Setup voice commands
    setupVoiceCommands()

    console.log('[VRFlipGestures] Advanced VR flip gesture system initialized successfully!')
    console.log('[VRFlipGestures] Gesture sensitivity:', app.props.gestureSensitivity)
    console.log('[VRFlipGestures] Haptics:', app.props.hapticFeedback, 'Visual:', app.props.visualConfirmation, 'Audio:', app.props.spatialAudio)
  }

  // Continuous VR gesture tracking
  app.on('update', (delta) => {
    if (!app.props.enabled || !world.isXR) return

    try {
      const control = app.control()
      if (!control) return

      // Update tracking data
      updateControllerGestures(control)
      updateHeadTracking()

      // Detect gestures every frame
      detectFlipGestures()

    } catch (e) {
      console.warn('[VRFlipGestures] Update cycle error:', e)
    }
  })

  // Configuration changes
  app.on('change', () => {
    console.log('[VRFlipGestures] Configuration changed')

    // Recalculate gesture confidence based on sensitivity
    vrState.gestureConfidence = 0.6 + (app.props.gestureSensitivity / 100) // 0.6-0.9 range
  })

  // Cleanup
  app.on('destroy', () => {
    console.log('[VRFlipGestures] Cleanup complete')
    // Cleanup gesture tracking state
    vrState = {
      leftController: { position: new Vector3(), rotation: new Quaternion(), trigger: 0, grip: 0, buttons: [false, false], velocity: new Vector3() },
      rightController: { position: new Vector3(), rotation: new Quaternion(), trigger: 0, grip: 0, buttons: [false, false], velocity: new Vector3() },
      head: { position: new Vector3(), rotation: new Euler(), velocity: new Vector3() },
      gestures: {},
      lastGestureTimes: {},
      gestureConfidence: 0.7
    }
  })

  console.log('[VRFlipGestures] Advanced VR flip gesture system script loaded successfully')
})