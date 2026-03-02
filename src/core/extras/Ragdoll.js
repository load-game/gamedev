import * as THREE from './three'
import { BODY_SEGMENTS, JOINT_DEFINITIONS, RAGDOLL_DEFAULTS, ACTIVE_RAGDOLL_DEFAULTS, REACTIVE_DEFAULTS,
         ARM_BODIES, LEFT_LEG_BODIES, RIGHT_LEG_BODIES, LOWER_BODY_NAMES, FLAIL_ARM_PARTS } from './RagdollConfig'
import { Layers } from './Layers'
import { DEG2RAD } from './general'

export const State = {
  OFF: -1,
  KINEMATIC: 0,
  RAGDOLL: 1,
  RECOVERING: 2,
  REACTIVE: 3,
}

// temp objects — dedicated per use to avoid decompose() conflicts
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3() // dedicated for decompose scale output
const _v4 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _q3 = new THREE.Quaternion()
const _v5 = new THREE.Vector3()
const _v6 = new THREE.Vector3()
const _v7 = new THREE.Vector3()
const _q4 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()

export class Ragdoll {
  constructor(world, vrmInstance, sceneMatrix, playerId) {
    this.world = world
    this.vrm = vrmInstance
    this.sceneMatrix = sceneMatrix // REFERENCE to this.base.matrixWorld
    this.playerId = playerId
    this.state = State.KINEMATIC
    this.bodies = new Map()        // name -> { actor, bone, segment, handle, shape }
    this.joints = []
    this.jointDefIndices = []  // maps this.joints[i] -> JOINT_DEFINITIONS index
    this.boneRestPoses = new Map()  // name -> { quaternion, position }
    this.boneSnapshot = new Map()   // snapshot of ragdoll pose for recovery blend
    this.recoveryTimer = 0
    this.recoveryStartY = 0
    this.built = false

    // active ragdoll drive state
    this.activeTimer = 0
    this.impactVelocity = 0
    this.fallDirection = 'forward'
    this.muscleMultiplier = 1
    this.hitSideMuscleMultiplier = 1
    this.jointDrives = new Map()   // index -> { joint, drive, baseDriveStiffness, baseDriveDamping, group, def }
    this.flailTimer = 0
    this.bracingActive = false
    this.driveTargetTransform = null
    this.jointFrames = new Map()   // jointIndex -> { parentWorldQuat, parentFrameQuat, def }
    this.jointRestPoses = new Map() // jointIndex -> THREE.Quaternion (hinge rest rotation at activation)
    this.bracingTargets = new Map() // jointIndex -> THREE.Quaternion
    this.hitJointScales = null     // Map<jointIndex, scale> — drive weakening near hit zone
    this.hitSide = null            // 'left' | 'right' | null — which side was struck
    this.hitBone = null            // name of the struck bone

    // reactive mode: joint frame quats for drive target computation
    this.jointFrameQuats = new Map()  // jointIndex -> { frame0Quat, frame1Quat, parentName, childName, type }

    // reactive mode: animation pose cache
    this.animPoseCache = new Map()  // bodyName -> { position: Vector3, quaternion: Quaternion }

    // reactive mode: walk→stop planted foot tracking
    this._wasMoving = false
    this._plantedSide = null     // 'left' | 'right' | null — which leg is planted on stop
    this._plantedForward = null  // Vector3 — forward direction at time of stop
    this._plantedTimer = 0       // seconds remaining for plant effect

    // reactive mode: momentum lean state
    this._leanAngleX = 0         // current forward/back lean in degrees (positive = forward)
    this._leanAngleZ = 0         // current lateral lean in degrees (positive = lean right)
    this._prevVelocity = new THREE.Vector3()

    // reactive mode: arm swing overshoot state
    this._armSwingTimer = 0      // seconds remaining for arm exemption
    this._armSwingActive = false  // true while arms are exempt from angular velocity zeroing
    this._prevMoveDir = new THREE.Vector3()

    // landing: suppress leg physics blend and resync bodies each frame
    this._landingTimer = 0

    // anchor body system
    this.anchorActor = null
    this.anchorShape = null
    this.anchorHandle = null
    this.anchorJoint = null
    this.anchorDriveLinear = null
    this.anchorDriveSlerp = null

  }

  build() {
    if (this.built) return
    const physics = this.world.physics.physics

    // create material for ragdoll bodies
    this.material = physics.createMaterial(0.5, 0.5, 0.2)

    // shape flags
    const shapeFlags = new PHYSX.PxShapeFlags(
      PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE
    )

    // filter data — use prop layer so ragdoll collides with environment and other props
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

      // save rest pose at build time (before ragdoll ever modifies bones)
      this.boneRestPoses.set(segment.name, {
        quaternion: bone.quaternion.clone(),
        position: bone.position.clone(),
      })

      // get bone world position: sceneMatrix * bone.matrixWorld
      _m1.multiplyMatrices(this.sceneMatrix, bone.matrixWorld)
      _m1.decompose(_v1, _q1, _v3) // _v1 = world pos, _q1 = world quat, _v3 = scale (discarded)

      // compute limb-aligned correction: rotate box Y axis to point along the limb
      // (bone Y doesn't necessarily point along the limb in VRM)
      let correctionLocal = null
      if (segment.childBone) {
        const cBone = this.vrm.findBone(segment.childBone)
        if (cBone) {
          _m1.multiplyMatrices(this.sceneMatrix, cBone.matrixWorld)
          _m1.decompose(_v4, _q2, _v3) // _v4 = child world pos
          _v4.sub(_v1) // limb dir world (_v1 unchanged)
          if (_v4.lengthSq() > 0.0001) {
            _v4.normalize()
            // transform limb direction to bone-local space
            _v4.applyQuaternion(_q2.copy(_q1).invert())
            correctionLocal = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0), _v4
            )
            // apply correction: body quat = bone quat * correction
            _q1.multiply(correctionLocal)
          }
        }
      }

      // apply segment offset in body-local space
      // corrected bodies have Y = limb direction, but config offsets assume Y = opposite limb
      _v2.set(segment.offset.x, correctionLocal ? -segment.offset.y : segment.offset.y, segment.offset.z)
      _v2.applyQuaternion(_q1)
      _v1.add(_v2)

      // create PhysX transform at world position with limb-aligned rotation
      const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      _v1.toPxTransform(transform)
      _q1.toPxTransform(transform)

      // create rigid dynamic actor
      const actor = physics.createRigidDynamic(transform)

      // set kinematic initially (CCD enabled later at activation — PhysX rejects CCD on kinematic bodies)
      actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)

      // create geometry
      let geometry
      if (segment.shape === 'sphere') {
        geometry = new PHYSX.PxSphereGeometry(segment.dimensions.radius)
      } else {
        // box — PhysX uses half-extents
        geometry = new PHYSX.PxBoxGeometry(
          segment.dimensions.width / 2,
          segment.dimensions.height / 2,
          segment.dimensions.depth / 2
        )
      }

      // create shape
      const shape = physics.createShape(geometry, this.material, true, shapeFlags)
      shape.setContactOffset(0.12)
      shape.setRestOffset(0.04)
      shape.setQueryFilterData(filterData)
      shape.setSimulationFilterData(filterData)
      actor.attachShape(shape)
      PHYSX.destroy(geometry)

      // set mass and damping — setMassAndUpdateInertia properly computes inertia tensor
      PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(actor, segment.mass)
      actor.setLinearDamping(RAGDOLL_DEFAULTS.linearDamping)
      actor.setAngularDamping(RAGDOLL_DEFAULTS.angularDamping)
      actor.setSolverIterationCounts(8, 4)

      // add to physics world with interpolation callback
      const interpolated = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
      const handle = this.world.physics.addActor(actor, {
        tag: 'ragdoll',
        playerId: this.playerId,
        onInterpolate: (position, quaternion) => {
          interpolated.position.copy(position)
          interpolated.quaternion.copy(quaternion)
        },
      })

      // disable simulation and scene queries until ragdoll activates
      actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, true)
      shape.setFlag(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE, false)

      this.bodies.set(segment.name, { actor, bone, segment, handle, shape, correctionLocal, interpolated })

      PHYSX.destroy(transform)
    }

    PHYSX.destroy(shapeFlags)
    PHYSX.destroy(filterData)

    // joints are built at activation time (not here) so they match the
    // current animation pose rather than the initial load pose

    this.built = true
    this._buildAnchor()

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

      // calculate anchor point at the child bone's world position
      // relative to each body's local space
      const childBone = childBody.bone
      _m1.multiplyMatrices(this.sceneMatrix, childBone.matrixWorld)
      _m1.decompose(_v1, _q1, _v3) // _v1 = child bone world pos, _q1 = child bone world quat

      // get parent body global pose (save positions as numbers to avoid aliasing)
      const parentPose = parentBody.actor.getGlobalPose()
      const ppx = parentPose.p.x, ppy = parentPose.p.y, ppz = parentPose.p.z
      const parentQuat = _q2.set(parentPose.q.x, parentPose.q.y, parentPose.q.z, parentPose.q.w)

      // get child body global pose
      const childPose = childBody.actor.getGlobalPose()
      const cpx = childPose.p.x, cpy = childPose.p.y, cpz = childPose.p.z
      const childQuat = _q3.set(childPose.q.x, childPose.q.y, childPose.q.z, childPose.q.w)

      // anchor in parent local space: child bone world pos relative to parent body
      const frame0 = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      _v2.set(_v1.x - ppx, _v1.y - ppy, _v1.z - ppz)
      _v2.applyQuaternion(parentQuat.clone().invert())
      _v2.toPxTransform(frame0)

      // anchor in child local space: child bone world pos relative to child body
      const frame1 = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
      _v4.set(_v1.x - cpx, _v1.y - cpy, _v1.z - cpz)
      _v4.applyQuaternion(childQuat.clone().invert())
      _v4.toPxTransform(frame1)

      // create spring for limits
      const spring = new PHYSX.PxSpring(def.stiffness || 100, def.damping || 10)

      let joint

      if (def.type === 'socket') {
        // Frame: align X axis with bone direction (Y) for twist axis
        const alignRotation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 1, 0)
        )
        const parentFrameQuat = parentQuat.clone().invert().multiply(_q1).multiply(alignRotation)
        parentFrameQuat.toPxTransform(frame0)
        const childFrameQuat = childQuat.clone().invert().multiply(_q1).multiply(alignRotation)
        childFrameQuat.toPxTransform(frame1)

        joint = new PHYSX.D6JointCreate(physics, parentBody.actor, frame0, childBody.actor, frame1)

        // store joint frame info for dynamic bracing computation
        this.jointFrames.set(this.joints.length, {
          parentWorldQuat: parentQuat.clone(),
          parentFrameQuat: parentFrameQuat.clone(),
          boneSign: childBody.segment.offset.y >= 0 ? 1 : -1,
          def,
        })

        // store frame quaternions for reactive drive target computation
        this.jointFrameQuats.set(this.joints.length, {
          frame0Quat: parentFrameQuat.clone(),
          frame1Quat: childFrameQuat.clone(),
          parentName: def.parent,
          childName: def.child,
          type: 'socket',
        })

        // lock translations
        joint.setMotion(PHYSX.PxD6AxisEnum.eX, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eY, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eZ, PHYSX.PxD6MotionEnum.eLOCKED)

        // cone swing limits
        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING1, PHYSX.PxD6MotionEnum.eLIMITED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING2, PHYSX.PxD6MotionEnum.eLIMITED)
        const cone = new PHYSX.PxJointLimitCone(def.limitY * DEG2RAD, def.limitZ * DEG2RAD, spring)
        joint.setSwingLimit(cone)
        PHYSX.destroy(cone)

        // twist limits (rotation around bone axis)
        if (def.twistMin != null && def.twistMax != null) {
          joint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eLIMITED)
          const twist = new PHYSX.PxJointAngularLimitPair(def.twistMin * DEG2RAD, def.twistMax * DEG2RAD, spring)
          joint.setTwistLimit(twist)
          PHYSX.destroy(twist)
        } else {
          joint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eLOCKED)
        }
      } else if (def.type === 'hinge') {
        // Compute bending axis from cross product of parent/child bone directions.
        _v2.set(0, 1, 0).applyQuaternion(parentQuat)
        const pYx = _v2.x, pYy = _v2.y, pYz = _v2.z

        _v4.set(0, 1, 0).applyQuaternion(childQuat)
        const cYx = _v4.x, cYy = _v4.y, cYz = _v4.z

        // bending axis = cross(parentBoneDir, childBoneDir)
        let bx = pYy * cYz - pYz * cYy
        let by = pYz * cYx - pYx * cYz
        let bz = pYx * cYy - pYy * cYx
        let bLen = Math.sqrt(bx * bx + by * by + bz * bz)

        if (bLen < 0.01) {
          // Limb nearly straight — fallback to bone's local Z axis
          _v2.set(0, 0, 1).applyQuaternion(parentQuat)
          bx = _v2.x; by = _v2.y; bz = _v2.z
          bLen = Math.sqrt(bx * bx + by * by + bz * bz)
        }

        // normalize
        bx /= bLen; by /= bLen; bz /= bLen

        // Frame: align X axis with bending axis (in each body's local space)
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

        // lock translations
        joint.setMotion(PHYSX.PxD6AxisEnum.eX, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eY, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eZ, PHYSX.PxD6MotionEnum.eLOCKED)

        // lock swing (no lateral movement)
        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING1, PHYSX.PxD6MotionEnum.eLOCKED)
        joint.setMotion(PHYSX.PxD6AxisEnum.eSWING2, PHYSX.PxD6MotionEnum.eLOCKED)

        // limit twist (= bending rotation)
        joint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eLIMITED)
        const twist = new PHYSX.PxJointAngularLimitPair(def.limitMin * DEG2RAD, def.limitMax * DEG2RAD, spring)
        joint.setTwistLimit(twist)
        PHYSX.destroy(twist)

        // store initial relative rotation between parent/child frames as hinge drive target
        const f0w = parentQuat.clone().multiply(parentFrameQuat)
        const f1w = childQuat.clone().multiply(childFrameQuat)
        this.jointRestPoses.set(this.joints.length, f0w.invert().multiply(f1w))

        // store frame quaternions for reactive drive target computation
        this.jointFrameQuats.set(this.joints.length, {
          frame0Quat: parentFrameQuat.clone(),
          frame1Quat: childFrameQuat.clone(),
          parentName: def.parent,
          childName: def.child,
          type: 'hinge',
        })
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

  /** Compute world position (_v1) and quaternion (_q1) for a body from its bone's current matrixWorld. */
  _syncBonePoseToBody(body) {
    const { bone, segment, correctionLocal } = body
    _m1.multiplyMatrices(this.sceneMatrix, bone.matrixWorld)
    _m1.decompose(_v1, _q1, _v3)
    if (correctionLocal) _q1.multiply(correctionLocal)
    _v2.set(segment.offset.x, correctionLocal ? -segment.offset.y : segment.offset.y, segment.offset.z)
    _v2.applyQuaternion(_q1)
    _v1.add(_v2)
  }

  /** Sync all ragdoll bodies to their current bone animation pose (sets actor global pose). */
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

  /** Destroy and rebuild joints to match current body positions/orientations. */
  _rebuildJoints() {
    this._destroyJoints()
    this._buildJoints()
  }

  /** Common tail for entering/restoring reactive state: rebuild joints+drives, anchor, cache poses. */
  _prepareReactiveState() {
    this._rebuildJoints()
    this._setupReactiveDrives()
    this._destroyAnchorJoint()
    // Sync anchor actor to hips bone pose and re-enable its simulation
    // (anchor simulation is disabled during RAGDOLL via _disableAnchorDrives)
    this._syncAnchorToHips()
    this._buildAnchorJoint()
    this.captureAnimationPoses()
  }

  /** Move anchor actor to current hips bone position and re-enable simulation. */
  _syncAnchorToHips() {
    const hipsBody = this.bodies.get('hips')
    if (!hipsBody || !this.anchorActor) return
    this._syncBonePoseToBody(hipsBody)
    const pose = this.anchorActor.getGlobalPose()
    _v1.toPxTransform(pose)
    _q1.toPxTransform(pose)
    this.anchorActor.setGlobalPose(pose)
    this.anchorActor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, false)
  }

  /**
   * Zero angular velocity on bodies, with optional skip set.
   * @param {Set|null} skipAngular - body names to skip angular zeroing
   * @param {Set|null} zeroLinear - body names to also zero linear velocity
   */
  _zeroBodyVelocities(skipAngular = null, zeroLinear = null) {
    const zeroVec = _v1.set(0, 0, 0).toPxVec3()
    for (const [name, body] of this.bodies) {
      if (skipAngular && skipAngular.has(name)) continue
      if (zeroLinear && zeroLinear.has(name)) {
        body.actor.setLinearVelocity(zeroVec)
      }
      body.actor.setAngularVelocity(zeroVec)
    }
  }

  /**
   * Configure body flags for all ragdoll bodies.
   * @param {{ simulation?: boolean, gravity?: boolean, ccd?: boolean, sceneQuery?: boolean, kinematic?: boolean }} options
   */
  _configureBodyFlags({ simulation, gravity, ccd, sceneQuery, kinematic } = {}) {
    for (const [, body] of this.bodies) {
      if (simulation != null) body.actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, !simulation)
      if (gravity != null) body.actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_GRAVITY, !gravity)
      if (ccd != null) body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, ccd)
      if (sceneQuery != null) body.shape.setFlag(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE, sceneQuery)
      if (kinematic != null) body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, kinematic)
    }
  }

  // --- Step 3b: Animation pose cache ---

  captureAnimationPoses() {
    for (const [name, body] of this.bodies) {
      this._syncBonePoseToBody(body)

      let cached = this.animPoseCache.get(name)
      if (!cached) {
        cached = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
        this.animPoseCache.set(name, cached)
      }
      cached.position.copy(_v1)
      cached.quaternion.copy(_q1)
    }
  }

  // --- Step 4a: Drive target computation from animation ---

  _updateDriveTargetsFromAnimation() {
    if (this.animPoseCache.size === 0) return
    const t = this.driveTargetTransform
    if (!t) return

    for (const [i, fq] of this.jointFrameQuats) {
      const parentCache = this.animPoseCache.get(fq.parentName)
      const childCache = this.animPoseCache.get(fq.childName)
      if (!parentCache || !childCache) continue

      // R_target = inv(frame0) * inv(R_parent) * R_child * frame1
      _q1.copy(fq.frame0Quat).invert()        // inv(frame0)
      _q2.copy(parentCache.quaternion).invert() // inv(R_parent)
      _q1.multiply(_q2)                         // inv(frame0) * inv(R_parent)
      _q1.multiply(childCache.quaternion)        // * R_child
      _q1.multiply(fq.frame1Quat)               // * frame1

      t.p.x = 0; t.p.y = 0; t.p.z = 0
      t.q.x = _q1.x; t.q.y = _q1.y; t.q.z = _q1.z; t.q.w = _q1.w
      this.joints[i].setDrivePosition(t)
    }
  }

  // --- Step 5b: Build anchor body ---

  _buildAnchor() {
    const physics = this.world.physics.physics
    const hipsBody = this.bodies.get('hips')
    if (!hipsBody) return

    // Create anchor at hips body's current position/rotation
    this._syncBonePoseToBody(hipsBody)
    const transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    _v1.toPxTransform(transform)
    _q1.toPxTransform(transform)

    // Create kinematic rigid dynamic
    this.anchorActor = physics.createRigidDynamic(transform)
    this.anchorActor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)

    // Tiny sphere shape (needed for PhysX but won't collide)
    const geometry = new PHYSX.PxSphereGeometry(0.01)
    const shapeFlags = new PHYSX.PxShapeFlags(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE)
    this.anchorShape = physics.createShape(geometry, this.material, true, shapeFlags)
    // Set filter data to collide with nothing
    const filterData = new PHYSX.PxFilterData(0, 0, 0, 0)
    this.anchorShape.setSimulationFilterData(filterData)
    this.anchorShape.setQueryFilterData(filterData)
    this.anchorActor.attachShape(this.anchorShape)
    PHYSX.destroy(geometry)
    PHYSX.destroy(shapeFlags)
    PHYSX.destroy(filterData)

    PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(this.anchorActor, 1)

    // Add to physics world
    this.anchorHandle = this.world.physics.addActor(this.anchorActor, {
      tag: 'ragdoll-anchor',
      playerId: this.playerId,
    })

    // Disable simulation (kinematic, no collisions needed)
    this.anchorActor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, true)
    this.anchorShape.setFlag(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE, false)

    PHYSX.destroy(transform)
  }

  // --- Step 5c: Build anchor joint ---

  _buildAnchorJoint() {
    const physics = this.world.physics.physics
    const hipsBody = this.bodies.get('hips')
    if (!hipsBody || !this.anchorActor) return

    // Both frames are identity — anchor IS at hips position/rotation
    const frame0 = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    const frame1 = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)

    this.anchorJoint = new PHYSX.D6JointCreate(
      physics, this.anchorActor, frame0, hipsBody.actor, frame1
    )

    // All translations FREE with linear drive
    this.anchorJoint.setMotion(PHYSX.PxD6AxisEnum.eX, PHYSX.PxD6MotionEnum.eFREE)
    this.anchorJoint.setMotion(PHYSX.PxD6AxisEnum.eY, PHYSX.PxD6MotionEnum.eFREE)
    this.anchorJoint.setMotion(PHYSX.PxD6AxisEnum.eZ, PHYSX.PxD6MotionEnum.eFREE)

    // All rotations FREE with SLERP drive
    this.anchorJoint.setMotion(PHYSX.PxD6AxisEnum.eSWING1, PHYSX.PxD6MotionEnum.eFREE)
    this.anchorJoint.setMotion(PHYSX.PxD6AxisEnum.eSWING2, PHYSX.PxD6MotionEnum.eFREE)
    this.anchorJoint.setMotion(PHYSX.PxD6AxisEnum.eTWIST, PHYSX.PxD6MotionEnum.eFREE)

    const { anchorLinearStiffness, anchorLinearDamping, anchorLinearForceLimit,
            anchorAngularStiffness, anchorAngularDamping, anchorAngularForceLimit } = REACTIVE_DEFAULTS

    // Linear drives (same for X, Y, Z)
    this.anchorDriveLinear = new PHYSX.PxD6JointDrive(
      anchorLinearStiffness, anchorLinearDamping, anchorLinearForceLimit, true
    )
    this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eX, this.anchorDriveLinear)
    this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eY, this.anchorDriveLinear)
    this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eZ, this.anchorDriveLinear)

    // SLERP rotational drive
    this.anchorDriveSlerp = new PHYSX.PxD6JointDrive(
      anchorAngularStiffness, anchorAngularDamping, anchorAngularForceLimit, true
    )
    this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eSLERP, this.anchorDriveSlerp)

    // Drive target = identity (keep hips at anchor position/rotation)
    if (!this.driveTargetTransform) {
      this.driveTargetTransform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    }
    this.anchorJoint.setDrivePosition(this.driveTargetTransform)

    // No inter-body collision, unbreakable
    this.anchorJoint.setConstraintFlag(PHYSX.PxConstraintFlagEnum.eCOLLISION_ENABLED, false)
    this.anchorJoint.setBreakForce(Infinity, Infinity)

    PHYSX.destroy(frame0)
    PHYSX.destroy(frame1)
  }

  // --- Step 5d: Destroy anchor joint ---

  _destroyAnchorJoint() {
    if (this.anchorJoint) {
      this.anchorJoint.release()
      this.anchorJoint = null
    }
    if (this.anchorDriveLinear) {
      PHYSX.destroy(this.anchorDriveLinear)
      this.anchorDriveLinear = null
    }
    if (this.anchorDriveSlerp) {
      PHYSX.destroy(this.anchorDriveSlerp)
      this.anchorDriveSlerp = null
    }
  }

  // --- Step 6b: Activate REACTIVE state ---

  activateReactive() {
    if (this.state === State.REACTIVE) return
    console.log('[Ragdoll] activateReactive — entering REACTIVE state')
    this.state = State.REACTIVE

    // VRM animation must keep running
    this.vrm.paused = false

    // Sync all bodies to current animation bone poses
    this._syncAllBodiesToPose()

    // Enable simulation on all bodies and switch to dynamic
    // Reactive mode: no collisions, no gravity, no scene queries — bodies are purely drive-controlled.
    this._configureBodyFlags({ simulation: true, gravity: false, sceneQuery: false, kinematic: false, ccd: false })

    // Zero out all velocities
    this._zeroBodyVelocities(null, new Set(this.bodies.keys()))

    // Disable collision filter — drives are constraint-based and don't need collision pairs
    this._setBodyCollisions(false)

    // Build joints, drives, anchor, and cache animation poses
    this._prepareReactiveState()

    if (!this.driveTargetTransform) {
      this.driveTargetTransform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    }
  }

  // --- Step 6c: Set up reactive drives ---

  _setupReactiveDrives() {
    const { driveStiffnessMultiplier, driveDampingMultiplier } = REACTIVE_DEFAULTS

    this.jointDrives.clear()

    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i]
      const defIdx = this.jointDefIndices[i]
      const def = JOINT_DEFINITIONS[defIdx]
      if (!def || !def.drive) continue

      const stiffness = def.drive.stiffness * driveStiffnessMultiplier
      const damping = def.drive.damping * driveDampingMultiplier

      const drive = new PHYSX.PxD6JointDrive(stiffness, damping, def.drive.forceLimit * driveStiffnessMultiplier, true)

      const driveEnum = def.type === 'hinge'
        ? PHYSX.PxD6DriveEnum.eTWIST
        : PHYSX.PxD6DriveEnum.eSLERP
      joint.setDrive(driveEnum, drive)

      // Initial target = identity (will be updated from animation cache next fixedUpdate)
      if (this.driveTargetTransform) {
        this.driveTargetTransform.p.x = 0; this.driveTargetTransform.p.y = 0; this.driveTargetTransform.p.z = 0
        this.driveTargetTransform.q.x = 0; this.driveTargetTransform.q.y = 0; this.driveTargetTransform.q.z = 0; this.driveTargetTransform.q.w = 1
        joint.setDrivePosition(this.driveTargetTransform)
      }

      this.jointDrives.set(i, {
        joint,
        drive,
        driveEnum,
        baseDriveStiffness: def.drive.stiffness,
        baseDriveDamping: def.drive.damping,
        forceLimit: def.drive.forceLimit,
        group: def.drive.group,
        def,
        lastStiffness: stiffness,
      })
    }
  }

  // --- Step 6d: Fixed update for REACTIVE state ---

  fixedUpdateReactive(delta, isMoving, capsuleVelocity, moveDir, grounded = true) {
    // --- 1. Detect walk→stop transition: pick which foot to plant (ground only) ---
    const justStopped = this._wasMoving && !isMoving && grounded
    if (justStopped) {
      const leftFoot = this.bodies.get('leftLowerLeg')
      const rightFoot = this.bodies.get('rightLowerLeg')
      if (leftFoot && rightFoot && this._prevMoveDir.lengthSq() >= 0.001) {
        const forward = _v5.copy(this._prevMoveDir)
        forward.y = 0
        forward.normalize()

        const leftPose = leftFoot.actor.getGlobalPose()
        const rightPose = rightFoot.actor.getGlobalPose()

        const leftDot = leftPose.p.x * forward.x + leftPose.p.z * forward.z
        const rightDot = rightPose.p.x * forward.x + rightPose.p.z * forward.z

        this._plantedSide = leftDot < rightDot ? 'left' : 'right'
        this._plantedForward = forward.clone()
        this._plantedTimer = 0.3
      }
    } else if (isMoving) {
      this._plantedSide = null
      this._plantedForward = null
      this._plantedTimer = 0
    }
    if (this._plantedTimer > 0) {
      this._plantedTimer -= delta
      if (this._plantedTimer <= 0) {
        this._plantedSide = null
        this._plantedForward = null
      }
    }
    this._wasMoving = isMoving

    // --- 2. Arm swing detection + kicks ---
    const { armSwingKickForward, armSwingKickLateral, armSwingDuration,
            armSwingDirChangeThreshold } = REACTIVE_DEFAULTS

    if (justStopped && this._prevMoveDir.lengthSq() > 0) {
      // Walk→stop: arms swing forward with momentum
      this._armSwingActive = true
      this._armSwingTimer = armSwingDuration
      const fwd = this._prevMoveDir
      const lateral = _v6.set(-fwd.z, 0, fwd.x) // perpendicular to old forward direction
      const kickVec = _v7.set(lateral.x * armSwingKickForward, 0, lateral.z * armSwingKickForward).toPxVec3()
      for (const name of ARM_BODIES) {
        const body = this.bodies.get(name)
        if (body) body.actor.setAngularVelocity(kickVec)
      }
    } else if (isMoving && moveDir && moveDir.lengthSq() > 0 && this._prevMoveDir.lengthSq() > 0) {
      // Direction change: arms lag behind in old direction
      const dot = moveDir.x * this._prevMoveDir.x + moveDir.z * this._prevMoveDir.z
      if (dot < armSwingDirChangeThreshold) {
        this._armSwingActive = true
        this._armSwingTimer = armSwingDuration
        const oldDir = this._prevMoveDir
        const lateral = _v6.set(-oldDir.z, 0, oldDir.x)
        const kickVec = _v7.set(lateral.x * armSwingKickLateral, 0, lateral.z * armSwingKickLateral).toPxVec3()
        for (const name of ARM_BODIES) {
          const body = this.bodies.get(name)
          if (body) body.actor.setAngularVelocity(kickVec)
        }
      }
    }

    // --- 3. Store previous move direction ---
    if (moveDir && isMoving && moveDir.lengthSq() > 0) {
      this._prevMoveDir.copy(moveDir)
    }

    // Count down arm swing timer
    if (this._armSwingTimer > 0) {
      this._armSwingTimer -= delta
      if (this._armSwingTimer <= 0) {
        this._armSwingActive = false
      }
    }

    // --- 4. Angular velocity zeroing (with arm + free leg exemptions) ---
    const freeLegBodies = this._plantedSide === 'left' ? RIGHT_LEG_BODIES
      : this._plantedSide === 'right' ? LEFT_LEG_BODIES
      : null
    const plantedLegBodies = this._plantedSide === 'left' ? LEFT_LEG_BODIES
      : this._plantedSide === 'right' ? RIGHT_LEG_BODIES
      : null

    // Build skip/zeroLinear sets for _zeroBodyVelocities
    const skipAngular = new Set()
    const zeroLinear = new Set()
    if (this._armSwingActive) for (const n of ARM_BODIES) skipAngular.add(n)
    if (freeLegBodies) for (const n of freeLegBodies) skipAngular.add(n)
    if (plantedLegBodies) for (const n of plantedLegBodies) zeroLinear.add(n)
    this._zeroBodyVelocities(skipAngular.size ? skipAngular : null, zeroLinear.size ? zeroLinear : null)

    // --- 5. Planted foot kick (on stop frame) ---
    if (justStopped && freeLegBodies && this._plantedForward) {
      const kickStrength = 8
      const lateral = _v6.set(-this._plantedForward.z, 0, this._plantedForward.x)
      const kickVec = _v7.set(lateral.x * kickStrength, 0, lateral.z * kickStrength).toPxVec3()
      for (const legName of freeLegBodies) {
        const legBody = this.bodies.get(legName)
        if (legBody) legBody.actor.setAngularVelocity(kickVec)
      }
    }

    // --- 6. Momentum lean computation ---
    const { leanMaxAngle, leanSpeedScale, leanSmoothUp, leanSmoothDown,
            leanStopOvershoot, leanLateralScale, leanMaxLateralAccel } = REACTIVE_DEFAULTS

    if (capsuleVelocity) {
      const hSpeed = Math.sqrt(capsuleVelocity.x * capsuleVelocity.x + capsuleVelocity.z * capsuleVelocity.z)

      // Forward lean proportional to speed (positive = lean forward)
      let targetLeanX = hSpeed * leanSpeedScale

      // On sudden stop: backward overshoot (negative = lean backward)
      if (justStopped) {
        targetLeanX = -leanStopOvershoot
      }

      // Lateral lean from horizontal acceleration
      let targetLeanZ = 0
      if (delta > 0) {
        const accelX = (capsuleVelocity.x - this._prevVelocity.x) / delta
        const accelZ = (capsuleVelocity.z - this._prevVelocity.z) / delta

        const animHipsPose = this.animPoseCache.get('hips')
        if (animHipsPose && (accelX !== 0 || accelZ !== 0)) {
          // Project acceleration onto character's right direction
          const right = _v5.set(1, 0, 0).applyQuaternion(animHipsPose.quaternion)
          right.y = 0
          right.normalize()
          let lateralAccel = accelX * right.x + accelZ * right.z
          lateralAccel = Math.max(-leanMaxLateralAccel, Math.min(leanMaxLateralAccel, lateralAccel))
          targetLeanZ = lateralAccel * leanLateralScale
        }
      }

      // Clamp
      targetLeanX = Math.max(-leanMaxAngle, Math.min(leanMaxAngle, targetLeanX))
      targetLeanZ = Math.max(-leanMaxAngle, Math.min(leanMaxAngle, targetLeanZ))

      // Smooth with exponential decay (fast ramp-up, slower settle)
      const rateX = Math.abs(targetLeanX) > Math.abs(this._leanAngleX) ? leanSmoothUp : leanSmoothDown
      const rateZ = Math.abs(targetLeanZ) > Math.abs(this._leanAngleZ) ? leanSmoothUp : leanSmoothDown
      this._leanAngleX += (targetLeanX - this._leanAngleX) * (1 - Math.exp(-rateX * delta))
      this._leanAngleZ += (targetLeanZ - this._leanAngleZ) * (1 - Math.exp(-rateZ * delta))

      this._prevVelocity.copy(capsuleVelocity)
    } else {
      // No velocity data — decay lean to zero
      this._leanAngleX += (0 - this._leanAngleX) * (1 - Math.exp(-leanSmoothDown * delta))
      this._leanAngleZ += (0 - this._leanAngleZ) * (1 - Math.exp(-leanSmoothDown * delta))
    }

    // --- 7. Anchor target update with lean offset ---
    const hipsPose = this.animPoseCache.get('hips')
    if (hipsPose && this.anchorActor) {
      const pose = this.anchorActor.getGlobalPose()
      hipsPose.position.toPxTransform(pose)

      // Apply lean quaternion on top of animation hips rotation
      _q4.copy(hipsPose.quaternion)
      if (Math.abs(this._leanAngleX) > 0.01 || Math.abs(this._leanAngleZ) > 0.01) {
        // Forward/backward lean (around local X axis; negative angle = forward lean)
        _q2.setFromAxisAngle(_v5.set(1, 0, 0), -this._leanAngleX * DEG2RAD)
        _q4.multiply(_q2)
        // Lateral lean (around local Z axis; negative angle = lean right)
        _q2.setFromAxisAngle(_v5.set(0, 0, 1), -this._leanAngleZ * DEG2RAD)
        _q4.multiply(_q2)
      }
      _q4.toPxTransform(pose)
      this.anchorActor.setKinematicTarget(pose)
    }

    // --- 8. Drive targets from animation ---
    this._updateDriveTargetsFromAnimation()

  }

  // --- Step 6e: Late update for REACTIVE state ---

  lateUpdate(delta) {
    if (this.state === State.RECOVERING) {
      this._applyRecoveryBlend()
      return
    }
    if (this.state !== State.REACTIVE) return

    // Tick landing timer
    const landing = this._landingTimer > 0
    if (landing) this._landingTimer = Math.max(0, this._landingTimer - delta)

    // 1. Capture current animation poses (bones have animation values from update phase)
    this.captureAnimationPoses()

    // 2. Physics writeback — overwrite bones with physics body poses
    this._writePhysicsToBones()

    // 3. Update skeleton
    this._updateSkeleton()

    // 7. During landing window, snap leg bodies to final bone poses so drives
    //    start next frame already aligned (prevents oscillation from drive lag)
    if (landing) {
      const legNames = LEFT_LEG_BODIES.concat(RIGHT_LEG_BODIES)
      for (const name of legNames) {
        const body = this.bodies.get(name)
        if (!body) continue
        this._syncBonePoseToBody(body)
        const pose = body.actor.getGlobalPose()
        _v1.toPxTransform(pose)
        _q1.toPxTransform(pose)
        body.actor.setGlobalPose(pose)
      }
      const zeroVec = _v1.set(0, 0, 0).toPxVec3()
      for (const name of legNames) {
        const body = this.bodies.get(name)
        if (!body) continue
        body.actor.setLinearVelocity(zeroVec)
        body.actor.setAngularVelocity(zeroVec)
      }
    }

  }

  // --- Step 6f: Extracted physics-to-bone writeback ---

  _writePhysicsToBones() {
    // In REACTIVE mode: blend between animation and physics rotations (no positions).
    // Animation dominates during normal movement; impacts still show through.
    // Blend factor from REACTIVE_DEFAULTS controls how much physics affects the visual.
    const reactive = this.state === State.REACTIVE
    const blend = reactive ? REACTIVE_DEFAULTS.reactiveBlend : 1
    const blendLegs = (reactive && this._landingTimer > 0) ? 0 : (reactive ? REACTIVE_DEFAULTS.reactiveBlendLegs : 1)

    for (const [name, body] of this.bodies) {
      const { bone, segment, correctionLocal, interpolated } = body

      const worldQuat = _q1.copy(interpolated.quaternion)

      // remove limb correction
      if (correctionLocal) _q1.multiply(_q3.copy(correctionLocal).invert())

      // convert quaternion to bone-local space
      if (bone.parent) {
        _m1.multiplyMatrices(this.sceneMatrix, bone.parent.matrixWorld)
        _m1.decompose(_v4, _q2, _v3)
        _q4.copy(_q2).invert().multiply(worldQuat) // physics local quat
      } else {
        this.sceneMatrix.decompose(_v4, _q2, _v3)
        _q4.copy(_q2).invert().multiply(worldQuat)
      }

      if (reactive) {
        // bone.quaternion still has VRM animation value — slerp toward physics
        // legs use tighter blend (less physics) so they track animation better at speed
        const isLeg = name === 'leftUpperLeg' || name === 'leftLowerLeg' ||
                      name === 'rightUpperLeg' || name === 'rightLowerLeg'
        const b = isLeg ? blendLegs : blend
        bone.quaternion.slerp(_q4, b)
      } else {
        bone.quaternion.copy(_q4)
      }

      if (!reactive) {
        const worldPos = _v1.copy(interpolated.position)

        // remove segment offset
        _v2.set(segment.offset.x, correctionLocal ? -segment.offset.y : segment.offset.y, segment.offset.z)
        _v2.applyQuaternion(_q1.copy(interpolated.quaternion))
        worldPos.sub(_v2)

        _v5.subVectors(worldPos, _v4)
        _v5.applyQuaternion(_q4.copy(_q2).invert())
        bone.position.copy(_v5)
      }

      bone.updateMatrixWorld(true)
    }
  }

  // --- Step 7a: Disable anchor drives ---

  /** Toggle simulation collisions on all ragdoll bodies.
   *  false = non-colliding (reactive mode), true = prop-layer collisions (ragdoll mode). */
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

  _disableAnchorDrives() {
    if (!this.anchorJoint) return
    if (this.anchorDriveLinear) {
      this.anchorDriveLinear.stiffness = 0
      this.anchorDriveLinear.damping = 0
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eX, this.anchorDriveLinear)
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eY, this.anchorDriveLinear)
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eZ, this.anchorDriveLinear)
    }
    if (this.anchorDriveSlerp) {
      this.anchorDriveSlerp.stiffness = 0
      this.anchorDriveSlerp.damping = 0
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eSLERP, this.anchorDriveSlerp)
    }
    // Disable anchor simulation
    this.anchorActor?.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, true)
  }

  // --- Step 7b: Enable anchor drives ---

  _enableAnchorDrives() {
    if (!this.anchorJoint || !this.anchorActor) return
    const { anchorLinearStiffness, anchorLinearDamping,
            anchorAngularStiffness, anchorAngularDamping } = REACTIVE_DEFAULTS

    // Re-enable anchor simulation
    this.anchorActor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, false)

    // Snap anchor to current hips position (prevent sudden jerk)
    const hipsBody = this.bodies.get('hips')
    if (hipsBody) {
      const hipsPose = hipsBody.actor.getGlobalPose()
      const anchorPose = this.anchorActor.getGlobalPose()
      anchorPose.p.x = hipsPose.p.x; anchorPose.p.y = hipsPose.p.y; anchorPose.p.z = hipsPose.p.z
      anchorPose.q.x = hipsPose.q.x; anchorPose.q.y = hipsPose.q.y; anchorPose.q.z = hipsPose.q.z; anchorPose.q.w = hipsPose.q.w
      this.anchorActor.setGlobalPose(anchorPose)
    }

    // Restore drive stiffness
    if (this.anchorDriveLinear) {
      this.anchorDriveLinear.stiffness = anchorLinearStiffness
      this.anchorDriveLinear.damping = anchorLinearDamping
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eX, this.anchorDriveLinear)
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eY, this.anchorDriveLinear)
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eZ, this.anchorDriveLinear)
    }
    if (this.anchorDriveSlerp) {
      this.anchorDriveSlerp.stiffness = anchorAngularStiffness
      this.anchorDriveSlerp.damping = anchorAngularDamping
      this.anchorJoint.setDrive(PHYSX.PxD6DriveEnum.eSLERP, this.anchorDriveSlerp)
    }
  }

  // --- Step 9b: Transition to REACTIVE from recovery ---

  _transitionToReactive() {
    console.log('[Ragdoll] _transitionToReactive — recovery complete, re-entering REACTIVE')
    this.state = State.REACTIVE
    this.boneSnapshot.clear()

    // Re-enable simulation and switch bodies back to dynamic (reactive = no collisions/gravity/queries)
    this._configureBodyFlags({ simulation: true, gravity: false, sceneQuery: false, kinematic: false, ccd: false })

    // Sync all bodies to current animation pose
    this._syncAllBodiesToPose()

    // Zero all velocities
    this._zeroBodyVelocities(null, new Set(this.bodies.keys()))

    // Disable collisions for reactive mode
    this._setBodyCollisions(false)

    // Clean up old drives, then rebuild joints+drives+anchor
    this._cleanupDrives()
    this._prepareReactiveState()
  }

  /** Re-sync reactive state after sceneMatrix (base.matrixWorld) has changed externally. */
  resyncReactive() {
    if (this.state !== State.REACTIVE) return
    this._syncAllBodiesToPose()
    this._zeroBodyVelocities(null, new Set(this.bodies.keys()))
    this._cleanupDrives()
    this._prepareReactiveState()
  }

  /** Begin landing window — legs use pure animation for 0.25s while bodies resync. */
  onLanding() {
    if (this.state !== State.REACTIVE) return
    this._landingTimer = 0.25
  }

  activate(velocity, hitInfo) {
    if (this.state === State.RAGDOLL) return
    const wasReactive = this.state === State.REACTIVE
    console.log(`[Ragdoll] activate — entering RAGDOLL (from ${wasReactive ? 'REACTIVE' : 'KINEMATIC'}, velocity=${velocity?.length().toFixed(1) || 0}, hit=${hitInfo?.bone || 'none'})`)
    this.state = State.RAGDOLL

    // pause VRM animation — prevents mixer from overwriting bone quaternions
    this.vrm.paused = true

    // Disable anchor drives (hips should move freely in ragdoll)
    this._disableAnchorDrives()

    // Clean up reactive drives and restore collisions before setting up ragdoll drives
    if (wasReactive) {
      this._cleanupDrives()
      this._setBodyCollisions(true)
      this._configureBodyFlags({ gravity: true, ccd: true, sceneQuery: true })
    }

    // Sync body poses to current bone positions so joint frames are computed correctly
    this._syncAllBodiesToPose()

    if (!wasReactive) {
      // Coming from KINEMATIC/OFF — re-enable simulation and scene queries
      this._configureBodyFlags({ simulation: true, sceneQuery: true })
    }

    // rebuild joints based on current body positions/orientations
    this._rebuildJoints()

    // set up active ragdoll drives before switching to dynamic
    this.activeTimer = 0
    this.impactVelocity = velocity ? velocity.length() : 0
    this.fallDirection = this._computeFallDirection(velocity)
    this.muscleMultiplier = 1
    this.hitSideMuscleMultiplier = 1
    this.flailTimer = 0
    this.bracingActive = false
    this.hitSide = hitInfo?.hitSide || null
    this.hitBone = hitInfo?.bone || null

    // compute velocity propagation and drive weakening for localized hits
    let velScales = null
    this.hitJointScales = null
    if (hitInfo) {
      const { spineConnectionScale, limbConnectionScale } = ACTIVE_RAGDOLL_DEFAULTS

      const SPINE_PAIRS = new Set([
        'hips-chest', 'chest-hips', 'chest-head', 'head-chest',
      ])

      // build adjacency graph from joint definitions
      const adjacency = new Map()
      for (const def of JOINT_DEFINITIONS) {
        if (!adjacency.has(def.parent)) adjacency.set(def.parent, [])
        if (!adjacency.has(def.child)) adjacency.set(def.child, [])
        adjacency.get(def.parent).push(def.child)
        adjacency.get(def.child).push(def.parent)
      }

      // BFS from hit bone — multiplicative propagation with connection-type falloff
      velScales = new Map()
      velScales.set(hitInfo.bone, 1.0)
      const queue = [{ name: hitInfo.bone, scale: 1.0 }]
      const visited = new Set([hitInfo.bone])
      while (queue.length > 0) {
        const { name: cur, scale: parentScale } = queue.shift()
        const neighbors = adjacency.get(cur) || []
        for (const n of neighbors) {
          if (visited.has(n)) continue
          visited.add(n)
          const isSpine = SPINE_PAIRS.has(`${cur}-${n}`)
          const newScale = parentScale * (isSpine ? spineConnectionScale : limbConnectionScale)
          if (newScale < 0.03) continue
          velScales.set(n, newScale)
          queue.push({ name: n, scale: newScale })
        }
      }

      // weaken drives near the hit zone so the struck limb goes limp
      // build scales keyed by JOINT_DEFINITIONS index first, then remap to joint array index
      const defScales = new Map()
      for (let i = 0; i < JOINT_DEFINITIONS.length; i++) {
        const def = JOINT_DEFINITIONS[i]
        if (def.parent === hitInfo.bone || def.child === hitInfo.bone) {
          defScales.set(i, 0.12)
        } else {
          const neighbors = adjacency.get(hitInfo.bone) || []
          if (neighbors.includes(def.parent) || neighbors.includes(def.child)) {
            defScales.set(i, 0.4)
          }
        }
      }
      // remap to joint array indices using jointDefIndices
      this.hitJointScales = new Map()
      for (let i = 0; i < this.jointDefIndices.length; i++) {
        const scale = defScales.get(this.jointDefIndices[i])
        if (scale != null) this.hitJointScales.set(i, scale)
      }
    }

    this._setupDrives()

    // Apply velocities (and switch to dynamic if not already)
    const { angularImpulseScale, torsoSpinSpeed } = ACTIVE_RAGDOLL_DEFAULTS
    for (const [name, body] of this.bodies) {
      if (!wasReactive) {
        // Switch from kinematic to dynamic
        body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, false)
        body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, true)
      }

      if (hitInfo) {
        const scale = velScales.get(name) || 0
        if (scale > 0) {
          body.actor.setLinearVelocity(
            _v1.copy(hitInfo.velocity).multiplyScalar(scale).toPxVec3()
          )
        }

        if (scale > 0.1) {
          const pose = body.actor.getGlobalPose()
          const bqx = pose.q.x, bqy = pose.q.y, bqz = pose.q.z, bqw = pose.q.w
          _q1.set(bqx, bqy, bqz, bqw)
          const bodyAxisX = 2 * (bqx * bqy - bqw * bqz)
          const bodyAxisY = 1 - 2 * (bqx * bqx + bqz * bqz)
          const bodyAxisZ = 2 * (bqy * bqz + bqw * bqx)
          const hitLen = hitInfo.velocity.length() || 1
          const hdx = hitInfo.velocity.x / hitLen
          const hdy = hitInfo.velocity.y / hitLen
          const hdz = hitInfo.velocity.z / hitLen
          const cx = hdy * bodyAxisZ - hdz * bodyAxisY
          const cy = hdz * bodyAxisX - hdx * bodyAxisZ
          const cz = hdx * bodyAxisY - hdy * bodyAxisX
          const angMag = scale * angularImpulseScale
          _v4.set(cx * angMag, cy * angMag, cz * angMag)
          body.actor.setAngularVelocity(_v4.toPxVec3())
        }
      } else if (velocity) {
        body.actor.setLinearVelocity(velocity.toPxVec3())
      }
    }

    // torso spin for off-center hits on center-mass bodies
    if (hitInfo && this.hitSide && ['hips', 'chest'].includes(hitInfo.bone)) {
      const torsoBody = this.bodies.get(hitInfo.bone)
      if (torsoBody) {
        const ySign = this.hitSide === 'right' ? -1 : 1
        const av = torsoBody.actor.getAngularVelocity()
        _v1.set(av.x, av.y + ySign * torsoSpinSpeed, av.z)
        torsoBody.actor.setAngularVelocity(_v1.toPxVec3())
      }
    }
  }

  deactivate() {
    if (this.state !== State.RAGDOLL) return
    console.log('[Ragdoll] deactivate — entering RECOVERING')
    this.state = State.RECOVERING
    this.recoveryTimer = 0

    this._cleanupDrives()

    // switch bodies to kinematic and disable simulation + scene queries so they don't block the player
    for (const [name, body] of this.bodies) {
      body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eENABLE_CCD, false)
      body.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)
      body.actor.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_SIMULATION, true)
      body.shape.setFlag(PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE, false)
    }

    // snapshot current ragdoll bone transforms for blending
    this.boneSnapshot.clear()
    for (const [name, body] of this.bodies) {
      this.boneSnapshot.set(name, {
        quaternion: body.bone.quaternion.clone(),
        position: body.bone.position.clone(),
      })
    }

    // snapshot hips world position for position blending
    const hipsBody = this.bodies.get('hips')
    if (hipsBody) {
      const pose = hipsBody.actor.getGlobalPose()
      this.recoveryStartY = pose.p.y
    }
  }

  fixedUpdate(delta) {
    if (this.state !== State.KINEMATIC) return

    // sync kinematic bodies to current bone poses
    for (const [name, body] of this.bodies) {
      this._syncBonePoseToBody(body)
      const pose = body.actor.getGlobalPose()
      _v1.toPxTransform(pose)
      _q1.toPxTransform(pose)
      body.actor.setKinematicTarget(pose)
    }

  }

  update(delta) {
    if (this.state === State.RAGDOLL) {
      this._updateRagdoll(delta)
    } else if (this.state === State.RECOVERING) {
      this._updateRecovery(delta)
    }
  }

  _updateRagdoll(delta) {
    this._updateDrives(delta)

    // physics -> bones (extracted to shared method)
    this._writePhysicsToBones()

    this._updateSkeleton()
  }

  _updateRecovery(delta) {
    // Only advance timer here — bone blending moved to _applyRecoveryBlend()
    // which runs in lateUpdate (after VRM/skeleton updates that would overwrite bones)
    this.recoveryTimer += delta
  }

  /**
   * Apply recovery bone blend. Must be called from lateUpdate so bone transforms
   * aren't overwritten by VRM animation/skeleton updates that run after update().
   */
  _applyRecoveryBlend() {
    const linear = Math.min(this.recoveryTimer / RAGDOLL_DEFAULTS.blendDuration, 1)
    const t = linear * linear * (3 - 2 * linear)

    for (const [name, body] of this.bodies) {
      const { bone } = body
      const snapshot = this.boneSnapshot.get(name)
      const rest = this.boneRestPoses.get(name)

      if (snapshot && rest) {
        bone.quaternion.copy(snapshot.quaternion).slerp(rest.quaternion, t)
        bone.position.copy(snapshot.position).lerp(rest.position, t)
        bone.updateMatrixWorld(true)
      }
    }

    this._updateSkeleton()

    // when blend is complete, resume animation and transition to REACTIVE
    if (linear >= 1) {
      this.vrm.paused = false
      this._transitionToReactive()
    }
  }

  _updateSkeleton() {
    const skeleton = this.vrm.skeleton
    if (!skeleton) return
    skeleton.update = THREE.Skeleton.prototype.update
    skeleton.bones.forEach(bone => bone.updateMatrixWorld())
    skeleton.update()
  }

  isActive() {
    return this.state === State.RAGDOLL || this.state === State.RECOVERING
  }

  getHipsPosition() {
    const hipsBody = this.bodies.get('hips')
    if (!hipsBody) return null
    return hipsBody.interpolated.position
  }

  getState() {
    return this.state
  }

  getRecoveryProgress() {
    return { timer: this.recoveryTimer, startY: this.recoveryStartY }
  }

  getBodyActor(name) {
    return this.bodies.get(name)?.actor
  }

  applyImpulse(boneName, force) {
    let body = this.bodies.get(boneName)
    if (!body) {
      for (const [name, b] of this.bodies) {
        if (b.segment.bone === boneName) {
          body = b
          break
        }
      }
    }
    if (!body || this.state !== State.RAGDOLL) return

    const forceVec = force.isVector3 ? force : _v2.set(force.x || 0, force.y || 0, force.z || 0)
    body.actor.addForce(forceVec.toPxVec3(), PHYSX.PxForceModeEnum.eIMPULSE, true)
  }

  _computeFallDirection(velocity) {
    if (!velocity || velocity.lengthSq() < 0.01) return 'forward'
    this.sceneMatrix.decompose(_v4, _q2, _v3)
    const fwd = _v1.set(0, 0, -1).applyQuaternion(_q2)
    const right = _v2.set(1, 0, 0).applyQuaternion(_q2)
    const dotFwd = velocity.x * fwd.x + velocity.z * fwd.z
    const dotRight = velocity.x * right.x + velocity.z * right.z
    if (Math.abs(dotFwd) >= Math.abs(dotRight)) {
      return dotFwd > 0 ? 'forward' : 'backward'
    }
    return dotRight > 0 ? 'right' : 'left'
  }

  _setupDrives() {
    if (!this.driveTargetTransform) {
      this.driveTargetTransform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    }

    const { impactVelocityMin, impactVelocityMax, transitionStiffnessBoost } = ACTIVE_RAGDOLL_DEFAULTS
    const impactScale = 1 - Math.min(
      Math.max((this.impactVelocity - impactVelocityMin) / (impactVelocityMax - impactVelocityMin), 0), 1
    )

    const groupMultipliers = {
      neck: ACTIVE_RAGDOLL_DEFAULTS.neckStiffnessMultiplier,
      core: ACTIVE_RAGDOLL_DEFAULTS.coreStiffnessMultiplier,
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
      const hitScale = this.hitJointScales?.get(i) ?? 1.0
      const stiffness = def.drive.stiffness * impactScale * groupMult * hitScale * transitionStiffnessBoost
      const damping = def.drive.damping * impactScale * groupMult * hitScale * transitionStiffnessBoost

      const drive = new PHYSX.PxD6JointDrive(stiffness, damping, def.drive.forceLimit, true)

      // hinge joints: eTWIST drive, socket joints: eSLERP drive
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
        forceLimit: def.drive.forceLimit,
        group: def.drive.group,
        def,
        lastStiffness: stiffness,
      })
    }

    this._computeDynamicBracingPoses()
  }

  _updateDrives(delta) {
    if (this.jointDrives.size === 0) return

    this.activeTimer += delta

    const {
      muscleFadeDuration, muscleFadeDelay,
      bracingDelay, bracingDuration, bracingArmStiffness,
      flailDuration, flailForceMin, flailForceMax, flailInterval, flailDecayRate,
      neckStiffnessMultiplier, coreStiffnessMultiplier,
      impactVelocityMin, impactVelocityMax,
      hitSideFadeMultiplier, legBuckleDuration, legBuckleScale,
      transitionDuration, transitionStiffnessBoost,
    } = ACTIVE_RAGDOLL_DEFAULTS

    const effectiveTimer = Math.max(0, this.activeTimer - transitionDuration)
    const inTransition = this.activeTimer < transitionDuration

    const impactScale = 1 - Math.min(
      Math.max((this.impactVelocity - impactVelocityMin) / (impactVelocityMax - impactVelocityMin), 0), 1
    )

    // Phase 1: Muscle fade
    if (effectiveTimer > muscleFadeDelay) {
      const fadeElapsed = effectiveTimer - muscleFadeDelay
      const fadeProgress = Math.min(fadeElapsed / muscleFadeDuration, 1)
      this.muscleMultiplier = Math.exp(-3 * fadeProgress)
      this.hitSideMuscleMultiplier = this.hitSide
        ? Math.exp(-3 * fadeProgress * hitSideFadeMultiplier)
        : this.muscleMultiplier
    } else {
      this.muscleMultiplier = 1
      this.hitSideMuscleMultiplier = 1
    }

    // Phase 2: Arm bracing
    const bracingStart = bracingDelay
    const bracingEnd = bracingDelay + bracingDuration
    if (effectiveTimer >= bracingStart && effectiveTimer < bracingEnd) {
      if (!this.bracingActive) {
        this.bracingActive = true
        this._applyBracingTargets()
      }
    } else if (this.bracingActive) {
      this.bracingActive = false
      this._clearBracingTargets()
    }

    // Phase 3: Leg buckling
    const isLowerBodyHit = this.hitBone && LOWER_BODY_NAMES.includes(this.hitBone)
    const legBuckleMod = (isLowerBodyHit && !inTransition && effectiveTimer < legBuckleDuration)
      ? legBuckleScale + (1 - legBuckleScale) * (effectiveTimer / legBuckleDuration)
      : 1.0

    // Phase 4: Update drive stiffness/damping
    const groupFadeMultipliers = {
      neck: this.bracingActive
        ? Math.max(this.muscleMultiplier * neckStiffnessMultiplier, 0.9)
        : Math.max(this.muscleMultiplier * neckStiffnessMultiplier, 0),
      core: Math.max(this.muscleMultiplier * coreStiffnessMultiplier, 0),
      arm: this.bracingActive ? Math.max(this.muscleMultiplier, 0.8) : this.muscleMultiplier,
      leg: this.muscleMultiplier * legBuckleMod,
    }

    for (const [i, entry] of this.jointDrives) {
      const def = entry.def
      const groupMod = groupFadeMultipliers[entry.group] || this.muscleMultiplier
      const hitScale = this.hitJointScales?.get(i) ?? 1.0

      const isHitSideJoint = this.hitSide && (
        def.child.startsWith(this.hitSide) || def.parent.startsWith(this.hitSide)
      )

      const transitionBoost = inTransition ? transitionStiffnessBoost : 1.0
      const newStiffness = entry.baseDriveStiffness * impactScale * groupMod * hitScale *
        (isHitSideJoint ? (this.hitSideMuscleMultiplier / (this.muscleMultiplier || 0.001)) : 1.0) *
        transitionBoost
      const newDamping = entry.baseDriveDamping * impactScale * groupMod * hitScale *
        (isHitSideJoint ? (this.hitSideMuscleMultiplier / (this.muscleMultiplier || 0.001)) : 1.0) *
        transitionBoost

      if (Math.abs(newStiffness - entry.lastStiffness) > 1) {
        const finalStiffness = (this.bracingActive && entry.group === 'arm')
          ? Math.max(newStiffness, bracingArmStiffness * (isHitSideJoint ? this.hitSideMuscleMultiplier : this.muscleMultiplier))
          : newStiffness

        // mutate existing drive object (no per-frame create/destroy)
        entry.drive.stiffness = finalStiffness
        entry.drive.damping = newDamping
        entry.joint.setDrive(entry.driveEnum, entry.drive)
        entry.lastStiffness = finalStiffness
      }
    }

    // Phase 5: Flailing
    if (effectiveTimer < flailDuration) {
      const decayFactor = Math.exp(-flailDecayRate * effectiveTimer)
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

        if (effectiveTimer < 0.5) {
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

  _computeBracingTarget(jointIndex, desiredWorldDir, swingAngleDeg) {
    const frameInfo = this.jointFrames.get(jointIndex)
    if (!frameInfo) return null

    const dir = frameInfo.boneSign < 0
      ? _v5.copy(desiredWorldDir).negate()
      : _v5.copy(desiredWorldDir)

    const frameWorldQuat = _q4.copy(frameInfo.parentWorldQuat).multiply(frameInfo.parentFrameQuat)
    const frameY = _v6.set(0, 1, 0).applyQuaternion(frameWorldQuat)
    const frameZ = _v7.set(0, 0, 1).applyQuaternion(frameWorldQuat)

    const dotY = dir.dot(frameY)
    const dotZ = dir.dot(frameZ)
    const projLen = Math.sqrt(dotY * dotY + dotZ * dotZ)

    if (projLen < 0.001) return null

    _v5.set(0, -dotZ / projLen, dotY / projLen) // swing axis (reuse _v5, dir no longer needed)
    return new THREE.Quaternion().setFromAxisAngle(_v5, swingAngleDeg * DEG2RAD)
  }

  _computeDynamicBracingPoses() {
    this.bracingTargets.clear()

    const { bracingArmSwingAngle, bracingHeadSwingAngle } = ACTIVE_RAGDOLL_DEFAULTS

    // decompose scene matrix using temps (_v5=pos, _q4=quat, _v3=scale)
    this.sceneMatrix.decompose(_v5, _q4, _v3)

    // charFwd, charRight stored as copies since we need them across branches
    const charFwd = _v6.set(0, 0, -1).applyQuaternion(_q4)
    const cfx = charFwd.x, cfy = charFwd.y, cfz = charFwd.z
    const charRight = _v7.set(1, 0, 0).applyQuaternion(_q4)
    const crx = charRight.x, cry = charRight.y, crz = charRight.z
    // charDown is constant (0, -1, 0)

    const jointIndices = {}
    for (let i = 0; i < this.joints.length; i++) {
      const defIdx = this.jointDefIndices[i]
      const child = JOINT_DEFINITIONS[defIdx].child
      if (['leftUpperArm', 'rightUpperArm', 'head'].includes(child)) {
        jointIndices[child] = i
      }
    }

    // compute bracing directions per fall direction
    // each dir is stored as a new Vector3 since _computeBracingTarget uses _v5/_v6/_v7
    let leftArmDir, rightArmDir, headDir

    // helper: normalize (a+b), then add offset, then normalize again (matches original two-step normalize)
    const addNormOffset = (ax, ay, az, ox, oy, oz) => {
      let len = Math.sqrt(ax * ax + ay * ay + az * az)
      if (len > 0) { ax /= len; ay /= len; az /= len }
      return new THREE.Vector3(ax + ox, ay + oy, az + oz).normalize()
    }

    const dir = this.fallDirection
    if (dir === 'forward') {
      leftArmDir = addNormOffset(cfx, cfy - 1, cfz, -crx * 0.3, -cry * 0.3, -crz * 0.3)
      rightArmDir = addNormOffset(cfx, cfy - 1, cfz, crx * 0.3, cry * 0.3, crz * 0.3)
      headDir = new THREE.Vector3(cfx, cfy - 1, cfz).normalize()
    } else if (dir === 'backward') {
      leftArmDir = addNormOffset(-cfx, -cfy - 1, -cfz, -crx * 0.4, -cry * 0.4, -crz * 0.4)
      rightArmDir = addNormOffset(-cfx, -cfy - 1, -cfz, crx * 0.4, cry * 0.4, crz * 0.4)
      headDir = new THREE.Vector3(cfx, cfy - 1, cfz).normalize()
    } else if (dir === 'left') {
      leftArmDir = new THREE.Vector3(-crx, -cry - 1, -crz).normalize()
      rightArmDir = addNormOffset(-crx, -cry - 1, -crz, cfx * 0.3, cfy * 0.3, cfz * 0.3)
      headDir = new THREE.Vector3(crx * 0.5, cry * 0.5 - 1, crz * 0.5).normalize()
    } else {
      rightArmDir = new THREE.Vector3(crx, cry - 1, crz).normalize()
      leftArmDir = addNormOffset(crx, cry - 1, crz, cfx * 0.3, cfy * 0.3, cfz * 0.3)
      headDir = new THREE.Vector3(-crx * 0.5, -cry * 0.5 - 1, -crz * 0.5).normalize()
    }

    const targets = [
      { name: 'leftUpperArm', dir: leftArmDir, angle: bracingArmSwingAngle },
      { name: 'rightUpperArm', dir: rightArmDir, angle: bracingArmSwingAngle },
      { name: 'head', dir: headDir, angle: bracingHeadSwingAngle },
    ]

    for (const { name, dir: desiredDir, angle } of targets) {
      const idx = jointIndices[name]
      if (idx == null) continue
      const q = this._computeBracingTarget(idx, desiredDir, angle)
      if (q) {
        this.bracingTargets.set(idx, q)
      }
    }
  }

  _applyBracingTargets() {
    const t = this.driveTargetTransform
    if (!t) return

    for (const [i, q] of this.bracingTargets) {
      t.p.x = 0; t.p.y = 0; t.p.z = 0
      t.q.x = q.x; t.q.y = q.y; t.q.z = q.z; t.q.w = q.w
      this.joints[i].setDrivePosition(t)
    }
  }

  _clearBracingTargets() {
    const t = this.driveTargetTransform
    if (!t) return
    t.p.x = 0; t.p.y = 0; t.p.z = 0
    t.q.x = 0; t.q.y = 0; t.q.z = 0; t.q.w = 1

    for (const [i] of this.bracingTargets) {
      this.joints[i].setDrivePosition(t)
    }
  }

  _cleanupDrives() {
    for (const [i, entry] of this.jointDrives) {
      entry.drive.stiffness = 0
      entry.drive.damping = 0
      entry.joint.setDrive(entry.driveEnum, entry.drive)
      PHYSX.destroy(entry.drive)
    }
    this.jointDrives.clear()
    this.bracingActive = false
    this.jointFrames.clear()
    this.bracingTargets.clear()
    this.hitJointScales = null
    this.hitSide = null
    this.hitBone = null
  }

  _destroyJoints() {
    for (const joint of this.joints) {
      joint.release()
    }
    this.joints.length = 0
    this.jointDefIndices.length = 0
    this.jointFrames.clear()
    this.jointRestPoses.clear()
    this.jointFrameQuats.clear()
  }

  destroy() {
    // resume VRM animation
    if (this.vrm) {
      this.vrm.paused = false
    }

    this._cleanupDrives()
    this._destroyJoints()
    this._destroyAnchorJoint()
    if (this.driveTargetTransform) {
      PHYSX.destroy(this.driveTargetTransform)
      this.driveTargetTransform = null
    }

    // destroy anchor actor
    if (this.anchorActor) {
      this.anchorHandle.destroy()
      this.anchorShape.release()
      this.anchorActor = null
      this.anchorHandle = null
      this.anchorShape = null
    }

    // destroy bodies
    for (const [name, body] of this.bodies) {
      const { actor, handle, shape } = body
      handle.destroy()
      shape.release()
    }
    this.bodies.clear()

    // release material
    if (this.material) {
      this.material.release()
      this.material = null
    }

    this.boneRestPoses.clear()
    this.boneSnapshot.clear()
    this.animPoseCache.clear()
    this.built = false
    this.state = State.OFF
  }
}
