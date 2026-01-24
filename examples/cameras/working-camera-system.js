/**
 * Working Camera Control System
 * 
 * A clean, working camera control system using the new node camera system
 * This should work without toPxVec3 errors and provide smooth camera switching
 */

console.log('🎥 Working Camera Control System - Starting...')

// Global variables
let cameras = {}
let currentCameraIndex = 0
let control = null
let initialized = false
const cameraSystem = null

// Camera presets - simple and working
const CAMERA_PRESETS = [
  {
    name: 'Third Person',
    position: [0, 2, 5],
    rotation: [-0.2, 0, 0],
    fov: 73,
    description: 'Classic third person view'
  },
  {
    name: 'First Person',
    position: [0, 1.6, 0],
    rotation: [0, 0, 0],
    fov: 80,
    description: 'First person view'
  },
  {
    name: 'Side View',
    position: [5, 2, 0],
    rotation: [0, -1.57, 0],
    fov: 73,
    description: 'Side view of player'
  },
  {
    name: 'Top Down',
    position: [0, 10, 2],
    rotation: [-1.57, 0, 0],
    fov: 73,
    description: 'Top down view'
  },
  {
    name: 'Front View',
    position: [0, 2, -5],
    rotation: [-0.2, 3.14, 0],
    fov: 73,
    description: 'Front view of player'
  }
]

if (world.isClient) {
  console.log('✅ Running on client side')

  // Keep app active
  app.keepActive = true

  app.on('update', (delta) => {
    if (!initialized) {
      initializeCameraSystem()
      return
    }

    // Handle camera controls
    handleCameraControls()
  })

  function initializeCameraSystem() {
    try {
      console.log('[Camera] Initializing camera system...')

      // Get control interface
      control = app.control()
      if (!control) {
        console.warn('[Camera] No control interface available')
        return
      }

      // Capture keys for camera control
      setupCameraControls()

      // Create cameras
      createCameras()

      // Set first camera as active
      if (cameras[0]) {
        activateCamera(cameras[0])
      }

      initialized = true
      console.log('[Camera] Camera system initialized successfully!')

      // Print available cameras
      console.log('🎥 Available Cameras:')
      CAMERA_PRESETS.forEach((preset, index) => {
        console.log(`  ${index + 1}: ${preset.name} - ${preset.description}`)
      })

      console.log('')
      console.log('🎮 Controls:')
      console.log('  1-5: Switch camera presets')
      console.log('  [: Previous camera, ]: Next camera')
      console.log('  R: Reset to default camera')
      console.log('')
      console.log('🎯 Active Camera:', cameras[currentCameraIndex]?.preset?.name || 'none')

    } catch (error) {
      console.error('[Camera] Failed to initialize camera system:', error)
    }
  }

  function createCameras() {
    console.log('[Camera] Creating cameras...')

    CAMERA_PRESETS.forEach((preset, index) => {
      try {
        const camera = app.create('camera', {
          name: `camera-${index}`,
          position: preset.position,
          rotation: preset.rotation,
          fov: preset.fov,
          active: false,
          showHelper: true,
          attachToRig: false, // World space cameras
          isPlayerCamera: false
        })

        if (camera) {
          camera.preset = preset
          camera.index = index
          cameras[index] = camera
          app.add(camera)
          console.log(`[Camera] Created camera: ${preset.name}`)
        } else {
          console.warn(`[Camera] Failed to create camera: ${preset.name}`)
        }
      } catch (error) {
        console.error(`[Camera] Error creating camera ${preset.name}:`, error)
      }
    })
  }

  function setupCameraControls() {
    if (!control) return

    // Capture number keys for camera switching (digit1..digit5)
    if (control.digit1) control.digit1.capture = true
    if (control.digit2) control.digit2.capture = true
    if (control.digit3) control.digit3.capture = true
    if (control.digit4) control.digit4.capture = true
    if (control.digit5) control.digit5.capture = true
    if (control.bracketLeft) control.bracketLeft.capture = true
    if (control.bracketRight) control.bracketRight.capture = true
    if (control.keyR) control.keyR.capture = true
  }

  function handleCameraControls() {
    if (!control) return

    // Number keys: Switch to specific camera
    if (control.digit1?.pressed) {
      switchToCamera(0)
    }
    if (control.digit2?.pressed) {
      switchToCamera(1)
    }
    if (control.digit3?.pressed) {
      switchToCamera(2)
    }
    if (control.digit4?.pressed) {
      switchToCamera(3)
    }
    if (control.digit5?.pressed) {
      switchToCamera(4)
    }

    // Cycle cameras with [ and ]
    if (control.bracketLeft?.pressed) {
      cycleCameras(true)
    }
    if (control.bracketRight?.pressed) {
      cycleCameras(false)
    }

    // R: Reset to default camera
    if (control.keyR?.pressed) {
      resetToDefaultCamera()
    }
  }

  function switchToCamera(index) {
    if (cameras[index]) {
      activateCamera(cameras[index])
      currentCameraIndex = index
      console.log(`[Camera] Switched to: ${CAMERA_PRESETS[index].name}`)
    } else {
      console.warn(`[Camera] Camera ${index} not found`)
    }
  }

  function cycleCameras(reverse = false) {
    const cameraCount = Object.keys(cameras).length
    if (cameraCount === 0) return

    if (reverse) {
      currentCameraIndex = currentCameraIndex <= 0 ? cameraCount - 1 : currentCameraIndex - 1
    } else {
      currentCameraIndex = currentCameraIndex >= cameraCount - 1 ? 0 : currentCameraIndex + 1
    }

    const camera = cameras[currentCameraIndex]
    if (camera) {
      activateCamera(camera)
      console.log(`[Camera] Cycled to: ${camera.preset?.name || 'unknown'}`)
    }
  }

  function activateCamera(camera) {
    try {
      if (world.cameraManager) {
        // Use CameraManager for proper camera switching
        world.cameraManager.setActiveCamera(camera)
        console.log(`[Camera] Activated: ${camera.preset?.name || 'unknown'} via CameraManager`)
      } else {
        // Fallback: activate directly
        camera.active = true
        console.log(`[Camera] Activated: ${camera.preset?.name || 'unknown'} directly`)
      }
    } catch (error) {
      console.error('[Camera] Error activating camera:', error)
    }
  }

  function resetToDefaultCamera() {
    try {
      if (world.activateDefaultCamera) {
        world.activateDefaultCamera()
        console.log('[Camera] Reset to default camera')
      } else {
        console.warn('[Camera] No default camera reset function available')
      }
    } catch (error) {
      console.error('[Camera] Error resetting camera:', error)
    }
  }

  // Configuration UI
  app.configure([
    {
      type: 'text',
      key: 'defaultCamera',
      label: 'Default Camera',
      initial: '0',
      options: CAMERA_PRESETS.map((preset, index) => ({
        value: index.toString(),
        label: preset.name
      }))
    },
    {
      type: 'switch',
      key: 'showHelpers',
      label: 'Show Camera Helpers',
      initial: true
    },
    {
      type: 'number',
      key: 'cameraFov',
      label: 'Camera FOV',
      initial: 73,
      min: 30,
      max: 120,
      step: 1
    }
  ])

  // Handle configuration changes
  app.on('update', () => {
    // Update helper visibility
    Object.values(cameras).forEach(camera => {
      if (camera.showHelper !== undefined) {
        camera.showHelper = app.config.showHelpers
      }
    })

    // Update FOV for active camera
    const activeCamera = world.cameraManager?.activeCamera
    if (activeCamera && app.config.cameraFov) {
      activeCamera.fov = app.config.cameraFov
    }
  })

  // Cleanup
  app.on('cleanup', () => {
    console.log('[Camera] Cleaning up camera system...')
    cameras = {}
    currentCameraIndex = 0
    initialized = false
    resetToDefaultCamera()
  })

  console.log('[Camera] Working camera control system loaded')
} else {
  console.log('❌ Not running on client side, skipping camera system')
}