// todo:
// - raycast firstHit=false and ignore own colliders
// - hide reticle, eg control.reticle = false ?
// - unmount points
// - custom camera zoom has no bumper?
// - engine sounds
// - drift sounds
// - handbrake should also slow down/stop from moving
// - handbrake on should lock back wheels

app.configure([
    {
        key: 'accel',
        type: 'number',
        label: 'Acceleration',
        initial: 10,
        min: 0,
        hint: 'The maximum amount of force applied when accelerating.'
    },
    {
        key: 'decel',
        type: 'number',
        label: 'Deceleration',
        initial: 6,
        min: 0,
        hint: 'The maximum amount of force applied when decelerating.'
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
        hint: 'The maximum speed, in kilometers per hour.'
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
        hint: 'The wheels that exert power when accelerating/decelerating.'
    },
    {
        key: 'steering',
        type: 'switch',
        label: 'Steering',
        options: [
            { label: 'Front', value: 'front' },
            { label: 'Rear', value: 'rear' },
        ],
        hint: 'The wheels that steer when turning.'
    },
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
        hint: 'Turning based on speed. X axis is the speed ratio (0 to 1 of max speed) and Y axis is the amount of turning to apply.'
    },
    {
        key: 'frontGrip',
        type: 'curve',
        label: 'Front Grip',
        hint: 'Front wheel grip. X axis is the amount of sideways force where 0 is none and 1 is full. Y axis is the amount of grip the wheel has.'
    },
    {
        key: 'rearGrip',
        type: 'curve',
        label: 'Rear Grip',
        hint: 'Rear wheel grip. X axis is the amount of sideways force where 0 is none and 1 is full. Y axis is the amount of grip the wheel has.'
    },
    {
        key: 'longGrip',
        type: 'curve',
        label: 'Long Grip',
        hint: 'Longitudinal grip curve for powered wheels. X-axis is the slip ratio and Y-axis is the grip from 0 (no traction) to 1 (full traction).'
    },
    {
        key: 'springStrength',
        type: 'number',
        label: 'Spring Strength',
        initial: 10,
        min: 1,
        hint: 'The spring suspension strength.'
    },
    {
        key: 'springDamper',
        type: 'number',
        label: 'Spring Damper',
        initial: 2,
        min: 1,
        hint: 'Damping applied to spring suspension.'
    },
    {
        key: 'sit',
        type: 'file',
        kind: 'emote',
        label: 'Sit Emote',
        hint: 'Emote used when sitting in the vehicle.'
    },
    {
        key: 'engine',
        type: 'file',
        kind: 'audio',
        label: 'Engine Sound',
        hint: 'A looping single-pitch sound that is pitch modulated to form the sounds of the engine while driving.'
    },
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
    }
])

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

const SEND_RATE = 1 / 5

const WHEEL_MASS = 0.05

const car = app.get('Car')
const body = app.get('Body')
const cOM = app.get('CenterOfMass')
const seatNodes = [
    app.get('Seat1'),
    app.get('Seat2'),
    app.get('Seat3'),
    app.get('Seat4'),
]

// car.type = 'static'
car.mass = 1
car.setCenterOfMass(cOM.position)
// car.linearDamping = 0.5
car.angularDamping = 2
app.traverse(node => {
    if (node.name === 'collider') {
        node.layer = 'prop'
    }
})
world.attach(car)

const accel = props.accel
const decel = props.decel
const handbrake = props.handbrake
const maxSpeed = props.maxSpeed
const driveTrain = props.driveTrain
const steering = props.steering
const powerCurve = new Curve().deserialize(props.power)
const turnCurve = new Curve().deserialize(props.turn)
const frontGripCurve = new Curve().deserialize(props.frontGrip)
const rearGripCurve = new Curve().deserialize(props.rearGrip)
const longGripCurve = new Curve().deserialize(props.longGrip)
const springStrength = props.springStrength
const springDamper = props.springDamper
const sitEmote = props.sit?.url
const treadmarkUrl = props.treadmark?.url
const smokeUrl = props.smoke?.url
const engineUrl = props.engine?.url

const engine = app.create('audio', {
    src: engineUrl,
    group: 'sfx',
    loop: true,
    volume: 0.8,
})
car.add(engine)

const wheels = [
    {
        idx: 0,
        front: true,
        left: true,
        spring: car.get('SpringFL'),
        hub: body.getBone('HubFL'),
        tire: body.getBone('TireFL'),
        grounded: false,
        compression: 0,
        powered: driveTrain === 'fwd' || driveTrain === '4wd',
        turns: steering === 'front',
        gripCurve: frontGripCurve,
    },
    {
        idx: 1,
        front: true,
        right: true,
        spring: car.get('SpringFR'),
        hub: body.getBone('HubFR'),
        tire: body.getBone('TireFR'),
        grounded: false,
        compression: 0,
        powered: driveTrain === 'fwd' || driveTrain === '4wd',
        turns: steering === 'front',
        gripCurve: frontGripCurve,
    },
    {
        idx: 2,
        rear: true,
        left: true,
        spring: car.get('SpringBL'),
        hub: body.getBone('HubBL'),
        tire: body.getBone('TireBL'),
        grounded: false,
        compression: 0,
        powered: driveTrain === 'rwd' || driveTrain === '4wd',
        turns: steering === 'rear',
        gripCurve: rearGripCurve,
    },
    {
        idx: 3,
        rear: true,
        right: true,
        spring: car.get('SpringBR'),
        hub: body.getBone('HubBR'),
        tire: body.getBone('TireBR'),
        grounded: false,
        compression: 0,
        powered: driveTrain === 'rwd' || driveTrain === '4wd',
        turns: steering === 'rear',
        gripCurve: rearGripCurve,
    },
]
for (const wheel of wheels) {
    wheel.springRestLength = wheel.spring.position.y - wheel.hub.position.y
    wheel.springTravel = wheel.springRestLength * 0.4 // ???
    wheel.springMaxLength = wheel.springRestLength + wheel.springTravel
    wheel.radius = wheel.hub.position.y
    if (wheel.rear) {
        const particles = app.create('group')
        particles.position.copy(wheel.hub.position)
        wheel.particles = particles
        const skid = app.create('particles', {
            emitting: false,
            shape: ['point'],
            billboard: 'direction',
            rate: 0,
            rateOverDistance: 8,
            life: '5',
            size: '0.4',
            speed: '0',
            rotate: '0~360',
            color: 'black',
            alpha: '0.5',
            alphaOverLife: '0,1|0.7,1|1,0',
            image: treadmarkUrl
        })
        skid.position.y -= wheel.radius - 0.05
        wheel.skid = skid
        particles.add(skid)
        const smoke = app.create('particles', {
            emitting: false,
            shape: ['cone', 0.2, 1, 20],
            rate: 0,
            rateOverDistance: 5,
            life: '3~20',
            size: '3',
            speed: '0.4',
            rotate: '0~360',
            alpha: '0.02',
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

let accelInput = 0
let steerInput = 0
let handbrakeInput = false

let state = app.state
let control
let zoom = 7
let isSeated = false
const isDriving = false

const player = world.getPlayer()

// app.on('update', delta => {
//   for (const wheel of wheels) {
//     wheel.hub.position.y += 1 * delta
//     wheel.tire.rotation.x -= 20 * delta
//   }
// })
// return



let mode
function setMode(fn, ...args) {
    if (mode?.cleanup) mode.cleanup()
    mode = fn ? fn(...args) : null
}

const info = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    wheels: [
        {
            offset: 0,
            turn: 0,
            rotate: 0,
        },
        {
            offset: 0,
            turn: 0,
            rotate: 0,
        },
        {
            offset: 0,
            turn: 0,
            rotate: 0,
            sliding: false,
        },
        {
            offset: 0,
            turn: 0,
            rotate: 0,
            sliding: false,
        },
    ],
    read() {
        this.position.copy(car.position)
        this.quaternion.copy(car.quaternion)
        for (let i = 0; i < 4; i++) {
            this.wheels[i].offset = wheels[i].hub.position.y
            this.wheels[i].turn = wheels[i].hub.rotation.y
            this.wheels[i].rotate = wheels[i].tire.rotation.x
            if (wheels[i].rear) {
                this.wheels[i].sliding = wheels[i].skid.emitting
            }
        }
        return this
    },
    write() {
        car.position.copy(this.position)
        car.quaternion.copy(this.quaternion)
        for (let i = 0; i < 4; i++) {
            wheels[i].hub.position.y = this.wheels[i].offset
            wheels[i].hub.rotation.y = this.wheels[i].turn
            wheels[i].tire.rotation.x = this.wheels[i].rotate
            if (wheels[i].rear) {
                wheels[i].skid.emitting = this.wheels[i].sliding
                wheels[i].smoke.emitting = this.wheels[i].sliding
            }
        }
        return this
    },
    deserialize([px, py, pz, qx, qy, qz, qw, w0o, w0t, w0r, w1o, w1t, w1r, w2o, w2t, w2r, w2s, w3o, w3t, w3r, w3s]) {
        this.position.set(px, py, pz)
        this.quaternion.set(qx, qy, qz, qw)
        this.wheels[0].offset = w0o
        this.wheels[0].turn = w0t
        this.wheels[0].rotate = w0r
        this.wheels[1].offset = w1o
        this.wheels[1].turn = w1t
        this.wheels[1].rotate = w1r
        this.wheels[2].offset = w2o
        this.wheels[2].turn = w2t
        this.wheels[2].rotate = w2r
        this.wheels[2].sliding = w2s
        this.wheels[3].offset = w3o
        this.wheels[3].turn = w3t
        this.wheels[3].rotate = w3r
        this.wheels[3].sliding = w3s
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
            wheels[0].hub.position.y,
            wheels[0].hub.rotation.y,
            wheels[0].tire.rotation.x,
            wheels[1].hub.position.y,
            wheels[1].hub.rotation.y,
            wheels[1].tire.rotation.x,
            wheels[2].hub.position.y,
            wheels[2].hub.rotation.y,
            wheels[2].tire.rotation.x,
            wheels[2].skid.emitting,
            wheels[3].hub.position.y,
            wheels[3].hub.rotation.y,
            wheels[3].tire.rotation.x,
            wheels[3].skid.emitting,
        ]
    }
}

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
    app.send('init', state)
    app.on('fixedUpdate', delta => {
        mode?.fixedUpdate(delta)
    })
    app.on('update', delta => {
        mode?.update(delta)
    })
    setMode(simulateMode)
}

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
        engine.play()
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
            node.add(anchor)
            return {
                playerId: state.sitting[seatIdx],
                anchor,
                setActive(active) {
                    action.active = active
                }
            }
        })
        app.on('seat', ([seatIdx, playerId]) => {
            const seat = seats[seatIdx]
            if (seat.playerId === player.id) {
                // we unmounted
                console.log('unmount')
                player.cancelEffect()
                control?.release()
                control = null
                accelInput = 0
                steerInput = 0
                isSeated = false
                for (const seat of seats) {
                    seat?.setActive(!seat.playerId)
                }
            }
            seat.playerId = playerId
            seat.setActive(!playerId && !isSeated)
            if (playerId === player.id) {
                // we mounted
                player.applyEffect({
                    anchor: seat.anchor,
                    emote: sitEmote,
                })
                control = app.control()
                control.hideReticle()
                control.camera.write = true
                isSeated = true
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
        app.on('fixedUpdate', delta => {
            mode?.fixedUpdate(delta)
        })
        app.on('update', delta => {
            // mode updates
            mode?.update(delta)
            // exit input
            if (isSeated && control.keyQ.pressed) {
                app.send('unmount')
            }
            // engine sound
            const powerToPitch = 5
            engine.setPlaybackRate(power * powerToPitch)
            // control
            if (control) {
                // camera attachment
                control.camera.position.copy(car.position)
                control.camera.position.y += cameraYOffset
                // camera automatic movement
                if (!control.mouseLeft.down) {
                    const targetY = e1.setFromQuaternion(car.quaternion).y
                    e2.setFromQuaternion(control.camera.quaternion)
                    e2.y = targetY
                    q1.setFromEuler(e2)
                    control.camera.quaternion.slerp(q1, 4 * delta)
                }
                // camera manual movement
                else {
                    control.camera.rotation.reorder('YXZ')
                    control.camera.rotation.y -= control.pointer.delta.x * 0.1 * delta
                    control.camera.rotation.x -= control.pointer.delta.y * 0.1 * delta
                }
                // camera zoom
                zoom += -control.scrollDelta.value * 0.01
                zoom = clamp(zoom, 3, 15)
                control.camera.zoom = lerp(control.camera.zoom, zoom, zoomSpeed * delta)
            }
        })
        setMode(viewerMode)
    }
}

function viewerMode() {
    car.type = 'kinematic'
    const position = new BufferedLerpVector3(car.position, 0.3)
    const quaternion = new BufferedLerpQuaternion(car.quaternion, 0.3)
    app.on('info', data => {
        info.deserialize(data)
        position.push(info.position)
        quaternion.push(info.quaternion)
    })
    return {
        fixedUpdate(delta) {
            // ...
        },
        update(delta) {
            position.update(delta)
            quaternion.update(delta)
            // car.position.lerp(info.position, 4 * delta)
            // car.quaternion.slerp(info.quaternion, 4 * delta)
            wheels[0].hub.position.y = lerp(wheels[0].hub.position.y, info.wheels[0].offset, 6 * delta)
            wheels[0].hub.rotation.y = lerp(wheels[0].hub.rotation.y, info.wheels[0].turn, 6 * delta)
            wheels[0].tire.rotation.x = lerp(wheels[0].tire.rotation.x, info.wheels[0].rotate, 6 * delta)
            wheels[1].hub.position.y = lerp(wheels[1].hub.position.y, info.wheels[1].offset, 6 * delta)
            wheels[1].hub.rotation.y = lerp(wheels[1].hub.rotation.y, info.wheels[1].turn, 6 * delta)
            wheels[1].tire.rotation.x = lerp(wheels[1].tire.rotation.x, info.wheels[1].rotate, 6 * delta)
            wheels[2].hub.position.y = lerp(wheels[2].hub.position.y, info.wheels[2].offset, 6 * delta)
            wheels[2].hub.rotation.y = lerp(wheels[2].hub.rotation.y, info.wheels[2].turn, 6 * delta)
            wheels[2].tire.rotation.x = lerp(wheels[2].tire.rotation.x, info.wheels[2].rotate, 6 * delta)
            wheels[2].skid.emitting = info.wheels[2].sliding
            wheels[2].smoke.emitting = info.wheels[2].sliding
            wheels[2].particles.position.copy(wheels[2].hub.position)
            wheels[3].hub.position.y = lerp(wheels[3].hub.position.y, info.wheels[3].offset, 6 * delta)
            wheels[3].hub.rotation.y = lerp(wheels[3].hub.rotation.y, info.wheels[3].turn, 6 * delta)
            wheels[3].tire.rotation.x = lerp(wheels[3].tire.rotation.x, info.wheels[3].rotate, 6 * delta)
            wheels[3].skid.emitting = info.wheels[3].sliding
            wheels[3].smoke.emitting = info.wheels[3].sliding
            wheels[3].particles.position.copy(wheels[3].hub.position)
        },
        cancel() {
            // ...
        }
    }
}

function simulateMode() {
    car.type = 'dynamic'
    let lastSend = 0

    return {
        fixedUpdate(delta) {
            grounded = false

            // calc speed
            const velocity = v2
            car.getLinearVelocity(velocity)
            const forward = v1.copy(FORWARD).applyQuaternion(car.quaternion)
            const magnitude = velocity.length()
            const mSpeed = v3.copy(forward).dot(velocity)
            speed = mSpeed * 3.6 // m/s -> km/h
            isMovingForward = velocity.dot(forward) > 0
            speedRatio = speed / maxSpeed
            speedRatioAbs = clamp(Math.abs(speed) / maxSpeed, 0, 1)

            // calc power
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
            // console.log(power, isSlipping)

            const powerFactor = powerCurve.evaluate(power)
            const accelForce = (accelInput > 0 ? accel : decel) * accelInput * powerFactor

            // TODO: roadPower is the power based on regular momentum but if i power is more than
            // ~0.2 or something of roadPower then we should move to a "slipping" state where
            // we are able to do donuts and drifting. when slipping i think the lateral grip should be lowered, eg replacing the handbrake 0.1 grip logic

            // suspension
            for (const wheel of wheels) {
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
                    wheel.compresson = compression
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
                // visual
                if (hit) {
                    wheel.hub.position.copy(wheel.spring.position)
                    wheel.hub.position.y -= hit.distance - wheel.radius
                } else {
                    wheel.hub.position.copy(wheel.spring.position)
                    wheel.hub.position.y = wheel.radius - wheel.springTravel
                }
            }

            // steering
            const turnFactor = turnCurve.evaluate(speedRatioAbs)
            const steerSpeedFactor = 1.0 - (speedRatioAbs * 0.7) // Speed-dependent steering speed
            const adjustedSteerSpeed = steerSpeed * steerSpeedFactor // Lower value at high speeds
            const targetSteerAngle = steerInput * (steerAngleMax * DEG2RAD) * turnFactor
            const angleDifference = targetSteerAngle - steerAngle
            const maxAngleChange = adjustedSteerSpeed * delta
            if (Math.abs(angleDifference) <= maxAngleChange) {
                steerAngle = targetSteerAngle
            } else {
                steerAngle += Math.sign(angleDifference) * maxAngleChange
            }
            for (const wheel of wheels) {
                if (!wheel.turns) continue
                wheel.hub.rotation.y = steerAngle
                wheel.spring.rotation.y = steerAngle
            }

            // acceleration / deceleration
            if (speedRatioAbs < 1) {
                for (const wheel of wheels) {
                    if (!wheel.powered) continue
                    if (!wheel.grounded) continue
                    if (handbrakeInput && wheel.rear) continue // <---
                    const worldMatrix = wheel.spring.getWorldMatrix(m1)
                    const worldQua = q1.setFromRotationMatrix(worldMatrix)
                    const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
                    const accelFinalForce = v4.copy(forwardDir).multiplyScalar(accelForce)
                    // if (wheel.rear && handbrakeInput) accelFinalForce.multiplyScalar(0.30)
                    car.addForceAtLocalPos(accelFinalForce, wheel.hub.position)
                }
            }

            // rolling friction
            const regular = 0.2
            for (const wheel of wheels) {
                if (!wheel.grounded) continue
                const worldMatrix = wheel.spring.getWorldMatrix(m1)
                const worldQua = q1.setFromRotationMatrix(worldMatrix)
                const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
                // oppose current direction of movement
                const opposingDir = v4.copy(forwardDir).multiplyScalar(isMovingForward ? -1 : 1)
                const frictionForce = wheel.rear && handbrakeInput ? handbrake : regular
                const frictionFinalForce = v5.copy(opposingDir).multiplyScalar(frictionForce)
                car.addForceAtLocalPos(frictionFinalForce, wheel.hub.position)
            }

            // lateral grip
            const tireMass = 0.05
            for (const wheel of wheels) {
                if (!wheel.grounded) continue
                const worldMatrix = wheel.spring.getWorldMatrix(m1)
                const worldQua = q1.setFromRotationMatrix(worldMatrix)
                const forwardDir = v3.copy(FORWARD).applyQuaternion(worldQua)
                const steeringDir = v5.copy(RIGHT).applyQuaternion(worldQua)
                const tireWorldVel = car.getLocalVelocityAtLocalPos(wheel.spring.position, v6)
                // calc forward and sideways velocity components
                const forwardVel = forwardDir.dot(tireWorldVel)
                const steeringVel = steeringDir.dot(tireWorldVel)
                // calc total velocity magnitude of tire
                const totalVelMagnitude = Math.sqrt(forwardVel * forwardVel + steeringVel * steeringVel)
                // calc lateral velocity ratio (how much of the total velocity is sideways)
                // avoid division by zero
                const lateralVelRatio = totalVelMagnitude > 0.01 ? Math.abs(steeringVel) / totalVelMagnitude : 0
                // use grip curve based on lateral velocity ratio
                let gripFactor
                if (wheel.rear && (handbrakeInput || isSlipping)) {
                    // if (wheel.rear && handbrakeInput) {
                    gripFactor = 0.1
                } else {
                    gripFactor = wheel.gripCurve.evaluate(lateralVelRatio)
                }
                // calc desired velocity change to counteract sideways movement
                const desiredVelChange = -steeringVel * gripFactor // 0 = no grip, 1 = full grip
                const desiredAccel = desiredVelChange / delta
                const counterForce = v4.copy(steeringDir).multiplyScalar(tireMass * desiredAccel)
                car.addForceAtLocalPos(counterForce, wheel.spring.position)
                // sliding particles
                if (wheel.skid) {
                    const sliding = gripFactor < 0.3 && Math.abs(speed) > 5
                    wheel.skid.emitting = sliding
                    wheel.smoke.emitting = sliding
                }
            }

            // tire visual rotation
            for (const wheel of wheels) {
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
        },
        update(delta) {
            if (control) {
                // steering
                steerInput = 0
                if (control.keyA.down) steerInput += 1
                if (control.keyD.down) steerInput -= 1
                // accel/decel
                accelInput = 0
                if (control.keyW.down) accelInput += 1
                if (control.keyS.down) accelInput -= 1
                // braking
                handbrakeInput = control.space.down
            }
            lastSend += delta
            if (lastSend > SEND_RATE) {
                lastSend = 0
                app.send('info', info.read().serialize())
            }
        },
        cancel() {
            // ...
        }
    }
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

