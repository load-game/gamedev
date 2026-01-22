import { isNumber } from 'lodash-es'
import { System } from './System'
import { Raycaster, Vector2, Vector3, Quaternion } from 'three'
import { DOFController } from './DOFController'

/**
 * Client Camera Controls System
 *
 * Provides programmatic control over camera settings including:
 * - Depth of Field (DOF) settings
 * - Focal length
 * - Helper visibility
 */
export class ClientCameraControls extends System {
  constructor(world) {
    super(world)
    this.raycaster = new Raycaster()
    this.raycaster.near = 0.1
    this.raycaster.far = 1000
    this.screenCenter = new Vector2(0, 0) // Center of screen

    // Master control
    this.enabled = true // Camera controls ON by default for ADS to work

    // Create DOF controller
    this.dofController = new DOFController(world)

    // Zoom control
    this.zoomSpeed = 5

    // Pinch-to-zoom state

    // Dynamic DOF compensation
    this.dynamicDOF = true // Auto-adjust DOF based on zoom
    this.lastCameraZoom = null

    // ADS-style zoom
    this.baseFocalLength = 24 // Will be set properly in init()
    this.currentFocalLength = 24
    this.targetFocalLength = 24

    // How strongly focus distance grows with camera zoom-out (legacy scalar)
    this.zoomDistanceMultiplier = 3
    this.anchorFocusToPlayer = true
    // Blend player distance with stop-based focus as we zoom out (0..1)
    this.playerFocusBlendMax = 0.5 // 50% blend for better player focus in third-person
    this.playerFocusBlendPow = 1.2

    // Track observed zoom range so we can normalize stops to user's device
    // Seed with a sensible span so defaults work without manual calibration
    this.zoomObservedMin = 0
    this.zoomObservedMax = 12

    // Four-stop profile across normalized zoom t in [0..1]
    this.zoomStopsNormalized = true
    this.zoomStops = [
      { t: 0.0, focus: 6, range: 2.0, bokeh: 1.0 },
      { t: 0.318, focus: 30, range: 80.0, bokeh: 0.5 },
      { t: 0.618, focus: 60, range: 160.0, bokeh: 0.4 },
      { t: 1.0, focus: 120, range: 240.0, bokeh: 0.35 },
    ]

    // Focus range shaping (shallow when close, deeper when far)
    this.focusRangeCloseFactor = 0.25
    this.focusRangeFarFactor = 3.0

    // One-click autofocus using right mouse (outside build mode)

    // Raycast throttling for performance (8ms = ~120fps)
    this.lastRaycastTime = 0
    this.raycastThrottleMs = 8
  }

  init() {
    // Use the exact same settings as the reset command
    // These are the defaults that make the camera look correct
    this.baseFocalLength = 24 // Wide landscape preset
    this.currentFocalLength = 24
    this.targetFocalLength = 24

    // Set all the defaults
    this.enabled = true // Enable camera controls

    // Autofocus defaults
    this.world.prefs.setFocusSmoothing(true)
    console.log('[DOF] Focus smoothing set to:', true)
    this.dofController.focusSpeed = 0.08 // Much slower for natural, imperceptible focus transitions
    this.dofController.setFocusDistance(10)

    // Other defaults
    this.zoomSpeed = 5

    // Apply settings to prefs
    if (this.world.prefs) {
      // Apply conservative defaults for DOF blur
      if (!this.world.prefs.dofMaxBlur) {
        this.world.prefs.setDOFMaxBlur(0.001)  // Ultra minimal blur
      }
      if (!this.world.prefs.dofFStop) {
        this.world.prefs.setDOFFStop(16.0)  // Ultra narrow aperture
      }
      if (!this.world.prefs.dofFocusRange) {
        this.world.prefs.setDOFFocusRange(5)  // Narrow range
      }

      // Apply the focal length
      this.applyFocalLength(this.world.prefs.focalLength || 24)
    }

    // Bind controls for mouse input
    if (this.world.controls) {
      this.control = this.world.controls.bind({
        priority: 1000, // High priority to capture mouse
      })
    }

    // Set up admin console commands if in browser
    if (typeof window !== 'undefined') {
      this.setupConsoleCommands()
    }
  }

  start() {
    // Listen for pref changes
    this.world.prefs.on('change', this.onPrefsChange)

    // Enable dynamic DOF when using the default/player camera
    this.world.on('camera-changed', cameraNode => {
      const isPlayerCam = !!cameraNode?.isPlayerCamera
      this.dynamicDOF = isPlayerCam || this.dynamicDOF
      if (isPlayerCam && this.world.prefs.dofEnabled) {
        // Seed focus immediately based on current zoom level
        const z = Math.abs(this.world.camera?.position?.z || 0)
        const baseFocus = 5 + z * 1.5
        this.dofController.setFocusDistance(baseFocus)
        this.setDOFFocusDistance(baseFocus)
      }
    })

    // Initialize dynamic DOF - always enabled for player camera
    this.dynamicDOF = true
  }

  resetCamera() {
    // Reset focal length to base
    this.baseFocalLength = 24
    this.currentFocalLength = this.baseFocalLength
    this.targetFocalLength = this.baseFocalLength

    // Reset DOF settings
    if (this.world.prefs) {
      this.world.prefs.setFocalLength(this.baseFocalLength)
    }

    // Reset ADS state

    // Reset control states
    if (this.control?.mouseRight) {
      this.control.mouseRight.capture = false
    }
  }

  destroy() {
    this.world.prefs.off('change', this.onPrefsChange)
    this.control?.release()
    this.control = null
    this.dofController?.destroy()
    this.dofController = null
  }

  onPrefsChange = changes => {
    if (changes.focusSpeed) this.dofController.focusSpeed = changes.focusSpeed.value
    if (changes.zoomSpeed) this.zoomSpeed = changes.zoomSpeed.value

    // Apply focal length changes from apps
    if (changes.focalLength) {
      this.applyFocalLength(changes.focalLength.value)
    }
  }

  update(_delta) {
    // Throttle raycasts for performance (only run every 8ms = ~120fps)
    const now = Date.now()
    const shouldRaycast = now - this.lastRaycastTime >= this.raycastThrottleMs

    if (shouldRaycast) {
      this.lastRaycastTime = now
    }

    // ADS zoom removed - weapons handle their own zoom

    // Smooth focal length transition
    if (Math.abs(this.targetFocalLength - this.currentFocalLength) > 0.1) {
      this.currentFocalLength += (this.targetFocalLength - this.currentFocalLength) * this.dofController.focusSpeed
      this.setFocalLength(this.currentFocalLength)
    } else if (this.currentFocalLength !== this.targetFocalLength) {
      // Snap to target if very close
      this.currentFocalLength = this.targetFocalLength
      this.setFocalLength(this.currentFocalLength)
    }

    // Removed scroll zoom to avoid conflicting with native camera controls
    // Use ADS zoom (right-click) instead for focal length adjustment

    // Dynamic DOF compensation based on camera zoom (mouse scroll distance)
    if (this.enabled && this.dynamicDOF && this.world.camera) {
      // Calculate focus based on camera distance from player (zoom level)
      // In first person (z=0), focus close. In third person, focus further
      const cameraZoom = Math.abs(this.world.camera.position.z)
      const camFar = this.world.camera.far || 1200

      // Track zoom change to react instantly when user scroll-zooms
      const prevZoom = this.lastCameraZoom
      const zoomDelta = prevZoom == null ? 0 : Math.abs(cameraZoom - prevZoom)
      this.lastCameraZoom = cameraZoom

      // Update observed zoom range
      this.zoomObservedMin = this.zoomObservedMin === null ? cameraZoom : Math.min(this.zoomObservedMin, cameraZoom)
      this.zoomObservedMax = this.zoomObservedMax === null ? cameraZoom : Math.max(this.zoomObservedMax, cameraZoom)
      const zoomSpan = Math.max(1e-6, this.zoomObservedMax - this.zoomObservedMin)
      const tZoom = Math.min(1, Math.max(0, (cameraZoom - this.zoomObservedMin) / zoomSpan))

      // Evaluate four-stop zoom profile (piecewise linear) in normalized space
      const stops =
        this.zoomStops && this.zoomStops.length >= 2
          ? this.zoomStops
          : [
              { t: 0, focus: 3, range: 1.0, bokeh: 1.0 },
              { t: 1, focus: Math.min(60, camFar * 0.5), range: Math.min(18, camFar * 0.4), bokeh: 0.5 },
            ]
      let s0 = stops[0]
      let s1 = stops[stops.length - 1]
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i]
        const b = stops[i + 1]
        if (tZoom >= a.t && tZoom <= b.t) {
          s0 = a
          s1 = b
          break
        }
        if (tZoom < stops[0].t) {
          s0 = stops[0]
          s1 = stops[1]
          break
        }
        if (tZoom > stops[stops.length - 2].t) {
          s0 = stops[stops.length - 2]
          s1 = stops[stops.length - 1]
        }
      }
      const denom = Math.max(1e-6, s1.t - s0.t)
      const t = Math.min(1, Math.max(0, (tZoom - s0.t) / denom))
      const lerp = (a, b, u) => a + (b - a) * u
      const baseFocus = Math.min(camFar * 0.5, lerp(s0.focus, s1.focus, t))
      const baseRange = Math.min(camFar * 0.45, lerp(s0.range, s1.range, t))
      const baseBokeh = Math.max(0.2, Math.min(2.0, lerp(s0.bokeh, s1.bokeh, t)))

      // Pass zoom-based values to DOFController as fallbacks
      // DOFController will handle raycasting and blend with these values
      this.dofController.setFallbackFocusDistance(baseFocus)

      // Don't override user DOF preferences - let them control blur intensity
      // The zoom-based calculations are only for focus distance, not blur amount

      // When the user changes zoom, snap focus to prevent temporary blur
      if (zoomDelta > 0.05) {
        const focus = this.dofController.getFocusDistance()
        // Snap to current focus as new fallback
        this.dofController.setFallbackFocusDistance(focus)
        // Also set as target to prevent smoothing lag
        this.dofController.setFocusDistance(focus)
      }
    }

    // Update DOF using controller (handles raycasting and smoothing)
    this.dofController.update(_delta)
  }

  // Depth of Field Controls
  enableDOF() {
    this.world.prefs.setDOFEnabled(true)
  }

  disableDOF() {
    this.world.prefs.setDOFEnabled(false)
  }

  setDOFFocusDistance(distance) {
    if (!isNumber(distance) || distance < 0) {
      console.warn('DOF focus distance must be a positive number')
      return
    }
    this.world.prefs.setDOFFocusDistance(distance)
    this.dofController.setFocusDistance(distance)
  }

  setDOFFocusRange(range) {
    if (!isNumber(range) || range < 0) {
      console.warn('DOF focus range must be a positive number')
      return
    }
    this.world.prefs.setDOFFocusRange(range)
    // Note: DOF controller will handle uniform updates
  }

  setDOFBokehScale(scale) {
    if (!isNumber(scale) || scale < 0) {
      console.warn('DOF bokeh scale must be a positive number')
      return
    }
    this.world.prefs.setDOFBokehScale(scale)
    // Note: DOF controller will handle uniform updates
  }

  setDOFFStop(fstop) {
    if (!isNumber(fstop) || fstop < 0.1 || fstop > 64) {
      console.warn('f-stop must be a number between 0.1 and 64')
      return
    }
    this.world.prefs.setDOFFStop(fstop)
  }

  // Focal Length Control
  setFocalLength(focalLength) {
    if (!isNumber(focalLength) || focalLength < 1 || focalLength > 200) {
      console.warn('Focal length must be a number between 1 and 200')
      return
    }
    this.world.prefs.setFocalLength(focalLength)
    this.applyFocalLength(focalLength)
  }

  applyFocalLength(focalLength) {
    if (this.world.camera) {
      // Convert focal length to FOV
      // Using standard 35mm film equivalent calculation
      const sensorHeight = 24 // 35mm sensor height in mm
      const fov = 2 * Math.atan(sensorHeight / (2 * focalLength)) * (180 / Math.PI)
      this.world.camera.fov = fov

      // Dynamically adjust far plane based on focal length to optimize performance
      // Wide angle (low focal length) = see far, Telephoto (high focal length) = see less far
      const baseFar = 1200 // Default far plane
      let dynamicFar

      if (focalLength <= 50) {
        // Wide to normal: full range
        dynamicFar = baseFar
      } else if (focalLength <= 85) {
        // Portrait range: slight reduction
        dynamicFar = baseFar * 0.95 // 1140 - keep skybox visible
      } else if (focalLength <= 135) {
        // Telephoto: moderate reduction
        dynamicFar = baseFar * 0.85 // 1020 - still see skybox
      } else {
        // Super telephoto: more reduction but keep skybox
        dynamicFar = baseFar * 0.75 // 900 - minimum for skybox
      }

      this.world.camera.far = dynamicFar
      this.world.camera.updateProjectionMatrix()
    }
  }

  getFocalLength() {
    return this.world.prefs.focalLength
  }

  // Helper Controls
  showHelpers() {
    this.world.prefs.setShowHelpers(true)
  }

  hideHelpers() {
    this.world.prefs.setShowHelpers(false)
  }

  toggleHelpers() {
    this.world.prefs.setShowHelpers(!this.world.prefs.showHelpers)
  }

  // Get current settings
  getCameraSettings() {
    return {
      dof: {
        enabled: this.world.prefs.dofEnabled,
        focusDistance: this.world.prefs.dofFocusDistance,
        focusRange: this.world.prefs.dofFocusRange,
        bokehScale: this.world.prefs.dofBokehScale,
      },
      focalLength: this.world.prefs.focalLength,
      fov: this.world.camera.fov,
      showHelpers: this.world.prefs.showHelpers,
    }
  }

  // Raycast from camera center to get focus distance (delegates to DOF controller)
  raycastFocusDistance() {
    return this.dofController._getRaycastFocusDistance()
  }

  // Get focus distance to player
  getFocusDistanceToPlayer() {
    if (!this.world.entities?.player || !this.world.camera) {
      return null
    }

    const player = this.world.entities.player

    // Try to get player head position for more accurate focus
    let playerPos
    if (player.entity?.position) {
      playerPos = player.entity.position.clone()
      // Add approximate head height offset
      playerPos.y += 1.6 // Standard eye height offset
    } else {
      return null
    }

    // Get actual camera world position (accounting for rig)
    const cameraWorldPos = new THREE.Vector3()
    this.world.camera.getWorldPosition(cameraWorldPos)

    // Calculate distance from camera to player head
    return cameraWorldPos.distanceTo(playerPos)
  }

  // Auto-focus on player

  
  // Master enable/disable
  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
    // Reset autofocus when disabling
  }

  setEnabled(enabled) {
    if (enabled) {
      this.enable()
    } else {
      this.disable()
    }
  }

  // Enable/disable autofocus modes
  setReticleAutofocus(enabled) {
    this.world.prefs.setReticleAutofocus(enabled)
    if (!enabled) {
    }
  }

  setPlayerAutofocus(enabled) {
    this.world.prefs.setPlayerAutofocus(enabled)
  }

  setFocusSmoothing(enabled) {
    this.world.prefs.setFocusSmoothing(enabled)
  }

  setFocusSpeed(speed) {
    console.log('[DOF] Focus speed set to:', speed)
    this.dofController.setFocusSpeed(speed)
    this.world.prefs.setFocusSpeed(speed)
  }

  setReticleFocusDelay(delay) {}

  // Zoom control
  setZoomSpeed(speed) {
    this.zoomSpeed = Math.max(1, Math.min(50, speed))
    this.world.prefs.setZoomSpeed(this.zoomSpeed)
  }

  setScrollZoomEnabled(enabled) {
    this.enableScrollZoom = enabled
    this.world.prefs.setScrollZoomEnabled(enabled)
  }

  // Preset camera settings
  applyPreset(presetName) {
    const presets = {
      portrait: {
        focalLength: 85,
        dofEnabled: true,
        dofFocusDistance: 5,
        dofFocusRange: 2,
        dofBokehScale: 1.5,
      },
      landscape: {
        focalLength: 24,
        dofEnabled: false,
        dofFocusDistance: 20,
        dofFocusRange: 10,
        dofBokehScale: 0.5,
      },
      macro: {
        focalLength: 100,
        dofEnabled: true,
        dofFocusDistance: 1,
        dofFocusRange: 0.5,
        dofBokehScale: 2,
      },
      standard: {
        focalLength: 50,
        dofEnabled: false,
        dofFocusDistance: 10,
        dofFocusRange: 5,
        dofBokehScale: 0.5,
      },
    }

    const preset = presets[presetName]
    if (!preset) {
      console.warn(`Unknown camera preset: ${presetName}. Available presets: ${Object.keys(presets).join(', ')}`)
      return
    }

    this.setFocalLength(preset.focalLength)
    this.world.prefs.setDOFEnabled(preset.dofEnabled)
    this.setDOFFocusDistance(preset.dofFocusDistance)
    this.setDOFFocusRange(preset.dofFocusRange)
    this.setDOFBokehScale(preset.dofBokehScale)
  }

  // Check if current player is admin
  isPlayerAdmin() {
    const player = this.world.entities?.player
    return player && player.isAdmin && player.isAdmin()
  }

  // Check if current player is builder
  isPlayerBuilder() {
    const player = this.world.entities?.player
    return player && player.isBuilder && player.isBuilder()
  }

  // Setup console commands for admins
  setupConsoleCommands() {
    window.cam = {
      // Enable/disable master control
      enable: () => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return false
        }
        this.enable()
        return true
      },

      disable: () => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return false
        }
        this.disable()
        return true
      },

      // DOF controls
      dof: {
        enable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.enableDOF()
          return true
        },

        disable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.disableDOF()
          return true
        },

        setFocus: distance => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setDOFFocusDistance(distance)
          return true
        },

        setRange: range => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setDOFFocusRange(range)
          return true
        },

        setBokeh: scale => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setDOFBokehScale(scale)
          return true
        },

        setFStop: fstop => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setDOFFStop(fstop)
          // console.log(`[DOF] f-stop set to ${fstop}`)
          return true
        },

        performance: {
          get: () => {
            if (!this.isPlayerAdmin()) {
              console.warn('Camera controls are admin-only')
              return false
            }
            return {
              lastRaycastTime: this.dofController.lastRaycastTime,
              raycastInterval: this.dofController.raycastInterval,
              frameSkipInterval: this.dofController.frameSkipInterval,
            }
          },

          setFrameSkip: interval => {
            if (!this.isPlayerAdmin()) {
              console.warn('Camera controls are admin-only')
              return false
            }
            this.dofController.frameSkipInterval = Math.max(1, Math.floor(interval))
            return true
          },
        },
      },

      // Focal length control
      setFocalLength: length => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return false
        }
        this.enabled = true
        this.setFocalLength(length)
        return true
      },

      // Autofocus controls
      autofocus: {
        reticle: enable => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setReticleAutofocus(enable)
          return true
        },

        player: enable => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setPlayerAutofocus(enable)
          return true
        },

        dynamic: enable => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.dynamicDOF = enable
          if (enable) {
            // Disable other autofocus modes when dynamic is enabled
          }
          return true
        },

        smoothing: enable => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setFocusSmoothing(enable)
          return true
        },

        speed: speed => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setFocusSpeed(speed)
          return true
        },
      },

      // Zoom control
      zoom: {
        enable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          this.setScrollZoomEnabled(true)
          return true
        },

        disable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.setScrollZoomEnabled(false)
          return true
        },

        setSpeed: speed => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.setZoomSpeed(speed)
          console.log(`Zoom speed set to ${speed}`)
          return true
        },
      },

      // ADS (Aim Down Sights) style zoom
      ads: {
        enable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.enabled = true
          return true
        },

        disable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          return true
        },

        setZoom: focalLength => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          return true
        },

        setBokeh: multiplier => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          console.log(`ADS bokeh multiplier set to ${multiplier}x`)
          return true
        },

        setSpeed: speed => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          console.log(`ADS transition speed set to ${speed}`)
          return true
        },
      },

      // Dynamic DOF tuning
      dynamicDOF: {
        setZoomFactor: multiplier => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          const value = Number(multiplier)
          if (!isFinite(value) || value <= 0) {
            console.warn('Zoom factor must be a positive number')
            return false
          }
          this.zoomDistanceMultiplier = value
          return true
        },
        setStops: stops => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          if (!Array.isArray(stops) || stops.length < 2) {
            console.warn('Provide an array of at least 2 stops: [{ t:0..1, focus, range, bokeh }, ...]')
            return false
          }
          const clamped = stops.map(s => ({
            t: Math.max(0, Math.min(1, Number(s.t))),
            focus: Math.max(0.01, Number(s.focus)),
            range: Math.max(0.01, Number(s.range)),
            bokeh: Math.max(0.1, Math.min(3.0, Number(s.bokeh))),
          }))
          clamped.sort((a, b) => a.t - b.t)
          this.zoomStops = clamped
          return true
        },
        resetStops: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.zoomStops = [
            { t: 0.0, focus: 3, range: 0.8, bokeh: 1.0 },
            { t: 0.33, focus: 12, range: 3.0, bokeh: 0.8 },
            { t: 0.66, focus: 28, range: 9.0, bokeh: 0.6 },
            { t: 1.0, focus: 60, range: 18.0, bokeh: 0.45 },
          ]
          return true
        },
        resetObserved: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.zoomObservedMin = null
          this.zoomObservedMax = null
          return true
        },
        setPlayerBlend: (max, pow = 1.0) => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          const m = Number(max)
          const p = Number(pow)
          if (!isFinite(m) || m < 0 || m > 1) {
            console.warn('max must be in [0..1]')
            return false
          }
          if (!isFinite(p) || p <= 0) {
            console.warn('pow must be > 0')
            return false
          }
          this.playerFocusBlendMax = m
          this.playerFocusBlendPow = p
          return true
        },
        anchorPlayer: enable => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.anchorFocusToPlayer = !!enable
          return true
        },
      },

      // Head bone raycast control
      headBone: {
        enable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.dofController.useHeadBoneRaycast = true
          console.log('Head bone raycast enabled')
          return true
        },

        disable: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          this.dofController.useHeadBoneRaycast = false
          console.log('Head bone raycast disabled')
          return true
        },

        debug: () => {
          if (!this.isPlayerAdmin()) {
            console.warn('Camera controls are admin-only')
            return false
          }
          const headFocus = this.dofController._raycastFromPlayerHead()
          const reticleFocus = (() => {
            if (!this.world.camera || !this.world.stage?.viewport) return null
            try {
              const hits = this.world.stage.raycastReticle()
              if (hits && hits.length > 0) {
                const validHits = hits.filter(hit => hit.distance > 0.5)
                if (validHits.length > 0) return validHits[0].distance
              }
            } catch (err) {}
            return null
          })()

          console.log(`Head bone focus: ${headFocus}m`)
          console.log(`Reticle focus: ${reticleFocus}m`)
          console.log(`Using head bone: ${this.dofController.useHeadBoneRaycast}`)
          console.log(`Player avatar available: ${!!this.world.entities.player?.avatar}`)
          console.log(`Last raycast performance: ${this.dofController.lastRaycastPerformance}ms`)
          return true
        },
      },

      // Presets
      preset: name => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return false
        }
        this.enabled = true
        this.applyPreset(name)
        return true
      },

      // Reset to default Hyperfy camera settings
      reset: () => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return false
        }
        console.log('Resetting camera to wide landscape preset...')

        // Use the new resetCamera method
        this.resetCamera()

        // Re-enable ADS after reset

        // Apply the reset
        this.applyFocalLength(this.baseFocalLength)

        // Reset autofocus settings
        this.dynamicDOF = false
        this.world.prefs.setFocusSmoothing(true)
        this.dofController.setFocusSpeed(0.1)

        // Save reset state
        this.world.prefs.persist()

        console.log('- FOV: 73° (24mm focal length)')
        console.log('- DOF: Disabled')
        console.log('- All autofocus: Disabled')
        return true
      },

      // Get current settings
      settings: () => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return null
        }
        const settings = this.getCameraSettings()
        console.log('Current Focus Distance:', this.dofController.getFocusDistance())
        console.log('Target Focus Distance:', this.dofController.targetFocusDistance)
        return settings
      },

      // Toggle debug mode
      debug: enable => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return false
        }
        this.dofController.setDebug(enable !== undefined ? enable : !this.dofController.debugDOF)
        return this.dofController.debugDOF
      },

      // Help
      help: () => {
        if (!this.isPlayerAdmin()) {
          console.warn('Camera controls are admin-only')
          return
        }
        console.log(`
Camera Controls (Admin Only):
=========================
cam.enable() - Enable camera controls
cam.disable() - Disable camera controls

DOF Controls:
cam.dof.enable() - Enable depth of field
cam.dof.disable() - Disable depth of field
cam.dof.setFocus(distance) - Set focus distance (e.g., 10)
cam.dof.setRange(range) - Set focus range (e.g., 5)
cam.dof.setBokeh(scale) - Set bokeh scale (e.g., 2)
cam.dof.setFStop(fstop) - Set f-stop aperture (e.g., 2.8 for strong blur, 8 for subtle)

Performance:
cam.dof.performance.get() - Get performance metrics

cam.dof.performance.setFrameSkip(interval) - Set raycast frequency (1=every frame, 2=every 2nd, etc.)

Focal Length:
cam.setFocalLength(mm) - Set focal length (e.g., 50)

Autofocus:
cam.autofocus.reticle(true/false) - Enable/disable reticle autofocus
cam.autofocus.player(true/false) - Enable/disable player autofocus
cam.autofocus.dynamic(true/false) - Enable/disable dynamic DOF (auto-adjusts with zoom)
cam.autofocus.smoothing(true/false) - Enable/disable focus smoothing
cam.autofocus.speed(0.1) - Set focus transition speed (0.01-1)

 Dynamic DOF (stops):
 cam.dynamicDOF.setZoomFactor(3) - Overall focus growth with zoom
 cam.dynamicDOF.setStops([{t,focus,range,bokeh}, ...]) - Override 4-stop curve (t in 0..1)
 cam.dynamicDOF.resetStops() - Restore default stops
 cam.dynamicDOF.resetObserved() - Relearn min/max zoom span
 cam.dynamicDOF.setPlayerBlend(max, pow) - Blend player→stops with zoom (0..1, >0)
 cam.dynamicDOF.anchorPlayer(true/false) - Anchor focus to player distance

Zoom:
cam.zoom.enable() - Enable scroll wheel zoom
cam.zoom.disable() - Disable scroll wheel zoom
cam.zoom.setSpeed(5) - Set zoom speed (1-50)

ADS Zoom (Right-Click):
cam.ads.enable() - Enable right-click zoom
cam.ads.disable() - Disable right-click zoom
cam.ads.setZoom(100) - Set zoom focal length (50-200mm)
cam.ads.setBokeh(2.5) - Set bokeh multiplier when zoomed
cam.ads.setSpeed(0.3) - Set zoom transition speed

Presets:
cam.preset('portrait') - Apply portrait preset
cam.preset('landscape') - Apply landscape preset
cam.preset('macro') - Apply macro preset
cam.preset('standard') - Apply standard preset

Head Bone Raycast:
cam.headBone.enable() - Enable head bone raycast (default: ON)
cam.headBone.disable() - Disable head bone raycast (fallback to reticle)
cam.headBone.debug() - Show current focus sources and performance

Info:
cam.settings() - Show current camera settings
cam.reset() - Reset to default Hyperfy camera
cam.help() - Show this help message
        `)
      },
    }
  }
}
