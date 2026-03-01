import * as THREE from './three'
import { ARM_OVERRIDE_DEFAULTS } from './RagdollConfig'

// module-level temps — no per-frame allocations
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _v4 = new THREE.Vector3()
const _v5 = new THREE.Vector3()
const _v6 = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _m = new THREE.Matrix4()

const IK_SMOOTH_RATE = 24

/**
 * Apply arm IK overrides toward arbitrary world-space targets.
 * Runs in lateUpdate after wall touch, before skeleton update.
 *
 * Uses an elbow hint (below + outward from hand target) so the upper arm
 * angles downward, creating a natural bent-arm stance with elbows out.
 * Lower arm then points from the lowered elbow up to the hand target.
 */
export function applyArmOverridePose(ragdoll, delta) {
  const ao = ragdoll._armOverride

  if (ao.left.blend > 0) {
    _applyArmIK(ragdoll, 'left', ao.left, delta)
  } else if (ao.left.hasPrev) {
    ao.left.hasPrev = false
  }
  if (ao.right.blend > 0) {
    _applyArmIK(ragdoll, 'right', ao.right, delta)
  } else if (ao.right.hasPrev) {
    ao.right.hasPrev = false
  }
}

/**
 * Tick arm override blend weights. Call once per frame before IK application.
 * Ramps blend toward 1 if active, toward 0 if not.
 */
export function tickArmOverrideBlend(ragdoll, delta) {
  const cfg = ARM_OVERRIDE_DEFAULTS
  tickArmBlendSide(ragdoll._armOverride.left, delta, cfg)
  tickArmBlendSide(ragdoll._armOverride.right, delta, cfg)
}

/**
 * Tick a single arm override blend weight. Exported for use by RemoteRagdollController.
 */
export function tickArmBlendSide(side, delta, cfg) {
  if (!cfg) cfg = ARM_OVERRIDE_DEFAULTS
  if (side.active) {
    side.blend += (1 - side.blend) * (1 - Math.exp(-cfg.blendInRate * delta))
  } else {
    if (side.blend <= 0) return
    side.blend += (0 - side.blend) * (1 - Math.exp(-cfg.blendOutRate * delta))
    if (side.blend < 0.01) side.blend = 0
  }
}

/** Thin wrapper: extracts bone refs from ragdoll, delegates to applyArmIKDirect. */
function _applyArmIK(ragdoll, side, state, delta) {
  const upperName = side === 'left' ? 'leftUpperArm' : 'rightUpperArm'
  const lowerName = side === 'left' ? 'leftLowerArm' : 'rightLowerArm'

  const upperBody = ragdoll.bodies.get(upperName)
  const lowerBody = ragdoll.bodies.get(lowerName)
  if (!upperBody || !lowerBody) return

  const handBoneName = side === 'left' ? 'leftHand' : 'rightHand'
  const hipsPose = ragdoll.animPoseCache.get('hips')

  applyArmIKDirect({
    upperBone: upperBody.bone,
    lowerBone: lowerBody.bone,
    handBone: ragdoll.vrm.findBone(handBoneName),
    sceneMatrix: ragdoll.sceneMatrix,
    hipsWorldQuat: hipsPose?.quaternion || null,
  }, side, state, delta)
}

/**
 * Core arm IK solver — works with explicit bone references (no ragdoll dependency).
 *
 * @param {Object} ctx - { upperBone, lowerBone, handBone, sceneMatrix, hipsWorldQuat }
 * @param {string} side - 'left' or 'right'
 * @param {Object} state - arm override state { blend, target, wristRoll, hasPrev, prevUpperQ, prevLowerQ }
 * @param {number} delta - frame delta time
 */
export function applyArmIKDirect(ctx, side, state, delta) {
  const cfg = ARM_OVERRIDE_DEFAULTS
  const { upperBone, lowerBone, handBone, sceneMatrix } = ctx
  if (!upperBone || !lowerBone) return

  const blend = state.blend

  // Hand target in world space
  const handTarget = _v.copy(state.target)

  // --- Compute elbow hint: below + outward from hand target ---
  // This makes the upper arm angle downward so the elbow drops,
  // then the lower arm angles back up to the hand target → bent arm stance
  const elbowHint = _v6.copy(handTarget)
  elbowHint.y -= cfg.elbowDrop

  if (ctx.hipsWorldQuat) {
    _v5.set(1, 0, 0).applyQuaternion(ctx.hipsWorldQuat)
    _v5.y = 0
    const len = _v5.length()
    if (len > 0.001) {
      _v5.divideScalar(len)
      elbowHint.addScaledVector(_v5, side === 'right' ? cfg.elbowOut : -cfg.elbowOut)
    }
  }

  // --- Upper arm: point toward ELBOW HINT (creates bend) ---
  _m.multiplyMatrices(sceneMatrix, upperBone.matrixWorld)
  const shoulderPos = _v2.setFromMatrixPosition(_m)

  _m.multiplyMatrices(sceneMatrix, lowerBone.matrixWorld)
  const elbowPos = _v3.setFromMatrixPosition(_m)

  // Current arm direction: shoulder → elbow
  const currentDir = _v4.subVectors(elbowPos, shoulderPos)
  if (currentDir.lengthSq() < 0.0001) return
  currentDir.normalize()

  // Desired arm direction: shoulder → elbow hint
  const desiredDir = _v.subVectors(elbowHint, shoulderPos)
  if (desiredDir.lengthSq() < 0.0001) return
  desiredDir.normalize()

  // Rotation delta in world space
  _q.setFromUnitVectors(currentDir, desiredDir)

  // Convert to bone-local: localDelta = inv(parentWorldQuat) * worldDelta * parentWorldQuat
  if (upperBone.parent) {
    _m.multiplyMatrices(sceneMatrix, upperBone.parent.matrixWorld)
    _q2.setFromRotationMatrix(_m)
  } else {
    _q2.setFromRotationMatrix(sceneMatrix)
  }
  const px = _q2.x, py = _q2.y, pz = _q2.z, pw = _q2.w
  _q2.invert().multiply(_q)       // inv(parent) * worldDelta
  _q.set(px, py, pz, pw)          // restore parent
  _q2.multiply(_q)                 // localDelta = inv(parent) * worldDelta * parent

  // Apply: rotatedQuat = localDelta * bone.quaternion, then slerp
  _q.copy(upperBone.quaternion).premultiply(_q2)
  upperBone.quaternion.slerp(_q, blend * cfg.upperArmBlend)

  // Temporal smoothing
  if (state.hasPrev) {
    const tRate = 1 - Math.exp(-IK_SMOOTH_RATE * delta)
    state.prevUpperQ.slerp(upperBone.quaternion, tRate)
    upperBone.quaternion.copy(state.prevUpperQ)
  } else {
    state.prevUpperQ.copy(upperBone.quaternion)
  }
  upperBone.updateMatrixWorld(true)

  // --- Lower arm: point toward HAND TARGET (reaches up from dropped elbow) ---
  _m.multiplyMatrices(sceneMatrix, lowerBone.matrixWorld)
  const newElbowPos = _v3.setFromMatrixPosition(_m)

  // Get hand position
  let handPos
  if (handBone) {
    _m.multiplyMatrices(sceneMatrix, handBone.matrixWorld)
    handPos = _v2.setFromMatrixPosition(_m)
  } else {
    handPos = _v2.copy(newElbowPos).addScaledVector(
      _v4.set(0, -1, 0).applyQuaternion(lowerBone.quaternion), 0.25
    )
  }

  // Recompute hand target (reuse _v)
  const target2 = _v.copy(state.target)

  // Current forearm direction: elbow → hand
  const forearmDir = _v4.subVectors(handPos, newElbowPos)
  if (forearmDir.lengthSq() < 0.0001) return
  forearmDir.normalize()

  // Desired forearm direction: elbow → hand target
  const desiredForearm = _v.subVectors(target2, newElbowPos)
  if (desiredForearm.lengthSq() < 0.0001) return
  desiredForearm.normalize()

  // Rotation delta in world space
  _q.setFromUnitVectors(forearmDir, desiredForearm)

  // Convert to bone-local
  if (lowerBone.parent) {
    _m.multiplyMatrices(sceneMatrix, lowerBone.parent.matrixWorld)
    _q2.setFromRotationMatrix(_m)
  } else {
    _q2.setFromRotationMatrix(sceneMatrix)
  }
  const px2 = _q2.x, py2 = _q2.y, pz2 = _q2.z, pw2 = _q2.w
  _q2.invert().multiply(_q)
  _q.set(px2, py2, pz2, pw2)
  _q2.multiply(_q)

  _q.copy(lowerBone.quaternion).premultiply(_q2)
  lowerBone.quaternion.slerp(_q, blend * cfg.lowerArmBlend)

  if (state.hasPrev) {
    const tRate = 1 - Math.exp(-IK_SMOOTH_RATE * delta)
    state.prevLowerQ.slerp(lowerBone.quaternion, tRate)
    lowerBone.quaternion.copy(state.prevLowerQ)
  } else {
    state.prevLowerQ.copy(lowerBone.quaternion)
  }
  lowerBone.updateMatrixWorld(true)

  // --- Wrist roll: rotate hand bone around forearm axis ---
  if (state.wristRoll && handBone) {
    // Forearm axis in world space (elbow → hand direction after IK)
    _m.multiplyMatrices(sceneMatrix, lowerBone.matrixWorld)
    const axis = _v4.set(0, -1, 0).applyQuaternion(_q2.setFromRotationMatrix(_m)).normalize()
    // Build world-space roll quaternion
    _q.setFromAxisAngle(axis, state.wristRoll * blend)
    // Convert to hand bone-local
    if (handBone.parent) {
      _m.multiplyMatrices(sceneMatrix, handBone.parent.matrixWorld)
      _q2.setFromRotationMatrix(_m)
    } else {
      _q2.setFromRotationMatrix(sceneMatrix)
    }
    const hpx = _q2.x, hpy = _q2.y, hpz = _q2.z, hpw = _q2.w
    _q2.invert().multiply(_q)
    _q.set(hpx, hpy, hpz, hpw)
    _q2.multiply(_q) // bone-local roll delta
    handBone.quaternion.premultiply(_q2)
    handBone.updateMatrixWorld(true)
  }

  state.hasPrev = true
}
