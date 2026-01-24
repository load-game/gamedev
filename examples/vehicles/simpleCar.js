// Simplified Advanced Car Script
// Features: Vehicle physics, damage system, multiple cameras, LOD, mobile support
// Removed: Turret system, HUD display

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
const BASE_SEND_RATE = 1 / 60
const SLOW_SEND_RATE = 1 / 30
let adaptiveSendRate = BASE_SEND_RATE

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

if (!car || !body) {
  throw new Error('Critical car components missing')
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
  if (propValue && typeof propValue === 'string' && propValue.length > 0) {
    curve.deserialize(propValue)
    if (!curve.keyframes || curve.keyframes.length === 0) {
      for (const kf of defaultKeyframes) {
        curve.add({ time: kf.time, value: kf.value, inTangent: kf.inTangent || 0, outTangent: kf.outTangent || 0 })
      }
    }
  } else {
    for (const kf of defaultKeyframes) {
      curve.add({ time: kf.time, value: kf.value, inTangent: kf.inTangent || 0, outTangent: kf.outTangent || 0 })
    }
  }
  return curve
}

// Default curve keyframes
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
    hub: safeExecute(() => body.getBone( 'HubFL')),
    tire: safeExecute(() => body.getBone( 'TireFL')),
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
    hub: safeExecute(() => body.getBone( 'HubFR')),
    tire: safeExecute(() => body.getBone( 'TireFR')),
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
    hub: safeExecute(() => body.getBone( 'HubBL')),
    tire: safeExecute(() => body.getBone( 'TireBL')),
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
    hub: safeExecute(() => body.getBone( 'HubBR')),
    tire: safeExecute(() => body.getBone( 'TireBR')),
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
  read() {
    this.position.copy(car.position)
    this.quaternion.copy(car.quaternion)
    this.health = health
    this.isDamaged = isDamaged
    this.exhaustEmitting = exhaustParticles.emitting

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
    if (!data || !Array.isArray(data) || data.length < 7) {
      return this
    }

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
    ] = data

    this.position.set(px || 0, py || 0, pz || 0)
    this.quaternion.set(qx || 0, qy || 0, qz || 0, qw !== undefined ? qw : 1)
    this.health = h !== undefined ? h : 100
    this.isDamaged = dmg || false
    this.exhaustEmitting = exh || false

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
  serialize() {
    return [
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
  },
}

// Mobile controls for driver and passenger seats
let driverPassengerMobileControls = null
let driverPassengerExitButton = null

function setupTouchControls() {
  isMobile =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      : false
  if (!control) return

  safeExecute(() => {
    removeDriverPassengerMobileControls()

    driverPassengerMobileControls = []

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

// Damage system
function takeDamage(amount) {
  if (health <= 0) return

  health = Math.max(0, health - amount)
  isDamaged = health < maxHealth * 0.7

  if (audioSources.crash.src) {
    audioSources.crash.play()
  }

  if (health <= 0) {
    setMode(disabledMode)

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
    for (const wheel of wheels) {
      if (wheel.skid) wheel.skid.emitting = false
      if (wheel.smoke) wheel.smoke.emitting = false
    }
    exhaustParticles.emitting = false
  } else if (distanceToPlayer > LOD_DISTANCES.MEDIUM) {
    for (const wheel of wheels) {
      if (wheel.skid) wheel.skid.rate = 4
      if (wheel.smoke) wheel.smoke.rate = 2
    }
  }
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

    if (wheel.skid?.emitting) {
      wheel.temperature += 50 * delta
    }

    wheel.temperature = Math.max(0, wheel.temperature - 10 * delta)

    const tempFactor = Math.max(0.3, 1 - wheel.temperature / 200)
    wheel.currentGrip = wheel.baseGrip * tempFactor
  }
}

// Enhanced lighting system
function updateLights() {
  safeExecute(() => {
    const isBraking = accelInput < 0 || handbrakeInput || brakeInput

    for (const light of lights.brakelights) {
      if (light && light.intensity !== undefined) {
        light.intensity = isBraking ? 1 : 0.3
      } else if (light && light.material && light.material.emissive) {
        light.material.emissive.setScalar(isBraking ? 0.8 : 0.2)
      }
    }

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
          control.camera.position.y += seat1YOffset
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

// Network rate adaptation
function updateNetworkRate() {
  const velocity = car.getLinearVelocity ? car.getLinearVelocity(v1).length() : 0
  adaptiveSendRate = velocity > 5 ? BASE_SEND_RATE : SLOW_SEND_RATE
}

// Differential system for better turning
function applyDifferential(leftWheel, rightWheel, torque) {
  if (!leftWheel.hub || !rightWheel.hub) return torque

  const speedDiff = Math.abs(leftWheel.speed - rightWheel.speed)
  const diffRatio = 1.0 - speedDiff * 0.1

  const leftTorque = torque * diffRatio
  const rightTorque = torque * diffRatio

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
  state.info = info.read().serialize()
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
    info.deserialize(data)
    app.send('info', data, playerId)
  })

  app.on('damage', (amount, playerId) => {
    if (state.authority === playerId) {
      takeDamage(amount)
    }
  })

  app.on('camera-mode', (mode, playerId) => {
    app.send('camera-mode', mode, playerId)
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
        player.cancelEffect()
        control?.release()
        control = null
        accelInput = 0
        steerInput = 0
        isSeated = false

        safeExecute(() => {
          if (dashboard) {
            app.remove(dashboard)
            dashboard = null
            speedometer = null
          }
          removeDriverPassengerMobileControls()

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
        player.applyEffect({
          anchor: seat.anchor,
          emote: sitEmote,
        })

        control = app.control()
        control.hideReticle()
        control.camera.write = true
        isSeated = true

        setupTouchControls()

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
      mode?.update(delta)

      if (isSeated && control?.keyQ?.pressed) {
        app.send('unmount')
      }

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

      updateAudio(delta)
      updateLights()
      updateCamera(delta)

      if (player) {
        const distanceToPlayer = car.position.distanceTo(player.position)
        updateLOD(distanceToPlayer)
      }
    })

    setMode(viewerMode)
  }
}

// Enhanced viewer mode
function viewerMode() {
  car.type = 'kinematic'

  app.on('info', data => {
    info.deserialize(data)
    info.write()
  })

  return {
    fixedUpdate(delta) {
    },
    update(delta) {
      car.position.lerp(info.position, 8 * delta)
      car.quaternion.slerp(info.quaternion, 8 * delta)

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

      health = info.health
      isDamaged = info.isDamaged
      exhaustParticles.emitting = info.exhaustEmitting
    },
    cancel() {
    },
  }
}

// Disabled mode for damaged vehicles
function disabledMode() {
  car.type = 'kinematic'

  return {
    fixedUpdate(delta) {
    },
    update(delta) {
      if (isDamaged) {
        exhaustParticles.emitting = true
        exhaustParticles.rate = 5
      }

      accelInput = 0
      steerInput = 0
      handbrakeInput = false
      brakeInput = false
    },
    cancel() {
    },
  }
}

// Enhanced simulate mode
function simulateMode() {
  car.type = 'dynamic'

  return {
    fixedUpdate(delta) {
      if (health <= 0) return

      grounded = false

      const velocity = v2
      car.getLinearVelocity(velocity)
      const forward = v1.copy(FORWARD).applyQuaternion(car.quaternion)
      const magnitude = velocity.length()
      const mSpeed = v3.copy(forward).dot(velocity)
      speed = mSpeed * 3.6
      isMovingForward = velocity.dot(forward) > 0
      speedRatio = speed / maxSpeed
      speedRatioAbs = clamp(Math.abs(speed) / maxSpeed, 0, 1)

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

        if (hit) {
          wheel.hub.position.copy(wheel.spring.position)
          wheel.hub.position.y -= hit.distance - wheel.radius
        } else {
          wheel.hub.position.copy(wheel.spring.position)
          wheel.hub.position.y = wheel.radius - wheel.springTravel
        }
      }

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

      if (speedRatioAbs < 1) {
        const leftWheels = wheels.filter(w => w.left && w.powered && w.grounded)
        const rightWheels = wheels.filter(w => w.right && w.powered && w.grounded)

        for (let i = 0; i < Math.min(leftWheels.length, rightWheels.length); i++) {
          const leftWheel = leftWheels[i]
          const rightWheel = rightWheels[i]

          if (handbrakeInput && leftWheel.rear) continue

          const torques = applyDifferential(leftWheel, rightWheel, accelForce)

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

        if (wheel.skid) {
          const sliding = gripFactor < 0.3 && Math.abs(speed) > 5
          wheel.skid.emitting = sliding
          wheel.smoke.emitting = sliding
        }
      }

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

      // Update particle positions to ensure correct alignment
      for (const wheel of wheels) {
        if (wheel.rear && wheel.particles) {
          wheel.particles.position.copy(wheel.hub.position)
        }
      }

      updateTireTemperature(delta)

      exhaustParticles.emitting = power > 0.3
      exhaustParticles.rate = power * 15

      updateNetworkRate()
    },
    update(delta) {
      if (health <= 0) return

      if (control) {
        steerInput = 0
        if (control.keyA?.down) steerInput += 1
        if (control.keyD?.down) steerInput -= 1

        accelInput = 0
        if (control.keyW?.down) accelInput += 1
        if (control.keyS?.down) accelInput -= 1

        handbrakeInput = control.space?.down
        brakeInput = control.keyS?.down && accelInput < 0
      }

      lastSend += delta
      if (lastSend > adaptiveSendRate) {
        lastSend = 0
        app.send('info', info.read().serialize())
      }
    },
    cancel() {
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
