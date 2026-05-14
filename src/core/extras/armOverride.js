import * as THREE from './three'

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

const CFG = {
  blendInRate: 6,
  blendOutRate: 4,
  upperArmBlend: 0.95,
  lowerArmBlend: 1.0,
  elbowDrop: 0.20,
  elbowOut: 0.15,
}

export function tickArmOverride(armOverride, delta) {
  _tickSide(armOverride.left, delta)
  _tickSide(armOverride.right, delta)
}

function _tickSide(side, delta) {
  if (side.active) {
    side.blend += (1 - side.blend) * (1 - Math.exp(-CFG.blendInRate * delta))
  } else {
    if (side.blend <= 0) return
    side.blend += (0 - side.blend) * (1 - Math.exp(-CFG.blendOutRate * delta))
    if (side.blend < 0.01) side.blend = 0
  }
}

/**
 * Core arm IK solver.
 *
 * @param {Object} ctx - { upperBone, lowerBone, handBone, sceneMatrix, hipsWorldQuat }
 * @param {string} side - 'left' or 'right'
 * @param {Object} state - { blend, target, wristRoll, hasPrev, prevUpperQ, prevLowerQ }
 * @param {number} delta
 */
export function applyArmIK(ctx, side, state, delta) {
  const { upperBone, lowerBone, handBone, sceneMatrix } = ctx
  if (!upperBone || !lowerBone) return

  const blend = state.blend

  const handTarget = _v.copy(state.target)

  const elbowHint = _v6.copy(handTarget)
  elbowHint.y -= CFG.elbowDrop

  if (ctx.hipsWorldQuat) {
    _v5.set(1, 0, 0).applyQuaternion(ctx.hipsWorldQuat)
    _v5.y = 0
    const len = _v5.length()
    if (len > 0.001) {
      _v5.divideScalar(len)
      elbowHint.addScaledVector(_v5, side === 'right' ? CFG.elbowOut : -CFG.elbowOut)
    }
  }

  _m.multiplyMatrices(sceneMatrix, upperBone.matrixWorld)
  const shoulderPos = _v2.setFromMatrixPosition(_m)

  _m.multiplyMatrices(sceneMatrix, lowerBone.matrixWorld)
  const elbowPos = _v3.setFromMatrixPosition(_m)

  const currentDir = _v4.subVectors(elbowPos, shoulderPos)
  if (currentDir.lengthSq() < 0.0001) return
  currentDir.normalize()

  const desiredDir = _v.subVectors(elbowHint, shoulderPos)
  if (desiredDir.lengthSq() < 0.0001) return
  desiredDir.normalize()

  _q.setFromUnitVectors(currentDir, desiredDir)

  if (upperBone.parent) {
    _m.multiplyMatrices(sceneMatrix, upperBone.parent.matrixWorld)
    _q2.setFromRotationMatrix(_m)
  } else {
    _q2.setFromRotationMatrix(sceneMatrix)
  }
  const px = _q2.x, py = _q2.y, pz = _q2.z, pw = _q2.w
  _q2.invert().multiply(_q)
  _q.set(px, py, pz, pw)
  _q2.multiply(_q)

  _q.copy(upperBone.quaternion).premultiply(_q2)
  upperBone.quaternion.slerp(_q, blend * CFG.upperArmBlend)

  if (state.hasPrev) {
    const tRate = 1 - Math.exp(-IK_SMOOTH_RATE * delta)
    state.prevUpperQ.slerp(upperBone.quaternion, tRate)
    upperBone.quaternion.copy(state.prevUpperQ)
  } else {
    state.prevUpperQ.copy(upperBone.quaternion)
  }
  upperBone.updateMatrixWorld(true)

  _m.multiplyMatrices(sceneMatrix, lowerBone.matrixWorld)
  const newElbowPos = _v3.setFromMatrixPosition(_m)

  let handPos
  if (handBone) {
    _m.multiplyMatrices(sceneMatrix, handBone.matrixWorld)
    handPos = _v2.setFromMatrixPosition(_m)
  } else {
    handPos = _v2.copy(newElbowPos).addScaledVector(
      _v4.set(0, -1, 0).applyQuaternion(lowerBone.quaternion), 0.25
    )
  }

  const target2 = _v.copy(state.target)

  const forearmDir = _v4.subVectors(handPos, newElbowPos)
  if (forearmDir.lengthSq() < 0.0001) return
  forearmDir.normalize()

  const desiredForearm = _v.subVectors(target2, newElbowPos)
  if (desiredForearm.lengthSq() < 0.0001) return
  desiredForearm.normalize()

  _q.setFromUnitVectors(forearmDir, desiredForearm)

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
  lowerBone.quaternion.slerp(_q, blend * CFG.lowerArmBlend)

  if (state.hasPrev) {
    const tRate = 1 - Math.exp(-IK_SMOOTH_RATE * delta)
    state.prevLowerQ.slerp(lowerBone.quaternion, tRate)
    lowerBone.quaternion.copy(state.prevLowerQ)
  } else {
    state.prevLowerQ.copy(lowerBone.quaternion)
  }
  lowerBone.updateMatrixWorld(true)

  if (state.wristRoll && handBone) {
    _m.multiplyMatrices(sceneMatrix, lowerBone.matrixWorld)
    const axis = _v4.set(0, -1, 0).applyQuaternion(_q2.setFromRotationMatrix(_m)).normalize()
    _q.setFromAxisAngle(axis, state.wristRoll * blend)
    if (handBone.parent) {
      _m.multiplyMatrices(sceneMatrix, handBone.parent.matrixWorld)
      _q2.setFromRotationMatrix(_m)
    } else {
      _q2.setFromRotationMatrix(sceneMatrix)
    }
    const hpx = _q2.x, hpy = _q2.y, hpz = _q2.z, hpw = _q2.w
    _q2.invert().multiply(_q)
    _q.set(hpx, hpy, hpz, hpw)
    _q2.multiply(_q)
    handBone.quaternion.premultiply(_q2)
    handBone.updateMatrixWorld(true)
  }

  state.hasPrev = true
}
