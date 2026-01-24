// Enhanced Advanced Cars Script with all improvements
// Features: Multi-audio, damage system, HUD, multiple cameras, LOD, mobile support, etc.

app.configure([
  // Core vehicle parameters
  {
    key: 'accel',
    type: 'number',
    label: 'Acceleration',
    initial: 10,
    min: 0,
    hint: 'The maximum amount of force applied when accelerating.',
  },
  {
    key: 'decel',
    type: 'number',
    label: 'Deceleration',
    initial: 6,
    min: 0,
    hint: 'The maximum amount of force applied when decelerating.',
  },
  {
    key: 'handbrake',
    type: 'number',
    label: 'Handbrake',
    initial: 6,
    min: 0,
    hint: 'The amount of force applied when hand braking.',
  },
  {
    key: 'maxSpeed',
    type: 'number',
    label: 'Max Speed',
    initial: 180,
    min: 1,
    hint: 'The maximum speed, in kilometers per hour.',
  },
  {
    key: 'maxHealth',
    type: 'number',
    label: 'Max Health',
    initial: 100,
    min: 1,
    hint: 'Maximum vehicle health before breakdown.',
  },
  {
    key: 'driveTrain',
    type: 'switch',
    label: 'Drive Train',
    options: [
      { label: 'FWD', value: 'fwd' },
      { label: 'RWD', value: 'rwd' },
      { label: '4WD', value: '4wd' },
    ],
    hint: 'The wheels that exert power when accelerating/decelerating.',
  },
  {
    key: 'steering',
    type: 'switch',
    label: 'Steering',
    options: [
      { label: 'Front', value: 'front' },
      { label: 'Rear', value: 'rear' },
    ],
    hint: 'The wheels that steer when turning.',
  },
  // Curve configurations
  {
    key: 'power',
    type: 'curve',
    label: 'Power',
    hint: 'Acceleration power based on speed. X axis is the speed ratio (0 to 1 of max speed) and Y axis is the amount of full acceleration/deceleration that should be applied.',
  },
  {
    key: 'turn',
    type: 'curve',
    label: 'Turn',
    hint: 'Turning based on speed. X axis is the speed ratio (0 to 1 of max speed) and Y axis is the amount of turning to apply.',
  },
  {
    key: 'frontGrip',
    type: 'curve',
    label: 'Front Grip',
    hint: 'Front wheel grip. X axis is the amount of sideways force where 0 is none and 1 is full. Y axis is the amount of grip the wheel has.',
  },
  {
    key: 'rearGrip',
    type: 'curve',
    label: 'Rear Grip',
    hint: 'Rear wheel grip. X axis is the amount of sideways force where 0 is none and 1 is full. Y axis is the amount of grip the wheel has.',
  },
  {
    key: 'longGrip',
    type: 'curve',
    label: 'Long Grip',
    hint: 'Longitudinal grip curve for powered wheels. X-axis is the slip ratio and Y-axis is the grip from 0 (no traction) to 1 (full traction).',
  },
  // Suspension
  {
    key: 'springStrength',
    type: 'number',
    label: 'Spring Strength',
    initial: 10,
    min: 1,
    hint: 'The spring suspension strength.',
  },
  {
    key: 'springDamper',
    type: 'number',
    label: 'Spring Damper',
    initial: 2,
    min: 1,
    hint: 'Damping applied to spring suspension.',
  },
  // Assets
  {
    key: 'sit',
    type: 'file',
    kind: 'emote',
    label: 'Sit Emote',
    hint: 'Emote used when sitting in the vehicle.',
  },
  // Seat Position Adjustments
  {
    key: 'seat1YOffset',
    type: 'number',
    label: 'Seat1 Y Offset',
    initial: 0,
    dp: 2,
    step: 0.01,
    hint: 'Vertical position offset for Seat1 (driver seat) in meters.',
  },
  {
    key: 'seat2YOffset',
    type: 'number',
    label: 'Seat2 Y Offset',
    initial: 0,
    dp: 2,
    step: 0.01,
    hint: 'Vertical position offset for Seat2 (passenger seat) in meters.',
  },
  // Enhanced Audio System
  {
    key: 'engineIdle',
    type: 'file',
    kind: 'audio',
    label: 'Engine Idle Sound',
    hint: 'Low RPM engine sound.',
  },
  {
    key: 'engineRev',
    type: 'file',
    kind: 'audio',
    label: 'Engine Rev Sound',
    hint: 'High RPM engine sound.',
  },
  {
    key: 'brakeSound',
    type: 'file',
    kind: 'audio',
    label: 'Brake Sound',
    hint: 'Sound when braking.',
  },
  {
    key: 'skidSound',
    type: 'file',
    kind: 'audio',
    label: 'Skid Sound',
    hint: 'Sound when tires are sliding.',
  },
  {
    key: 'crashSound',
    type: 'file',
    kind: 'audio',
    label: 'Crash Sound',
    hint: 'Sound when vehicle takes damage.',
  },
  // Visual effects
  {
    key: 'treadmark',
    type: 'file',
    kind: 'texture',
    label: 'Treadmark',
  },
  {
    key: 'smoke',
    type: 'file',
    kind: 'texture',
    label: 'Smoke',
  },
  {
    key: 'exhaust',
    type: 'file',
    kind: 'texture',
    label: 'Exhaust Smoke',
  },
  // Turret System
  {
    key: 'turretSeatEmote',
    type: 'file',
    kind: 'emote',
    label: 'Turret Seat Emote',
    hint: 'Animation for turret seat (Seat3).',
  },
  {
    key: 'turretOverheatThreshold',
    type: 'number',
    label: 'Turret Overheat Threshold',
    initial: 100,
    min: 1,
    hint: 'Number of shots before turret overheats.',
  },
  {
    key: 'turretCooldownTime',
    type: 'number',
    label: 'Turret Cooldown Time',
    initial: 5,
    min: 0.1,
    dp: 1,
    hint: 'Seconds to cool down after overheating.',
  },
  {
    key: 'turretFireRate',
    type: 'number',
    label: 'Turret Fire Rate',
    initial: 0.1,
    min: 0.01,
    dp: 2,
    hint: 'Minimum time between shots in seconds.',
  },
  {
    key: 'turretMinDamage',
    type: 'number',
    label: 'Turret Min Damage',
    initial: 20,
    min: 1,
    hint: 'Minimum damage per shot.',
  },
  {
    key: 'turretMaxDamage',
    type: 'number',
    label: 'Turret Max Damage',
    initial: 40,
    min: 1,
    hint: 'Maximum damage per shot.',
  },
  {
    key: 'turretCritChance',
    type: 'range',
    label: 'Turret Crit Chance',
    initial: 0.2,
    min: 0,
    max: 1,
    step: 0.01,
    dp: 2,
    hint: 'Critical hit chance (0-1).',
  },
  {
    key: 'turretCritMultiplier',
    type: 'number',
    label: 'Turret Crit Multiplier',
    initial: 1.8,
    min: 1,
    dp: 1,
    hint: 'Critical damage multiplier.',
  },
  {
    key: 'turretRange',
    type: 'number',
    label: 'Turret Range',
    initial: 100,
    min: 1,
    hint: 'Maximum shooting range in meters.',
  },
  {
    key: 'turretRotationSpeed',
    type: 'number',
    label: 'Turret Rotation Speed',
    initial: 3,
    min: 0.1,
    dp: 1,
    hint: 'Turret rotation interpolation speed (higher = faster).',
  },
  {
    key: 'turretFireSound',
    type: 'file',
    kind: 'audio',
    label: 'Turret Fire Sound',
    hint: 'Sound when turret fires.',
  },
  {
    key: 'turretOverheatSound',
    type: 'file',
    kind: 'audio',
    label: 'Turret Overheat Sound',
    hint: 'Sound when turret overheats.',
  },
])

// Enhanced constants and utilities
const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const v4 = new Vector3()
const v5 = new Vector3()
const v6 = new Vector3()
const e1 = new Euler(0, 0, 0, 'YXZ')
const e2 = new Euler(0, 0, 0, 'YXZ')
const q1 = new Quaternion()
const q2 = new Quaternion()
const q3 = new Quaternion()
const m1 = new Matrix4()

const UP = new Vector3(0, 1, 0)
const DOWN = new Vector3(0, -1, 0)
const FORWARD = new Vector3(0, 0, -1)
const BACK = new Vector3(0, 0, 1)
const LEFT = new Vector3(-1, 0, 0)
const RIGHT = new Vector3(1, 0, 0)

// Enhanced networking constants
const BASE_SEND_RATE = 1 / 60 // Increased to 60Hz for very smooth vehicle sync
const SLOW_SEND_RATE = 1 / 30 // Increased to 30Hz for slow-moving vehicles
const TURRET_SEND_RATE = 1 / 60 // Fast rate for turret updates (60Hz) for smooth rotation
let adaptiveSendRate = BASE_SEND_RATE
let lastTurretSend = 0

// LOD constants
const LOD_DISTANCES = {
  FULL: 50,
  MEDIUM: 150,
  LOW: 300,
}

// Camera modes
const CAMERA_MODES = {
  FOLLOW: 'follow',
  COCKPIT: 'cockpit',
  HOOD: 'hood',
  CINEMATIC: 'cinematic',
}

const WHEEL_MASS = 0.05

// Validation and error handling
function validateConfiguration() {
  const errors = []

  if (!props.accel || props.accel <= 0) {
    errors.push('Acceleration must be greater than 0')
  }

  if (!props.maxSpeed || props.maxSpeed <= 0) {
    errors.push('Max speed must be greater than 0')
  }

  if (!props.maxHealth || props.maxHealth <= 0) {
    errors.push('Max health must be greater than 0')
  }

  if (errors.length > 0) {
    console.error('Car configuration errors:', errors)
    return false
  }
  return true
}

function safeExecute(fn, fallback = () => {}) {
  try {
    return fn()
  } catch (error) {
    console.error('Car script error:', error)
    return fallback()
  }
}

// Validate configuration on startup
if (!validateConfiguration()) {
  console.warn('Using fallback configuration due to validation errors')
}

// Get nodes with error handling
const car = safeExecute(() => app.get('Car'))
const body = safeExecute(() => app.get('Body'))
const cOM = safeExecute(() => app.get('CenterOfMass'))
const seatNodes = [
  safeExecute(() => app.get('Seat1')),
  safeExecute(() => app.get('Seat2')),
  safeExecute(() => app.get('Seat3')),
  safeExecute(() => app.get('Seat4')),
]
const gunnerCam = safeExecute(() => app.get('GunnerCam'))

// Declare turret bone variables
let turretBaseBone = null
let turretGunBone = null
let turretBarrelBone = null // Separate barrel bone for spinning
let turretMuzzleBone = null

// Get turret bones
turretBaseBone = safeExecute(() => body.getBone('TurretBase'))
turretGunBone = safeExecute(() => body.getBone('TurretGun'))
turretBarrelBone = safeExecute(() => body.getBone('TurretBarrel')) || safeExecute(() => body.getBone('Barrel')) // Try common barrel bone names
turretMuzzleBone = safeExecute(() => body.getBone('TurretMuzzle'))

if (!car || !body) {
  throw new Error('Critical car components missing')
}

if (!turretBaseBone || !turretGunBone || !turretMuzzleBone) {
  console.warn('Turret bones not found - turret functionality will be disabled')
}

// Enhanced car setup
car.mass = 1
if (cOM) car.setCenterOfMass(cOM.position)
car.angularDamping = 2

app.traverse(node => {
  if (node.name === 'collider') {
    node.layer = 'prop'
  }
})
world.attach(car)

// Helper function to safely create curves with defaults
function createCurve(propValue, defaultKeyframes) {
  const curve = new Curve()
  // Check if propValue is a valid string (curve serialization format)
  if (propValue && typeof propValue === 'string' && propValue.length > 0) {
    curve.deserialize(propValue)
    // Ensure we have at least one keyframe after deserialization
    if (!curve.keyframes || curve.keyframes.length === 0) {
      // Fall back to defaults if deserialization failed
      for (const kf of defaultKeyframes) {
        curve.add({ time: kf.time, value: kf.value, inTangent: kf.inTangent || 0, outTangent: kf.outTangent || 0 })
      }
    }
  } else {
    // Create default curve with provided keyframes
    for (const kf of defaultKeyframes) {
      curve.add({ time: kf.time, value: kf.value, inTangent: kf.inTangent || 0, outTangent: kf.outTangent || 0 })
    }
  }
  return curve
}

// Default curve keyframes (time, value, inTangent, outTangent)
const defaultPowerCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.5, inTangent: 0, outTangent: 0 },
]
const defaultTurnCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.3, inTangent: 0, outTangent: 0 },
]
const defaultGripCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.2, inTangent: 0, outTangent: 0 },
]
const defaultLongGripCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 0.1, value: 1, inTangent: 0, outTangent: 0 },
  { time: 0.5, value: 0.8, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.3, inTangent: 0, outTangent: 0 },
]

// Configuration values
const accel = props.accel || 10
const decel = props.decel || 6
const handbrake = props.handbrake || 6
const maxSpeed = props.maxSpeed || 180
const maxHealth = props.maxHealth || 100
const driveTrain = props.driveTrain || 'fwd'
const steering = props.steering || 'front'
const powerCurve = createCurve(props.power, defaultPowerCurve)
const turnCurve = createCurve(props.turn, defaultTurnCurve)
const frontGripCurve = createCurve(props.frontGrip, defaultGripCurve)
const rearGripCurve = createCurve(props.rearGrip, defaultGripCurve)
const longGripCurve = createCurve(props.longGrip, defaultLongGripCurve)
const springStrength = props.springStrength || 10
const springDamper = props.springDamper || 2
const sitEmote = props.sit?.url
const seat1YOffset = props.seat1YOffset || 0
const seat2YOffset = props.seat2YOffset || 0
const treadmarkUrl = props.treadmark?.url
const smokeUrl = props.smoke?.url
const exhaustUrl = props.exhaust?.url

// Turret configuration
const turretSeatEmote = props.turretSeatEmote?.url
const turretOverheatThreshold = props.turretOverheatThreshold || 100
const turretCooldownTime = props.turretCooldownTime || 5
const turretFireRate = props.turretFireRate || 0.1
const turretMinDamage = props.turretMinDamage || 20
const turretMaxDamage = props.turretMaxDamage || 40
const turretCritChance = props.turretCritChance || 0.2
const turretCritMultiplier = props.turretCritMultiplier || 1.8
const turretRange = props.turretRange || 100
const turretRotationSpeed = props.turretRotationSpeed || 3

// Enhanced Audio System
const audioSources = {
  idle: app.create('audio', {
    src: props.engineIdle?.url,
    group: 'sfx',
    loop: true,
    volume: 0.8,
    spatial: true,
  }),
  revving: app.create('audio', {
    src: props.engineRev?.url,
    group: 'sfx',
    loop: true,
    volume: 0,
    spatial: true,
  }),
  braking: app.create('audio', {
    src: props.brakeSound?.url,
    group: 'sfx',
    volume: 0.6,
    spatial: true,
  }),
  skidding: app.create('audio', {
    src: props.skidSound?.url,
    group: 'sfx',
    loop: true,
    volume: 0,
    spatial: true,
  }),
  crash: app.create('audio', {
    src: props.crashSound?.url,
    group: 'sfx',
    volume: 0.8,
    spatial: true,
  }),
}

// Add audio sources to car
for (const audio of Object.values(audioSources)) {
  if (audio.src) {
    car.add(audio)
  }
}

// Enhanced wheel system with tire temperature
const wheels = [
  {
    idx: 0,
    front: true,
    left: true,
    spring: safeExecute(() => car.get('SpringFL')),
    hub: safeExecute(() => body.getBone('HubFL')),
    tire: safeExecute(() => body.getBone('TireFL')),
    grounded: false,
    compression: 0,
    powered: driveTrain === 'fwd' || driveTrain === '4wd',
    turns: steering === 'front',
    gripCurve: frontGripCurve,
    temperature: 0,
    speed: 0,
  },
  {
    idx: 1,
    front: true,
    right: true,
    spring: safeExecute(() => car.get('SpringFR')),
    hub: safeExecute(() => body.getBone('HubFR')),
    tire: safeExecute(() => body.getBone('TireFR')),
    grounded: false,
    compression: 0,
    powered: driveTrain === 'fwd' || driveTrain === '4wd',
    turns: steering === 'front',
    gripCurve: frontGripCurve,
    temperature: 0,
    speed: 0,
  },
  {
    idx: 2,
    rear: true,
    left: true,
    spring: safeExecute(() => car.get('SpringBL')),
    hub: safeExecute(() => body.getBone('HubBL')),
    tire: safeExecute(() => body.getBone('TireBL')),
    grounded: false,
    compression: 0,
    powered: driveTrain === 'rwd' || driveTrain === '4wd',
    turns: steering === 'rear',
    gripCurve: rearGripCurve,
    temperature: 0,
    speed: 0,
  },
  {
    idx: 3,
    rear: true,
    right: true,
    spring: safeExecute(() => car.get('SpringBR')),
    hub: safeExecute(() => body.getBone('HubBR')),
    tire: safeExecute(() => body.getBone('TireBR')),
    grounded: false,
    compression: 0,
    powered: driveTrain === 'rwd' || driveTrain === '4wd',
    turns: steering === 'rear',
    gripCurve: rearGripCurve,
    temperature: 0,
    speed: 0,
  },
]

// Enhanced wheel setup with particles and lights
for (const wheel of wheels) {
  if (!wheel.spring || !wheel.hub || !wheel.tire) continue

  wheel.springRestLength = wheel.spring.position.y - wheel.hub.position.y
  wheel.springTravel = wheel.springRestLength * 0.4
  wheel.springMaxLength = wheel.springRestLength + wheel.springTravel
  wheel.radius = wheel.hub.position.y
  wheel.baseGrip = 1.0
  wheel.currentGrip = 1.0

  if (wheel.rear) {
    const particles = app.create('group')
    particles.position.copy(wheel.hub.position)
    wheel.particles = particles

    // Enhanced skid marks
    const skid = app.create('particles', {
      emitting: false,
      shape: ['point'],
      billboard: 'direction',
      rate: 0,
      rateOverDistance: 8,
      life: '5~8',
      size: '0.4~0.6',
      speed: '0',
      rotate: '0~360',
      color: 'black',
      alpha: '0.5~0.8',
      alphaOverLife: '0,1|0.7,1|1,0',
      image: treadmarkUrl,
    })
    skid.position.y -= wheel.radius - 0.05
    wheel.skid = skid
    particles.add(skid)

    // Enhanced smoke
    const smoke = app.create('particles', {
      emitting: false,
      shape: ['cone', 0.2, 1, 20],
      rate: 0,
      rateOverDistance: 5,
      life: '3~20',
      size: '2~4',
      speed: '0.4~0.8',
      rotate: '0~360',
      alpha: '0.02~0.05',
      alphaOverLife: '0,0|0.03,1|0.3,0.4|1,0',
      sizeOverLife: '0,1|1,3',
      direction: 0.7,
      image: smokeUrl,
    })
    smoke.position.y -= wheel.radius - 0.05
    wheel.smoke = smoke
    particles.add(smoke)
    car.add(particles)
  }
}

// Exhaust system
const exhaustParticles = app.create('particles', {
  emitting: false,
  shape: ['cone', 0.1, 0.3, 10],
  rate: 0,
  life: '1~3',
  size: '0.5~1.5',
  speed: '2~4',
  rotate: '0~360',
  color: 'rgba(100,100,100,0.8)',
  alpha: '0.3~0.6',
  alphaOverLife: '0,0.8|1,0',
  sizeOverLife: '0,0.5|1,2',
  image: exhaustUrl,
})

// Position exhaust at rear of vehicle
exhaustParticles.position.set(0, 0.5, 2)
car.add(exhaustParticles)

// Lighting system
const lights = {
  headlights: [],
  taillights: [],
  brakelights: [],
}

// Create basic lighting (if light nodes exist)
safeExecute(() => {
  const headlightL = app.get('HeadlightL')
  const headlightR = app.get('HeadlightR')
  const taillightL = app.get('TaillightL')
  const taillightR = app.get('TaillightR')

  if (headlightL) lights.headlights.push(headlightL)
  if (headlightR) lights.headlights.push(headlightR)
  if (taillightL) lights.taillights.push(taillightL)
  if (taillightR) lights.taillights.push(taillightR)
})

// Enhanced vehicle state
const steerAngleMax = 40
const steerSpeed = 3
const springLayerMask = world.createLayerMask('environment')
const cameraYOffset = 1
const zoomSpeed = 5

let grounded = false
let steerAngle = 0
let power = 0
let speed = 0
let speedRatio = 0
let speedRatioAbs = 0
let isMovingForward = true
let isSlipping = false

// Enhanced input system
let accelInput = 0
let steerInput = 0
let handbrakeInput = false
let brakeInput = false

// Camera system
let currentCameraMode = CAMERA_MODES.FOLLOW
let zoom = 7

// Vehicle state
let health = maxHealth
let isSeated = false
let isDriving = false
let isDamaged = false
let lastSend = 0

// Mobile touch controls
let touchControls = null
let isMobile = false

// Turret state
let isInTurretSeat = false
let justEnteredTurretSeat = false
let turretHeat = 0
let isTurretOverheated = false
let lastTurretFireTime = 0
let turretBaseRotation = 0
let turretGunRotation = 0
let turretBarrelRotation = 0 // Z-axis rotation for barrel spin
let turretHUD = null
let turretHeatBar = null

let state = app.state
let control
const player = world.getPlayer()

// Enhanced mode system
let mode
function setMode(fn, ...args) {
  if (mode) mode.cancel()
  mode = fn ? fn(...args) : null
}

// Enhanced info serialization with damage and effects
const info = {
  position: new Vector3(),
  quaternion: new Quaternion(),
  health: maxHealth,
  isDamaged: false,
  exhaustEmitting: false,
  wheels: [
    { offset: 0, turn: 0, rotate: 0, temperature: 0 },
    { offset: 0, turn: 0, rotate: 0, temperature: 0 },
    { offset: 0, turn: 0, rotate: 0, sliding: false, temperature: 0 },
    { offset: 0, turn: 0, rotate: 0, sliding: false, temperature: 0 },
  ],
  turretBaseRotation: 0,
  turretGunRotation: 0,
  turretBarrelRotation: 0,
  turretHeat: 0,
  isTurretOverheated: false,
  read() {
    this.position.copy(car.position)
    this.quaternion.copy(car.quaternion)
    this.health = health
    this.isDamaged = isDamaged
    this.exhaustEmitting = exhaustParticles.emitting
    // Read bone rotations directly from bones (simpler and more accurate)
    this.turretBaseRotation = turretBaseBone && turretBaseBone.rotation ? turretBaseBone.rotation.y : turretBaseRotation
    this.turretGunRotation = turretGunBone && turretGunBone.rotation ? turretGunBone.rotation.x : turretGunRotation
    this.turretBarrelRotation =
      turretBarrelBone && turretBarrelBone.rotation ? turretBarrelBone.rotation.z : turretBarrelRotation
    this.turretHeat = turretHeat
    this.isTurretOverheated = isTurretOverheated

    for (let i = 0; i < 4; i++) {
      if (!wheels[i].hub || !wheels[i].tire) continue
      this.wheels[i].offset = wheels[i].hub.position.y
      this.wheels[i].turn = wheels[i].hub.rotation.y
      this.wheels[i].rotate = wheels[i].tire.rotation.x
      this.wheels[i].temperature = wheels[i].temperature || 0
      if (wheels[i].rear && wheels[i].skid) {
        this.wheels[i].sliding = wheels[i].skid.emitting
      }
    }
    return this
  },
  write() {
    car.position.copy(this.position)
    car.quaternion.copy(this.quaternion)
    health = this.health
    isDamaged = this.isDamaged
    exhaustParticles.emitting = this.exhaustEmitting

    // Only update turret bone rotations if we're NOT the gunner (viewers only)
    // The gunner controls their own turret directly, so they don't need network updates
    if (!isInTurretSeat) {
      // Apply bone rotations directly from network state (simple and accurate)
      if (turretBaseBone && turretBaseBone.rotation !== undefined) {
        turretBaseBone.rotation.y = this.turretBaseRotation || 0
      }
      if (turretGunBone && turretGunBone.rotation !== undefined) {
        turretGunBone.rotation.x = this.turretGunRotation || 0
      }
      if (turretBarrelBone && turretBarrelBone.rotation !== undefined) {
        turretBarrelBone.rotation.z = this.turretBarrelRotation || 0
      }
      // Update local vars for consistency (but bones are the source of truth)
      turretBaseRotation = this.turretBaseRotation || 0
      turretGunRotation = this.turretGunRotation || 0
      turretBarrelRotation = this.turretBarrelRotation || 0

      // Update player anchor rotation for viewers (if someone is in turret seat)
      // Read directly from bone rotation to match visual (bone is source of truth)
      if (turretBaseBone && turretBaseBone.rotation !== undefined) {
        const anchorId = `seat-2-${app.instanceId}`
        const anchor = app.get(anchorId)
        if (anchor && anchor.rotation) {
          anchor.rotation.y = turretBaseBone.rotation.y
        }
      }
    } else {
      // Gunner: Only update local vars for reference (bones are updated directly by gunner)
      turretBaseRotation = this.turretBaseRotation || 0
      turretGunRotation = this.turretGunRotation || 0
      turretBarrelRotation = this.turretBarrelRotation || 0
    }
    turretHeat = this.turretHeat || 0
    isTurretOverheated = this.isTurretOverheated || false

    for (let i = 0; i < 4; i++) {
      if (!wheels[i].hub || !wheels[i].tire) continue
      wheels[i].hub.position.y = this.wheels[i].offset
      wheels[i].hub.rotation.y = this.wheels[i].turn
      wheels[i].tire.rotation.x = this.wheels[i].rotate
      wheels[i].temperature = this.wheels[i].temperature || 0
      if (wheels[i].rear && wheels[i].skid) {
        wheels[i].skid.emitting = this.wheels[i].sliding
        wheels[i].smoke.emitting = this.wheels[i].sliding
      }
    }
    return this
  },
  deserialize(data) {
    // Handle case where data might be undefined or incomplete
    if (!data || !Array.isArray(data) || data.length < 7) {
      return this
    }

    // Check if turret data is included (driver sends without, gunner sends with)
    const hasTurretData = data.length >= 33 // Base data (28) + turret data (5)

    const [
      px,
      py,
      pz,
      qx,
      qy,
      qz,
      qw,
      h,
      dmg,
      exh,
      w0o,
      w0t,
      w0r,
      w0temp,
      w1o,
      w1t,
      w1r,
      w1temp,
      w2o,
      w2t,
      w2r,
      w2s,
      w2temp,
      w3o,
      w3t,
      w3r,
      w3s,
      w3temp,
      tbr,
      tgr,
      tbarrelr,
      th,
      toh,
    ] = data

    this.position.set(px || 0, py || 0, pz || 0)
    this.quaternion.set(qx || 0, qy || 0, qz || 0, qw !== undefined ? qw : 1)
    this.health = h !== undefined ? h : 100
    this.isDamaged = dmg || false
    this.exhaustEmitting = exh || false

    // Only update turret state if it's included in the data (from gunner)
    // Don't overwrite turret state with stale data from driver
    if (hasTurretData) {
      this.turretBaseRotation = tbr !== undefined ? tbr : this.turretBaseRotation || 0
      this.turretGunRotation = tgr !== undefined ? tgr : this.turretGunRotation || 0
      this.turretBarrelRotation = tbarrelr !== undefined ? tbarrelr : this.turretBarrelRotation || 0
      this.turretHeat = th !== undefined ? th : this.turretHeat || 0
      this.isTurretOverheated = toh !== undefined ? toh : this.isTurretOverheated || false
    }
    // If no turret data, keep existing turret state (don't overwrite with undefined)

    // Safely assign wheel data (only if wheels array exists and has elements)
    if (this.wheels && this.wheels.length > 0) {
      if (w0o !== undefined) this.wheels[0].offset = w0o
      if (w0t !== undefined) this.wheels[0].turn = w0t
      if (w0r !== undefined) this.wheels[0].rotate = w0r
      if (w0temp !== undefined) this.wheels[0].temperature = w0temp
    }

    if (this.wheels && this.wheels.length > 1) {
      if (w1o !== undefined) this.wheels[1].offset = w1o
      if (w1t !== undefined) this.wheels[1].turn = w1t
      if (w1r !== undefined) this.wheels[1].rotate = w1r
      if (w1temp !== undefined) this.wheels[1].temperature = w1temp
    }

    if (this.wheels && this.wheels.length > 2) {
      if (w2o !== undefined) this.wheels[2].offset = w2o
      if (w2t !== undefined) this.wheels[2].turn = w2t
      if (w2r !== undefined) this.wheels[2].rotate = w2r
      if (w2s !== undefined) this.wheels[2].sliding = w2s
      if (w2temp !== undefined) this.wheels[2].temperature = w2temp
    }

    if (this.wheels && this.wheels.length > 3) {
      if (w3o !== undefined) this.wheels[3].offset = w3o
      if (w3t !== undefined) this.wheels[3].turn = w3t
      if (w3r !== undefined) this.wheels[3].rotate = w3r
      if (w3s !== undefined) this.wheels[3].sliding = w3s
      if (w3temp !== undefined) this.wheels[3].temperature = w3temp
    }

    return this
  },
  serialize(includeTurret = true) {
    const baseData = [
      this.position.x,
      this.position.y,
      this.position.z,
      this.quaternion.x,
      this.quaternion.y,
      this.quaternion.z,
      this.quaternion.w,
      this.health,
      this.isDamaged,
      this.exhaustEmitting,
      wheels[0]?.hub?.position.y || 0,
      wheels[0]?.hub?.rotation.y || 0,
      wheels[0]?.tire?.rotation.x || 0,
      wheels[0]?.temperature || 0,
      wheels[1]?.hub?.position.y || 0,
      wheels[1]?.hub?.rotation.y || 0,
      wheels[1]?.tire?.rotation.x || 0,
      wheels[1]?.temperature || 0,
      wheels[2]?.hub?.position.y || 0,
      wheels[2]?.hub?.rotation.y || 0,
      wheels[2]?.tire?.rotation.x || 0,
      wheels[2]?.skid?.emitting || false,
      wheels[2]?.temperature || 0,
      wheels[3]?.hub?.position.y || 0,
      wheels[3]?.hub?.rotation.y || 0,
      wheels[3]?.tire?.rotation.x || 0,
      wheels[3]?.skid?.emitting || false,
      wheels[3]?.temperature || 0,
    ]

    if (includeTurret) {
      return [
        ...baseData,
        this.turretBaseRotation || 0,
        this.turretGunRotation || 0,
        this.turretBarrelRotation || 0,
        this.turretHeat || 0,
        this.isTurretOverheated || false,
      ]
    }

    return baseData
  },
  serializeTurretOnly() {
    // Only serialize turret state (for gunner to send separately)
    return [
      this.turretBaseRotation || 0,
      this.turretGunRotation || 0,
      this.turretBarrelRotation || 0,
      this.turretHeat || 0,
      this.isTurretOverheated || false,
    ]
  },
  deserializeTurretOnly(data) {
    // Only deserialize turret state (from gunner's separate message)
    if (!data || !Array.isArray(data) || data.length < 5) {
      return this
    }
    const [tbr, tgr, tbarrelr, th, toh] = data
    this.turretBaseRotation = tbr !== undefined ? tbr : this.turretBaseRotation || 0
    this.turretGunRotation = tgr !== undefined ? tgr : this.turretGunRotation || 0
    this.turretBarrelRotation = tbarrelr !== undefined ? tbarrelr : this.turretBarrelRotation || 0
    this.turretHeat = th !== undefined ? th : this.turretHeat || 0
    this.isTurretOverheated = toh !== undefined ? toh : this.isTurretOverheated || false
    return this
  },
}

// Simplified HUD/Dashboard system
let dashboard = null
let speedometer = null

function createHUD() {
  if (!control) return

  safeExecute(() => {
    dashboard = app.create('ui', {
      space: 'screen',
      width: 300,
      height: 60,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 10,
      pivot: 'bottom-center',
      position: [0, 0],
      offset: [0, 20],
    })

    // Simple speedometer
    speedometer = app.create('uitext', {
      value: '0 KM/H',
      color: '#00ff00',
      fontSize: 24,
    })
    dashboard.add(speedometer)
    app.add(dashboard)
  })
}

function updateHUD() {
  if (!speedometer) return

  safeExecute(() => {
    const displaySpeed = Math.abs(speed).toFixed(0)
    speedometer.value = `${displaySpeed} KM/H | Health: ${health.toFixed(0)}`
  })
}

// Turret helper functions
function createTurretMuzzleFlash() {
  if (!turretMuzzleBone) return null

  // Safely access matrixWorld (may throw warning if bone not found in mesh)
  let muzzleMatrixWorld
  try {
    muzzleMatrixWorld = turretMuzzleBone.matrixWorld
    if (!muzzleMatrixWorld) return null
  } catch (e) {
    // Bone not found in mesh, skip muzzle flash
    return null
  }

  const muzzleFlash = app.create('particles', {
    shape: ['sphere', 0.15, 1],
    direction: 1,
    rate: 0,
    max: 40,
    bursts: [{ time: 0, count: 40 }],
    color: '#ffaa00',
    size: '0.08~0.2',
    alphaOverLife: '1,1|1,0',
    emissive: '10',
    speed: '3~7',
    life: '0.1~0.3',
  })

  const muzzlePos = new Vector3()
  muzzlePos.setFromMatrixPosition(muzzleMatrixWorld)
  muzzleFlash.position.copy(muzzlePos)

  world.add(muzzleFlash)

  setTimeout(() => {
    world.remove(muzzleFlash)
  }, 500)

  return muzzleFlash
}

function createTurretBulletTrail(startPos, direction) {
  const trail = app.create('particles', {
    shape: ['sphere', 0.015, 1],
    direction: 1,
    rate: 0,
    color: '#ffff00',
    rateOverDistance: 60,
    life: '0.05~0.15',
    size: '0.008~0.02',
    alphaOverLife: '1,1|1,0',
    emissive: '8',
  })

  trail.position.copy(startPos)
  world.add(trail)

  return trail
}

function createTurretImpactSparks(position) {
  const sparks = app.create('particles', {
    shape: ['sphere', 0.15, 1],
    direction: 1,
    rate: 0,
    max: 20,
    bursts: [{ time: 0, count: 20 }],
    color: '#ff8800',
    size: '0.03~0.1',
    alphaOverLife: '1,1|1,0',
    emissive: '10',
    speed: '1~5',
    life: '0.1~0.4',
    force: new Vector3(0, -5, 0),
  })

  sparks.position.copy(position)
  world.add(sparks)

  setTimeout(() => {
    world.remove(sparks)
  }, 500)

  return sparks
}

function createTurretHUD() {
  if (!control || turretHUD) return

  safeExecute(() => {
    turretHUD = app.create('ui', {
      space: 'screen',
      width: 250,
      height: 80,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 10,
      pivot: 'bottom-center',
      position: [0, 0],
      offset: [0, 100],
    })

    const heatLabel = app.create('uitext', {
      value: 'HEAT',
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
    })
    turretHUD.add(heatLabel)

    turretHeatBar = app.create('uitext', {
      value: '0%',
      color: '#00ff00',
      fontSize: 20,
      fontWeight: 'bold',
    })
    turretHUD.add(turretHeatBar)

    app.add(turretHUD)
  })
}

function updateTurretHUD() {
  if (!turretHeatBar) return

  safeExecute(() => {
    const heatPercent = Math.round((turretHeat / turretOverheatThreshold) * 100)
    turretHeatBar.value = `${heatPercent}%`

    if (isTurretOverheated) {
      turretHeatBar.value = 'OVERHEATED!'
      turretHeatBar.color = '#ff0000'
    } else if (heatPercent > 75) {
      turretHeatBar.color = '#ff8800'
    } else if (heatPercent > 50) {
      turretHeatBar.color = '#ffff00'
    } else {
      turretHeatBar.color = '#00ff00'
    }
  })
}

function playTurretSound(soundType) {
  const soundUrl = props[`turret${soundType}Sound`]?.url
  if (!soundUrl) return

  const audio = app.create('audio')
  audio.src = soundUrl
  audio.spatial = true
  audio.volume = 0.8
  audio.group = 'sfx'
  audio.distanceModel = 'exponential'
  audio.refDistance = 1
  audio.maxDistance = 100
  audio.rolloffFactor = 2

  if (turretMuzzleBone) {
    // Safely access matrixWorld (may throw warning if bone not found in mesh)
    try {
      const muzzleMatrixWorld = turretMuzzleBone.matrixWorld
      if (muzzleMatrixWorld) {
        const muzzlePos = new Vector3()
        muzzlePos.setFromMatrixPosition(muzzleMatrixWorld)
        audio.position.copy(muzzlePos)
      } else if (car) {
        audio.position.copy(car.position)
      }
    } catch (e) {
      // Bone not found in mesh, use car position
      if (car) {
        audio.position.copy(car.position)
      }
    }
  } else if (car) {
    audio.position.copy(car.position)
  }

  world.add(audio)
  audio.play()

  setTimeout(() => {
    world.remove(audio)
  }, 3000)
}

// Mobile controls for driver and passenger seats
let driverPassengerMobileControls = null
let driverPassengerExitButton = null

function setupTouchControls() {
  // Check if navigator is available (may not be in SES environment)
  isMobile =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      : false
  if (!control) return

  safeExecute(() => {
    // Remove existing controls if any
    removeDriverPassengerMobileControls()

    // Track buttons in an array for easy cleanup
    driverPassengerMobileControls = []

    // Exit button - always shown for driver/passenger seats (all platforms)
    // Match turret exit button position exactly (same spot for all seats)
    driverPassengerExitButton = app.create('ui', {
      space: 'screen',
      width: 40,
      height: 40,
      backgroundColor: 'rgba(200, 50, 50, 0.3)',
      borderRadius: 20,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-145, -160],
      cursor: 'pointer',
      onPointerDown: () => {
        driverPassengerExitButton.backgroundColor = 'rgba(200, 50, 50, 0.5)'
      },
      onPointerUp: () => {
        driverPassengerExitButton.backgroundColor = 'rgba(200, 50, 50, 0.3)'
        app.send('unmount')
      },
      alignItems: 'center',
      justifyContent: 'center',
    })
    const exitLabel = app.create('uitext', {
      value: 'EXIT',
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
    })
    driverPassengerExitButton.add(exitLabel)
    app.add(driverPassengerExitButton)
    driverPassengerMobileControls.push(driverPassengerExitButton)

    // Note: Mobile joystick support relies on the engine's built-in joystick bridge system
    // which automatically bridges touch joystick input to control.keyW/A/S/D.down
    // The vehicle's input system already reads from these keys, so joystick should work automatically
    if (isMobile) {
      const mobileNotice = app.create('uitext', {
        value: 'Mobile: Use joystick to drive',
        color: '#ffaa00',
        fontSize: 16,
      })

      const noticeUI = app.create('ui', {
        width: 350,
        height: 40,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 5,
        position: [0, 3, -4],
        billboard: 'full',
      })

      noticeUI.add(mobileNotice)
      touchControls = noticeUI
      car.add(noticeUI)
    }
  })
}

function removeDriverPassengerMobileControls() {
  if (driverPassengerMobileControls && Array.isArray(driverPassengerMobileControls)) {
    safeExecute(() => {
      // Remove all buttons from the array
      for (const button of driverPassengerMobileControls) {
        if (button) {
          app.remove(button)
        }
      }
      driverPassengerMobileControls = null
      driverPassengerExitButton = null
    })
  }
}

// Mobile controls for turret seat
let turretMobileControls = null
let turretExitButton = null
let turretAccelButton = null
let turretEBrakeButton = null
let turretShootButton = null
let turretShootButtonPressed = false

function setupTurretMobileControls() {
  // Check if navigator is available (may not be in SES environment)
  isMobile =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      : false
  if (!control) return

  safeExecute(() => {
    // Remove existing controls if any
    removeTurretMobileControls()

    // Track buttons in an array for easy cleanup
    turretMobileControls = []

    // Shoot button - always shown when in turret seat (all platforms)
    // Match pistol script style but smaller (40x40 instead of 50x50)
    turretShootButton = app.create('ui', {
      space: 'screen',
      width: 40,
      height: 40,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 20,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-90, -160],
      cursor: 'pointer',
      onPointerDown: () => {
        turretShootButton.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        turretShootButtonPressed = true
      },
      onPointerUp: () => {
        turretShootButton.backgroundColor = 'rgba(0, 0, 0, 0.3)'
        turretShootButtonPressed = false
      },
      onPointerOut: () => {
        // Reset if pointer leaves button area while pressed
        turretShootButton.backgroundColor = 'rgba(0, 0, 0, 0.3)'
        turretShootButtonPressed = false
      },
      alignItems: 'center',
      justifyContent: 'center',
    })
    const shootLabel = app.create('uitext', {
      value: 'SHOOT',
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
    })
    turretShootButton.add(shootLabel)
    app.add(turretShootButton)
    turretMobileControls.push(turretShootButton)

    // Exit button - positioned next to shoot button
    turretExitButton = app.create('ui', {
      space: 'screen',
      width: 40,
      height: 40,
      backgroundColor: 'rgba(200, 50, 50, 0.3)',
      borderRadius: 20,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-145, -160],
      cursor: 'pointer',
      onPointerDown: () => {
        turretExitButton.backgroundColor = 'rgba(200, 50, 50, 0.5)'
      },
      onPointerUp: () => {
        turretExitButton.backgroundColor = 'rgba(200, 50, 50, 0.3)'
        app.send('unmount')
      },
      alignItems: 'center',
      justifyContent: 'center',
    })
    const exitLabel = app.create('uitext', {
      value: 'EXIT',
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
    })
    turretExitButton.add(exitLabel)
    app.add(turretExitButton)
    turretMobileControls.push(turretExitButton)

    // Vehicle control buttons (only on mobile)
    if (isMobile) {
      // Accelerate button - positioned below shoot button
      turretAccelButton = app.create('ui', {
        space: 'screen',
        width: 40,
        height: 40,
        backgroundColor: 'rgba(50, 200, 50, 0.3)',
        borderRadius: 20,
        pivot: 'top-right',
        position: [1, 1],
        offset: [-90, -210],
        cursor: 'pointer',
        onPointerDown: () => {
          turretAccelButton.backgroundColor = 'rgba(50, 200, 50, 0.5)'
          accelInput = 1
        },
        onPointerUp: () => {
          turretAccelButton.backgroundColor = 'rgba(50, 200, 50, 0.3)'
          accelInput = 0
        },
        alignItems: 'center',
        justifyContent: 'center',
      })
      const accelLabel = app.create('uitext', {
        value: 'GO',
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
      })
      turretAccelButton.add(accelLabel)
      app.add(turretAccelButton)
      turretMobileControls.push(turretAccelButton)

      // E-brake button - positioned next to accelerate button
      turretEBrakeButton = app.create('ui', {
        space: 'screen',
        width: 40,
        height: 40,
        backgroundColor: 'rgba(200, 200, 50, 0.3)',
        borderRadius: 20,
        pivot: 'top-right',
        position: [1, 1],
        offset: [-145, -210],
        cursor: 'pointer',
        onPointerDown: () => {
          turretEBrakeButton.backgroundColor = 'rgba(200, 200, 50, 0.5)'
          handbrakeInput = true
        },
        onPointerUp: () => {
          turretEBrakeButton.backgroundColor = 'rgba(200, 200, 50, 0.3)'
          handbrakeInput = false
        },
        alignItems: 'center',
        justifyContent: 'center',
      })
      const ebrakeLabel = app.create('uitext', {
        value: 'BRAKE',
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
      })
      turretEBrakeButton.add(ebrakeLabel)
      app.add(turretEBrakeButton)
      turretMobileControls.push(turretEBrakeButton)
    }
  })
}

function removeTurretMobileControls() {
  if (turretMobileControls && Array.isArray(turretMobileControls)) {
    safeExecute(() => {
      // Remove all buttons from the array
      for (const button of turretMobileControls) {
        if (button) {
          app.remove(button)
        }
      }
      turretMobileControls = null
      turretExitButton = null
      turretAccelButton = null
      turretEBrakeButton = null
      turretShootButton = null
      // Reset input values when controls are removed
      accelInput = 0
      handbrakeInput = false
      turretShootButtonPressed = false
    })
  }
}

// Damage system
function takeDamage(amount) {
  if (health <= 0) return

  health = Math.max(0, health - amount)
  isDamaged = health < maxHealth * 0.7

  // Play crash sound
  if (audioSources.crash.src) {
    audioSources.crash.play()
  }

  // Visual damage effects
  if (health <= 0) {
    setMode(disabledMode)

    // Add smoke particles
    const damageSmoke = app.create('particles', {
      emitting: true,
      shape: ['box', 0.5, 0.5, 0.5],
      rate: 10,
      life: '5~10',
      size: '1~3',
      speed: '1~3',
      color: 'gray',
      alpha: '0.5~0.8',
      alphaOverLife: '0,1|1,0',
      image: smokeUrl,
    })
    damageSmoke.position.set(0, 1, 1)
    car.add(damageSmoke)
  }
}

// Enhanced collision detection
if (car.onCollisionEnter) {
  car.onCollisionEnter = collision => {
    const impactForce = collision.impulse ? collision.impulse.length() : 0
    if (impactForce > 10) {
      const damage = Math.min(impactForce * 0.5, 25)
      takeDamage(damage)
    }
  }
}

// LOD system
function updateLOD(distanceToPlayer) {
  if (distanceToPlayer > LOD_DISTANCES.LOW) {
    // Disable particle effects at far distance
    for (const wheel of wheels) {
      if (wheel.skid) wheel.skid.emitting = false
      if (wheel.smoke) wheel.smoke.emitting = false
    }
    exhaustParticles.emitting = false
  } else if (distanceToPlayer > LOD_DISTANCES.MEDIUM) {
    // Reduce particle quality at medium distance
    for (const wheel of wheels) {
      if (wheel.skid) wheel.skid.rate = 4 // Reduced from 8
      if (wheel.smoke) wheel.smoke.rate = 2 // Reduced from 5
    }
  }
  // Full quality at close distance (< LOD_DISTANCES.FULL)
}

// Enhanced audio system
function updateAudio(delta) {
  safeExecute(() => {
    if (!audioSources.idle || !audioSources.idle.src) return

    const idleVolume = Math.max(0.3, 1 - power)
    const revVolume = power * 0.8

    audioSources.idle.volume = idleVolume
    if (audioSources.idle.setPlaybackRate) {
      audioSources.idle.setPlaybackRate(1 + power * 0.5)
    }

    if (audioSources.revving && audioSources.revving.src) {
      audioSources.revving.volume = revVolume
      if (audioSources.revving.setPlaybackRate) {
        audioSources.revving.setPlaybackRate(0.8 + power * 1.2)
      }
    }

    if (audioSources.skidding && audioSources.skidding.src) {
      audioSources.skidding.volume = isSlipping ? 0.6 : 0
    }

    if (brakeInput && audioSources.braking && audioSources.braking.src && !audioSources.braking.playing) {
      audioSources.braking.play()
    }
  })
}

// Enhanced tire temperature system
function updateTireTemperature(delta) {
  for (let i = 0; i < wheels.length; i++) {
    const wheel = wheels[i]
    if (!wheel.hub) continue

    // Heat up during sliding
    if (wheel.skid?.emitting) {
      wheel.temperature += 50 * delta
    }

    // Cool down naturally
    wheel.temperature = Math.max(0, wheel.temperature - 10 * delta)

    // Affect grip based on temperature
    const tempFactor = Math.max(0.3, 1 - wheel.temperature / 200)
    wheel.currentGrip = wheel.baseGrip * tempFactor
  }
}

// Enhanced lighting system
function updateLights() {
  safeExecute(() => {
    const isBraking = accelInput < 0 || handbrakeInput || brakeInput

    // Update brake lights
    for (const light of lights.brakelights) {
      if (light && light.intensity !== undefined) {
        light.intensity = isBraking ? 1 : 0.3
      } else if (light && light.material && light.material.emissive) {
        light.material.emissive.setScalar(isBraking ? 0.8 : 0.2)
      }
    }

    // Update headlights
    for (const light of lights.headlights) {
      if (light && light.intensity !== undefined) {
        light.intensity = 0.8
      }
    }
  })
}

// Enhanced camera system
function updateCamera(delta) {
  if (!control || !control.camera) return

  safeExecute(() => {
    // Turret seat uses free camera (positioned at GunnerCam reference, free rotation for aiming)
    if (isInTurretSeat) {
      // Position camera at GunnerCam reference if available, otherwise fallback to seat position
      const cameraPositionNode = gunnerCam || seatNodes[2]
      if (cameraPositionNode) {
        control.camera.position.copy(cameraPositionNode.position)
        control.camera.position.applyMatrix4(car.matrixWorld)
      }

      // Initialize camera rotation and zoom to match car's forward direction only once when entering
      if (justEnteredTurretSeat) {
        control.camera.quaternion.copy(car.quaternion)
        // Reset zoom to default to prevent glitchy behavior
        zoom = 1 // Default zoom (no zoom)
        if (control.camera.zoom !== undefined) {
          control.camera.zoom = 1
        }
        justEnteredTurretSeat = false
      }

      // Allow zoom adjustment via scroll wheel while in turret seat
      if (control.scrollDelta && control.scrollDelta.value !== 0) {
        zoom += -control.scrollDelta.value * 0.01
        zoom = clamp(zoom, 0.5, 2) // Allow zoom from 0.5x to 2x
        if (control.camera.zoom !== undefined) {
          control.camera.zoom = lerp(control.camera.zoom, zoom, zoomSpeed * delta)
        }
      }

      // Allow free camera rotation via pointer input (like FOLLOW mode)
      if (control.pointer && control.pointer.delta) {
        control.camera.rotation.reorder('YXZ')
        control.camera.rotation.y -= control.pointer.delta.x * 0.1 * delta
        control.camera.rotation.x -= control.pointer.delta.y * 0.1 * delta
        // Clamp vertical rotation to prevent flipping
        control.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, control.camera.rotation.x))
      }

      // The turret rotation system will read from camera.quaternion for aiming
      return
    }

    switch (currentCameraMode) {
      case CAMERA_MODES.FOLLOW:
        control.camera.position.copy(car.position)
        control.camera.position.y += cameraYOffset

        if (!control.mouseLeft || !control.mouseLeft?.down) {
          const targetY = e1.setFromQuaternion(car.quaternion).y
          e2.setFromQuaternion(control.camera.quaternion)
          e2.y = targetY
          q1.setFromEuler(e2)
          control.camera.quaternion.slerp(q1, 4 * delta)
        } else if (control.pointer && control.pointer.delta) {
          control.camera.rotation.reorder('YXZ')
          control.camera.rotation.y -= control.pointer.delta.x * 0.1 * delta
          control.camera.rotation.x -= control.pointer.delta.y * 0.1 * delta
        }

        if (control.scrollDelta && control.scrollDelta.value !== undefined) {
          zoom += -control.scrollDelta.value * 0.01
          zoom = clamp(zoom, 3, 15)
          control.camera.zoom = lerp(control.camera.zoom, zoom, zoomSpeed * delta)
        }
        break

      case CAMERA_MODES.COCKPIT:
        if (seatNodes[0]) {
          control.camera.position.copy(seatNodes[0].position)
          control.camera.position.y += seat1YOffset // Apply Y offset for Seat1
          control.camera.position.applyMatrix4(car.matrixWorld)
          control.camera.quaternion.copy(car.quaternion)
        }
        break

      case CAMERA_MODES.HOOD:
        control.camera.position.copy(car.position)
        control.camera.position.y += 0.5
        v1.set(0, 0, -2).applyQuaternion(car.quaternion)
        control.camera.position.add(v1)
        control.camera.quaternion.copy(car.quaternion)
        break

      case CAMERA_MODES.CINEMATIC:
        if (world.getTime) {
          const time = world.getTime() * 0.5
          const radius = 8 + Math.sin(time * 0.3) * 3
          const height = 3 + Math.cos(time * 0.2) * 2

          control.camera.position.x = car.position.x + Math.cos(time) * radius
          control.camera.position.z = car.position.z + Math.sin(time) * radius
          control.camera.position.y = car.position.y + height
          if (control.camera.lookAt) {
            control.camera.lookAt(car.position)
          }
        }
        break
    }
  })
}

// Turret rotation system
function updateTurretRotation(delta) {
  if (!control || !control.camera || !turretBaseBone || !turretGunBone || !car) return

  safeExecute(() => {
    // Read camera rotation (world space)
    const cameraRotation = control.camera.rotation
    if (!cameraRotation) return

    // Get car's Y rotation (world space) to calculate relative rotation
    e1.setFromQuaternion(car.quaternion)
    const carYRotation = e1.y

    // Calculate turret base rotation relative to car
    // Camera Y rotation (horizontal look) relative to car's forward direction
    const cameraYRotation = cameraRotation.y
    const targetBaseRotation = cameraYRotation - carYRotation

    // Normalize to -PI to PI range
    let normalizedTarget = targetBaseRotation
    while (normalizedTarget > Math.PI) normalizedTarget -= Math.PI * 2
    while (normalizedTarget < -Math.PI) normalizedTarget += Math.PI * 2

    // Smooth interpolate base rotation with wrap-around handling
    const baseDiff = normalizedTarget - turretBaseRotation
    let normalizedDiff = baseDiff
    if (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2
    if (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2

    turretBaseRotation += normalizedDiff * turretRotationSpeed * delta
    // Normalize to -PI to PI range
    while (turretBaseRotation > Math.PI) turretBaseRotation -= Math.PI * 2
    while (turretBaseRotation < -Math.PI) turretBaseRotation += Math.PI * 2

    // Get target gun rotation from camera X rotation (vertical look/up-down)
    // Clamp to reasonable elevation limits
    const maxElevation = Math.PI / 4 // 45 degrees up
    const minElevation = -Math.PI / 6 // -30 degrees down
    const targetGunRotation = clamp(cameraRotation.x, minElevation, maxElevation)

    // Smooth interpolate gun rotation
    turretGunRotation = lerp(turretGunRotation, targetGunRotation, turretRotationSpeed * delta)

    // Update bone rotations (relative to car)
    if (turretBaseBone.rotation !== undefined) {
      turretBaseBone.rotation.y = turretBaseRotation
    }
    if (turretGunBone.rotation !== undefined) {
      turretGunBone.rotation.x = turretGunRotation
      // Don't rotate the gun bone on Z-axis - only rotate barrel if it exists
    }
    // Rotate barrel separately if it exists
    if (turretBarrelBone && turretBarrelBone.rotation !== undefined) {
      turretBarrelBone.rotation.z = turretBarrelRotation
    }
  })
}

// Turret shooting system
function updateTurretShooting(delta) {
  if (!control || isTurretOverheated) return

  // Check for mouse input (down for continuous) or mobile button input (held)
  const fireInput = control.mouseLeft
  const isFiring = (fireInput && fireInput.down) || turretShootButtonPressed
  if (!isFiring) return

  const now = world.getTime()
  if (now - lastTurretFireTime < turretFireRate) return

  // Get firing direction from camera (like pistol script) - frozen at fire time
  let dir
  let origin
  if (control.camera && control.camera.quaternion && control.camera.position) {
    // Use camera direction directly for accurate aiming (like pistol script)
    dir = v1.set(0, 0, -1).applyQuaternion(control.camera.quaternion)
    // Use camera position as origin so bullets shoot from reticle/camera center
    origin = control.camera.position.clone()
    // Project forward slightly to avoid self-hits
    const forwardOffset = dir.clone().multiplyScalar(0.3)
    origin.add(forwardOffset)
  } else {
    return
  }

  // Clone direction to ensure it's frozen (not affected by future updates)
  const frozenDir = dir.clone()

  // Get muzzle position for visual effects (muzzle flash should appear at muzzle bone)
  let muzzlePos = origin.clone() // Default to camera position
  if (turretMuzzleBone) {
    try {
      const muzzleMatrixWorld = turretMuzzleBone.matrixWorld
      if (muzzleMatrixWorld) {
        muzzlePos.setFromMatrixPosition(muzzleMatrixWorld)
      }
    } catch (e) {
      // Bone not found, use camera position
    }
  }

  // Send fire event to server
  app.send('turret:fire', {
    origin: origin.toArray(), // Camera position for bullet origin
    muzzlePos: muzzlePos.toArray(), // Muzzle bone position for muzzle flash
    dir: frozenDir.toArray(),
    heat: turretHeat,
  })

  lastTurretFireTime = now

  // Increment barrel rotation (spin on Z axis)
  turretBarrelRotation += 0.5 // Rotate barrel on each shot
  if (turretBarrelRotation > Math.PI * 2) {
    turretBarrelRotation -= Math.PI * 2
  }

  // Increment heat
  turretHeat += 1
  if (turretHeat >= turretOverheatThreshold) {
    isTurretOverheated = true
    playTurretSound('Overheat')
  }

  // Play sound immediately (local, no sync needed)
  playTurretSound('Fire')

  // NOTE: Visual effects (muzzle flash, bullet trail) are handled by server broadcast
  // This ensures all clients see the same effects for consistency
  // The server will broadcast 'turret:fire-visual' which all clients (including gunner) will receive
}

// Turret heat management
function updateTurretHeat(delta) {
  if (isTurretOverheated) {
    // Cooldown phase
    turretHeat -= (turretOverheatThreshold / turretCooldownTime) * delta
    if (turretHeat <= 0) {
      turretHeat = 0
      isTurretOverheated = false
    }
  } else {
    // Natural cooling when not shooting
    turretHeat = Math.max(0, turretHeat - delta * 2) // Cool down slowly
  }
}

// Network rate adaptation
function updateNetworkRate() {
  const velocity = car.getLinearVelocity ? car.getLinearVelocity(v1).length() : 0
  adaptiveSendRate = velocity > 5 ? BASE_SEND_RATE : SLOW_SEND_RATE
}

// Differential system for better turning
function applyDifferential(leftWheel, rightWheel, torque) {
  if (!leftWheel.hub || !rightWheel.hub) return torque

  const speedDiff = Math.abs(leftWheel.speed - rightWheel.speed)
  const diffRatio = 1.0 - speedDiff * 0.1 // Simple open differential

  const leftTorque = torque * diffRatio
  const rightTorque = torque * diffRatio

  // Apply more torque to slower wheel
  if (leftWheel.speed < rightWheel.speed) {
    return { left: leftTorque * 1.2, right: rightTorque }
  } else {
    return { left: leftTorque, right: rightTorque * 1.2 }
  }
}

// Server-side logic
if (world.isServer) {
  state.authority = null
  state.sitting = [null, null, null, null]
  state.info = info.read().serialize(true) // Include turret state for initial sync
  state.ready = true

  app.on('mount', (seatIdx, playerId) => {
    if (state.sitting[seatIdx]) return
    state.sitting[seatIdx] = playerId
    if (seatIdx === 0) {
      app.send('authority', playerId)
      setMode(viewerMode)
    }
    app.send('seat', [seatIdx, playerId])
  })

  app.on('unmount', (_, playerId) => {
    const seatIdx = state.sitting.indexOf(playerId)
    if (seatIdx === -1) return
    state.sitting[seatIdx] = null
    app.send('seat', [seatIdx, null])
  })

  world.on('leave', ({ playerId }) => {
    const seatIdx = state.sitting.indexOf(playerId)
    if (seatIdx === -1) return
    state.sitting[seatIdx] = null
    app.send('seat', [seatIdx, null])
    if (seatIdx === 0) {
      app.send('authority', null)
      setMode(simulateMode)
    }
  })

  app.on('info', (data, playerId) => {
    // Driver sends vehicle state (without turret)
    info.deserialize(data)
    app.send('info', data, playerId)
  })

  app.on('turret:info', (data, playerId) => {
    // Gunner sends turret state only (separate from vehicle state)
    // Merge turret state into info object and broadcast to all clients
    info.deserializeTurretOnly(data)
    // Broadcast turret state to all clients (including sender for consistency)
    app.send('turret:info', data)
  })

  app.on('damage', (amount, playerId) => {
    if (state.authority === playerId) {
      takeDamage(amount)
    }
  })

  app.on('camera-mode', (mode, playerId) => {
    app.send('camera-mode', mode, playerId)
  })

  // Turret fire handler (server-side)
  app.on('turret:fire', (data, playerId) => {
    // Only allow firing if player is in Seat3
    if (state.sitting[2] !== playerId) {
      console.warn('Turret fire: Player not in Seat3')
      return
    }

    // Validate heat from client (prevent cheating)
    const clientHeat = data.heat || 0
    if (clientHeat >= turretOverheatThreshold) {
      console.warn('Turret fire: Overheated, ignoring fire request')
      return
    }

    const origin = v1.fromArray(data.origin)
    const dir = v2.fromArray(data.dir).normalize()
    const layerMask = world.createLayerMask('player', 'environment')

    // Authoritative raycast
    const hit = world.raycast(origin, dir, turretRange, layerMask)

    if (hit) {
      // Check if we hit a player
      if (hit.playerId && hit.playerId !== playerId) {
        const targetPlayer = world.getPlayer(hit.playerId)
        if (targetPlayer && targetPlayer.health !== undefined) {
          // Prevent self-hits and close-range hits
          if (hit.distance < 0.5) return

          let amount = turretMinDamage + Math.random() * (turretMaxDamage - turretMinDamage)
          let crit = false
          if (targetPlayer.health > amount) {
            crit = Math.random() < turretCritChance
            if (crit) amount *= turretCritMultiplier
          }
          if (amount > targetPlayer.health) amount = targetPlayer.health

          targetPlayer.damage(amount)
          app.send('turret:hit', {
            playerId: hit.playerId,
            amount,
            crit,
            position: hit.point.toArray(),
          })
        }
      }
      // Check if we hit a mob
      else if (hit.tag?.startsWith('elemental-mob:')) {
        try {
          const mobInstanceId = hit.tag.split(':')[1]
          let amount = turretMinDamage + Math.random() * (turretMaxDamage - turretMinDamage)
          const crit = Math.random() < turretCritChance
          if (crit) amount *= turretCritMultiplier

          app.emit('elemental-mob:hit', [mobInstanceId, playerId, amount, crit])
        } catch (error) {
          console.error('[turret] Error handling mob hit:', error)
        }
      }
    }

    // Broadcast fire event to all clients for visual effects
    // Use muzzle position for muzzle flash, camera origin for bullet trail
    app.send('turret:fire-visual', {
      origin: data.origin, // Camera position for bullet trail
      muzzlePos: data.muzzlePos || data.origin, // Muzzle bone position for muzzle flash (fallback to origin)
      direction: data.dir,
      hit: hit
        ? {
            position: hit.point.toArray(),
            playerId: hit.playerId,
            entityId: hit.entityId,
          }
        : null,
    })
  })

  app.send('init', state)

  app.on('fixedUpdate', delta => {
    mode?.fixedUpdate(delta)
  })

  app.on('update', delta => {
    mode?.update(delta)
  })

  setMode(simulateMode)
}

// Client-side logic
if (world.isClient) {
  world.remove(car)

  if (state.ready) {
    init(app.state)
  } else {
    app.on('init', init)
  }

  function init(_state_) {
    state = _state_
    world.add(car)
    info.deserialize(state.info).write()

    // Start audio
    for (const audio of Object.values(audioSources)) {
      if (audio.src && audio.loop) {
        audio.play()
      }
    }

    const seats = seatNodes.map((node, seatIdx) => {
      if (!node) return null

      const action = app.create('action', {
        label: 'Enter',
        distance: 3,
        onTrigger: () => {
          app.send('mount', seatIdx)
          action.active = false
        },
      })
      action.position.y += 0.5
      action.active = !state.sitting[seatIdx]
      node.add(action)

      const anchorId = `seat-${seatIdx}-${app.instanceId}`
      const anchor = app.create('anchor', { id: anchorId })
      // Apply Y offset for Seat1 and Seat2
      if (seatIdx === 0) {
        anchor.position.y = seat1YOffset
      } else if (seatIdx === 1) {
        anchor.position.y = seat2YOffset
      }
      node.add(anchor)

      return {
        playerId: state.sitting[seatIdx],
        anchor,
        setActive(active) {
          action.active = active
        },
      }
    })

    app.on('seat', ([seatIdx, playerId]) => {
      const seat = seats[seatIdx]
      if (!seat) return

      if (seat.playerId === player.id) {
        // We unmounted
        console.log('unmount')
        player.cancelEffect()
        control?.release()
        control = null
        accelInput = 0
        steerInput = 0
        isSeated = false

        // Reset turret state if unmounting from turret seat
        const wasInTurretSeat = isInTurretSeat
        if (wasInTurretSeat) {
          isInTurretSeat = false
          justEnteredTurretSeat = false
          turretHeat = 0
          isTurretOverheated = false
          turretBaseRotation = 0
          turretGunRotation = 0
        }

        // Clean up HUD and touch controls
        safeExecute(() => {
          if (wasInTurretSeat) {
            if (turretHUD) {
              app.remove(turretHUD)
              turretHUD = null
              turretHeatBar = null
            }
            removeTurretMobileControls()
          } else {
            if (dashboard) {
              app.remove(dashboard)
              dashboard = null
              speedometer = null
            }
            removeDriverPassengerMobileControls()
          }

          if (touchControls) {
            car.remove(touchControls)
            touchControls = null
          }
        })

        for (const seat of seats) {
          seat?.setActive(!seat.playerId)
        }
      }

      seat.playerId = playerId
      seat.setActive(!playerId && !isSeated)

      if (playerId === player.id) {
        // We mounted
        const wasInTurretSeat = isInTurretSeat
        isInTurretSeat = seatIdx === 2 // Seat3 is index 2
        justEnteredTurretSeat = isInTurretSeat && !wasInTurretSeat

        player.applyEffect({
          anchor: seat.anchor,
          emote: isInTurretSeat ? turretSeatEmote : sitEmote,
        })

        control = app.control()
        // Hide reticle for driver/passenger seats, but keep it visible for turret seat
        if (!isInTurretSeat) {
          control.hideReticle()
        }
        control.camera.write = true
        isSeated = true

        // Create HUD and touch controls
        if (isInTurretSeat) {
          createTurretHUD()
          setupTurretMobileControls()
        } else {
          createHUD()
          setupTouchControls()
        }

        for (const seat of seats) {
          seat?.setActive(false)
        }
      }
    })

    app.on('authority', playerId => {
      if (state.authority === player.id) {
        setMode(viewerMode)
      }
      state.authority = playerId
      if (playerId === player.id) {
        setMode(simulateMode)
      }
    })

    app.on('camera-mode', mode => {
      currentCameraMode = mode
    })

    app.on('fixedUpdate', delta => {
      mode?.fixedUpdate(delta)
    })

    app.on('update', delta => {
      // Mode updates
      mode?.update(delta)

      // Exit input
      if (isSeated && control?.keyQ?.pressed) {
        app.send('unmount')
      }

      // Camera mode switching
      if (isSeated && control) {
        if (control.key1?.pressed) {
          currentCameraMode = CAMERA_MODES.FOLLOW
          app.send('camera-mode', currentCameraMode)
        } else if (control.key2?.pressed) {
          currentCameraMode = CAMERA_MODES.COCKPIT
          app.send('camera-mode', currentCameraMode)
        } else if (control.key3?.pressed) {
          currentCameraMode = CAMERA_MODES.HOOD
          app.send('camera-mode', currentCameraMode)
        } else if (control.key4?.pressed) {
          currentCameraMode = CAMERA_MODES.CINEMATIC
          app.send('camera-mode', currentCameraMode)
        }
      }

      // Enhanced audio system
      updateAudio(delta)

      // Enhanced lighting
      updateLights()

      // HUD updates
      updateHUD()

      // Camera updates
      updateCamera(delta)

      // LOD updates
      if (player) {
        const distanceToPlayer = car.position.distanceTo(player.position)
        updateLOD(distanceToPlayer)
      }

      // Turret rotation and shooting (only when in turret seat)
      if (isInTurretSeat && control && turretBaseBone && turretGunBone) {
        updateTurretRotation(delta)
        updateTurretShooting(delta)
        updateTurretHeat(delta)
        updateTurretHUD()

        // Update player anchor rotation to match turret base (for gunner only)
        // Read directly from bone rotation - this is the authoritative source for the gunner
        if (turretBaseBone && turretBaseBone.rotation !== undefined) {
          const anchorId = `seat-2-${app.instanceId}`
          const anchor = app.get(anchorId)
          if (anchor && anchor.rotation) {
            // Set anchor rotation to match turret base bone rotation (Y-axis only)
            anchor.rotation.y = turretBaseBone.rotation.y
          }
        }

        // Send turret state updates to server at higher frequency (gunner only)
        // Use separate timer and separate message to avoid conflicts with vehicle updates
        // Gunner sends ONLY turret state, not vehicle state (driver handles vehicle state)
        lastTurretSend += delta
        if (lastTurretSend > TURRET_SEND_RATE) {
          lastTurretSend = 0
          // Read current turret state and send it as separate message (NO vehicle state)
          const turretState = info.read().serializeTurretOnly()
          app.send('turret:info', turretState)
        }
      }
    })

    // Handle turret fire visual effects from server
    app.on('turret:fire-visual', data => {
      // Get muzzle position directly from turret muzzle bone (ensures perfect sync with turret rotation)
      let muzzlePos = new Vector3().fromArray(data.muzzlePos || data.origin) // Fallback to network position
      if (turretMuzzleBone) {
        try {
          const muzzleMatrixWorld = turretMuzzleBone.matrixWorld
          if (muzzleMatrixWorld) {
            muzzlePos.setFromMatrixPosition(muzzleMatrixWorld)
          }
        } catch (e) {
          // Bone not found, use network position
        }
      }

      const dir = new Vector3().fromArray(data.direction || data.dir).normalize()

      // Create muzzle flash for all clients at muzzle bone position
      safeExecute(() => {
        const muzzleFlash = app.create('particles', {
          shape: ['sphere', 0.15, 1],
          direction: 1,
          rate: 0,
          max: 40,
          bursts: [{ time: 0, count: 40 }],
          color: '#ffaa00',
          size: '0.08~0.2',
          alphaOverLife: '1,1|1,0',
          emissive: '10',
          speed: '3~7',
          life: '0.1~0.3',
        })
        muzzleFlash.position.copy(muzzlePos)
        world.add(muzzleFlash)
        setTimeout(() => {
          world.remove(muzzleFlash)
        }, 500)
      })

      // Create bullet trail for all clients from muzzle bone position
      // Use time-based movement for consistent sync across all clients
      const bulletOrigin = muzzlePos.clone() // Store muzzle position at fire time
      const trail = createTurretBulletTrail(bulletOrigin, dir)
      if (trail) {
        const distance = turretRange
        const speed = 50 // Projectile speed for visual
        const startTime = world.getTime() // Use world time for sync
        const frozenDirArray = dir.toArray() // Store as array for immutability in closure

        const updateHandler = dt => {
          // Calculate position based on elapsed time since fire (ensures sync across clients)
          const elapsedTime = world.getTime() - startTime
          const traveled = speed * elapsedTime

          if (traveled >= distance) {
            world.remove(trail)
            app.off('update', updateHandler)
          } else {
            // Update trail position based on time, not frame delta
            v2.fromArray(frozenDirArray).multiplyScalar(traveled)
            trail.position.copy(bulletOrigin).add(v2)
          }
        }
        app.on('update', updateHandler)
      }

      // Create impact sparks if hit
      if (data.hit && data.hit.position) {
        const impactPos = new Vector3().fromArray(data.hit.position)
        createTurretImpactSparks(impactPos)
      }
    })

    app.on('turret:hit', data => {
      // Could add hit feedback UI here if needed
    })

    setMode(viewerMode)
  }
}

// Enhanced viewer mode
function viewerMode() {
  car.type = 'kinematic'

  app.on('info', data => {
    // Driver sends vehicle state (without turret)
    info.deserialize(data)
    // Write network state (turret bones are updated separately via turret:info)
    info.write()
  })

  app.on('turret:info', data => {
    // Gunner sends turret state only (separate from vehicle state)
    // Only apply turret updates if we're NOT the gunner (gunner controls their own turret directly)
    if (!isInTurretSeat) {
      info.deserializeTurretOnly(data)
      // Update bones directly for viewers (gunner never applies network updates to their own turret)
      info.write()
    }
  })

  return {
    fixedUpdate(delta) {
      // Enhanced viewer mode physics
    },
    update(delta) {
      // Smooth interpolation to target position (increased rates for smoother movement)
      car.position.lerp(info.position, 8 * delta)
      car.quaternion.slerp(info.quaternion, 8 * delta)

      // Enhanced wheel interpolation (increased rates for smoother movement)
      for (let i = 0; i < wheels.length; i++) {
        const wheel = wheels[i]
        if (!wheel.hub || !wheel.tire) continue

        wheel.hub.position.y = lerp(wheel.hub.position.y, info.wheels[i].offset, 12 * delta)
        wheel.hub.rotation.y = lerp(wheel.hub.rotation.y, info.wheels[i].turn, 12 * delta)
        wheel.tire.rotation.x = lerp(wheel.tire.rotation.x, info.wheels[i].rotate, 12 * delta)
        wheel.temperature = lerp(wheel.temperature || 0, info.wheels[i].temperature || 0, 4 * delta)

        if (wheel.rear && wheel.skid && wheel.smoke && wheel.particles) {
          wheel.skid.emitting = info.wheels[i].sliding
          wheel.smoke.emitting = info.wheels[i].sliding
          wheel.particles.position.copy(wheel.hub.position)
        }
      }

      // Turret bone rotations are updated directly in info.write() for viewers
      // No need for interpolation here - bones are updated directly from network state

      // Update player anchor rotation continuously for viewers (read directly from bone)
      // This ensures the gunner's avatar rotates smoothly with the turret for all viewers
      if (turretBaseBone && turretBaseBone.rotation !== undefined) {
        const anchorId = `seat-2-${app.instanceId}`
        const anchor = app.get(anchorId)
        if (anchor && anchor.rotation) {
          // Read directly from bone rotation to match visual (bone is source of truth)
          anchor.rotation.y = turretBaseBone.rotation.y
        }
      }

      // Update damage effects
      health = info.health
      isDamaged = info.isDamaged
      exhaustParticles.emitting = info.exhaustEmitting
      turretHeat = info.turretHeat || 0
      isTurretOverheated = info.isTurretOverheated || false
    },
    cancel() {
      // Cleanup viewer mode
    },
  }
}

// Disabled mode for damaged vehicles
function disabledMode() {
  car.type = 'kinematic'

  return {
    fixedUpdate(delta) {
      // Vehicle is disabled, no physics
    },
    update(delta) {
      // Keep smoking if damaged
      if (isDamaged) {
        exhaustParticles.emitting = true
        exhaustParticles.rate = 5 // Reduced rate for damage smoke
      }

      // Disable all input
      accelInput = 0
      steerInput = 0
      handbrakeInput = false
      brakeInput = false
    },
    cancel() {
      // Cleanup disabled mode
    },
  }
}

// Enhanced simulate mode
function simulateMode() {
  car.type = 'dynamic'

  return {
    fixedUpdate(delta) {
      if (health <= 0) return // Vehicle is disabled

      grounded = false

      // Enhanced speed calculation
      const velocity = v2
      car.getLinearVelocity(velocity)
      const forward = v1.copy(FORWARD).applyQuaternion(car.quaternion)
      const magnitude = velocity.length()
      const mSpeed = v3.copy(forward).dot(velocity)
      speed = mSpeed * 3.6 // m/s -> km/h
      isMovingForward = velocity.dot(forward) > 0
      speedRatio = speed / maxSpeed
      speedRatioAbs = clamp(Math.abs(speed) / maxSpeed, 0, 1)

      // Enhanced power calculation
      if ((handbrakeInput || isSlipping) && accelInput) {
        power += 1 * delta
      } else {
        power -= 0.4 * delta
      }
      power = clamp(Math.max(power, speedRatio), 0.1, 1)

      const roadPower = powerCurve.evaluate(speedRatio)
      if (!isSlipping && power > 0.8 && power > roadPower && !handbrakeInput) {
        isSlipping = true
      } else if (isSlipping && power < 0.8) {
        isSlipping = false
      }

      const powerFactor = powerCurve.evaluate(power)
      const accelForce = (accelInput > 0 ? accel : decel) * accelInput * powerFactor

      // Enhanced suspension system
      for (const wheel of wheels) {
        if (!wheel.spring || !wheel.hub) continue

        const worldMatrix = wheel.spring.getWorldMatrix(m1)
        const worldPos = v1.setFromMatrixPosition(worldMatrix)
        const worldQua = q1.setFromRotationMatrix(worldMatrix)
        const upDir = v3.copy(UP).applyQuaternion(worldQua)
        const downDir = v2.copy(DOWN).applyQuaternion(worldQua)
        const hit = world.raycast(worldPos, downDir, wheel.springMaxLength + wheel.radius, springLayerMask)

        if (hit) {
          wheel.grounded = true
          grounded = true
          const length = hit.distance - wheel.radius
          const compression = (wheel.springRestLength - length) / wheel.springTravel
          wheel.compression = compression
          const springVelocity = car.getLocalVelocityAtLocalPos(wheel.spring.position, v4).dot(upDir)
          const dampForce = springDamper * springVelocity
          const springForce = springStrength * compression
          const netForce = springForce - dampForce
          const finalForce = v5.copy(upDir).multiplyScalar(netForce)
          car.addForceAtLocalPos(finalForce, wheel.spring.position)
        } else {
          wheel.grounded = false
          wheel.compression = 0
        }

        // Enhanced visual positioning
        if (hit) {
          wheel.hub.position.copy(wheel.spring.position)
          wheel.hub.position.y -= hit.distance - wheel.radius
        } else {
          wheel.hub.position.copy(wheel.spring.position)
          wheel.hub.position.y = wheel.radius - wheel.springTravel
        }
      }

      // Enhanced steering with speed-dependent response
      const turnFactor = turnCurve.evaluate(speedRatioAbs)
      const steerSpeedFactor = 1.0 - speedRatioAbs * 0.7
      const adjustedSteerSpeed = steerSpeed * steerSpeedFactor
      const targetSteerAngle = steerInput * (steerAngleMax * DEG2RAD) * turnFactor
      const angleDifference = targetSteerAngle - steerAngle
      const maxAngleChange = adjustedSteerSpeed * delta

      if (Math.abs(angleDifference) <= maxAngleChange) {
        steerAngle = targetSteerAngle
      } else {
        steerAngle += Math.sign(angleDifference) * maxAngleChange
      }

      for (const wheel of wheels) {
        if (!wheel.turns || !wheel.hub || !wheel.spring) continue
        wheel.hub.rotation.y = steerAngle
        wheel.spring.rotation.y = steerAngle
      }

      // Enhanced acceleration with differential
      if (speedRatioAbs < 1) {
        const leftWheels = wheels.filter(w => w.left && w.powered && w.grounded)
        const rightWheels = wheels.filter(w => w.right && w.powered && w.grounded)

        for (let i = 0; i < Math.min(leftWheels.length, rightWheels.length); i++) {
          const leftWheel = leftWheels[i]
          const rightWheel = rightWheels[i]

          if (handbrakeInput && leftWheel.rear) continue

          const torques = applyDifferential(leftWheel, rightWheel, accelForce)

          // Apply forces
          if (leftWheel.spring) {
            const worldMatrix = leftWheel.spring.getWorldMatrix(m1)
            const worldQua = q1.setFromRotationMatrix(worldMatrix)
            const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
            const accelFinalForce = v4.copy(forwardDir).multiplyScalar(torques.left || accelForce)
            car.addForceAtLocalPos(accelFinalForce, leftWheel.hub.position)
          }

          if (rightWheel.spring) {
            const worldMatrix = rightWheel.spring.getWorldMatrix(m1)
            const worldQua = q1.setFromRotationMatrix(worldMatrix)
            const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
            const accelFinalForce = v4.copy(forwardDir).multiplyScalar(torques.right || accelForce)
            car.addForceAtLocalPos(accelFinalForce, rightWheel.hub.position)
          }
        }
      }

      // Enhanced rolling friction
      const regular = 0.2
      for (const wheel of wheels) {
        if (!wheel.grounded || !wheel.spring) continue
        const worldMatrix = wheel.spring.getWorldMatrix(m1)
        const worldQua = q1.setFromRotationMatrix(worldMatrix)
        const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
        const opposingDir = v4.copy(forwardDir).multiplyScalar(isMovingForward ? -1 : 1)
        const frictionForce = wheel.rear && handbrakeInput ? handbrake : regular
        const frictionFinalForce = v5.copy(opposingDir).multiplyScalar(frictionForce)
        car.addForceAtLocalPos(frictionFinalForce, wheel.hub.position)
      }

      // Enhanced lateral grip with temperature effects
      const tireMass = WHEEL_MASS
      for (const wheel of wheels) {
        if (!wheel.grounded || !wheel.spring) continue

        const worldMatrix = wheel.spring.getWorldMatrix(m1)
        const worldQua = q1.setFromRotationMatrix(worldMatrix)
        const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
        const steeringDir = v5.copy(RIGHT).applyQuaternion(worldQua)
        const tireWorldVel = car.getLocalVelocityAtLocalPos(wheel.spring.position, v6)

        const forwardVel = forwardDir.dot(tireWorldVel)
        const steeringVel = steeringDir.dot(tireWorldVel)

        wheel.speed = Math.abs(forwardVel)

        const totalVelMagnitude = Math.sqrt(forwardVel * forwardVel + steeringVel * steeringVel)
        const lateralVelRatio = totalVelMagnitude > 0.01 ? Math.abs(steeringVel) / totalVelMagnitude : 0

        let gripFactor
        if (wheel.rear && (handbrakeInput || isSlipping)) {
          gripFactor = 0.1
        } else {
          gripFactor = wheel.gripCurve.evaluate(lateralVelRatio) * wheel.currentGrip
        }

        const desiredVelChange = -steeringVel * gripFactor
        const desiredAccel = desiredVelChange / delta
        const counterForce = v4.copy(steeringDir).multiplyScalar(tireMass * desiredAccel)

        car.addForceAtLocalPos(counterForce, wheel.spring.position)

        // Enhanced sliding detection
        if (wheel.skid) {
          const sliding = gripFactor < 0.3 && Math.abs(speed) > 5
          wheel.skid.emitting = sliding
          wheel.smoke.emitting = sliding
        }
      }

      // Enhanced tire rotation with slip
      for (const wheel of wheels) {
        if (!wheel.spring || !wheel.tire) continue
        if (wheel.rear && handbrakeInput) continue

        const worldMatrix = wheel.spring.getWorldMatrix(m1)
        const worldQua = q1.setFromRotationMatrix(worldMatrix)
        const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
        car.getLocalVelocityAtLocalPos(wheel.spring.position, v6)
        const forwardVelocity = forwardDir.dot(v6)
        const angularVelocity = Math.abs(forwardVelocity) / wheel.radius
        const rotationAmount = Math.sign(forwardVelocity) * -1 * angularVelocity * delta
        wheel.tire.rotation.x += rotationAmount
      }

      // Tire temperature updates
      updateTireTemperature(delta)

      // Exhaust effects
      exhaustParticles.emitting = power > 0.3
      exhaustParticles.rate = power * 15

      // Network rate adaptation
      updateNetworkRate()
    },
    update(delta) {
      if (health <= 0) return // Vehicle is disabled

      if (control) {
        // Enhanced input handling
        steerInput = 0
        if (control.keyA?.down) steerInput += 1
        if (control.keyD?.down) steerInput -= 1

        accelInput = 0
        if (control.keyW?.down) accelInput += 1
        if (control.keyS?.down) accelInput -= 1

        handbrakeInput = control.space?.down
        brakeInput = control.keyS?.down && accelInput < 0
      }

      // Network transmission (driver sends vehicle state WITHOUT turret state)
      // Only the gunner sends turret state to avoid conflicts
      lastSend += delta
      if (lastSend > adaptiveSendRate) {
        lastSend = 0
        // Driver sends vehicle state only (exclude turret - gunner handles that)
        app.send('info', info.read().serialize(false)) // Exclude turret state
      }

      // Note: Anchor rotation for turret seat is handled in viewerMode.update()
      // Don't update here to avoid conflicts with the gunner's own updates
    },
    cancel() {
      // Cleanup simulate mode
    },
  }
}

// Utility functions
function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const DEG2RAD = Math.PI / 180
