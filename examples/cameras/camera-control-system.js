({
  init() {
    // Only run on client
    if (!world.isClient) return

    // Get control interface for input handling
    this.control = app.control()
    if (!this.control) {
      console.warn('[Camera Demo] No control interface available')
      return
    }

    // Keep app active for continuous updates
    app.keepActive = true

    // Store camera instances
    this.cameras = []
    this.currentCameraIndex = 0
    this.freeCameras = {} // Store free-flying camera states

    // UI references
    this.mainUI = null
    this.infoUI = null
    this.detailedUI = null

    // Initialize camera demo
    this.setupControls()
    this.createCameraPresets()
    this.setupUI()

    // Start update loop
    app.on('update', delta => this.update(delta))

    console.log('[Camera Demo] Comprehensive Camera Control System initialized!')
    console.log('[Camera Demo] Press H to toggle help, [ and ] to cycle cameras')
  },

  setupControls() {
    // Capture all necessary keys
    const controls = [
      // Camera switching
      'digit1', 'digit2', 'digit3', 'digit4', 'digit5', 'digit6',
      'bracketLeft', 'bracketRight', 'keyH',
      // Free camera controls
      'keyW', 'keyA', 'keyS', 'keyD', 'keyQ', 'keyE', 'space', 'shiftLeft',
      'mouseRight', 'mouseScroll',
      // Feature toggles
      'keyB', 'keyV', 'keyM', 'keyG', 'keyR', 'keyF'
    ]

    controls.forEach(key => {
      if (this.control[key]) {
        this.control[key].capture = true
      }
    })
  },

  createCameraPresets() {
    const presets = [
      // 1. CINEMATIC WIDE CAMERA
      {
        name: 'Cinematic Wide',
        position: [10, 3, 10],
        rotation: [-0.2, 0.785, 0],
        fov: 35,
        attachToRig: false,
        isPlayerCamera: false,
        showHelper: true,
        helperScale: 0.25,

        // Ultra cinematic DOF
        dof: {
          enabled: true,
          focusDistance: 12,
          focalLength: 85,
          fStop: 1.4, // Prime lens
          maxBlur: 0.08,
          autofocus: false
        },

        // Smooth cinematic motion
        motion: {
          enabled: true,
          bobAmount: 0.001,
          bobSpeed: 0.01,
          swayAmount: 0.0005,
          swaySpeed: 0.008,
          breathingAmount: 0.002,
          breathingSpeed: 0.15,
          handheldShake: 0,
          dampingFactor: 0.92
        },

        // Post-processing effects
        bloom: {
          enabled: true,
          intensity: 0.6,
          luminanceThreshold: 0.7,
          radius: 1.0
        },

        vignette: {
          enabled: true,
          offset: 0.35,
          darkness: 0.3
        },

        chromaticAberration: {
          enabled: true,
          offset: [0.002, 0.002]
        }
      },

      // 2. PORTRAIT CAMERA
      {
        name: 'Portrait Close-up',
        position: [2, 1.6, 2],
        rotation: [-0.1, 0.3, 0],
        fov: 85,
        attachToRig: false,
        isPlayerCamera: false,
        showHelper: true,

        // Shallow DOF for portraits
        dof: {
          enabled: true,
          focusDistance: 2,
          focalLength: 135,
          fStop: 1.8,
          maxBlur: 0.12,
          autofocus: true,
          autofocusSpeed: 4
        },

        motion: { enabled: false },

        // Subtle color grading
        hueSaturation: {
          enabled: true,
          hue: 0.05,
          saturation: 0.1
        },

        brightnessContrast: {
          enabled: true,
          brightness: 0.05,
          contrast: 0.1
        },

        vignette: {
          enabled: true,
          offset: 0.4,
          darkness: 0.5
        }
      },

      // 3. FREE-FLYING SPECTATOR
      {
        name: 'Free-Flying Spectator',
        position: [5, 5, 5],
        rotation: [-0.3, 0.785, 0],
        fov: 75,
        attachToRig: false,
        isPlayerCamera: false,
        showHelper: false,

        // Free-flying controls
        freeFlying: true,
        flySpeed: 8,
        flyBoostMultiplier: 3,
        lookSensitivity: 0.003,
        smoothMovement: true,
        freeBody: 'noclip',

        // Moderate DOF
        dof: {
          enabled: false
        },

        motion: { enabled: false }
      },

      // 4. ACTION CAMERA
      {
        name: 'Action Camera',
        position: [0, 0.5, 1],
        rotation: [0, 0, 0],
        fov: 110,
        attachToRig: true,
        isPlayerCamera: false,
        showHelper: true,
        helperScale: 0.15,

        // No DOF for action
        dof: { enabled: false },

        // Dynamic motion
        motion: {
          enabled: true,
          bobAmount: 0.01,
          bobSpeed: 0.2,
          swayAmount: 0.008,
          swaySpeed: 0.15,
          handheldShake: 0.003,
          velocityInfluence: 0.5,
          dampingFactor: 0.85
        },

        // Action bloom
        bloom: {
          enabled: true,
          intensity: 0.8,
          luminanceThreshold: 0.6
        },

        // Lens distortion for action feel
        lensDistortion: {
          enabled: true,
          distortion: 0.2,
          cubicDistortion: 0.1
        }
      },

      // 5. SURVEILLANCE CAMERA
      {
        name: 'Surveillance Camera',
        position: [0, 8, 0],
        rotation: [-Math.PI / 2, 0, 0],
        fov: 60,
        attachToRig: false,
        isPlayerCamera: false,
        showHelper: true,
        helperScale: 0.3,

        // No DOF for surveillance
        dof: { enabled: false },

        motion: { enabled: false },

        // Surveillance color grading
        brightnessContrast: {
          enabled: true,
          brightness: -0.1,
          contrast: 0.2
        },

        filmGrain: {
          enabled: true,
          intensity: 0.4,
          grainScale: 2.0
        },

        vignette: {
          enabled: true,
          offset: 0.25,
          darkness: 0.2
        }
      },

      // 6. ARTISTIC CAMERA
      {
        name: 'Artistic Camera',
        position: [6, 2, 6],
        rotation: [-0.15, Math.PI / 4, 0],
        fov: 50,
        attachToRig: false,
        isPlayerCamera: false,
        showHelper: true,
        helperScale: 0.2,

        // Artistic DOF
        dof: {
          enabled: true,
          focusDistance: 6,
          focalLength: 50,
          fStop: 2.8,
          maxBlur: 0.06,
          autofocus: false
        },

        // Subtle motion
        motion: {
          enabled: true,
          bobAmount: 0.002,
          swayAmount: 0.001,
          breathingAmount: 0.008,
          breathingSpeed: 0.25
        },

        // Full post-processing pipeline
        bloom: {
          enabled: true,
          intensity: 0.4,
          luminanceThreshold: 0.8,
          radius: 0.8
        },

        vignette: {
          enabled: true,
          offset: 0.3,
          darkness: 0.35
        },

        chromaticAberration: {
          enabled: true,
          offset: [0.003, 0.003]
        },

        filmGrain: {
          enabled: true,
          intensity: 0.2
        },

        hueSaturation: {
          enabled: true,
          hue: 0.02,
          saturation: 0.15
        }
      }
    ]

    // Create each camera preset
    presets.forEach((preset, index) => {
      const camera = app.create('camera', {
        name: `demo-camera-${index}`,
        position: preset.position,
        rotation: preset.rotation,
        fov: preset.fov,
        active: false,
        attachToRig: preset.attachToRig || false,
        isPlayerCamera: preset.isPlayerCamera || false,
        showHelper: preset.showHelper !== false,
        helperScale: preset.helperScale || 0.3,

        // Free-flying settings
        freeFlying: preset.freeFlying || false,
        flySpeed: preset.flySpeed || 5,
        flyBoostMultiplier: preset.flyBoostMultiplier || 3,
        lookSensitivity: preset.lookSensitivity || 0.003,
        smoothMovement: preset.smoothMovement !== false,
        freeBody: preset.freeBody || 'noclip',

        // Motion system
        motion: preset.motion || { enabled: false },

        // DOF system
        dof: preset.dof || { enabled: false },

        // Post-processing effects
        bloom: preset.bloom || { enabled: false },
        vignette: preset.vignette || { enabled: false },
        chromaticAberration: preset.chromaticAberration || { enabled: false },
        filmGrain: preset.filmGrain || { enabled: false },
        hueSaturation: preset.hueSaturation || { enabled: false },
        brightnessContrast: preset.brightnessContrast || { enabled: false },
        lensDistortion: preset.lensDistortion || { enabled: false },

        // Tone mapping
        toneMapping: {
          enabled: true,
          mode: 'ACES_FILMIC',
          exposure: 1.0
        }
      })

      // Store preset data for reference
      camera.presetData = preset
      this.cameras.push(camera)
      app.add(camera)

      // Initialize free camera state if needed
      if (preset.freeFlying) {
        this.freeCameras[index] = {
          velocity: new THREE.Vector3(),
          targetVelocity: new THREE.Vector3(),
          euler: new THREE.Euler(0, 0, 0, 'YXZ'),
          mouseLookEnabled: false
        }
      }

      console.log(`[Camera Demo] Created camera ${index}: ${preset.name}`)
    })

    // Activate first camera by default
    if (this.cameras.length > 0) {
      this.switchToCamera(0)
    }

    console.log(`[Camera Demo] Created ${this.cameras.length} camera presets`)
  },

  setupUI() {
    // Main Control UI
    this.mainUI = app.create('ui', {
      width: 400,
      height: 320,
      backgroundColor: 'rgba(0, 15, 30, 0.95)',
      borderRadius: 15,
      padding: 20,
      billboard: 'full',
      pivot: 'top-left',
      position: [2, 3, 0],
      size: 0.003,
      active: true
    })

    // Main title
    const title = app.create('uitext', {
      value: '🎥 CAMERA CONTROL SYSTEM',
      color: '#00ffaa',
      fontSize: 22,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 15
    })

    // Current camera info
    const currentInfo = app.create('uitext', {
      value: 'Current Camera: Initializing...',
      color: '#ffffff',
      fontSize: 16,
      marginBottom: 10
    })

    // Controls list
    const controlsText = app.create('uitext', {
      value: `📋 CONTROLS:
1-6 - Select Camera  [ ] - Cycle
H - Toggle Help     B - Toggle Bloom
V - Toggle Vignette M - Toggle Motion
G - Toggle DOF      R - Reset Camera
F - Toggle Film Grain`,
      color: '#cccccc',
      fontSize: 13,
      lineHeight: 1.4,
      marginBottom: 10
    })

    // Feature status
    const featureStatus = app.create('uitext', {
      value: '🎯 FEATURES: Initializing...',
      color: '#88ccff',
      fontSize: 12,
      lineHeight: 1.3
    })

    this.mainUI.add(title)
    this.mainUI.add(currentInfo)
    this.mainUI.add(controlsText)
    this.mainUI.add(featureStatus)

    app.add(this.mainUI)

    // Store references for updates
    this.mainUI.currentInfo = currentInfo
    this.mainUI.featureStatus = featureStatus

    // Camera Details UI
    this.detailedUI = app.create('ui', {
      width: 350,
      height: 250,
      backgroundColor: 'rgba(15, 0, 30, 0.9)',
      borderRadius: 15,
      padding: 20,
      billboard: 'full',
      pivot: 'top-right',
      position: [-2, 3, 0],
      size: 0.003,
      active: true
    })

    // Details title
    const detailsTitle = app.create('uitext', {
      value: '📊 CAMERA DETAILS',
      color: '#ff6b6b',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 15
    })

    // Details content
    const detailsContent = app.create('uitext', {
      value: 'Initializing...',
      color: '#ffffff',
      fontSize: 12,
      lineHeight: 1.4
    })

    this.detailedUI.add(detailsTitle)
    this.detailedUI.add(detailsContent)
    app.add(this.detailedUI)

    this.detailedUI.content = detailsContent
  },

  update(delta) {
    if (!this.control || !world.isClient) return

    // Handle input
    this.handleInput()

    // Update UI
    this.updateUI()

    // Handle free camera movement
    if (this.currentCameraIndex < this.cameras.length) {
      const camera = this.cameras[this.currentCameraIndex]
      if (camera?.presetData?.freeFlying && this.freeCameras[this.currentCameraIndex]) {
        this.updateFreeCamera(delta)
      }
    }
  },

  handleInput() {
    // Number keys for direct camera selection
    for (let i = 0; i < Math.min(6, this.cameras.length); i++) {
      if (this.control[`digit${i + 1}`]?.pressed) {
        this.switchToCamera(i)
      }
    }

    // Bracket keys for cycling
    if (this.control.bracketLeft?.pressed) {
      this.cycleCamera(-1)
    }
    if (this.control.bracketRight?.pressed) {
      this.cycleCamera(1)
    }

    // Feature toggles
    if (this.control.keyB?.pressed) this.toggleBloom()
    if (this.control.keyV?.pressed) this.toggleVignette()
    if (this.control.keyM?.pressed) this.toggleMotion()
    if (this.control.keyG?.pressed) this.toggleDOF()
    if (this.control.keyF?.pressed) this.toggleFilmGrain()
    if (this.control.keyR?.pressed) this.resetCamera()

    // Help toggle
    if (this.control.keyH?.pressed) {
      this.mainUI.active = !this.mainUI.active
      this.detailedUI.active = !this.detailedUI.active
    }
  },

  switchToCamera(index) {
    if (index < 0 || index >= this.cameras.length) return

    // Deactivate all cameras
    this.cameras.forEach(camera => {
      camera.active = false
    })

    // Activate selected camera
    this.cameras[index].active = true
    this.currentCameraIndex = index

    const name = this.cameras[index].presetData?.name || `Camera ${index}`
    console.log(`[Camera Demo] Switched to: ${name}`)
  },

  cycleCamera(direction) {
    const newIndex = (this.currentCameraIndex + direction + this.cameras.length) % this.cameras.length
    this.switchToCamera(newIndex)
  },

  toggleBloom() {
    const camera = this.cameras[this.currentCameraIndex]
    if (camera) {
      camera.bloom.enabled = !camera.bloom.enabled
      console.log(`[Camera Demo] Bloom ${camera.bloom.enabled ? 'ENABLED' : 'DISABLED'}`)
    }
  },

  toggleVignette() {
    const camera = this.cameras[this.currentCameraIndex]
    if (camera) {
      camera.vignette.enabled = !camera.vignette.enabled
      console.log(`[Camera Demo] Vignette ${camera.vignette.enabled ? 'ENABLED' : 'DISABLED'}`)
    }
  },

  toggleMotion() {
    const camera = this.cameras[this.currentCameraIndex]
    if (camera) {
      camera.motion.enabled = !camera.motion.enabled
      console.log(`[Camera Demo] Motion ${camera.motion.enabled ? 'ENABLED' : 'DISABLED'}`)
    }
  },

  toggleDOF() {
    const camera = this.cameras[this.currentCameraIndex]
    if (camera) {
      camera.dof.enabled = !camera.dof.enabled
      console.log(`[Camera Demo] DOF ${camera.dof.enabled ? 'ENABLED' : 'DISABLED'}`)
    }
  },

  toggleFilmGrain() {
    const camera = this.cameras[this.currentCameraIndex]
    if (camera) {
      camera.filmGrain.enabled = !camera.filmGrain.enabled
      console.log(`[Camera Demo] Film Grain ${camera.filmGrain.enabled ? 'ENABLED' : 'DISABLED'}`)
    }
  },

  resetCamera() {
    const camera = this.cameras[this.currentCameraIndex]
    if (camera && camera.presetData) {
      // Reset position and rotation
      camera.position.fromArray(camera.presetData.position)
      camera.rotation.fromArray(camera.presetData.rotation)

      // Reset free camera state if applicable
      if (this.freeCameras[this.currentCameraIndex]) {
        const freeCam = this.freeCameras[this.currentCameraIndex]
        freeCam.velocity.set(0, 0, 0)
        freeCam.targetVelocity.set(0, 0, 0)
        freeCam.euler.set(0, 0, 0)
        freeCam.mouseLookEnabled = false
      }

      console.log(`[Camera Demo] Reset camera: ${camera.presetData.name}`)
    }
  },

  updateFreeCamera(delta) {
    const freeCamState = this.freeCameras[this.currentCameraIndex]
    if (!freeCamState) return

    // Handle mouse look
    if (this.control.mouseRight?.pressed) {
      freeCamState.mouseLookEnabled = true
    } else if (this.control.mouseRight?.released) {
      freeCamState.mouseLookEnabled = false
    }

    if (freeCamState.mouseLookEnabled && this.control.mouseMove) {
      const deltaX = this.control.mouseX - (this.lastMouseX || this.control.mouseX)
      const deltaY = this.control.mouseY - (this.lastMouseY || this.control.mouseY)

      freeCamState.euler.y -= deltaX * 0.003
      freeCamState.euler.x -= deltaY * 0.003
      freeCamState.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, freeCamState.euler.x))

      this.lastMouseX = this.control.mouseX
      this.lastMouseY = this.control.mouseY
    }

    // Handle movement
    const camera = this.cameras[this.currentCameraIndex]
    const preset = camera.presetData

    let moveX = 0, moveY = 0, moveZ = 0

    if (this.control.keyW?.down) moveZ -= 1
    if (this.control.keyS?.down) moveZ += 1
    if (this.control.keyA?.down) moveX -= 1
    if (this.control.keyD?.down) moveX += 1
    if (this.control.keyQ?.down || this.control.space?.down) moveY += 1
    if (this.control.keyE?.down) moveY -= 1

    const speed = preset.flySpeed * (this.control.shiftLeft?.down ? preset.flyBoostMultiplier : 1)

    if (moveX !== 0 || moveY !== 0 || moveZ !== 0) {
      const moveVector = new THREE.Vector3(moveX, moveY, moveZ).normalize().multiplyScalar(speed * delta)
      moveVector.applyEuler(freeCamState.euler)
      freeCamState.targetVelocity.copy(moveVector)
    } else {
      freeCamState.targetVelocity.multiplyScalar(0.9)
    }

    // Smooth velocity
    freeCamState.velocity.lerp(freeCamState.targetVelocity, 0.05)
    camera.position.add(freeCamState.velocity.clone().multiplyScalar(delta))

    // Apply rotation
    camera.rotation.set(freeCamState.euler.x, freeCamState.euler.y, 0)
  },

  updateUI() {
    if (!this.mainUI || !cameras[this.currentCameraIndex]) return

    const camera = this.cameras[this.currentCameraIndex]
    const preset = camera.presetData
    const name = preset.name || `Camera ${this.currentCameraIndex}`

    // Update current camera info
    this.mainUI.currentInfo.value = `Current: ${name} (${this.currentCameraIndex + 1}/${this.cameras.length})`

    // Update feature status
    const features = [
      `🌟 DOF: ${camera.dof.enabled ? 'ON' : 'OFF'}`,
      `✨ Bloom: ${camera.bloom.enabled ? 'ON' : 'OFF'}`,
      `🎭 Vignette: ${camera.vignette.enabled ? 'ON' : 'OFF'}`,
      `🎬 Motion: ${camera.motion.enabled ? 'ON' : 'OFF'}`,
      `🎞️ Film Grain: ${camera.filmGrain.enabled ? 'ON' : 'OFF'}`,
      `🌈 Chromatic: ${camera.chromaticAberration.enabled ? 'ON' : 'OFF'}`
    ]
    this.mainUI.featureStatus.value = features.join(' | ')

    // Update detailed camera information
    this.detailedUI.content.value = `📊 ${name}

📐 Properties:
  FOV: ${preset.fov}°
  Position: [${preset.position.map(n => n.toFixed(1)).join(', ')}]
  Rotation: [${preset.rotation.map(n => (n * 180 / Math.PI).toFixed(0)).join('°, ')}]°

🎯 DOF Settings:
  Enabled: ${camera.dof.enabled ? 'Yes' : 'No'}
  F-Stop: ${camera.dof.fStop || 'N/A'}
  Focus Distance: ${camera.dof.focusDistance || 'N/A'}m
  Focal Length: ${camera.dof.focalLength || 'N/A'}mm

✨ Post-Processing:
  Bloom: ${camera.bloom.intensity || 0}
  Vignette: ${(camera.vignette.darkness || 0) * 100}%
  Film Grain: ${(camera.filmGrain.intensity || 0) * 100}%

🎬 Motion:
  Enabled: ${camera.motion.enabled ? 'Yes' : 'No'}
  Bob: ${camera.motion.bobAmount || 0}
  Sway: ${camera.motion.swayAmount || 0}
  Handheld: ${camera.motion.handheldShake || 0}

🎮 Type: ${preset.freeFlying ? 'Free-Flying' : 'Static'}
📎 Attached: ${preset.attachToRig ? 'Player' : 'World'}
`
  },

  cleanup() {
    // Release captured controls
    if (this.control) {
      Object.keys(this.control).forEach(key => {
        if (this.control[key]?.capture !== undefined) {
          this.control[key].capture = false
        }
      })
    }

    // Clean up UI
    if (this.mainUI) {
      app.remove(this.mainUI)
    }
    if (this.detailedUI) {
      app.remove(this.detailedUI)
    }

    // Clean up cameras
    this.cameras.forEach(camera => {
      if (camera) app.remove(camera)
    })

    console.log('[Camera Demo] Cleanup complete')
  }
})