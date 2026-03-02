import * as THREE from './three'
import { Layers } from './Layers'
import { DEG2RAD } from './general'

export const State = {
  OFF: -1,
  KINEMATIC: 0,
  RAGDOLL: 1,
}

// 11 body segments, each maps a VRM bone name to a physics collider
const BODY_SEGMENTS = [
  { name: 'hips',          bone: 'hips',          shape: 'box',    dimensions: { width: 0.28, height: 0.2, depth: 0.2 },  mass: 12, offset: { x: 0, y: 0.1, z: 0 } },
  { name: 'chest',         bone: 'chest',         shape: 'box',    dimensions: { width: 0.3, height: 0.25, depth: 0.2 },  mass: 15, offset: { x: 0, y: 0.125, z: 0 } },
  { name: 'head',          bone: 'head',          shape: 'sphere', dimensions: { radius: 0.12 },                         mass: 4,  offset: { x: 0, y: 0.1, z: 0 } },
  { name: 'leftUpperArm',  bone: 'leftUpperArm',  childBone: 'leftLowerArm',  shape: 'box',    dimensions: { width: 0.1, height: 0.32, depth: 0.1 },  mass: 3,  offset: { x: 0, y: -0.16, z: 0 } },
  { name: 'leftLowerArm',  bone: 'leftLowerArm',  childBone: 'leftHand',      shape: 'box',    dimensions: { width: 0.08, height: 0.28, depth: 0.08 }, mass: 2,  offset: { x: 0, y: -0.14, z: 0 } },
  { name: 'rightUpperArm', bone: 'rightUpperArm', childBone: 'rightLowerArm', shape: 'box',    dimensions: { width: 0.1, height: 0.32, depth: 0.1 },  mass: 3,  offset: { x: 0, y: -0.16, z: 0 } },
  { name: 'rightLowerArm', bone: 'rightLowerArm', childBone: 'rightHand',     shape: 'box',    dimensions: { width: 0.08, height: 0.28, depth: 0.08 }, mass: 2,  offset: { x: 0, y: -0.14, z: 0 } },
  { name: 'leftUpperLeg',  bone: 'leftUpperLeg',  childBone: 'leftLowerLeg',  shape: 'box',    dimensions: { width: 0.12, height: 0.4, depth: 0.12 },  mass: 7,  offset: { x: 0, y: -0.2, z: 0 } },
  { name: 'leftLowerLeg',  bone: 'leftLowerLeg',  childBone: 'leftFoot',      shape: 'box',    dimensions: { width: 0.1, height: 0.38, depth: 0.1 },  mass: 5,  offset: { x: 0, y: -0.19, z: 0 } },
  { name: 'rightUpperLeg', bone: 'rightUpperLeg', childBone: 'rightLowerLeg', shape: 'box',    dimensions: { width: 0.12, height: 0.4, depth: 0.12 },  mass: 7,  offset: { x: 0, y: -0.2, z: 0 } },
  { name: 'rightLowerLeg', bone: 'rightLowerLeg', childBone: 'rightFoot',     shape: 'box',    dimensions: { width: 0.1, height: 0.38, depth: 0.1 },  mass: 5,  offset: { x: 0, y: -0.19, z: 0 } },
]

// 10 joints connecting body segments — all use PxD6Joint
// 'socket' = D6 with cone swing limits + twist limits (shoulders, hips, spine, neck)
// 'hinge' = D6 with single-axis bending limit, swing+twist locked (elbows, knees)
// 'drive' = active ragdoll D6 joint drive config { stiffness, damping, forceLimit, group }
const JOINT_DEFINITIONS = [
  // spine
  { parent: 'hips', child: 'chest', type: 'socket', limitY: 20, limitZ: 20, twistMin: -15, twistMax: 15, stiffness: 100, damping: 10,
    drive: { stiffness: 800, damping: 80, forceLimit: 1000, group: 'core' } },
  // neck
  { parent: 'chest', child: 'head', type: 'socket', limitY: 20, limitZ: 25, twistMin: -20, twistMax: 20, stiffness: 100, damping: 10,
    drive: { stiffness: 1200, damping: 120, forceLimit: 1500, group: 'neck' } },
  // left arm
  { parent: 'chest', child: 'leftUpperArm', type: 'socket', limitY: 55, limitZ: 55, twistMin: -15, twistMax: 15, stiffness: 100, damping: 10,
    drive: { stiffness: 350, damping: 35, forceLimit: 500, group: 'arm' } },
  { parent: 'leftUpperArm', child: 'leftLowerArm', type: 'hinge', limitMin: -5, limitMax: 130, stiffness: 250, damping: 25,
    drive: { stiffness: 400, damping: 40, forceLimit: 600, group: 'arm' } },
  // right arm
  { parent: 'chest', child: 'rightUpperArm', type: 'socket', limitY: 55, limitZ: 55, twistMin: -15, twistMax: 15, stiffness: 100, damping: 10,
    drive: { stiffness: 350, damping: 35, forceLimit: 500, group: 'arm' } },
  { parent: 'rightUpperArm', child: 'rightLowerArm', type: 'hinge', limitMin: -5, limitMax: 130, stiffness: 250, damping: 25,
    drive: { stiffness: 400, damping: 40, forceLimit: 600, group: 'arm' } },
  // left leg
  { parent: 'hips', child: 'leftUpperLeg', type: 'socket', limitY: 45, limitZ: 45, twistMin: -15, twistMax: 15, stiffness: 100, damping: 10,
    drive: { stiffness: 800, damping: 80, forceLimit: 1000, group: 'leg' } },
  { parent: 'leftUpperLeg', child: 'leftLowerLeg', type: 'hinge', limitMin: -5, limitMax: 130, stiffness: 100, damping: 10,
    drive: { stiffness: 650, damping: 65, forceLimit: 850, group: 'leg' } },
  // right leg
  { parent: 'hips', child: 'rightUpperLeg', type: 'socket', limitY: 45, limitZ: 45, twistMin: -15, twistMax: 15, stiffness: 100, damping: 10,
    drive: { stiffness: 800, damping: 80, forceLimit: 1000, group: 'leg' } },
  { parent: 'rightUpperLeg', child: 'rightLowerLeg', type: 'hinge', limitMin: -5, limitMax: 130, stiffness: 100, damping: 10,
    drive: { stiffness: 650, damping: 65, forceLimit: 850, group: 'leg' } },
]

const DEFAULTS = {
  linearDamping: 0.5,
  angularDamping: 1.5,
  muscleFadeDuration: 3.5,
  muscleFadeDelay: 0.5,
  flailDuration: 1.2,
  flailForceMin: 0.8,
  flailForceMax: 3,
  flailInterval: 0.1,
  flailDecayRate: 2.5,
  neckStiffnessMultiplier: 2.0,
  coreStiffnessMultiplier: 1.5,
}

// Flailing arm scales (upper arms get less torque than lower)
const FLAIL_ARM_PARTS = [
  { name: 'leftUpperArm', scale: 0.2 },
  { name: 'leftLowerArm', scale: 0.6 },
  { name: 'rightUpperArm', scale: 0.2 },
  { name: 'rightLowerArm', scale: 0.6 },
]

// temp objects
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _v4 = new THREE.Vector3()
const _v5 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _q3 = new THREE.Quaternion()
const _q4 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()

export class Ragdoll {
  constructor(world, vrmInstance, sceneMatrix, playerId) {
    this.world = world
    this.vrm = vrmInstance
    this.sceneMatrix = sceneMatrix
    this.playerId = playerId
    this.state = State.KINEMATIC
    this.bodies = new Map()
    this.joints = []
    this.jointDefIndices = []
    this.jointRestPoses = new Map()
    this.built = false

    // active ragdoll drive state
    this.activeTimer = 0
    this.muscleMultiplier = 1
    this.jointDrives = new Map()
    this.flailTimer = 0
    this.driveTargetTransform = null

    // opts from activate()
    this.muscleFadeDuration = DEFAULTS.muscleFadeDuration
    this.flailDuration = DEFAULTS.flailDuration
    this.stiffnessScale = 1
    this.gravityScale = 1
    this.duration = null
  }

  build() {
    if (this.built) return
    const physics = this.world.physics.physics

    this.material = physics.createMaterial(0.5, 0.5, 0.2)

    const shapeFlags = new PHYSX.PxShapeFlags(
      PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE
    )

    const filterData = new PHYSX.PxFilterData(
      Layers.prop.group,
      Layers.prop.mask,
      PHYSX.PxPairFlagEnum.eSOLVE_CONTACT | PHYSX.PxPairFlagEnum.eDETECT_DISCRETE_CONTACT | PHYSX.PxPairFlagEnum.eDETECT_CCD_CONTACT,
      0
    )

    for (const segment of BODY_SEGMENTS) {
      const bone = this.vrm.findBone(segment.bone)
      if (!bone) {
        console.warn(`[Ragdoll] bone not found: ${segment.bone}`)
        continue
      }

      _m1.multiplyMatrices(this.sceneMatrix, bone.matrixWorld)
      _m1.decompose(_v1, _q1, _v3)

      let correctionLocal = null
      if (segment.childBone) {
        const cBone = this.vrm.findBone(segment.childBone)
        if (cBone) {
          _m1.multiplyMatrices(this.sceneMatrix, cBone.matrixWorld)
          _m1.decompose(_v4, _q2, _v3)
          _v4.sub(_v1)
          if (_v4.lengthSq() > 0.0001) {
            _v4.normalize()
            _v4.applyQuaternion(_q2.copy(_q1).invert())
            correctionLocal = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0), _v4
            )
            _q1.multiply(correctionLocal)
          }
        }
      }

      _v2.set(segment.offset.x, correctionLocal ? -segment.offset.y : segment.offset.y, segment.offset.z)
      _v2.applyQuaternion(_q1)
      _v1.add(_v2)

      const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      _v1.toPxTransform(transform)
      _q1.toPxTransform(transform)

      const actor = physics.createRigidDynamic(transform)
      actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)

      let geometry
      if (segment.shape === 'sphere') {
        geometry = new PHYSX.PxSphereGeometry(segment.dimensions.radius)
      } else {
        geometry = new PHYSX.PxBoxGeometry(
          segment.dimensions.width / 2,
          segment.dimensions.height / 2,
          segment.dimensions.depth / 2
        )
      }

      const shape = physics.createShape(geometry, this.material, true, shapeFlags)
      shape.setContactOffset(0.12)
      shape.setRestOffset(0.04)
      shape.setQueryFilterData(filterData)
      shape.setSimulationFilterData(filterData)
      actor.attachShape(shape)
      PHYSX.destroy(geometry)

      PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(actor, segment.mass)
      actor.setLinearDamping(DEFAULTS.linearDamping)
      actor.setAngularDamping(DEFAULTS.angularDamping)
      actor.setSolverIterationCounts(8, 4)

      const interpolated = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
      const handle = this.world.physics.addActor(actor, {
        tag: 'ragdoll',
        playerId: this.playerId,
        bone: segment.name,
        onInterpolate: (position, quaternion) => {
          interpolated.position.copy(position)
          interpolated.quaternion.copy(quaternion)
        },
      })

      actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, true)
      shape.setFlag(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE, false)

      this.bodies.set(segment.name, { actor, bone, segment, handle, shape, correctionLocal, interpolated })

      PHYSX.destroy(transform)
    }

    PHYSX.destroy(shapeFlags)
    PHYSX.destroy(filterData)

    this._pv1 = new PHYSX.PxVec3()
    this._pv2 = new PHYSX.PxVec3()

    this.built = true
  }

  pushBone(boneName, force, point) {
    const body = this.bodies.get(boneName)
    if (!body) return console.log('[pushBone] no body for', boneName)
    body.actor.wakeUp()
    if (point) {
      const pxForce = force.toPxVec3(this._pv1)
      const pxPos = point.toPxVec3(this._pv2)
      PHYSX.PxRigidBodyExt.prototype.addForceAtPos(
        body.actor, pxForce, pxPos, PHYSX.PxForceModeEnum.eIMPULSE
      )
    } else {
      body.actor.addForce(force.toPxVec3(this._pv1), PHYSX.PxForceModeEnum.eIMPULSE, true)
    }
  }

  _buildJoints() {
    const physics = this.world.physics.physics

    for (let defIdx = 0; defIdx < JOINT_DEFINITIONS.length; defIdx++) {
      const def = JOINT_DEFINITIONS[defIdx]
      const parentBody = this.bodies.get(def.parent)
      const childBody = this.bodies.get(def.child)
      if (!parentBody || !childBody) {
        console.warn(`[Ragdoll] joint missing body: ${def.parent} -> ${def.child}`)
        continue
      }

      const childBone = childBody.bone
      _m1.multiplyMatrices(this.sceneMatrix, childBone.matrixWorld)
      _m1.decompose(_v1, _q1, _v3)

      const parentPose = parentBody.actor.getGlobalPose()
      const ppx = parentPose.p.x, ppy = parentPose.p.y, ppz = parentPose.p.z
      const parentQuat = _q2.set(parentPose.q.x, parentPose.q.y, parentPose.q.z, parentPose.q.w)

      const childPose = childBody.actor.getGlobalPose()
      const cpx = childPose.p.x, cpy = childPose.p.y, cpz = childPose.p.z
      const childQuat = _q3.set(childPose.q.x, childPose.q.y, childPose.q.z, childPose.q.w)

      const frame0 = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      _v2.set(_v1.x - ppx, _v1.y - ppy, _v1.z - ppz)
      _v2.applyQuaternion(parentQuat.clone().invert())
      _v2.toPxTransform(frame0)

      const frame1 = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      _v4.set(_v1.x - cpx, _v1.y - cpy, _v1.z - cpz)
      _v4.applyQuaternion(childQuat.clone().invert())
      _v4.toPxTransform(frame1)

      const spring = new PHYSX.PxSpring(def.stiffness || 100, def.damping || 10)

      let joint

      if (def.type === 'socket') {
        const alignRotation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 1, 0)
        )
        const parentFrameQuat = parentQuat.clone().invert().multiply(_q1).multiply(alignRotation)
        parentFrameQuat.toPxTransform(frame0)
        const childFrameQuat = childQuat.clone().invert().multiply(_q1).multiply(alignRotation)
        childFrameQuat.toPxTransform(frame1)

        joint = new PHYSX.D6JointCreate(physics, parentBody.actor, frame0, childBody.actor, frame1)

        joint.setMotion(PHYSX.PxD6AxisEnum.eX, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eY, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eZ, PHYSX.PxD6MotionEnum.eLOCKED)

        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING1, PHYSX.PxD6MotionEnum.eLIMITED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING2, PHYSX.PxD6MotionEnum.eLIMITED)
        const cone = new PHYSX.PxJointLimitCone(def.limitY * DEG2RAD, def.limitZ * DEG2RAD, spring)
        joint.setSwingLimit(cone)
        PHYSX.destroy(cone)

        if (def.twistMin != null && def.twistMax != null) {
          joint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eLIMITED)
          const twist = new PHYSX.PxJointAngularLimitPair(def.twistMin * DEG2RAD, def.twistMax * DEG2RAD, spring)
          joint.setTwistLimit(twist)
          PHYSX.destroy(twist)
        } else {
          joint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eLOCKED)
        }
      } else if (def.type === 'hinge') {
        _v2.set(0, 1, 0).applyQuaternion(parentQuat)
        const pYx = _v2.x, pYy = _v2.y, pYz = _v2.z

        _v4.set(0, 1, 0).applyQuaternion(childQuat)
        const cYx = _v4.x, cYy = _v4.y, cYz = _v4.z

        let bx = pYy * cYz - pYz * cYy
        let by = pYz * cYx - pYx * cYz
        let bz = pYx * cYy - pYy * cYx
        let bLen = Math.sqrt(bx * bx + by * by + bz * bz)

        if (bLen < 0.01) {
          _v2.set(0, 0, 1).applyQuaternion(parentQuat)
          bx = _v2.x; by = _v2.y; bz = _v2.z
          bLen = Math.sqrt(bx * bx + by * by + bz * bz)
        }

        bx /= bLen; by /= bLen; bz /= bLen

        const bendWorldVec = new THREE.Vector3(bx, by, bz)
        const invParentQuat = parentQuat.clone().invert()
        const bendInParent = bendWorldVec.clone().applyQuaternion(invParentQuat)
        const parentFrameQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(1, 0, 0), bendInParent.normalize()
        )
        parentFrameQuat.toPxTransform(frame0)

        const invChildQuat = childQuat.clone().invert()
        const bendInChild = bendWorldVec.clone().applyQuaternion(invChildQuat)
        const childFrameQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(1, 0, 0), bendInChild.normalize()
        )
        childFrameQuat.toPxTransform(frame1)

        joint = new PHYSX.D6JointCreate(physics, parentBody.actor, frame0, childBody.actor, frame1)

        joint.setMotion(PHYSX.PxD6AxisEnum.eX, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eY, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eZ, PHYSX.PxD6MotionEnum.eLOCKED)

        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING1, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING2, PHYSX.PxD6MotionEnum.eLOCKED)

        joint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eLIMITED)
        const twist = new PHYSX.PxJointAngularLimitPair(def.limitMin * DEG2RAD, def.limitMax * DEG2RAD, spring)
        joint.setTwistLimit(twist)
        PHYSX.destroy(twist)

        // store initial relative rotation for hinge drive target
        const f0w = parentQuat.clone().multiply(parentFrameQuat)
        const f1w = childQuat.clone().multiply(childFrameQuat)
        this.jointRestPoses.set(this.joints.length, f0w.invert().multiply(f1w))
      }

      PHYSX.destroy(spring)

      if (joint) {
        joint.setConstraintFlag(PHYSX.PxConstraintFlagEnum.eCOLLISION_ENABLED, false)
        joint.setBreakForce(Infinity, Infinity)
        this.joints.push(joint)
        this.jointDefIndices.push(defIdx)
      }

      PHYSX.destroy(frame0)
      PHYSX.destroy(frame1)
    }
  }

  _syncBonePoseToBody(body) {
    const { bone, segment, correctionLocal } = body
    _m1.multiplyMatrices(this.sceneMatrix, bone.matrixWorld)
    _m1.decompose(_v1, _q1, _v3)
    if (correctionLocal) _q1.multiply(correctionLocal)
    _v2.set(segment.offset.x, correctionLocal ? -segment.offset.y : segment.offset.y, segment.offset.z)
    _v2.applyQuaternion(_q1)
    _v1.add(_v2)
  }

  _syncAllBodiesToPose() {
    for (const [name, body] of this.bodies) {
      this._syncBonePoseToBody(body)
      const pose = body.actor.getGlobalPose()
      _v1.toPxTransform(pose)
      _q1.toPxTransform(pose)
      body.actor.setGlobalPose(pose)
      body.interpolated.position.copy(_v1)
      body.interpolated.quaternion.copy(_q1)
    }
  }

  _rebuildJoints() {
    this._destroyJoints()
    this._buildJoints()
  }

  _configureBodyFlags({ simulation, gravity, ccd, sceneQuery, kinematic } = {}) {
    for (const [, body] of this.bodies) {
      if (simulation != null) body.actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, !simulation)
      if (gravity != null) body.actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_GRAVITY, !gravity)
      if (ccd != null) body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, ccd)
      if (sceneQuery != null) body.shape.setFlag(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE, sceneQuery)
      if (kinematic != null) body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, kinematic)
    }
  }

  _setBodyCollisions(enabled) {
    const filterData = enabled
      ? new PHYSX.PxFilterData(
          Layers.prop.group,
          Layers.prop.mask,
          PHYSX.PxPairFlagEnum.eSOLVE_CONTACT | PHYSX.PxPairFlagEnum.eDETECT_DISCRETE_CONTACT | PHYSX.PxPairFlagEnum.eDETECT_CCD_CONTACT,
          0
        )
      : new PHYSX.PxFilterData(0, 0, 0, 0)
    for (const [, body] of this.bodies) {
      body.shape.setSimulationFilterData(filterData)
    }
    PHYSX.destroy(filterData)
  }

  _zeroBodyVelocities() {
    const zeroVec = _v1.set(0, 0, 0).toPxVec3()
    for (const [, body] of this.bodies) {
      body.actor.setLinearVelocity(zeroVec)
      body.actor.setAngularVelocity(zeroVec)
    }
  }

  activate(velocity, opts) {
    if (this.state === State.RAGDOLL) return
    this.state = State.RAGDOLL

    this.muscleFadeDuration = opts?.muscleFadeDuration ?? DEFAULTS.muscleFadeDuration
    this.flailDuration = opts?.flailDuration ?? DEFAULTS.flailDuration
    this.stiffnessScale = Math.max(0, opts?.stiffness ?? 1)
    this.gravityScale = opts?.gravity ?? 1
    this.duration = opts?.duration ?? null

    // pause VRM animation
    this.vrm.paused = true

    // sync body poses to current bone positions
    this._syncAllBodiesToPose()

    // enable simulation and scene queries
    this._configureBodyFlags({ simulation: true, sceneQuery: true })

    // rebuild joints based on current body positions
    this._rebuildJoints()

    // set up active ragdoll drives
    this.activeTimer = 0
    this.muscleMultiplier = 1
    this.flailTimer = 0
    this._setupDrives()

    // apply damping override
    const dampingScale = Math.max(0, opts?.damping ?? 1)
    const linDamp = DEFAULTS.linearDamping * dampingScale
    const angDamp = DEFAULTS.angularDamping * dampingScale

    // apply bounce (restitution) override
    const bounce = opts?.bounce ?? null
    if (bounce != null) {
      this.material.setRestitution(Math.max(0, Math.min(1, bounce)))
    }

    // apply gravity scale — disable PhysX gravity and apply custom force per tick
    if (this.gravityScale !== 1) {
      this._configureBodyFlags({ gravity: false })
    }

    // switch to dynamic and apply velocity + damping
    for (const [, body] of this.bodies) {
      body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, false)
      body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, true)
      body.actor.setLinearDamping(linDamp)
      body.actor.setAngularDamping(angDamp)
      if (velocity) {
        body.actor.setLinearVelocity(velocity.toPxVec3())
      }
    }
  }

  _setupDrives() {
    if (!this.driveTargetTransform) {
      this.driveTargetTransform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    }

    const groupMultipliers = {
      neck: DEFAULTS.neckStiffnessMultiplier,
      core: DEFAULTS.coreStiffnessMultiplier,
      arm: 1.0,
      leg: 1.0,
    }

    this.jointDrives.clear()

    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i]
      const defIdx = this.jointDefIndices[i]
      const def = JOINT_DEFINITIONS[defIdx]
      if (!def || !def.drive) continue

      const groupMult = groupMultipliers[def.drive.group] || 1.0
      const stiffness = def.drive.stiffness * groupMult * this.stiffnessScale
      const damping = def.drive.damping * groupMult * this.stiffnessScale

      const drive = new PHYSX.PxD6JointDrive(stiffness, damping, def.drive.forceLimit, true)

      const driveEnum = def.type === 'hinge'
        ? PHYSX.PxD6DriveEnum.eTWIST
        : PHYSX.PxD6DriveEnum.eSLERP
      joint.setDrive(driveEnum, drive)

      // set drive target
      const restQuat = this.jointRestPoses.get(i)
      if (restQuat) {
        this.driveTargetTransform.q.x = restQuat.x
        this.driveTargetTransform.q.y = restQuat.y
        this.driveTargetTransform.q.z = restQuat.z
        this.driveTargetTransform.q.w = restQuat.w
        joint.setDrivePosition(this.driveTargetTransform)
        this.driveTargetTransform.q.x = 0
        this.driveTargetTransform.q.y = 0
        this.driveTargetTransform.q.z = 0
        this.driveTargetTransform.q.w = 1
      } else {
        joint.setDrivePosition(this.driveTargetTransform)
      }

      this.jointDrives.set(i, {
        joint,
        drive,
        driveEnum,
        baseDriveStiffness: def.drive.stiffness,
        baseDriveDamping: def.drive.damping,
        group: def.drive.group,
        lastStiffness: stiffness,
      })
    }
  }

  _updateDrives(delta) {
    if (this.jointDrives.size === 0) return

    this.activeTimer += delta

    const { muscleFadeDelay, flailForceMin, flailForceMax, flailInterval,
            flailDecayRate, neckStiffnessMultiplier, coreStiffnessMultiplier } = DEFAULTS

    // Phase 1: Muscle fade — exponential decay of stiffness over time
    if (this.activeTimer > muscleFadeDelay) {
      const fadeElapsed = this.activeTimer - muscleFadeDelay
      const fadeProgress = Math.min(fadeElapsed / this.muscleFadeDuration, 1)
      this.muscleMultiplier = Math.exp(-3 * fadeProgress)
    } else {
      this.muscleMultiplier = 1
    }

    // Update drive stiffness/damping
    const groupFadeMultipliers = {
      neck: Math.max(this.muscleMultiplier * neckStiffnessMultiplier, 0),
      core: Math.max(this.muscleMultiplier * coreStiffnessMultiplier, 0),
      arm: this.muscleMultiplier,
      leg: this.muscleMultiplier,
    }

    for (const [i, entry] of this.jointDrives) {
      const groupMod = groupFadeMultipliers[entry.group] || this.muscleMultiplier

      const newStiffness = entry.baseDriveStiffness * groupMod * this.stiffnessScale
      const newDamping = entry.baseDriveDamping * groupMod * this.stiffnessScale

      if (Math.abs(newStiffness - entry.lastStiffness) > 1) {
        entry.drive.stiffness = newStiffness
        entry.drive.damping = newDamping
        entry.joint.setDrive(entry.driveEnum, entry.drive)
        entry.lastStiffness = newStiffness
      }
    }

    // Phase 2: Flailing — random arm torques
    if (this.activeTimer < this.flailDuration) {
      const decayFactor = Math.exp(-flailDecayRate * this.activeTimer)
      this.flailTimer += delta
      if (this.flailTimer >= flailInterval) {
        this.flailTimer -= flailInterval

        for (const { name, scale } of FLAIL_ARM_PARTS) {
          const body = this.bodies.get(name)
          if (!body) continue
          const force = (flailForceMin + Math.random() * (flailForceMax - flailForceMin)) * decayFactor * scale
          _v1.set(
            (Math.random() - 0.5) * force,
            (Math.random() - 0.3) * force * 0.6,
            (Math.random() - 0.5) * force,
          )
          body.actor.addTorque(_v1.toPxVec3(), PHYSX.PxForceModeEnum.eIMPULSE, true)
        }

        if (this.activeTimer < 0.5) {
          const headBody = this.bodies.get('head')
          if (headBody) {
            const headForce = (flailForceMin + Math.random() * (flailForceMax - flailForceMin)) * 0.15 * decayFactor
            _v1.set(
              (Math.random() - 0.5) * headForce,
              (Math.random() - 0.5) * headForce * 0.3,
              (Math.random() - 0.5) * headForce,
            )
            headBody.actor.addTorque(_v1.toPxVec3(), PHYSX.PxForceModeEnum.eIMPULSE, true)
          }
        }
      }
    }
  }

  _cleanupDrives() {
    for (const [, entry] of this.jointDrives) {
      entry.drive.stiffness = 0
      entry.drive.damping = 0
      entry.joint.setDrive(entry.driveEnum, entry.drive)
      PHYSX.destroy(entry.drive)
    }
    this.jointDrives.clear()
  }

  _writePhysicsToBones() {
    for (const [, body] of this.bodies) {
      const { bone, segment, correctionLocal, interpolated } = body

      const worldQuat = _q1.copy(interpolated.quaternion)

      if (correctionLocal) _q1.multiply(_q3.copy(correctionLocal).invert())

      if (bone.parent) {
        _m1.multiplyMatrices(this.sceneMatrix, bone.parent.matrixWorld)
        _m1.decompose(_v4, _q2, _v3)
        _q4.copy(_q2).invert().multiply(worldQuat)
      } else {
        this.sceneMatrix.decompose(_v4, _q2, _v3)
        _q4.copy(_q2).invert().multiply(worldQuat)
      }

      bone.quaternion.copy(_q4)

      const worldPos = _v1.copy(interpolated.position)

      _v2.set(segment.offset.x, correctionLocal ? -segment.offset.y : segment.offset.y, segment.offset.z)
      _v2.applyQuaternion(_q1.copy(interpolated.quaternion))
      worldPos.sub(_v2)

      _v5.subVectors(worldPos, _v4)
      _v5.applyQuaternion(_q4.copy(_q2).invert())
      bone.position.copy(_v5)

      bone.updateMatrixWorld(true)
    }
  }

  _updateSkeleton() {
    const skeleton = this.vrm.skeleton
    if (!skeleton) return
    skeleton.update = THREE.Skeleton.prototype.update
    skeleton.bones.forEach(bone => bone.updateMatrixWorld())
    skeleton.update()
  }

  fixedUpdate(delta) {
    if (this.state !== State.KINEMATIC) return

    for (const [, body] of this.bodies) {
      this._syncBonePoseToBody(body)
      const pose = body.actor.getGlobalPose()
      _v1.toPxTransform(pose)
      _q1.toPxTransform(pose)
      body.actor.setKinematicTarget(pose)
    }
  }

  update(delta) {
    if (this.state !== State.RAGDOLL) return

    // duration auto-disable
    if (this.duration != null && this.activeTimer >= this.duration) {
      this.state = State.OFF
      return
    }

    // custom gravity — apply scaled gravity force to all bodies each tick
    if (this.gravityScale !== 1) {
      for (const [, body] of this.bodies) {
        const mass = body.actor.getMass()
        _v1.set(0, -9.81 * this.gravityScale * mass, 0)
        body.actor.addForce(_v1.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
      }
    }

    this._updateDrives(delta)
    this._writePhysicsToBones()
    this._updateSkeleton()
  }

  isActive() {
    return this.state === State.RAGDOLL
  }

  getHipsPosition() {
    const hipsBody = this.bodies.get('hips')
    if (!hipsBody) return null
    return hipsBody.interpolated.position
  }

  _destroyJoints() {
    for (const joint of this.joints) {
      joint.release()
    }
    this.joints.length = 0
    this.jointDefIndices.length = 0
    this.jointRestPoses.clear()
  }

  destroy() {
    if (this.vrm) {
      this.vrm.paused = false
    }

    this._cleanupDrives()
    this._destroyJoints()
    if (this.driveTargetTransform) {
      PHYSX.destroy(this.driveTargetTransform)
      this.driveTargetTransform = null
    }
    if (this._pv1) {
      PHYSX.destroy(this._pv1)
      this._pv1 = null
    }
    if (this._pv2) {
      PHYSX.destroy(this._pv2)
      this._pv2 = null
    }

    for (const [, body] of this.bodies) {
      body.handle.destroy()
      body.shape.release()
    }
    this.bodies.clear()

    if (this.material) {
      this.material.release()
      this.material = null
    }

    this.built = false
    this.state = State.OFF
  }
}
