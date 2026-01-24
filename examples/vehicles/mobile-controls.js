// Mobile Controls System for Vehicle Movement and Camera
// Focused implementation for mobile touch controls only

app.configure([
  {
    key: 'joystickSensitivity',
    type: 'range',
    label: 'Joystick Sensitivity',
    initial: 1.0,
    min: 0.5,
    max: 2.0,
    step: 0.1,
    hint: 'Sensitivity of the virtual joystick for movement control.',
  },
  {
    key: 'cameraPanSpeed',
    type: 'range',
    label: 'Camera Pan Speed',
    initial: 0.4,
    min: 0.1,
    max: 1.0,
    step: 0.05,
    hint: 'Speed of camera rotation when touch panning on right side of screen.',
  },
  {
    key: 'invertYAxis',
    type: 'switch',
    label: 'Invert Y Axis',
    options: [
      { label: 'Normal', value: false },
      { label: 'Inverted', value: true },
    ],
    hint: 'Invert vertical camera movement for touch panning.',
  },
])

// Core mobile control system
const MobileControls = {
  // Input state
  steerInput: 0,
  accelInput: 0,
  handbrakeInput: false,

  // Touch state
  touchPan: null,
  isMobile: false,
  screenWidth: 1000,
  screenHeight: 1000,

  // Configuration
  joystickSensitivity: props.joystickSensitivity || 1.0,
  cameraPanSpeed: props.cameraPanSpeed || 0.4,
  invertYAxis: props.invertYAxis || false,

  // Initialize mobile detection
  init() {
    this.isMobile =
      typeof navigator !== 'undefined' && navigator.userAgent
        ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        : false

    if (!this.isMobile) {
      console.log('[MobileControls] Not running on mobile device')
      return false
    }

    console.log('[MobileControls] Mobile device detected, initializing touch controls')
    return true
  },

  // Bind touch controls with priority handling
  bindControls() {
    if (!this.isMobile) return null

    const control = app.control()
    if (!control) {
      console.warn('[MobileControls] No control system available')
      return null
    }

    // Store screen dimensions
    this.screenWidth = control.screen?.width || window.innerWidth || 1000
    this.screenHeight = control.screen?.height || window.innerHeight || 1000

    console.log('[MobileControls] Binding controls with screen:', this.screenWidth, 'x', this.screenHeight)

    // Store original handlers
    const originalOnTouch = control.options?.onTouch
    const originalOnTouchEnd = control.options?.onTouchEnd

    // Re-bind with touch panning support (priority -1 to run before player controls)
    return world.controls.bind({
      priority: -1,
      onTouch: touch => {
        let consumed = false

        // Call original handler if exists
        if (originalOnTouch) {
          consumed = originalOnTouch(touch) || false
        }

        // Right side of screen = camera look, left side = joystick
        if (!consumed && touch.position.x > this.screenWidth / 2) {
          this.touchPan = touch
          console.log('[MobileControls] Touch pan started on right side')
          return true // Consume the touch event
        }

        return consumed
      },
      onTouchEnd: touch => {
        // Call original handler if exists
        if (originalOnTouchEnd) originalOnTouchEnd(touch)

        if (this.touchPan === touch) {
          this.touchPan = null
          console.log('[MobileControls] Touch pan ended')
        }
      },
    })
  },

  // Process movement input from joystick
  processMovementInput(control) {
    if (!control || !this.isMobile) return

    // Get joystick values with sensitivity scaling
    const stickX = (control.touchStick?.value.x || 0) * this.joystickSensitivity
    const stickZ = (control.touchStick?.value.z || 0) * this.joystickSensitivity
    const isJoystickActive = Math.abs(stickX) > 0.01 || Math.abs(stickZ) > 0.01

    if (isJoystickActive) {
      // Mobile joystick is active - use it for movement
      this.steerInput = -stickX // Inverted for natural feel
      this.accelInput = -stickZ // Inverted for correct forward/back direction
      this.handbrakeInput = control.space?.down || false
    } else {
      // No joystick input - reset values
      this.steerInput = 0
      this.accelInput = 0
      this.handbrakeInput = false
    }
  },

  // Process camera rotation from touch panning
  processCameraInput(control, delta) {
    if (!control || !control.camera || !this.touchPan) return

    const panSpeed = this.cameraPanSpeed * delta
    const yMultiplier = this.invertYAxis ? 1 : -1

    // Apply rotation based on touch delta
    control.camera.rotation.reorder('YXZ')
    control.camera.rotation.y -= this.touchPan.delta.x * panSpeed
    control.camera.rotation.x += this.touchPan.delta.y * panSpeed * yMultiplier

    // Clamp vertical rotation to prevent flipping
    control.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, control.camera.rotation.x))
  },

  // Get current input values
  getInput() {
    return {
      steer: this.steerInput,
      accel: this.accelInput,
      handbrake: this.handbrakeInput,
    }
  },

  // Update configuration from props
  updateConfig() {
    this.joystickSensitivity = props.joystickSensitivity || 1.0
    this.cameraPanSpeed = props.cameraPanSpeed || 0.4
    this.invertYAxis = props.invertYAxis || false
  },

  // Cleanup
  cleanup() {
    this.touchPan = null
    this.steerInput = 0
    this.accelInput = 0
    this.handbrakeInput = false
  },
}

// Initialize mobile controls
const mobileControls = Object.create(MobileControls)(
  // App lifecycle
  {
    init() {
      console.log('[MobileControls] Initializing mobile control system')
      mobileControls.init()
    },

    update(delta) {
      // Skip if not mobile
      if (!mobileControls.isMobile) return

      const control = app.control()
      if (!control) return

      // Process inputs
      mobileControls.processMovementInput(control)
      mobileControls.processCameraInput(control, delta)

      // Update config if changed
      mobileControls.updateConfig()
    },

    cleanup() {
      console.log('[MobileControls] Cleaning up mobile control system')
      mobileControls.cleanup()
    },
  }
)
