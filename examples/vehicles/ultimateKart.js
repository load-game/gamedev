// ULTIMATE Simple Go Kart
// Features: Intuitive controls, hop/drift mechanics, multi-platform support
// Philosophy: Maximum fun with minimum complexity

app.configure([
  // Core vehicle parameters
  {
    key: 'accel',
    type: 'number',
    label: 'Acceleration',
    initial: 12,
    min: 0,
    hint: 'Acceleration force (higher = faster acceleration)',
  },
  {
    key: 'decel',
    type: 'number',
    label: 'Deceleration',
    initial: 8,
    min: 0,
    hint: 'Braking force',
  },
  {
    key: 'maxSpeed',
    type: 'number',
    label: 'Max Speed',
    initial: 160,
    min: 1,
    hint: 'Maximum speed in km/h',
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
    initial: 'fwd',
    hint: 'Which wheels provide power',
  },
  // Steering modes
  {
    key: 'steeringMode',
    type: 'switch',
    label: 'Steering Mode',
    options: [
      { label: 'Mouse (Recommended)', value: 'mouse' },
      { label: 'Keyboard (A/D)', value: 'keyboard' },
      { label: 'Auto (Mobile)', value: 'auto' },
    ],
    initial: 'mouse',
    hint: 'How to steer the kart',
  },
  // Hop/Drift settings
  {
    key: 'hopForce',
    type: 'number',
    label: 'Hop Force',
    initial: 45,
    min: 10,
    hint: 'Upward force when hopping (Space/Mobile button)',
  },
  {
    key: 'driftDuration',
    type: 'number',
    label: 'Drift Duration',
    initial: 1.2,
    min: 0.5,
    hint: 'How long drift mode lasts after hop (seconds)',
  },
  {
    key: 'driftGrip',
    type: 'number',
    label: 'Drift Grip Multiplier',
    initial: 0.4,
    min: 0.1,
    max: 1.0,
    hint: 'Grip during drift (0.4 = 40% of normal grip)',
  },
  // Suspension
  {
    key: 'springStrength',
    type: 'number',
    label: 'Spring Strength',
    initial: 12,
    min: 1,
    hint: 'Suspension stiffness',
  },
  {
    key: 'springDamper',
    type: 'number',
    label: 'Spring Damper',
    initial: 2.5,
    min: 1,
    hint: 'Suspension damping',
  },
  // Assets
  {
    key: 'sit',
    type: 'file',
    kind: 'emote',
    label: 'Sit Emote',
    hint: 'Emote when entering vehicle',
  },
  // Effects toggles
  {
    key: 'enableSound',
    type: 'toggle',
    label: 'Enable Sound',
    initial: true,
    hint: 'Engine and driving sounds',
  },
  {
    key: 'enableParticles',
    type: 'toggle',
    label: 'Enable Particles',
    initial: true,
    hint: 'Skid marks, smoke, exhaust',
  },
  // Audio files
  {
    key: 'engineIdle',
    type: 'file',
    kind: 'audio',
    label: 'Engine Idle',
    hint: 'Low RPM engine sound',
  },
  {
    key: 'engineRev',
    type: 'file',
    kind: 'audio',
    label: 'Engine Rev',
    hint: 'High RPM engine sound',
  },
  {
    key: 'engineStart',
    type: 'file',
    kind: 'audio',
    label: 'Engine Start',
    hint: 'Start-up sound',
  },
  {
    key: 'brakeSound',
    type: 'file',
    kind: 'audio',
    label: 'Brake Sound',
    hint: 'Braking sound',
  },
  {
    key: 'skidSound',
    type: 'file',
    kind: 'audio',
    label: 'Skid Sound',
    hint: 'Tire sliding sound',
  },
  // Particle textures
  {
    key: 'treadmark',
    type: 'file',
    kind: 'texture',
    label: 'Skid Texture',
    hint: 'Skid mark texture',
  },
  {
    key: 'smoke',
    type: 'file',
    kind: 'texture',
    label: 'Smoke Texture',
    hint: 'Smoke particle texture',
  },
  {
    key: 'exhaust',
    type: 'file',
    kind: 'texture',
    label: 'Exhaust Texture',
    hint: 'Exhaust particle texture',
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
const m1 = new Matrix4()

const UP = new Vector3(0, 1, 0)
const DOWN = new Vector3(0, -1, 0)
const FORWARD = new Vector3(0, 0, -1)
const BACK = new Vector3(0, 0, 1)
const LEFT = new Vector3(-1, 0, 0)
const RIGHT = new Vector3(1, 0, 0)

// Networking constants
const BASE_SEND_RATE = 1 / 60
const SLOW_SEND_RATE = 1 / 30
let adaptiveSendRate = BASE_SEND_RATE

const WHEEL_MASS = 0.05

// Utility functions
function safeExecute(fn, fallback = () => {}) {
  try {
    return fn()
  } catch (error) {
    return fallback()
  }
}

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

// Default curves - optimized for kart handling
const defaultPowerCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.6, inTangent: 0, outTangent: 0 },
]
const defaultTurnCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.4, inTangent: 0, outTangent: 0 },
]
const defaultGripCurve = [
  { time: 0, value: 1, inTangent: 0, outTangent: 0 },
  { time: 1, value: 0.6, inTangent: 0, outTangent: 0 }, // 60% grip at max speed (good balance)
]

// Configuration values
const accel = props.accel || 12
const decel = props.decel || 8
const maxSpeed = props.maxSpeed || 160
const driveTrain = props.driveTrain || 'fwd'
const steeringMode = props.steeringMode || 'mouse'
const hopForce = props.hopForce || 45
const driftDuration = props.driftDuration || 1.2
const driftGripMultiplier = props.driftGrip || 0.4
const springStrength = props.springStrength || 12
const springDamper = props.springDamper || 2.5
const sitEmote = props.sit?.url
const enableSound = props.enableSound !== false
const enableParticles = props.enableParticles !== false

const powerCurve = createCurve(props.power, defaultPowerCurve)
const turnCurve = createCurve(props.turn, defaultTurnCurve)
const frontGripCurve = createCurve(props.frontGrip, defaultGripCurve)
const rearGripCurve = createCurve(props.rearGrip, defaultGripCurve)

const treadmarkUrl = props.treadmark?.url
const smokeUrl = props.smoke?.url
const exhaustUrl = props.exhaust?.url

// Get nodes with error handling
const car = safeExecute(() => app.get('Car'))
const body = safeExecute(() => app.get('Body'))
const cOM = safeExecute(() => app.get('CenterOfMass'))
const seatNode = safeExecute(() => app.get('Seat1'))

// Car setup
car.mass = 1
if (cOM) car.setCenterOfMass(cOM.position)
car.angularDamping = 2

app.traverse(node => {
  if (node.name === 'collider') {
    node.layer = 'prop'
  }
})
world.attach(car)

// Audio system
const audioSources = enableSound
  ? {
      start: app.create('audio', {
        src: props.engineStart?.url,
        group: 'sfx',
        loop: false,
        volume: 0.8,
        spatial: true,
      }),
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
    }
  : null

if (enableSound && audioSources) {
  for (const audio of Object.values(audioSources)) {
    if (audio && audio.src) {
      car.add(audio)
    }
  }
}

// Wheel system
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
    turns: true,
    gripCurve: frontGripCurve,
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
    turns: true,
    gripCurve: frontGripCurve,
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
    turns: false,
    gripCurve: rearGripCurve,
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
    turns: false,
    gripCurve: rearGripCurve,
    speed: 0,
  },
]

// Wheel setup
for (const wheel of wheels) {
  if (!wheel.spring || !wheel.hub || !wheel.tire) continue

  wheel.springRestLength = wheel.spring.position.y - wheel.hub.position.y
  wheel.springTravel = wheel.springRestLength * 0.4
  wheel.springMaxLength = wheel.springRestLength + wheel.springTravel
  wheel.radius = wheel.hub.position.y
  wheel.baseGrip = 1.0
  wheel.currentGrip = 1.0

  // Add particles to rear wheels
  if (enableParticles && wheel.rear) {
    const particles = app.create('group')
    particles.position.copy(wheel.hub.position)
    wheel.particles = particles

    // Skid marks
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

    // Smoke
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

// Exhaust particles
const exhaustParticles = enableParticles
  ? app.create('particles', {
      emitting: false,
      shape: ['cone', 0.1, 0.3, 10],
      rate: 0,
      life: '1~3',
      size: '0.5~1.5',
      speed: '2~4',
      rotate: '0~360',
      color: 'rgb(100,100,100)',
      alpha: '0.3~0.6',
      alphaOverLife: '0,0.8|1,0',
      sizeOverLife: '0,0.5|1,2',
      image: exhaustUrl,
    })
  : null

if (exhaustParticles) {
  exhaustParticles.position.set(0, 0.5, 2)
  car.add(exhaustParticles)
}

// Vehicle state
const steerAngleMax = 35 // Reduced from 40 for better control
const steerSpeed = 4
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

// Input system
let accelInput = 0
let steerInput = 0
let hopInput = false

// Hop/Drift state
let isHopping = false
let isDrifting = false
let driftTime = 0
let currentGripMultiplier = 1.0

// Camera system
let zoom = 6

// Vehicle state
let isSeated = false
let lastSend = 0
let isEngineRunning = false
let engineStartupTime = 0
let engineStartupPending = false

let state = app.state
let control
const player = world.getPlayer()

// UI elements
let speedometerUI = null
let speedometerText = null
let minimapUI = null
let minimapDot = null
let minimapTrail = []
let minimapGrid = []
let lastDotPosition = null
const TRAIL_DISTANCE_THRESHOLD = 5
const WORLD_SIZE = 2000
const MINIMAP_SIZE = 200
const GRID_SPACING = 100

// Mobile controls
let mobileControls = null
let isMobile = false
let touchPan = null
let isGasPressed = false
let isHopButtonPressed = false
const PAN_LOOK_SPEED = 0.4

// Mode system
let mode
function setMode(fn, ...args) {
  if (mode) mode.cancel()
  mode = fn ? fn(...args) : null
}

// Network state serialization
const info = {
  position: new Vector3(),
  quaternion: new Quaternion(),
  wheels: [
    { offset: 0, turn: 0, rotate: 0 },
    { offset: 0, turn: 0, rotate: 0 },
    { offset: 0, turn: 0, rotate: 0 },
    { offset: 0, turn: 0, rotate: 0 },
  ],
  read() {
    this.position.copy(car.position)
    this.quaternion.copy(car.quaternion)

    for (let i = 0; i < 4; i++) {
      if (!wheels[i].hub || !wheels[i].tire) continue
      this.wheels[i].offset = wheels[i].hub.position.y
      this.wheels[i].turn = wheels[i].hub.rotation.y
      this.wheels[i].rotate = wheels[i].tire.rotation.x
    }
    return this
  },
  write() {
    car.position.copy(this.position)
    car.quaternion.copy(this.quaternion)

    for (let i = 0; i < 4; i++) {
      if (!wheels[i].hub || !wheels[i].tire) continue
      wheels[i].hub.position.y = this.wheels[i].offset
      wheels[i].hub.rotation.y = this.wheels[i].turn
      wheels[i].tire.rotation.x = this.wheels[i].rotate
    }
    return this
  },
  deserialize(data) {
    if (!data || !Array.isArray(data) || data.length < 7) {
      return this
    }

    const [px, py, pz, qx, qy, qz, qw, w0o, w0t, w0r, w1o, w1t, w1r, w2o, w2t, w2r, w3o, w3t, w3r] = data

    this.position.set(px || 0, py || 0, pz || 0)
    this.quaternion.set(qx || 0, qy || 0, qz || 0, qw !== undefined ? qw : 1)

    if (this.wheels && this.wheels.length > 0 && w0o !== undefined) {
      this.wheels[0].offset = w0o
      this.wheels[0].turn = w0t
      this.wheels[0].rotate = w0r
    }

    if (this.wheels && this.wheels.length > 1 && w1o !== undefined) {
      this.wheels[1].offset = w1o
      this.wheels[1].turn = w1t
      this.wheels[1].rotate = w1r
    }

    if (this.wheels && this.wheels.length > 2 && w2o !== undefined) {
      this.wheels[2].offset = w2o
      this.wheels[2].turn = w2t
      this.wheels[2].rotate = w2r
    }

    if (this.wheels && this.wheels.length > 3 && w3o !== undefined) {
      this.wheels[3].offset = w3o
      this.wheels[3].turn = w3t
      this.wheels[3].rotate = w3r
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
      wheels[0]?.hub?.position.y || 0,
      wheels[0]?.hub?.rotation.y || 0,
      wheels[0]?.tire?.rotation.x || 0,
      wheels[1]?.hub?.position.y || 0,
      wheels[1]?.hub?.rotation.y || 0,
      wheels[1]?.tire?.rotation.x || 0,
      wheels[2]?.hub?.position.y || 0,
      wheels[2]?.hub?.rotation.y || 0,
      wheels[2]?.tire?.rotation.x || 0,
      wheels[3]?.hub?.position.y || 0,
      wheels[3]?.hub?.rotation.y || 0,
      wheels[3]?.tire?.rotation.x || 0,
    ]
  },
}

// Engine control functions
function startEngine() {
  if (!enableSound || !audioSources || isEngineRunning) return

  isEngineRunning = true
  engineStartupTime = 0
  engineStartupPending = true

  if (audioSources.start?.src) {
    audioSources.start.play()
  } else {
    engineStartupPending = false
    if (audioSources.idle?.src) audioSources.idle.play()
    if (audioSources.revving?.src) audioSources.revving.play()
  }
}

function stopEngine() {
  if (!enableSound || !audioSources || !isEngineRunning) return

  isEngineRunning = false

  for (const audio of Object.values(audioSources)) {
    safeExecute(() => {
      if (audio && audio.stop && audio.parent) {
        audio.stop()
      }
    })
  }
}

// Audio update function
function updateAudio(delta) {
  if (!enableSound || !audioSources || !isEngineRunning) return

  if (engineStartupPending) {
    engineStartupTime += delta

    if (!audioSources.start?.playing || engineStartupTime > 3) {
      engineStartupPending = false
      if (audioSources.idle?.src) audioSources.idle.play()
      if (audioSources.revving?.src) audioSources.revving.play()
    }
  }

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

    if (accelInput < 0 && audioSources.braking && audioSources.braking.src && !audioSources.braking.playing) {
      audioSources.braking.play()
    }
  })
}

// Calculate steering input based on selected mode
function calculateSteeringInput() {
  if (!control) return 0

  // Auto mode: use joystick on mobile, keyboard on desktop
  if (steeringMode === 'auto') {
    const stickX = control.touchStick?.value.x || 0
    const isJoystickActive = Math.abs(stickX) > 0.01

    if (isJoystickActive) {
      return -stickX // Joystick steering
    } else {
      // Keyboard fallback
      let keyboardSteer = 0
      if (control.keyA?.down) keyboardSteer += 1
      if (control.keyD?.down) keyboardSteer -= 1
      return keyboardSteer
    }
  }

  // Mouse mode: camera-based steering
  if (steeringMode === 'mouse') {
    return calculateSteeringFromCamera()
  }

  // Keyboard mode: traditional A/D
  if (steeringMode === 'keyboard') {
    let keyboardSteer = 0
    if (control.keyA?.down) keyboardSteer += 1
    if (control.keyD?.down) keyboardSteer -= 1
    return keyboardSteer
  }

  return 0
}

// Mouse-based steering calculation
function calculateSteeringFromCamera() {
  if (!control || !control.camera || !control.camera.quaternion) {
    return 0
  }

  // Get camera forward direction
  const cameraForward = new Vector3(0, 0, -1).applyQuaternion(control.camera.quaternion)
  cameraForward.y = 0
  const cameraLength = cameraForward.length()
  if (cameraLength < 0.001) return 0
  cameraForward.normalize()

  // Get kart forward direction
  const kartForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion)
  kartForward.y = 0
  kartForward.normalize()

  // Calculate angle between kart forward and camera forward
  const angle = Math.atan2(
    cameraForward.x * kartForward.z - cameraForward.z * kartForward.x,
    cameraForward.x * kartForward.x + cameraForward.z * kartForward.z
  )

  // Convert angle to steerInput (-1 to 1) with speed-based limiting
  const maxAngle = steerAngleMax * DEG2RAD
  let steerValue = clamp(angle / maxAngle, -1, 1)

  // Apply speed-based steering reduction (more stable at high speed)
  const speedSteeringLimit = 1.0 - speedRatioAbs * 0.5
  steerValue *= speedSteeringLimit

  return steerValue
}

// Camera update function
function updateCamera(delta) {
  if (!control || !control.camera) return

  safeExecute(() => {
    control.camera.position.copy(car.position)
    control.camera.position.y += cameraYOffset

    // Mouse pointer control for camera rotation
    if (control.pointer && control.pointer.delta) {
      control.camera.rotation.reorder('YXZ')
      control.camera.rotation.y -= control.pointer.delta.x * 0.1 * delta
      control.camera.rotation.x -= control.pointer.delta.y * 0.1 * delta
      control.camera.rotation.x = clamp(control.camera.rotation.x, -Math.PI / 2, Math.PI / 2)
    } else if (!control.mouseLeft || !control.mouseLeft?.down) {
      // Smooth follow when no mouse input
      const targetY = e1.setFromQuaternion(car.quaternion).y
      e2.setFromQuaternion(control.camera.quaternion)
      e2.y = targetY
      q1.setFromEuler(e2)
      control.camera.quaternion.slerp(q1, 4 * delta)
    }

    // Zoom control
    if (control.scrollDelta && control.scrollDelta.value !== undefined) {
      zoom += -control.scrollDelta.value * 0.01
      zoom = clamp(zoom, 3, 15)
      control.camera.zoom = lerp(control.camera.zoom, zoom, zoomSpeed * delta)
    }
  })
}

// Mobile controls setup
function setupMobileControls() {
  isMobile =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      : false

  if (!control || !isMobile) return

  safeExecute(() => {
    removeMobileControls()

    mobileControls = []

    // Exit button
    const exitButton = app.create('ui', {
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
        exitButton.backgroundColor = 'rgba(200, 50, 50, 0.5)'
      },
      onPointerUp: () => {
        exitButton.backgroundColor = 'rgba(200, 50, 50, 0.3)'
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
    exitButton.add(exitLabel)
    app.add(exitButton)
    mobileControls.push(exitButton)

    // Gas button
    const gasButton = app.create('ui', {
      space: 'screen',
      width: 75,
      height: 75,
      backgroundColor: 'rgba(50, 200, 50, 0.3)',
      borderRadius: 20,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-140, -100],
      cursor: 'pointer',
      onPointerDown: () => {
        gasButton.backgroundColor = 'rgba(50, 200, 50, 0.5)'
        isGasPressed = true
      },
      onPointerUp: () => {
        gasButton.backgroundColor = 'rgba(50, 200, 50, 0.3)'
        isGasPressed = false
      },
      alignItems: 'center',
      justifyContent: 'center',
    })
    const gasLabel = app.create('uitext', {
      value: 'GAS',
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
    })
    gasButton.add(gasLabel)
    app.add(gasButton)
    mobileControls.push(gasButton)

    // Hop button
    const hopButton = app.create('ui', {
      space: 'screen',
      width: 40,
      height: 40,
      backgroundColor: 'rgba(150, 100, 200, 0.3)',
      borderRadius: 20,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-145, -210],
      cursor: 'pointer',
      onPointerDown: () => {
        hopButton.backgroundColor = 'rgba(150, 100, 200, 0.5)'
        isHopButtonPressed = true
      },
      onPointerUp: () => {
        hopButton.backgroundColor = 'rgba(150, 100, 200, 0.3)'
        isHopButtonPressed = false
      },
      alignItems: 'center',
      justifyContent: 'center',
    })
    const hopLabel = app.create('uitext', {
      value: 'HOP',
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
    })
    hopButton.add(hopLabel)
    app.add(hopButton)
    mobileControls.push(hopButton)

    // Touch panning for camera
    touchPan = null
    if (control.on) {
      control.on('touchstart', touch => {
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000
        if (!touch.consumed && touch.position.x > screenWidth / 2) {
          touchPan = touch
          return true
        }
        return touch.consumed
      })

      control.on('touchend', touch => {
        if (touchPan === touch) {
          touchPan = null
        }
      })
    }
  })
}

function removeMobileControls() {
  if (mobileControls && Array.isArray(mobileControls)) {
    safeExecute(() => {
      for (const button of mobileControls) {
        if (button) {
          app.remove(button)
        }
      }
      mobileControls = null
    })
  }
}

// Network rate adaptation
function updateNetworkRate() {
  const velocity = car.getLinearVelocity ? car.getLinearVelocity(v1).length() : 0
  adaptiveSendRate = velocity > 5 ? BASE_SEND_RATE : SLOW_SEND_RATE
}

// Server-side logic
if (world.isServer) {
  state.authority = null
  state.sitting = null
  state.info = info.read().serialize()
  state.ready = true

  app.on('mount', (seatIdx, playerId) => {
    if (state.sitting) return
    state.sitting = playerId
    app.send('authority', playerId)
    app.send('seat', playerId)
  })

  app.on('unmount', (_, playerId) => {
    if (state.sitting !== playerId) return
    state.sitting = null
    app.send('seat', null)
  })

  world.on('leave', ({ playerId }) => {
    if (state.sitting !== playerId) return
    state.sitting = null
    app.send('seat', null)
    app.send('authority', null)
    setMode(simulateMode)
  })

  app.on('info', (data, playerId) => {
    info.deserialize(data)
    app.send('info', data, playerId)
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

    // Create speedometer UI
    speedometerUI = app.create('ui', {
      space: 'screen',
      width: 200,
      height: 60,
      position: [0.95, 0.05, 0],
      pivot: 'top-right',
      backgroundColor: 'rgba(50, 150, 200, 0.9)',
      borderWidth: 2,
      borderColor: '#00aaff',
      borderRadius: 10,
      padding: 10,
      pointerEvents: false,
      alignItems: 'center',
      justifyContent: 'center',
      active: false,
    })

    speedometerText = app.create('uitext', {
      value: '0 KM/H',
      fontSize: 28,
      color: '#ffffff',
      textAlign: 'center',
      fontWeight: 'bold',
      width: 180,
      height: 40,
    })

    speedometerUI.add(speedometerText)
    app.add(speedometerUI)

    // Create minimap UI
    minimapUI = app.create('ui', {
      space: 'screen',
      width: MINIMAP_SIZE,
      height: MINIMAP_SIZE,
      position: [0.95, 0.11, 0],
      pivot: 'top-right',
      backgroundColor: 'rgba(30, 30, 30, 0.6)',
      borderWidth: 2,
      borderColor: '#00aaff',
      borderRadius: 10,
      padding: 5,
      pointerEvents: false,
      active: false,
    })

    minimapDot = app.create('ui', {
      space: 'screen',
      width: 10,
      height: 10,
      position: [0.95, 0.11, 0],
      pivot: 'top-right',
      offset: [0, 0, 0],
      backgroundColor: '#00ffff',
      borderRadius: 5,
      pointerEvents: false,
      active: false,
    })

    // Create grid lines
    const mapAreaSize = MINIMAP_SIZE - 10
    const padding = 5
    const numGridLines = Math.floor(WORLD_SIZE / GRID_SPACING) + 1

    // Vertical grid lines
    for (let i = 0; i < numGridLines; i++) {
      const worldPos = i * GRID_SPACING
      const normalizedPos = worldPos / WORLD_SIZE
      const pixelPos = normalizedPos * mapAreaSize

      const gridLine = app.create('ui', {
        space: 'screen',
        width: 1,
        height: mapAreaSize,
        position: [0.95, 0.11, 0],
        pivot: 'top-right',
        offset: [-(mapAreaSize - pixelPos + padding), padding, 0],
        backgroundColor: 'rgba(0, 170, 255, 0.3)',
        pointerEvents: false,
        active: false,
      })
      minimapGrid.push(gridLine)
      app.add(gridLine)
    }

    // Horizontal grid lines
    for (let i = 0; i < numGridLines; i++) {
      const worldPos = i * GRID_SPACING
      const normalizedPos = worldPos / WORLD_SIZE
      const pixelPos = normalizedPos * mapAreaSize

      const gridLine = app.create('ui', {
        space: 'screen',
        width: mapAreaSize,
        height: 1,
        position: [0.95, 0.11, 0],
        pivot: 'top-right',
        offset: [-padding, pixelPos + padding, 0],
        backgroundColor: 'rgba(0, 170, 255, 0.3)',
        pointerEvents: false,
        active: false,
      })
      minimapGrid.push(gridLine)
      app.add(gridLine)
    }

    app.add(minimapUI)
    app.add(minimapDot)

    if (!seatNode) return

    const action = app.create('action', {
      label: 'Enter',
      distance: 3,
      onTrigger: () => {
        app.send('mount', 0)
        action.active = false
      },
    })
    action.position.y += 0.5
    action.active = !state.sitting
    seatNode.add(action)

    const anchorId = `seat-0-${app.instanceId}`
    const anchor = app.create('anchor', { id: anchorId })
    seatNode.add(anchor)

    app.on('seat', playerId => {
      if (state.sitting === player.id) {
        player.cancelEffect()
        control?.release()
        stopEngine()
        control = null
        accelInput = 0
        steerInput = 0
        isSeated = false
        action.active = !playerId

        // Hide UI
        if (speedometerUI) speedometerUI.active = false
        if (minimapUI) minimapUI.active = false
        if (minimapDot) minimapDot.active = false
        minimapGrid.forEach(gridLine => {
          if (gridLine) gridLine.active = false
        })
      }

      state.sitting = playerId
      action.active = !playerId && !isSeated

      if (playerId === player.id) {
        player.applyEffect({
          anchor: anchor,
          emote: sitEmote,
        })

        startEngine()

        control = app.control()
        control.hideReticle()
        control.camera.write = true
        isSeated = true
        action.active = false

        setupMobileControls()

        // Show UI when gaining authority
        if (speedometerUI && state.authority === player.id) {
          speedometerUI.active = true
        }
        if (minimapUI && state.authority === player.id) {
          minimapUI.active = true
        }
        if (minimapDot && state.authority === player.id) {
          minimapDot.active = true
        }
        minimapGrid.forEach(gridLine => {
          if (gridLine && state.authority === player.id) gridLine.active = true
        })
      }
    })

    app.on('authority', playerId => {
      if (state.authority === player.id) {
        setMode(viewerMode)
        // Hide UI when losing authority
        if (speedometerUI) speedometerUI.active = false
        if (minimapUI) minimapUI.active = false
        if (minimapDot) minimapDot.active = false
        minimapGrid.forEach(gridLine => {
          if (gridLine) gridLine.active = false
        })
      }
      state.authority = playerId
      if (playerId === player.id) {
        setMode(simulateMode)
        // Show UI when gaining authority
        if (speedometerUI && isSeated) {
          speedometerUI.active = true
        }
        if (minimapUI && isSeated) {
          minimapUI.active = true
        }
        if (minimapDot && isSeated) {
          minimapDot.active = true
        }
        if (isSeated) {
          minimapGrid.forEach(gridLine => {
            if (gridLine) gridLine.active = true
          })
        }
      }
    })

    app.on('fixedUpdate', delta => {
      mode?.fixedUpdate(delta)
    })

    app.on('update', delta => {
      mode?.update(delta)

      if (isSeated && control?.keyQ?.pressed) {
        app.send('unmount')
      }

      updateAudio(delta)
      updateCamera(delta)

      // Update minimap
      if (minimapDot && minimapUI && minimapUI.active) {
        const player = world.getPlayer()
        if (!player) return

        const playerPos = player.position
        const normalizedX = (playerPos.x + WORLD_SIZE / 2) / WORLD_SIZE
        const normalizedZ = (playerPos.z + WORLD_SIZE / 2) / WORLD_SIZE

        const mapX = Math.max(0, Math.min(1, normalizedX))
        const mapZ = Math.max(0, Math.min(1, normalizedZ))

        const mapAreaSize = MINIMAP_SIZE - 10
        const padding = 5

        const dotXInMap = mapX * mapAreaSize
        const dotYInMap = mapZ * mapAreaSize

        const offsetX = -(mapAreaSize - dotXInMap + padding)
        const offsetY = dotYInMap + padding

        const currentPos = { x: offsetX, y: offsetY }

        if (!lastDotPosition) {
          lastDotPosition = currentPos
          minimapDot.offset = new Vector3(offsetX, offsetY, 0)
          return
        }

        const distance = Math.sqrt(
          Math.pow(currentPos.x - lastDotPosition.x, 2) + Math.pow(currentPos.y - lastDotPosition.y, 2)
        )

        if (distance > TRAIL_DISTANCE_THRESHOLD) {
          const trailDot = app.create('ui', {
            space: 'screen',
            width: 10,
            height: 10,
            position: [0.95, 0.11, 0],
            pivot: 'top-right',
            offset: new Vector3(lastDotPosition.x, lastDotPosition.y, 0),
            backgroundColor: '#00ffff',
            borderRadius: 5,
            pointerEvents: false,
            active: minimapUI.active,
          })

          minimapTrail.push(trailDot)
          app.add(trailDot)
        }

        lastDotPosition = currentPos
        minimapDot.offset = new Vector3(offsetX, offsetY, 0)
      }
    })

    setMode(viewerMode)
  }
}

// Viewer mode
function viewerMode() {
  car.type = 'kinematic'

  app.on('info', data => {
    info.deserialize(data)
    info.write()
  })

  return {
    fixedUpdate(delta) {},
    update(delta) {
      car.position.lerp(info.position, 8 * delta)
      car.quaternion.slerp(info.quaternion, 8 * delta)

      for (let i = 0; i < wheels.length; i++) {
        const wheel = wheels[i]
        if (!wheel.hub || !wheel.tire) continue

        wheel.hub.position.y = lerp(wheel.hub.position.y, info.wheels[i].offset, 12 * delta)
        wheel.hub.rotation.y = lerp(wheel.hub.rotation.y, info.wheels[i].turn, 12 * delta)
        wheel.tire.rotation.x = lerp(wheel.tire.rotation.x, info.wheels[i].rotate, 12 * delta)
      }

      // Update speedometer for viewer mode
      if (speedometerText && speedometerUI && speedometerUI.active) {
        const speedDisplay = Math.round(Math.abs(speed) || 0)
        speedometerText.value = `${speedDisplay} KM/H`
      }
    },
    cancel() {},
  }
}

// Simulate mode
function simulateMode() {
  car.type = 'dynamic'

  return {
    fixedUpdate(delta) {
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

      // Power management
      if (isSlipping && accelInput) {
        power = Math.min(power + 1 * delta, 1.5)
      } else if (isSlipping) {
        power -= 0.8 * delta
      } else {
        power -= 0.4 * delta
      }
      power = clamp(Math.max(power, speedRatio), 0.1, 1)

      // Slip detection
      const roadPower = powerCurve.evaluate(speedRatio)
      if (!isSlipping && power > 0.8 && power > roadPower) {
        isSlipping = true
      } else if (isSlipping && (power < 0.6 || Math.abs(steerInput) < 0.2)) {
        isSlipping = false
      }

      const powerFactor = powerCurve.evaluate(speedRatio)
      const accelForce = (accelInput > 0 ? accel : decel) * accelInput * powerFactor

      // Wheel physics
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

      // Steering
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

      // Acceleration
      if (speedRatioAbs < 1) {
        const leftWheels = wheels.filter(w => w.left && w.powered && w.grounded)
        const rightWheels = wheels.filter(w => w.right && w.powered && w.grounded)

        for (let i = 0; i < Math.min(leftWheels.length, rightWheels.length); i++) {
          const leftWheel = leftWheels[i]
          const rightWheel = rightWheels[i]

          if (leftWheel.spring) {
            const worldMatrix = leftWheel.spring.getWorldMatrix(m1)
            const worldQua = q1.setFromRotationMatrix(worldMatrix)
            const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
            const accelFinalForce = v4.copy(forwardDir).multiplyScalar(accelForce)
            car.addForceAtLocalPos(accelFinalForce, leftWheel.hub.position)
          }

          if (rightWheel.spring) {
            const worldMatrix = rightWheel.spring.getWorldMatrix(m1)
            const worldQua = q1.setFromRotationMatrix(worldMatrix)
            const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
            const accelFinalForce = v4.copy(forwardDir).multiplyScalar(accelForce)
            car.addForceAtLocalPos(accelFinalForce, rightWheel.hub.position)
          }
        }
      }

      // Friction
      const regular = 0.2
      for (const wheel of wheels) {
        if (!wheel.grounded || !wheel.spring) continue
        const worldMatrix = wheel.spring.getWorldMatrix(m1)
        const worldQua = q1.setFromRotationMatrix(worldMatrix)
        const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
        const opposingDir = v4.copy(forwardDir).multiplyScalar(isMovingForward ? -1 : 1)
        const frictionFinalForce = v5.copy(opposingDir).multiplyScalar(regular)
        car.addForceAtLocalPos(frictionFinalForce, wheel.hub.position)
      }

      // Lateral forces and grip
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

        // Apply drift grip multiplier if drifting
        let gripFactor = wheel.gripCurve.evaluate(lateralVelRatio) * wheel.currentGrip
        if (isDrifting) {
          gripFactor *= driftGripMultiplier
        }

        // Minimum grip to prevent total loss of control
        const minGrip = speedRatioAbs > 0.85 ? 0.3 : 0.0
        gripFactor = Math.max(gripFactor, minGrip)

        const desiredVelChange = -steeringVel * gripFactor
        const desiredAccel = desiredVelChange / delta
        const counterForce = v4.copy(steeringDir).multiplyScalar(tireMass * desiredAccel)

        car.addForceAtLocalPos(counterForce, wheel.spring.position)

        // Update particle effects
        if (enableParticles && wheel.rear && wheel.skid && wheel.smoke && wheel.particles) {
          const sliding = gripFactor < 0.3 && Math.abs(speed) > 5
          wheel.skid.emitting = sliding
          wheel.smoke.emitting = sliding
          wheel.particles.position.copy(wheel.hub.position)
        }
      }

      // Wheel rotation
      for (const wheel of wheels) {
        if (!wheel.spring || !wheel.tire) continue

        const worldMatrix = wheel.spring.getWorldMatrix(m1)
        const worldQua = q1.setFromRotationMatrix(worldMatrix)
        const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
        car.getLocalVelocityAtLocalPos(wheel.spring.position, v6)
        const forwardVelocity = forwardDir.dot(v6)
        const angularVelocity = Math.abs(forwardVelocity) / wheel.radius
        const rotationAmount = Math.sign(forwardVelocity) * -1 * angularVelocity * delta
        wheel.tire.rotation.x += rotationAmount
      }

      // Hop/Drift mechanics
      if (isHopping && !grounded) {
        // Still in the air
      } else if (isHopping && grounded) {
        // Just landed - start drifting
        isHopping = false
        isDrifting = true
        driftTime = 0
      }

      if (isDrifting) {
        driftTime += delta
        if (driftTime >= driftDuration) {
          isDrifting = false
          driftTime = 0
          currentGripMultiplier = 1.0

          // Reset grip
          for (const wheel of wheels) {
            wheel.currentGrip = wheel.baseGrip
            if (wheel.skid) wheel.skid.emitting = false
            if (wheel.smoke) wheel.smoke.emitting = false
          }
        } else {
          currentGripMultiplier = driftGripMultiplier
          for (const wheel of wheels) {
            wheel.currentGrip = wheel.baseGrip * currentGripMultiplier
          }
        }
      } else {
        currentGripMultiplier = 1.0
        for (const wheel of wheels) {
          wheel.currentGrip = wheel.baseGrip
        }
      }

      // Hop input
      if (hopInput && !isHopping && grounded) {
        car.addForce(new Vector3(0, hopForce, 0))
        isHopping = true
      }

      // Exhaust particles
      if (enableParticles && exhaustParticles) {
        exhaustParticles.emitting = power > 0.3
        exhaustParticles.rate = power * 15
      }

      updateNetworkRate()
    },
    update(delta) {
      if (control) {
        // Input handling based on steering mode
        if (steeringMode === 'auto') {
          // Auto mode: joystick or keyboard
          const stickX = control.touchStick?.value.x || 0
          const stickZ = control.touchStick?.value.z || 0
          const isJoystickActive = Math.abs(stickX) > 0.01 || Math.abs(stickZ) > 0.01

          hopInput = control.space?.down || isHopButtonPressed

          if (isGasPressed) {
            accelInput = 1
            if (isJoystickActive) {
              steerInput = -stickX
            } else {
              steerInput = 0
              if (control.keyA?.down) steerInput += 1
              if (control.keyD?.down) steerInput -= 1
            }
          } else if (isJoystickActive) {
            steerInput = -stickX
            accelInput = -stickZ
          } else {
            steerInput = 0
            if (control.keyA?.down) steerInput += 1
            if (control.keyD?.down) steerInput -= 1
            accelInput = 0
            if (control.keyW?.down) accelInput += 1
            if (control.keyS?.down) accelInput -= 1
          }
        } else {
          // Specific steering mode
          steerInput = calculateSteeringInput()

          accelInput = 0
          if (control.keyW?.down) accelInput += 1
          if (control.keyS?.down) accelInput -= 1

          hopInput = control.space?.down || isHopButtonPressed
        }

        // Reverse steering when driving backwards
        if (accelInput < 0) {
          steerInput = -steerInput
        }
      }

      // Update speedometer
      if (speedometerText && speedometerUI && speedometerUI.active) {
        const speedDisplay = Math.round(Math.abs(speed))
        speedometerText.value = `${speedDisplay} KM/H`
      }

      lastSend += delta
      if (lastSend > adaptiveSendRate && control && isSeated) {
        lastSend = 0
        app.send('info', info.read().serialize())
      }
    },
    cancel() {},
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
