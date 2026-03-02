# Ragdoll Branch Diff Notes (ragdoll vs dev)

## Commits
- `112a6e3` document world.set/get
- `3cd82fd` init
- `5c2b473` smoothness, docs

## Summary
+2,587 lines / -2 lines across 10 files. Adds a full ragdoll physics system for player avatars using PhysX D6 joints, plus docs and minor VRM factory changes.

---

## File-by-File Breakdown

### Docs
- **docs/scripting/world/Player.md** — New `.ragdoll(enable, force?)` API docs. Server-only, auto-synced to clients. Example shows damage + knockback + timed restore.
- **docs/scripting/world/World.md** — New `.get(key)` / `.set(key, value)` persistent world storage docs (server-only, JSON-serializable).

### Core Entity Integration
- **src/core/entities/PlayerLocal.js** (+73/-2)
  - Imports `Ragdoll` class
  - Stores `capsuleShape` ref for toggling scene queries
  - `fixedUpdate`: early-returns into `_ragdoll.fixedUpdate()` when ragdoll active
  - `update`: early-returns into `_ragdoll.update()`, tracks hips position to move `base` transform
  - `lateUpdate`: early-returns into `_ragdoll.lateUpdate()`, camera follows ragdoll hips
  - Suppresses emote/locomotion calls when ragdoll active (`if (!this._ragdoll)` guards)
  - New `setRagdoll(enable, force)` method: toggles capsule simulation, computes hips offset, creates/destroys `Ragdoll` instance, applies initial force

- **src/core/entities/PlayerRemote.js** (+55)
  - Imports `Ragdoll` class
  - `update`: early-returns into ragdoll update loop, tracks hips for base position, auto-deactivates when `!isActive()`
  - `lateUpdate`: early-returns when ragdoll active
  - New `setRagdoll(enable, force)` — mirrors local but disables `body.active` instead of capsule
  - `onStateFields`: parses `r` (ragdoll flag) and `rf` (force array) from network state

### New Files

- **src/core/extras/Ragdoll.js** (1,901 lines) — Main ragdoll class
  - **States**: OFF, KINEMATIC, RAGDOLL, RECOVERING, REACTIVE
  - **build()**: Creates 11 PhysX rigid dynamic bodies (boxes + head sphere) mapped to VRM bones. Bodies start kinematic with simulation disabled. Uses prop collision layer. Limb-aligned correction rotations computed from child bone directions.
  - **_buildJoints()**: Creates D6 joints at activation time. Socket joints (shoulders, hips, spine, neck) with cone swing + twist limits. Hinge joints (elbows, knees) with single-axis bend limits. Frame quaternions computed from bone world orientations.
  - **activate(velocity, hitInfo)**: Transitions to RAGDOLL state. Pauses VRM animation. Enables CCD, gravity, collisions. Applies velocity with BFS propagation from hit bone (spine vs limb falloff). Angular impulse from cross product of hit direction and body axis. Torso spin for off-center hits. Sets up active ragdoll drives.
  - **Active ragdoll drives**: Impact-scaled stiffness, per-group multipliers (neck strongest, core next, limbs weakest). Muscle fade over time with exponential decay. Hit-side fades faster. Arm bracing toward fall direction. Leg buckling for lower-body hits. Arm/head flailing with decaying random torques.
  - **deactivate()**: Snapshots bone poses, switches to RECOVERING. Bodies go kinematic + simulation disabled.
  - **Recovery blend**: Smoothstep interpolation from ragdoll snapshot to rest pose over `blendDuration` (0.4s). On completion, resumes VRM animation and transitions to REACTIVE.
  - **REACTIVE mode**: Bodies are dynamic but non-colliding, gravity-free, drive-controlled. Animation keeps running. Physics bodies follow animation via D6 drive targets computed from cached animation poses. Anchor body (kinematic) drives hips position/rotation. Momentum lean (forward tilt proportional to speed, backward overshoot on stop, lateral lean from acceleration). Arm swing on stop/direction change. Planted foot tracking on walk-to-stop. Landing window suppresses leg physics for 0.25s.
  - **Arm IK override**: `setArmTarget(side, worldPos, opts)` / `clearArmTarget(side)` with blend-in/out. During aim, upper body physics blend reduced ~85% for stability.
  - **Physics writeback**: In RAGDOLL mode, full physics override of bone transforms. In REACTIVE mode, slerp blend between animation and physics (configurable per body group).
  - **Cleanup**: Proper destruction of all PhysX actors, shapes, joints, drives, materials.

- **src/core/extras/RagdollConfig.js** (155 lines)
  - `BODY_SEGMENTS`: 11 segments (hips, chest, head, 2x upper/lower arm, 2x upper/lower leg) with bone names, shapes, dimensions, masses, offsets
  - `JOINT_DEFINITIONS`: 10 joints with types (socket/hinge), limits, spring params, drive configs (stiffness/damping/forceLimit/group)
  - `RAGDOLL_DEFAULTS`: linear/angular damping, blend duration
  - `REACTIVE_DEFAULTS`: drive multipliers, blend factors, anchor stiffness, momentum lean params, arm swing params
  - `ACTIVE_RAGDOLL_DEFAULTS`: muscle fade, bracing, flailing, impact velocity scaling, hit-side fade, leg buckling, transition params, steering force
  - `ARM_OVERRIDE_DEFAULTS`: blend rates, upper/lower arm blend weights, elbow drop/out offsets
  - Body name group exports: ARM_BODIES, LEFT/RIGHT_LEG_BODIES, CORE_BODIES_NAMES, LOWER_BODY_NAMES, FLAIL_ARM_PARTS

- **src/core/extras/RagdollDebug.js** (120 lines)
  - Wireframe visualization of all ragdoll bodies (color-coded: yellow=torso, red=head, green=arms, blue=legs)
  - LineSegments showing joint connections
  - Updates from actor global poses each frame

- **src/core/extras/ragdollArmOverride.js** (243 lines)
  - Two-bone IK solver for arm overrides
  - Elbow hint system: drops elbow below + pushes outward from hand target for natural bent-arm pose
  - Upper arm aims toward elbow hint, lower arm aims toward hand target
  - Temporal smoothing with exponential decay (IK_SMOOTH_RATE = 24)
  - Wrist roll support (rotation around forearm axis)
  - Blend-in/out with configurable rates
  - `applyArmIKDirect()` exported for use without ragdoll dependency

### VRM Factory Changes
- **src/core/extras/createVRMFactory.js** (+6)
  - Adds `paused` flag — when true, `update()` early-returns (skips animation mixer)
  - Exposes `findBone` on the VRM instance object
  - Exposes `paused` as getter/setter on the instance

### Network Integration
- **src/core/extras/createPlayerProxy.js** (+9)
  - New `ragdoll(enable, force)` method on player proxy
  - Serializes force to array, sends `entityModified` with `r` (0/1) and `rf` (force array)
  - Calls `player.setRagdoll()` locally, broadcasts via network if server

---

## Architecture Notes
- Ragdoll has 3 operational modes that cycle: REACTIVE (always-on secondary motion) -> RAGDOLL (full physics takeover) -> RECOVERING (blend back to animation) -> REACTIVE
- REACTIVE mode is the "idle" state — physics bodies shadow animation, providing momentum lean, arm swing, and arm IK without interrupting normal gameplay
- Server authoritative: `player.ragdoll()` must be called server-side, state syncs to all clients
- Remote players receive ragdoll state via network and create their own physics simulation locally
- All PhysX resources (actors, shapes, joints, drives, materials) are properly cleaned up on destroy
