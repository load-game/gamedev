// Simple Kart Script
// Features: Basic vehicle physics, networking support, simple controls (W/S/A/D)
// Simplified for easy driving with gas, brake, and steering

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
      key: 'maxSpeed',
      type: 'number',
      label: 'Max Speed',
      initial: 180,
      min: 1,
      hint: 'The maximum speed, in kilometers per hour.',
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
    // Effects toggles
    {
      key: 'enableSound',
      type: 'toggle',
      label: 'Enable Sound',
      initial: true,
      hint: 'Enable engine and driving sounds.',
    },
    {
      key: 'enableParticles',
      type: 'toggle',
      label: 'Enable Particles',
      initial: true,
      hint: 'Enable skid marks, smoke, and exhaust particles.',
    },
    // Audio files (only used if enableSound is true)
    {
      key: 'engineIdle',
      type: 'file',
      kind: 'audio',
      label: 'Engine Idle Sound',
      hint: 'Low RPM engine sound (looping).',
    },
    {
      key: 'engineRev',
      type: 'file',
      kind: 'audio',
      label: 'Engine Rev Sound',
      hint: 'High RPM engine sound (looping).',
    },
    {
      key: 'engineStart',
      type: 'file',
      kind: 'audio',
      label: 'Engine Start Sound',
      hint: 'Sound when engine starts (non-looping).',
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
    // Particle textures (only used if enableParticles is true)
    {
      key: 'treadmark',
      type: 'file',
      kind: 'texture',
      label: 'Treadmark Texture',
      hint: 'Texture for skid mark particles.',
    },
    {
      key: 'smoke',
      type: 'file',
      kind: 'texture',
      label: 'Smoke Texture',
      hint: 'Texture for smoke particles.',
    },
    {
      key: 'exhaust',
      type: 'file',
      kind: 'texture',
      label: 'Exhaust Texture',
      hint: 'Texture for exhaust particles.',
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
  
  // Enhanced networking constants
  const BASE_SEND_RATE = 1 / 60
  const SLOW_SEND_RATE = 1 / 30
  let adaptiveSendRate = BASE_SEND_RATE
  
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
  
    if (errors.length > 0) {
      return false
    }
    return true
  }
  
  function safeExecute(fn, fallback = () => { }) {
    try {
      return fn()
    } catch (error) {
      return fallback()
    }
  }
  
  // Validate configuration on startup
  validateConfiguration()
  
  // Get nodes with error handling
  const car = safeExecute(() => app.get('Car'))
  const body = safeExecute(() => app.get('Body'))
  const cOM = safeExecute(() => app.get('CenterOfMass'))
  const seatNode = safeExecute(() => app.get('Seat1'))
  
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
  
  // Configuration values
  const accel = props.accel || 10
  const decel = props.decel || 6
  const maxSpeed = props.maxSpeed || 180
  const driveTrain = props.driveTrain || 'fwd'
  const steering = 'front' // Always use front steering with pointer control
  const powerCurve = createCurve(props.power, defaultPowerCurve)
  const turnCurve = createCurve(props.turn, defaultTurnCurve)
  const frontGripCurve = createCurve(props.frontGrip, defaultGripCurve)
  const rearGripCurve = createCurve(props.rearGrip, defaultGripCurve)
  const springStrength = props.springStrength || 10
  const springDamper = props.springDamper || 2
  const sitEmote = props.sit?.url
  const enableSound = props.enableSound !== false // Default to true
  const enableParticles = props.enableParticles !== false // Default to true
  const treadmarkUrl = props.treadmark?.url
  const smokeUrl = props.smoke?.url
  const exhaustUrl = props.exhaust?.url
  
  // Audio system (only if enabled)
  const audioSources = enableSound ? {
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
    crash: app.create('audio', {
      src: props.crashSound?.url,
      group: 'sfx',
      volume: 0.8,
      spatial: true,
    }),
  } : null
  
  // Add audio sources to car if enabled
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
      hub: safeExecute(() => body.getBone('HubFL')),
      tire: safeExecute(() => body.getBone('TireFL')),
      grounded: false,
      compression: 0,
      powered: driveTrain === 'fwd' || driveTrain === '4wd',
      turns: steering === 'front',
      gripCurve: frontGripCurve,
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
    
    // Add particles to rear wheels if enabled
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
  
  // Exhaust particles (if enabled)
  const exhaustParticles = enableParticles ? app.create('particles', {
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
  }) : null
  
  if (exhaustParticles) {
    exhaustParticles.position.set(0, 0.5, 2)
    car.add(exhaustParticles)
  }
  
  // Vehicle state
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
  
  // Input system
  let accelInput = 0
  let steerInput = 0
  
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
  
  // Speedometer UI
  let speedometerUI = null
  let speedometerText = null
  
  // Minimap UI
  let minimapUI = null
  let minimapDot = null
  let minimapTrail = [] // Array to store trail dots (old positions)
  let minimapGrid = [] // Array to store grid lines
  let lastDotPosition = null // Last position of the main dot
  const TRAIL_DISTANCE_THRESHOLD = 5 // Minimum distance (pixels) before creating new trail dot
  const WORLD_SIZE = 2000 // 2km = 2000m
  const MINIMAP_SIZE = 200 // Same width as speedometer
  const GRID_SPACING = 100 // Grid lines every 100m
  
  // Enhanced mode system
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
  
      const [
        px,
        py,
        pz,
        qx,
        qy,
        qz,
        qw,
        w0o,
        w0t,
        w0r,
        w1o,
        w1t,
        w1r,
        w2o,
        w2t,
        w2r,
        w3o,
        w3t,
        w3r,
      ] = data
  
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
  
    // Handle engine startup sequence
    if (engineStartupPending) {
      engineStartupTime += delta
  
      // Check if start sound finished playing (or timeout after 3 seconds)
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
  
  // Calculate steering input from camera direction
  function calculateSteeringFromCamera() {
    if (!control || !control.camera || !control.camera.quaternion) {
      return 0
    }

    // Get camera forward direction
    const cameraForward = new Vector3(0, 0, -1).applyQuaternion(control.camera.quaternion)
    // Project to horizontal plane (ignore vertical component)
    cameraForward.y = 0
    const cameraLength = cameraForward.length()
    if (cameraLength < 0.001) return 0 // Camera pointing straight up/down
    cameraForward.normalize()

    // Get kart forward direction
    const kartForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion)
    kartForward.y = 0
    kartForward.normalize()

    // Calculate angle between kart forward and camera forward using atan2
    // This gives us the signed angle in radians
    const angle = Math.atan2(
      cameraForward.x * kartForward.z - cameraForward.z * kartForward.x,
      cameraForward.x * kartForward.x + cameraForward.z * kartForward.z
    )

    // Convert angle to steerInput (-1 to 1)
    // Divide by max steer angle to normalize, then clamp
    const maxAngle = steerAngleMax * DEG2RAD
    return clamp(angle / maxAngle, -1, 1)
  }

  // Simple follow camera with mouse pointer control
  function updateCamera(delta) {
    if (!control || !control.camera) return
  
    safeExecute(() => {
      control.camera.position.copy(car.position)
      control.camera.position.y += cameraYOffset
  
      // Allow mouse pointer to control camera rotation for steering
      if (control.pointer && control.pointer.delta) {
        control.camera.rotation.reorder('YXZ')
        control.camera.rotation.y -= control.pointer.delta.x * 0.1 * delta
        control.camera.rotation.x -= control.pointer.delta.y * 0.1 * delta
        // Clamp pitch to prevent camera flipping
        control.camera.rotation.x = clamp(control.camera.rotation.x, -Math.PI / 2, Math.PI / 2)
      } else if (!control.mouseLeft || !control.mouseLeft?.down) {
        // If no mouse input, smoothly follow kart's yaw rotation
        const targetY = e1.setFromQuaternion(car.quaternion).y
        e2.setFromQuaternion(control.camera.quaternion)
        e2.y = targetY
        q1.setFromEuler(e2)
        control.camera.quaternion.slerp(q1, 4 * delta)
      }
  
      if (control.scrollDelta && control.scrollDelta.value !== undefined) {
        zoom += -control.scrollDelta.value * 0.01
        zoom = clamp(zoom, 3, 15)
        control.camera.zoom = lerp(control.camera.zoom, zoom, zoomSpeed * delta)
      }
    })
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
  
      // Create speedometer UI (initially hidden)
      speedometerUI = app.create('ui', {
        space: 'screen',
        width: 200,
        height: 60,
        position: [0.95, 0.05, 0], // top-right of screen
        pivot: 'top-right',
        backgroundColor: 'rgba(255, 192, 203, 0.9)', // pink background
        borderWidth: 2,
        borderColor: '#ff69b4',
        borderRadius: 10,
        padding: 10,
        pointerEvents: false,
        alignItems: 'center',
        justifyContent: 'center',
        active: false // Initially hidden
      })

      speedometerText = app.create('uitext', {
        value: '0 KM/H',
        fontSize: 28,
        color: '#ffffff', // white text
        textAlign: 'center',
        fontWeight: 'bold',
        width: 180,
        height: 40
      })

      speedometerUI.add(speedometerText)
      app.add(speedometerUI)

      // Create minimap UI (initially hidden, positioned below speedometer)
      // Position: speedometer is at 0.05 from top with 60px height, minimap is 200px
      // We'll position it relative to speedometer using a calculated offset
      minimapUI = app.create('ui', {
        space: 'screen',
        width: MINIMAP_SIZE,
        height: MINIMAP_SIZE,
        position: [0.95, 0.05, 0], // Will be adjusted to be below speedometer
        pivot: 'top-right',
        backgroundColor: 'rgba(30, 30, 30, 0.6)', // Darker, more transparent background so dot shows through
        borderWidth: 2,
        borderColor: '#ff69b4', // Pink border to match speedometer
        borderRadius: 10,
        padding: 5,
        pointerEvents: false,
        active: false // Initially hidden
      })
      
      // Position minimap below speedometer (60px speedometer + 5px gap = 65px offset)
      // Convert pixels to normalized screen coordinates (assuming ~1080p height)
      // 65px / 1080 ≈ 0.06, so position at 0.05 + 0.06 = 0.11
      // But we need to account for minimap height too, so center it properly
      // Speedometer top: 0.05, height: 60/1080 ≈ 0.0556, so bottom at ~0.1056
      // Add 5px gap: 5/1080 ≈ 0.0046, so minimap top at ~0.11
      // Minimap height: 200/1080 ≈ 0.185, so we position top at 0.11
      minimapUI.position.y = 0.11

      // Create pink dot for player position as a separate screen-space UI
      // Position it relative to minimap using offset
      // Add it AFTER minimap so it renders on top
      minimapDot = app.create('ui', {
        space: 'screen',
        width: 10,
        height: 10,
        position: [0.95, 0.11, 0], // Same as minimap top-right corner
        pivot: 'top-right', // Match minimap pivot
        offset: [0, 0, 0], // Will be updated dynamically
        backgroundColor: '#ff00ff', // Bright magenta/pink dot (fully opaque, very bright)
        borderRadius: 5,
        pointerEvents: false,
        active: false // Initially hidden
      })
      
      // Create grid lines (every 100m)
      const mapAreaSize = MINIMAP_SIZE - 10 // 190px (with 5px padding on each side)
      const padding = 5
      const numGridLines = Math.floor(WORLD_SIZE / GRID_SPACING) + 1 // 21 lines (0 to 2000m)
      
      // Create vertical grid lines
      for (let i = 0; i < numGridLines; i++) {
        const worldPos = i * GRID_SPACING // Position in world (0 to 2000m)
        const normalizedPos = worldPos / WORLD_SIZE // 0 to 1
        const pixelPos = normalizedPos * mapAreaSize // Position in pixels within map area
        
        const gridLine = app.create('ui', {
          space: 'screen',
          width: 1, // 1px wide line
          height: mapAreaSize, // Full height of map area
          position: [0.95, 0.11, 0], // Same as minimap top-right corner
          pivot: 'top-right',
          offset: [-(mapAreaSize - pixelPos + padding), padding, 0], // Position from top-right
          backgroundColor: 'rgba(255, 105, 180, 0.3)', // Semi-transparent pink
          pointerEvents: false,
          active: false // Initially hidden
        })
        minimapGrid.push(gridLine)
        app.add(gridLine)
      }
      
      // Create horizontal grid lines
      for (let i = 0; i < numGridLines; i++) {
        const worldPos = i * GRID_SPACING // Position in world (0 to 2000m)
        const normalizedPos = worldPos / WORLD_SIZE // 0 to 1
        const pixelPos = normalizedPos * mapAreaSize // Position in pixels within map area
        
        const gridLine = app.create('ui', {
          space: 'screen',
          width: mapAreaSize, // Full width of map area
          height: 1, // 1px tall line
          position: [0.95, 0.11, 0], // Same as minimap top-right corner
          pivot: 'top-right',
          offset: [-padding, pixelPos + padding, 0], // X: right edge at padding, Y: position from top
          backgroundColor: 'rgba(255, 105, 180, 0.3)', // Semi-transparent pink
          pointerEvents: false,
          active: false // Initially hidden
        })
        minimapGrid.push(gridLine)
        app.add(gridLine)
      }
      
      // Add minimap first, then grid, then dot (dot will render on top)
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
  
      app.on('seat', (playerId) => {
        if (state.sitting === player.id) {
          player.cancelEffect()
          control?.release()
          stopEngine()
          control = null
          accelInput = 0
          steerInput = 0
          isSeated = false
          action.active = !playerId
          // Hide speedometer and minimap when exiting
          if (speedometerUI) {
            speedometerUI.active = false
          }
          if (minimapUI) {
            minimapUI.active = false
          }
          if (minimapDot) {
            minimapDot.active = false
          }
          // Hide grid lines
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
          // Show speedometer and minimap when entering (authority should be granted shortly after)
          if (speedometerUI && state.authority === player.id) {
            speedometerUI.active = true
          }
          if (minimapUI && state.authority === player.id) {
            minimapUI.active = true
          }
            if (minimapDot && state.authority === player.id) {
              minimapDot.active = true
            }
            // Show grid lines
            minimapGrid.forEach(gridLine => {
              if (gridLine) gridLine.active = true
            })
            // Show all trail points
            minimapTrail.forEach(trailPoint => {
              if (trailPoint) trailPoint.active = true
            })
        }
      })
  
      app.on('authority', playerId => {
        if (state.authority === player.id) {
          setMode(viewerMode)
          // Hide speedometer and minimap when losing authority
          if (speedometerUI) {
            speedometerUI.active = false
          }
          if (minimapUI) {
            minimapUI.active = false
          }
          if (minimapDot) {
            minimapDot.active = false
          }
          // Hide grid lines
          minimapGrid.forEach(gridLine => {
            if (gridLine) gridLine.active = false
          })
        }
        state.authority = playerId
        if (playerId === player.id) {
          setMode(simulateMode)
          // Show speedometer and minimap when gaining authority (player is driving)
          if (speedometerUI && isSeated) {
            speedometerUI.active = true
          }
          if (minimapUI && isSeated) {
            minimapUI.active = true
          }
          if (minimapDot && isSeated) {
            minimapDot.active = true
          }
          // Show grid lines
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
        
        // Update minimap dot position using player position (like player_transforms.js)
        if (minimapDot && minimapUI && minimapUI.active) {
          const player = world.getPlayer()
          if (!player) return
          
          // Get player position exactly like player_transforms.js
          const playerPos = player.position
          
          // Convert world coordinates to minimap position
          // World is 2km x 2km centered at (0, 0), so bounds are -1000 to 1000
          // Convert to 0-1 range for minimap
          const normalizedX = (playerPos.x + WORLD_SIZE / 2) / WORLD_SIZE // 0 to 1
          const normalizedZ = (playerPos.z + WORLD_SIZE / 2) / WORLD_SIZE // 0 to 1
          
          // Clamp to map bounds
          const mapX = Math.max(0, Math.min(1, normalizedX))
          const mapZ = Math.max(0, Math.min(1, normalizedZ))
          
          // Calculate offset from minimap top-right corner
          // Minimap is 200px, map area is 190px (with 5px padding on each side)
          // Top-right pivot: offset (0,0) is at top-right corner
          // X: negative = left from right edge
          // Y: positive = down from top edge
          const mapAreaSize = MINIMAP_SIZE - 10 // 190px
          const padding = 5
          
          // Calculate dot position within map area (0 to 190px from left/top)
          const dotXInMap = mapX * mapAreaSize // 0 to 190px from left edge
          const dotYInMap = mapZ * mapAreaSize // 0 to 190px from top edge
          
          // Calculate offset: go left (negative X) and down (positive Y) from top-right
          const offsetX = -(mapAreaSize - dotXInMap + padding) // Negative = left
          const offsetY = dotYInMap + padding // Positive = down
          
          // Check if we moved enough to create a trail dot at the old position
          const currentPos = { x: offsetX, y: offsetY }
          
          // Initialize lastDotPosition on first frame
          if (!lastDotPosition) {
            lastDotPosition = currentPos
            // Update the main dot position
            minimapDot.offset = new Vector3(offsetX, offsetY, 0)
            return // Skip trail creation on first frame
          }
          
          // Calculate distance moved
          const distance = Math.sqrt(
            Math.pow(currentPos.x - lastDotPosition.x, 2) + 
            Math.pow(currentPos.y - lastDotPosition.y, 2)
          )
          
          // If moved enough, create a pink dot at the OLD position (lastDotPosition)
          if (distance > TRAIL_DISTANCE_THRESHOLD) {
            const trailDot = app.create('ui', {
              space: 'screen',
              width: 10,
              height: 10,
              position: [0.95, 0.11, 0],
              pivot: 'top-right',
              offset: new Vector3(lastDotPosition.x, lastDotPosition.y, 0),
              backgroundColor: '#ff00ff', // Same pink as main dot
              borderRadius: 5,
              pointerEvents: false,
              active: minimapUI.active
            })
            
            minimapTrail.push(trailDot)
            app.add(trailDot)
          }
          
          // ALWAYS update lastDotPosition to current position (every frame)
          lastDotPosition = currentPos
          
          // Update the main dot position
          minimapDot.offset = new Vector3(offsetX, offsetY, 0)
        }
      })
  
      setMode(viewerMode)
    }
  }
  
  // Viewer mode - interpolates network state
  function viewerMode() {
    car.type = 'kinematic'
  
    app.on('info', data => {
      info.deserialize(data)
      info.write()
    })
  
    return {
      fixedUpdate(delta) { },
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

        // Update speedometer for viewer mode (if visible)
        if (speedometerText && speedometerUI && speedometerUI.active) {
          // Estimate speed from network data
          const speedDisplay = Math.round(Math.abs(speed) || 0)
          speedometerText.value = `${speedDisplay} KM/H`
        }
      },
      cancel() { },
    }
  }
  
  // Simulate mode - runs physics simulation
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
  
        if (isSlipping && accelInput) {
          power = Math.min(power + 1 * delta, 1.5)
        } else if (isSlipping) {
          power -= 0.8 * delta
        } else {
          power -= 0.4 * delta
        }
        power = clamp(Math.max(power, speedRatio), 0.1, 1)
  
        const roadPower = powerCurve.evaluate(speedRatio)
        if (!isSlipping && power > 0.8 && power > roadPower) {
          isSlipping = true
        } else if (isSlipping && (power < 0.6 || Math.abs(steerInput) < 0.2)) {
          isSlipping = false
        }
  
        const powerFactor = powerCurve.evaluate(speedRatio)
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
  
          const gripFactor = isSlipping ? 0.1 : wheel.gripCurve.evaluate(lateralVelRatio) * wheel.currentGrip
  
          const desiredVelChange = -steeringVel * gripFactor
          const desiredAccel = desiredVelChange / delta
          const counterForce = v4.copy(steeringDir).multiplyScalar(tireMass * desiredAccel)
  
          car.addForceAtLocalPos(counterForce, wheel.spring.position)
          
          // Update particle effects if enabled
          if (enableParticles && wheel.rear && wheel.skid && wheel.smoke && wheel.particles) {
            const sliding = gripFactor < 0.3 && Math.abs(speed) > 5
            wheel.skid.emitting = sliding
            wheel.smoke.emitting = sliding
            wheel.particles.position.copy(wheel.hub.position)
          }
        }
  
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
  
        // Update exhaust particles if enabled
        if (enableParticles && exhaustParticles) {
          exhaustParticles.emitting = power > 0.3
          exhaustParticles.rate = power * 15
        }
  
        updateNetworkRate()
      },
      update(delta) {
        if (control) {
          // Keyboard controls: W (gas), S (brake)
          accelInput = 0
          if (control.keyW?.down) accelInput += 1
          if (control.keyS?.down) accelInput -= 1
  
          // Mouse pointer steering: kart turns toward where camera is pointing
          // Reverse steering when driving backwards
          steerInput = calculateSteeringFromCamera()
          if (accelInput < 0) {
            steerInput = -steerInput
          }
        }
  
        // Update speedometer display (only when visible and player has authority)
        if (speedometerText && speedometerUI && speedometerUI.active) {
          const speedDisplay = Math.round(Math.abs(speed))
          speedometerText.value = `${speedDisplay} KM/H`
        }

        // Update minimap dot position using player position (like player_transforms.js)
        if (minimapDot && minimapUI && minimapUI.active) {
          const player = world.getPlayer()
          if (!player) return
          
          // Get player position exactly like player_transforms.js
          const playerPos = player.position
          
          // Convert world coordinates to minimap position
          // World is 2km x 2km centered at (0, 0), so bounds are -1000 to 1000
          // Convert to 0-1 range for minimap
          const normalizedX = (playerPos.x + WORLD_SIZE / 2) / WORLD_SIZE // 0 to 1
          const normalizedZ = (playerPos.z + WORLD_SIZE / 2) / WORLD_SIZE // 0 to 1
          
          // Clamp to map bounds
          const mapX = Math.max(0, Math.min(1, normalizedX))
          const mapZ = Math.max(0, Math.min(1, normalizedZ))
          
          // Calculate offset from minimap top-right corner
          // Minimap is 200px, map area is 190px (with 5px padding on each side)
          // Top-right pivot: offset (0,0) is at top-right corner
          // X: negative = left from right edge
          // Y: positive = down from top edge
          const mapAreaSize = MINIMAP_SIZE - 10 // 190px
          const padding = 5
          
          // Calculate dot position within map area (0 to 190px from left/top)
          const dotXInMap = mapX * mapAreaSize // 0 to 190px from left edge
          const dotYInMap = mapZ * mapAreaSize // 0 to 190px from top edge
          
          // Calculate offset: go left (negative X) and down (positive Y) from top-right
          const offsetX = -(mapAreaSize - dotXInMap + padding) // Negative = left
          const offsetY = dotYInMap + padding // Positive = down
          
          // Check if we moved enough to create a trail dot at the old position
          const currentPos = { x: offsetX, y: offsetY }
          
          // Initialize lastDotPosition on first frame
          if (!lastDotPosition) {
            lastDotPosition = currentPos
            // Update the main dot position
            minimapDot.offset = new Vector3(offsetX, offsetY, 0)
            return // Skip trail creation on first frame
          }
          
          // Calculate distance moved
          const distance = Math.sqrt(
            Math.pow(currentPos.x - lastDotPosition.x, 2) + 
            Math.pow(currentPos.y - lastDotPosition.y, 2)
          )
          
          // If moved enough, create a pink dot at the OLD position (lastDotPosition)
          if (distance > TRAIL_DISTANCE_THRESHOLD) {
            const trailDot = app.create('ui', {
              space: 'screen',
              width: 10,
              height: 10,
              position: [0.95, 0.11, 0],
              pivot: 'top-right',
              offset: new Vector3(lastDotPosition.x, lastDotPosition.y, 0),
              backgroundColor: '#ff00ff', // Same pink as main dot
              borderRadius: 5,
              pointerEvents: false,
              active: minimapUI.active
            })
            
            minimapTrail.push(trailDot)
            app.add(trailDot)
          }
          
          // ALWAYS update lastDotPosition to current position (every frame)
          lastDotPosition = currentPos
          
          // Update the main dot position
          minimapDot.offset = new Vector3(offsetX, offsetY, 0)
        }

        lastSend += delta
        if (lastSend > adaptiveSendRate && control && isSeated) {
          lastSend = 0
          app.send('info', info.read().serialize())
        }
      },
      cancel() { },
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
  