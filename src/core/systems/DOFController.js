import * as THREE from '../extras/three'
import { Raycaster, Vector3, Quaternion, Matrix4 } from '../extras/three'

/**
 * Dedicated DOF (Depth of Field) Controller
 *
 * Manages all DOF-related functionality:
 * - Focus distance calculation via raycast
 * - Smooth focus transitions
 * - Hysteresis to prevent jumping
 * - Far plane filtering
 * - Uniform updates through EffectRegistry
 */

export class DOFController {
  constructor(world) {
    this.world = world

    // Focus state
    this.currentFocusDistance = 5  // Start closer for typical first-person view
    this.targetFocusDistance = 5
    this.focusSpeed = 3.0  // Much faster for responsive focus changes
    this.focusHysteresis = 0.1  // Lower threshold for visible focus changes

    // Raycast state
    this.useHeadBoneRaycast = true
    this.lastRaycastPerformance = 0
    this.debugDOF = false

    // Performance optimization
    this.lastRaycastTime = 0
    this.raycastInterval = 16  // Raycast every ~16ms (60fps), increase for better performance
    this.frameSkipCounter = 0
    this.frameSkipInterval = 1  // Raycast every N frames (1=no skip, 2=every other frame, etc.)

    // Fallback focus distance (from zoom-based calculation)
    this.fallbackFocusDistance = 10

    // Raycaster for focus detection
    this.raycaster = new Raycaster()

    // Vectors for raycasting
    this.v1 = new Vector3()
    this.v2 = new Vector3()
    this.v3 = new Vector3()
    this.q1 = new Quaternion()
  }

  /**
   * Update DOF focus (called each frame)
   */
  update(delta) {
    if (!this.world.prefs?.dofEnabled) return
    if (!this.world.camera) return

    // Performance: Skip frames to reduce raycast frequency
    this.frameSkipCounter++
    if (this.frameSkipCounter >= this.frameSkipInterval) {
      this.frameSkipCounter = 0

      // Update camera position/rotation for accurate raycasting
      if (this.world.camera.parent) {
        this.world.camera.updateMatrixWorld()
      }

      // Calculate target focus distance
      this._updateTargetFocusDistance()

      // Instant focus - no smoothing for responsive autofocus
      this.currentFocusDistance = this.targetFocusDistance
    }

    // Update DOF uniforms every frame (inexpensive)
    this._updateDofUniforms()
  }

  /**
   * Update target focus distance based on raycast or fallback
   */
  _updateTargetFocusDistance() {
    const prevTarget = this.targetFocusDistance
    const raycastDistance = this._getRaycastFocusDistance()

    if (raycastDistance !== null) {
      // Raycast succeeded - update focus with hysteresis
      const distanceDelta = Math.abs(raycastDistance - prevTarget)
      if (distanceDelta > this.focusHysteresis) {
        this.targetFocusDistance = raycastDistance
      }
    } else {
      // Raycast failed - use fallback from zoom-based calculation
      const distanceDelta = Math.abs(this.fallbackFocusDistance - prevTarget)
      if (distanceDelta > this.focusHysteresis) {
        this.targetFocusDistance = this.fallbackFocusDistance
      }
    }
  }

  /**
   * Smooth focus transition using exponential smoothing
   */
  _smoothFocusTransition(delta) {
    const smoothing = 1 - Math.exp(-this.focusSpeed * delta)
    this.currentFocusDistance += (this.targetFocusDistance - this.currentFocusDistance) * smoothing
  }

  /**
   * Get focus distance via raycast
   * Priority 1: Camera position (what player actually sees)
   * Priority 2: Reticle/camera center screen point
   */
  _getRaycastFocusDistance() {
    // Use camera raycast first (most accurate for what player sees)
    const cameraFocus = this._raycastFromCamera()
    if (cameraFocus !== null) return cameraFocus

    // Fallback to reticle raycast
    return this._raycastFromReticle()
  }

  /**
   * Raycast from camera (what player actually sees)
   */
  _raycastFromCamera() {
    if (!this.world.camera) return null

    try {
      // Get camera position and direction
      const cameraPos = this.v1.setFromMatrixPosition(this.world.camera.matrixWorld)
      const forward = this.v3.set(0, 0, -1).transformDirection(this.world.camera.matrixWorld)

      return this._performRaycast(cameraPos, forward)
    } catch (err) {
      console.error('[DOF] Camera raycast error:', err)
      return null
    }
  }

  /**
   * Raycast from camera/reticle
   */
  _raycastFromReticle() {
    if (!this.world.stage?.viewport) return null

    try {
      const hits = this.world.stage.raycastReticle()
      return this._processRaycastHits(hits)
    } catch (err) {
      console.error('[DOF] Reticle raycast error:', err)
      return null
    }
  }

  /**
   * Perform raycast and get distance
   */
  _performRaycast(origin, direction) {
    this.raycaster.set(origin, direction)

    const intersectables = this.world.stage?.scene
    if (!intersectables) return null

    const intersects = this.raycaster.intersectObjects(
      intersectables.children || [],
      true
    )

    return this._processRaycastHits(intersects)
  }

  /**
   * Process raycast hits and extract distance
   */
  _processRaycastHits(hits) {
    if (!hits || hits.length === 0) return null

    // Filter out very close hits (likely the player)
    const validHits = hits.filter(hit => hit.distance > 0.5)
    if (validHits.length === 0) return null

    const distance = validHits[0].distance

    // Filter out sky/background (camera far plane)
    const camFar = this.world.camera.far || 1200
    const maxDistance = camFar * 0.8
    if (distance > maxDistance) return null

    return distance
  }

  /**
   * Update DOF uniforms through EffectRegistry
   */
  _updateDofUniforms() {
    if (!this.world.graphics?.effectRegistry) return

    const dof = this.world.graphics.effectRegistry.instances.get('dof')
    if (!dof) return

    // Update the actual shader uniform (not the constructor parameter)
    if (dof.circleOfConfusionMaterial?.uniforms?.focusDistance) {
      // Normalize focus distance for shader (0-1 range)
      const normalizedFocus = this.currentFocusDistance / (this.world.camera.far || 1200)
      dof.circleOfConfusionMaterial.uniforms.focusDistance.value = normalizedFocus

      // Log when focus changes significantly (debugging only, remove later)
      // if (Math.abs(this.currentFocusDistance - (this.lastLoggedFocus || 0)) > 1.0) {
      //   console.log(`[DOF] Shader focus updated: ${this.currentFocusDistance.toFixed(1)}m (normalized: ${normalizedFocus.toFixed(3)})`)
      //   this.lastLoggedFocus = this.currentFocusDistance
      // }
    }
  }

  /**
   * Get current focus distance (for external use)
   */
  getFocusDistance() {
    return this.currentFocusDistance
  }

  /**
   * Set fallback focus distance (from zoom-based calculation)
   */
  setFallbackFocusDistance(distance) {
    this.fallbackFocusDistance = Math.max(0.1, distance)
  }

  /**
   * Set target focus distance (for external use)
   */
  setFocusDistance(distance) {
    this.targetFocusDistance = Math.max(0.1, distance)
  }

  /**
   * Set focus speed
   */
  setFocusSpeed(speed) {
    this.focusSpeed = Math.max(0.01, Math.min(1, speed))
  }

  /**
   * Toggle debug logging
   */
  setDebug(enabled) {
    this.debugDOF = enabled
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Cleanup if needed
  }
}
