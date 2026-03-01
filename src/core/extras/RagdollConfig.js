/**
 * Ragdoll Physics Configuration
 * Maps VRM humanoid bones to physics body segments and joints.
 */

// 11 body segments, each maps a VRM bone name to a physics collider
export const BODY_SEGMENTS = [
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
  export const JOINT_DEFINITIONS = [
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
  
  export const RAGDOLL_DEFAULTS = {
    linearDamping: 0.5,
    angularDamping: 1.5,
    blendDuration: 0.4,
  }
  
  export const REACTIVE_DEFAULTS = {
    // Drive multipliers — applied on top of each joint's base drive.stiffness/damping
    driveStiffnessMultiplier: 3.0,
    driveDampingMultiplier: 3.0,
  
    // Blend factor for physics→bone rotation writeback (0 = pure animation, 1 = pure physics)
    // Lower values give cleaner animation; higher values show more physical reaction.
    reactiveBlend: 0.25,
    reactiveBlendLegs: 0.25,  // legs blend less physics — tighter animation tracking at speed
  
    // Anchor→hips D6 joint: linear tracking (position)
    anchorLinearStiffness: 5000,
    anchorLinearDamping: 1000,
    anchorLinearForceLimit: 10000,
  
    // Anchor→hips D6 joint: angular tracking (rotation)
    anchorAngularStiffness: 3000,
    anchorAngularDamping: 300,
    anchorAngularForceLimit: 5000,
  
    // Momentum lean — body tilts in response to movement
    leanMaxAngle: 5,           // max lean in degrees
    leanSpeedScale: 0.4,       // degrees of forward lean per m/s of horizontal speed
    leanSmoothUp: 10,          // exponential decay rate for ramping up lean
    leanSmoothDown: 8,         // exponential decay rate for settling lean
    leanStopOvershoot: 4,      // degrees of backward tilt on sudden stop
    leanLateralScale: 0.008,   // lateral acceleration → lean degrees scale factor
    leanMaxLateralAccel: 30,   // clamp lateral acceleration input (m/s²) to avoid turn spikes
  
    // Arm swing overshoot — arms lag behind on stop/turn
    armSwingKickForward: 5,    // rad/s angular kick on walk→stop (arms swing forward)
    armSwingKickLateral: 2,    // rad/s angular kick on direction change (arms lag behind)
    armSwingDuration: 0.2,     // seconds arms exempt from angular velocity zeroing
    armSwingDirChangeThreshold: -0.2, // dot product threshold — only fires on near-180° reversals
  }
  
  // Body name groups — used for targeted effects (flailing, bracing, velocity zeroing)
  export const ARM_BODIES = ['leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm']
  export const LEFT_LEG_BODIES = ['leftUpperLeg', 'leftLowerLeg']
  export const RIGHT_LEG_BODIES = ['rightUpperLeg', 'rightLowerLeg']
  export const CORE_BODIES_NAMES = ['hips', 'chest']
  export const LOWER_BODY_NAMES = ['hips', 'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg']
  
  // Flailing arm scales (upper arms get less torque than lower)
  export const FLAIL_ARM_PARTS = [
    { name: 'leftUpperArm', scale: 0.2 },
    { name: 'leftLowerArm', scale: 0.6 },
    { name: 'rightUpperArm', scale: 0.2 },
    { name: 'rightLowerArm', scale: 0.6 },
  ]
  
  export const ACTIVE_RAGDOLL_DEFAULTS = {
    muscleFadeDuration: 3.5,   // seconds until fully limp
    muscleFadeDelay: 0.5,      // full stiffness before fade begins
    impactVelocityMin: 5,      // velocity range for scaling initial stiffness
    impactVelocityMax: 25,
    bracingDelay: 0.05,        // seconds before bracing starts
    bracingDuration: 0.8,      // bracing window length
    bracingArmStiffness: 400,  // override arm stiffness during bracing
    flailDuration: 1.2,        // arm perturbation window
    flailForceMin: 0.8,
    flailForceMax: 3,
    flailInterval: 0.1,        // seconds between flail impulses
    flailDecayRate: 2.5,       // exponential decay rate for flail intensity
    neckStiffnessMultiplier: 2.0,  // neck fades slowest
    coreStiffnessMultiplier: 1.5,  // core fades next slowest
    activeRecoveryDelay: 1.5,  // minimum seconds before recovery input accepted
    settledVelocityThreshold: 0.8,  // max total velocity to count as "settled" (not sliding)
    settledDuration: 0.35,          // seconds the body must be settled on ground before getup allowed
    bracingArmSwingAngle: 55,  // degrees — how far arms swing toward fall direction
    bracingHeadSwingAngle: 18, // degrees — neck tuck (safely within 20 deg limit)
  
    // --- transition parameters ---
    transitionDuration: 0.15,        // seconds of pose-hold before active ragdoll effects begin
    transitionStiffnessBoost: 3.0,   // drive stiffness multiplier during transition (holds fall pose tightly)
  
    // --- enhanced realism parameters ---
    angularImpulseScale: 6,       // angular velocity applied to struck body (rad/s)
    hitSideFadeMultiplier: 2.5,   // hit-side muscles fade this much faster
    legBuckleDuration: 1.0,       // seconds of knee weakness after lower-body hit
    legBuckleScale: 0.05,         // knee drive scale during buckling (nearly zero)
    spineConnectionScale: 0.7,    // velocity propagation through spine joints
    limbConnectionScale: 0.5,     // velocity propagation through limb joints
    torsoSpinSpeed: 4,            // Y-axis angular velocity for off-center torso hits
    steeringForce: 30,            // per-body horizontal force via WASD while ragdolling (applied to all 11 bodies)
  }
  
  export const ARM_OVERRIDE_DEFAULTS = {
    blendInRate: 6,              // exponential blend-in speed (snappy aim raise)
    blendOutRate: 4,             // exponential blend-out speed (smooth lower)
    upperArmBlend: 0.95,         // how much upperArm rotates toward elbow hint
    lowerArmBlend: 1.0,          // how much lowerArm rotates toward hand target (1.0 = fully locked)
    elbowDrop: 0.20,             // how far below hand target the elbow hint sits (meters)
    elbowOut: 0.15,              // how far outward from body center the elbow pushes (meters)
  }
  