/**
 * Camera Control System Example
 *
 * Stable implementation following proven Hyperfy patterns:
 * ✅ Object return format (SES compatible)
 * ✅ Direct console.log usage (proven to work)
 * ✅ Proper client-side isolation
 * ✅ Clean error handling
 * ✅ Console-based feedback only
 */

// Only run on client
if (world.isClient) {
  console.log("🎥 CAMERA CONTROL SYSTEM - Starting implementation...")
  console.log("==============================================")

  // Proper object return format - proven to work in SES
  ({
    init() {
      console.log("✅ Initialize() called - Camera system starting")

      // Get control interface for input handling
      this.control = app.control()
      if (!this.control) {
        console.warn("❌ No control interface available")
        return
      }

      // Keep app active for continuous updates
      app.keepActive = true

      // Store camera instances
      this.cameras = []
      this.currentCameraIndex = 0

      // Capture necessary keys
      this.setupControls()

      // Create camera presets
      this.createCameras()

      // Start update loop
      app.on('update', delta => this.update(delta))

      console.log("✅ Camera Control System initialized!")
      console.log("📋 Controls: 1-4 to switch cameras, H to toggle helpers")
    },

    setupControls() {
      // Capture camera switching keys
      const controlKeys = ['key1', 'key2', 'key3', 'key4', 'keyH']

      controlKeys.forEach(key => {
        if (this.control[key]) {
          this.control[key].capture = true
        }
      })

      console.log("✅ Controls configured")
    },

    createCameras() {
      const cameraConfigs = [
        {
          name: 'Overhead View',
          position: [0, 15, 0],
          rotation: [-Math.PI / 2, 0, 0],
          fov: 50,
          description: 'Top-down surveillance view'
        },
        {
          name: 'Cinematic Angle',
          position: [10, 5, 10],
          rotation: [-0.3, 0.785, 0],
          fov: 50,
          description: 'Dynamic cinematic perspective'
        },
        {
          name: 'Close-up View',
          position: [0, 2, 5],
          rotation: [0, Math.PI, 0],
          fov: 50,
          description: 'Intimate close-up perspective'
        },
        {
          name: 'Wide Angle',
          position: [0, 8, 20],
          rotation: [-0.2, 0, 0],
          fov: 75,
          description: 'Broad landscape view'
        }
      ]

      cameraConfigs.forEach((config, index) => {
        const camera = app.create('camera', {
          name: config.name.toLowerCase().replace(/\s+/g, '-'),
          position: config.position,
          rotation: config.rotation,
          fov: config.fov,
          active: false,
          attachToRig: false,
          isPlayerCamera: false,
          showHelper: false,

          // DOF settings
          dof: {
            enabled: true,
            focusDistance: config.position[2] || 10,
            fStop: 2.8,
            maxBlur: 0.03,
            autofocus: index === 1 // Enable autofocus for cinematic camera
          },

          // Motion settings
          motion: {
            enabled: true,
            bobAmount: 0.001,
            bobSpeed: 0.01,
            swayAmount: 0.0005,
            swaySpeed: 0.005,
            dampingFactor: 0.95
          },

          // Post-processing
          bloom: {
            enabled: index % 2 === 0, // Enable bloom for even cameras
            intensity: 0.4
          },

          vignette: {
            enabled: index % 2 === 1, // Enable vignette for odd cameras
            offset: 0.35,
            darkness: 0.3
          },

          // Tone mapping
          toneMapping: {
            enabled: true,
            mode: 'ACES_FILMIC',
            exposure: 1.0
          }
        })

        // Store config data
        camera.configData = config
        this.cameras.push(camera)
        app.add(camera)

        console.log("✅ Created camera " + index + ": " + config.name)
      })

      // Activate first camera
      if (this.cameras.length > 0) {
        this.switchToCamera(0)
      }

      console.log("✅ Created " + this.cameras.length + " cameras")
    },

    update(delta) {
      if (!this.control) return

      // Handle input
      this.handleInput()
    },

    handleInput() {
      // Camera switching with number keys
      for (let i = 0; i < Math.min(4, this.cameras.length); i++) {
        if (this.control['key' + (i + 1)]?.pressed) {
          this.switchToCamera(i)
        }
      }

      // Toggle camera helpers
      if (this.control.keyH?.pressed) {
        this.toggleHelpers()
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

      const cameraName = this.cameras[index].configData.name
      console.log("🎥 Switched to camera: " + cameraName)
    },

    toggleHelpers() {
      this.cameras.forEach(camera => {
        camera.showHelper = !camera.showHelper
      })

      const status = this.cameras[0].showHelper ? 'visible' : 'hidden'
      console.log("📍 Camera helpers are now " + status)
    },

    cleanup() {
      // Release captured controls
      if (this.control) {
        const controlKeys = ['key1', 'key2', 'key3', 'key4', 'keyH']
        controlKeys.forEach(key => {
          if (this.control[key]?.capture !== undefined) {
            this.control[key].capture = false
          }
        })
      }

      // Clean up cameras
      this.cameras.forEach(camera => {
        if (camera) app.remove(camera)
      })

      console.log("🧹 Camera Control System cleaned up")
    }
  })

} else {
  console.log('Server environment detected - camera functionality not needed on server')
}

// Safe ES module ending - prevents SES parsing issues
;;null