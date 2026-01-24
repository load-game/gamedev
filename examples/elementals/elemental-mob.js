app.configure([
	{
		key: 'assets',
		type: 'file',
		kind: 'model',
		label: 'Assets',
	},
	{
		key: 'idleEmote',
		type: 'file',
		kind: 'emote',
		label: 'Idle Emote',
	},
	{
		key: 'runEmote',
		type: 'file',
		kind: 'emote',
		label: 'Run Emote'
	},
	{
		key: 'runSpeed',
		type: 'number',
		label: 'Run Speed',
		initial: 6,
		dp: 1,
	},
	{
		key: 'attackEmote',
		type: 'file',
		kind: 'emote',
		label: 'Attack Emote'
	},
	{
		key: 'attackDmg',
		type: 'text',
		label: 'Attack Damage',
		initial: '10,20,30,2',
		hint: 'Format: min,max,crit_chance,crit_multiplier'
	},
	{
		key: 'attackRate',
		type: 'number',
		label: 'Attack Rate',
		initial: 1.3,
		dp: 1,
	},
	{
		key: 'aggroDistance',
		type: 'number',
		label: 'Aggro Distance',
		initial: 10,
	},
	{
		key: 'leashDistance',
		type: 'number',
		label: 'Leash Distance',
		initial: 11,
	},
	{
		key: 'regenRate',
		type: 'number',
		label: 'Regen Rate',
		initial: 1,
	},
	{
		key: 'regenAmount',
		type: 'number',
		label: 'Regen Amount',
		initial: 1,
	},
	{
		key: 'deadEmote',
		type: 'file',
		kind: 'emote',
		label: 'Dead Emote'
	},
	{
		key: 'maxHealth',
		type: 'number',
		label: 'Max Health',
		initial: 100,
	},
	{
		key: 'mobName',
		type: 'text',
		label: 'Mob Name',
		initial: 'Elemental Mob',
	},
])

const SEND_RATE = 1 / 5
const GRAVITY = -10
const FORWARD = new Vector3(0, 0, -1)
const MAX_HEALTH = props.maxHealth || 100
const DEATH_TIME = 3
const RESPAWN_TIME = 3
const SPAWN_TIME = 3

const DEBUG_AGGRO = false

const Emotes = {
	IDLE: 0,
	RUN: 1,
	ATTACK: 2,
	DEAD: 3,
}
const emoteUrls = {
	0: props.idleEmote?.url,
	1: props.runEmote?.url + '?s=1',
	2: props.attackEmote?.url,
	3: props.deadEmote?.url + '?l=0'
}

const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const q1 = new Quaternion()
const q2 = new Quaternion()
const q3 = new Quaternion()

const avatar = app.get('avatar')
avatar.quaternion.copy(app.quaternion)

const mobId = app.instanceId

const getAttackDmg = strToDamageFn(props.attackDmg)

const start = {
	position: app.position.clone(),
	quaternion: app.quaternion.clone()
}

if (world.isServer) {
	init()
	async function init() {
		const state = app.state

		const ctrl = app.create('controller', {
			radius: 0.3,
			height: 1.2,
			tag: `elemental-mob:${mobId}`,
			layer: 'player' // Make mobs detectable by player weapons
		})
		ctrl.position.copy(app.position)
		world.add(ctrl)
		ctrl.add(avatar)

		const threat = createThreatTable()

		let visible = true
		let collision = true
		let health = MAX_HEALTH
		const position = ctrl.position
		const quaternion = avatar.quaternion
		let emote = Emotes.IDLE

		const aggro = createAggroSphere(ctrl, props.aggroDistance)

		let phase

		function setPhase(fn, ...args) {
			// console.log('setPhase', fn.name)
			phase?.stop?.()
			phase = fn(...args)
		}
		function spawn() {
			visible = true
			collision = true
			ctrl.teleport(start.position)
			avatar.quaternion.copy(start.quaternion)
			health = MAX_HEALTH
			emote = Emotes.IDLE
			threat.reset()
			let time = 0
			return {
				fixedUpdate(delta) {
					if (threat.target) {
						return setPhase(chase)
					}
					time += delta
					if (time > SPAWN_TIME) setPhase(idle)
				}
			}
		}
		function idle() {
			emote = Emotes.IDLE
			aggro.watch(playerId => {
				threat.inc(playerId, 1)
				setPhase(chase)
			})
			let lastRegen = 0
			return {
				fixedUpdate(delta) {
					if (threat.target) {
						return setPhase(chase)
					}
					if (health < MAX_HEALTH) {
						lastRegen += delta
						if (lastRegen > props.regenRate) {
							lastRegen = 0
							health = Math.min(health + props.regenAmount, MAX_HEALTH)
						}
					}
				},
				stop() {
					aggro.unwatch()
				}
			}
		}
		function chase() {
			let playerId = threat.target
			let player = world.getPlayer(playerId)
			emote = Emotes.RUN
			return {
				fixedUpdate(delta) {
					// get and check target
					if (threat.target !== playerId) {
						playerId = threat.target
						if (!playerId) return setPhase(leash)
						player = world.getPlayer(playerId)
					}
					// get flat direction from mob to player (ignore vetical component)
					const dir = v1
					dir.copy(player.position)
					dir.y = ctrl.position.y
					dir.sub(ctrl.position)
					dir.normalize()
					// create a move vector
					const move = v2.copy(dir)
					// apply speed          
					const moveSpeed = props.runSpeed
					move.multiplyScalar(moveSpeed * delta)
					// add gravity
					move.y = GRAVITY * delta
					// move controller
					ctrl.move(move)
					// turn toward player
					q1.setFromUnitVectors(FORWARD, dir)
					avatar.quaternion.copy(q1)
					// close enough to attack?
					const distance = player.position.distanceTo(ctrl.position)
					if (distance < 1.3) setPhase(attack)
					// too far away?
					if (distance > props.leashDistance) setPhase(leash)
				},
				stop() {
					// ...
				}
			}
		}
		function attack() {
			let playerId = threat.target
			let player = world.getPlayer(playerId)
			emote = Emotes.ATTACK
			let lastAttack = props.attackRate
			return {
				fixedUpdate(delta) {
					// get and check target
					if (threat.target !== playerId) {
						playerId = threat.target
						if (!playerId) return setPhase(leash)
						player = world.getPlayer(playerId)
					}
					// attack
					lastAttack += delta
					if (lastAttack > props.attackRate) {
						lastAttack = 0
						const [amount, crit] = getAttackDmg()
						// Use elementals damage system instead of prism
						app.emit('elemental-item:dmg', [playerId, amount, crit])
						// Also damage the player directly
						player.damage(amount)
					}
					// get flat direction from mob to player (ignore vetical component)
					const dir = v1
					dir.copy(player.position)
					dir.y = ctrl.position.y
					dir.sub(ctrl.position)
					dir.normalize()
					// turn toward player
					q1.setFromUnitVectors(FORWARD, dir)
					avatar.quaternion.copy(q1)
					// far enough away to chase?
					const distance = player.position.distanceTo(ctrl.position)
					if (distance > 2.5) setPhase(chase)
				},
				stop() {
					// ...
				}
			}
		}
		function leash() {
			threat.reset()
			emote = Emotes.RUN
			return {
				fixedUpdate(delta) {
					// get flat direction from mob to start (ignore vetical component)
					const dir = v1
					dir.copy(start.position)
					dir.y = ctrl.position.y
					dir.sub(ctrl.position)
					dir.normalize()
					// create a move vector
					const move = v2.copy(dir)
					// apply speed          
					const moveSpeed = 6
					move.multiplyScalar(moveSpeed * delta)
					// add gravity
					move.y = GRAVITY * delta
					// move controller
					ctrl.move(move)
					// turn toward start
					q1.setFromUnitVectors(FORWARD, dir)
					avatar.quaternion.copy(q1)
					// close enough to attack?
					const distance = start.position.distanceTo(ctrl.position)
					if (distance < 0.3) setPhase(idle)
				},
				stop() {
					// ...
				}
			}
		}
		function dead() {
			emote = Emotes.DEAD
			collision = false
			let time = 0
			return {
				fixedUpdate(delta) {
					time += delta
					if (time > DEATH_TIME) setPhase(despawn)
				},
				stop() {
					// ...
				}
			}
		}
		function despawn() {
			visible = false
			let time = 0
			return {
				fixedUpdate(delta) {
					time += delta
					if (time > RESPAWN_TIME) setPhase(spawn)
				},
				stop() {
					// ...
				}
			}
		}
		let lastSend = 0
		world.on('leave', e => {
			threat.clear(e.playerId)
		})
		world.on('health', ({ playerId, health }) => {
			if (health === 0) {
				threat.clear(playerId)
			}
		})
		// Listen for damage from elemental items
		world.on(`elemental-mob:hit:${mobId}`, ([fromPlayerId, amount, crit]) => {
			console.log(`[elemental-mob] ${mobId} received damage:`, amount, 'crit:', crit, 'from player:', fromPlayerId)
			if (health <= 0) {
				console.log(`[elemental-mob] ${mobId} already dead`)
				return
			}
			const actualAmount = Math.min(health, amount)
			const position = ctrl.position.clone()
			position.y += 1.7
			health -= actualAmount
			console.log(`[elemental-mob] ${mobId} health: ${health}/${MAX_HEALTH}`)
			threat.inc(fromPlayerId, amount)
			// Use elementals damage display system
			app.emit('elemental-mob:dmg', [mobId, actualAmount, crit])
			if (health <= 0) {
				console.log(`[elemental-mob] ${mobId} died, entering dead phase`)
				setPhase(dead)
			}
		})
		app.on('fixedUpdate', delta => {
			phase.fixedUpdate?.(delta)
			lastSend += delta
			if (lastSend >= SEND_RATE) {
				lastSend = 0
				let changed
				const delta = {}
				if (state.v !== visible) {
					state.v = visible
					delta.v = visible
					changed = true
				}
				if (state.c !== collision) {
					state.c = collision
					delta.c = collision
					changed = true
				}
				if (state.h !== health) {
					state.h = health
					delta.h = health
					changed = true
				}
				const p = position.toArray()
				if (!isArrayEqual(state.p, p)) {
					state.p = p
					delta.p = p
					changed = true
				}
				const q = quaternion.toArray()
				if (!isArrayEqual(state.q, q)) {
					state.q = q
					delta.q = q
					changed = true
				}
				if (state.e !== emote) {
					state.e = emote
					delta.e = emote
					changed = true
				}
				if (changed) {
					app.send('delta', delta)
				}
			}
		})
		setPhase(spawn)
		state.v = visible
		state.c = collision
		state.h = health
		state.p = position.toArray()
		state.q = quaternion.toArray()
		state.e = emote
		state.ready = true
		app.send('init', state)
	}
}

if (world.isClient) {
	if (app.state.ready) {
		init(app.state)
	} else {
		app.on('init', init)
	}
	function init(state) {
		console.log('[Elemental Mob] Client init:', state)
		let visible = state.v
		let collision = state.c
		const root = app.create('group')
		root.position.fromArray(state.p)
		if (visible) world.add(root)
		avatar.quaternion.fromArray(state.q)
		avatar.setEmote(emoteUrls[state.e])
		root.add(avatar)
		const nametag = createNametag(props.mobName || 'Elemental Mob', state.h, MAX_HEALTH)
		if (visible) world.add(nametag.node)
		let weapon
		let sphere
		let capsule
		world.load('model', props.assets?.url).then(wep => {
			weapon = app.create('group')
			const sword = wep.get('Sword')
			if (sword) {
				sword.position.set(0.1, -0.01, 0)
				sword.rotation.set(-80 * DEG2RAD, 0 * DEG2RAD, 0 * DEG2RAD)
				// Make sure sword doesn't block raycasts - set all children to 'prop' layer
				sword.traverse(child => {
					if (child.layer !== undefined) {
						child.layer = 'prop'
					}
				})
				weapon.add(sword)
				if (visible) world.add(weapon)
			}
			sphere = wep.get('Sphere')
			if (DEBUG_AGGRO && sphere) {
				const aggroSphere = sphere.clone()
				aggroSphere.scale.setScalar(props.aggroDistance)
				avatar.add(aggroSphere)
				aggroSphere.active = true
			}
			capsule = wep.get('Capsule')
			if (capsule) {
				wep.get('CapsuleCollider').layer = 'prop'
				if (collision) root.add(capsule)
			}
		})
		const lerp = {
			pos: {
				current: new Vector3().fromArray(state.p),
				target: new Vector3().fromArray(state.p),
				speed: 3
			},
			qua: {
				current: new Quaternion().fromArray(state.q),
				target: new Quaternion().fromArray(state.q),
				speed: 5
			}
		}
		app.on('update', delta => {
			if (!visible) return
			// lerp position
			lerp.pos.current.lerp(lerp.pos.target, Math.min(1, delta * lerp.pos.speed))
			root.position.copy(lerp.pos.current)
			// lerp rotation
			lerp.qua.current.slerp(lerp.qua.target, Math.min(1, delta * lerp.qua.speed))
			avatar.quaternion.copy(lerp.qua.current)
		})
		app.on('lateUpdate', delta => {
			if (!visible) return
			if (weapon) {
				const matrix = avatar.getBoneTransform?.('rightHand')
				if (matrix) {
					weapon.position.setFromMatrixPosition(matrix)
					weapon.quaternion.setFromRotationMatrix(matrix)
				}
			}
			if (nametag) {
				const matrix = avatar.getBoneTransform?.('head')
				if (matrix) {
					nametag.node.position.setFromMatrixPosition(matrix)
				}
			}
		})
		app.on('delta', delta => {
			let snap
			if (delta.v !== undefined) {
				state.v = delta.v
				visible = delta.v
				snap = true
				if (visible) {
					world.add(root)
					if (weapon) world.add(weapon)
					if (nametag) world.add(nametag.node)
				} else {
					world.remove(root)
					if (weapon) world.remove(weapon)
					if (nametag) world.remove(nametag.node)
				}
			}
			if (delta.c !== undefined) {
				state.c = delta.c
				collision = delta.c
				if (capsule) {
					collision ? root.add(capsule) : root.remove(capsule)
				}
			}
			if (delta.h !== undefined) {
				state.h = delta.h
				nametag.setHealth(delta.h)
			}
			if (delta.p) {
				state.p = delta.p
				lerp.pos.target.fromArray(delta.p)
			}
			if (delta.q) {
				state.q = delta.q
				lerp.qua.target.fromArray(delta.q)
			}
			if (delta.e !== undefined) {
				state.e = delta.e
				avatar.setEmote(emoteUrls[delta.e])
			}
			if (snap) {
				lerp.pos.current.copy(lerp.pos.target)
				lerp.qua.current.copy(lerp.qua.target)
			}
		})
	}
}

// =======================================
// Utils
function isArrayEqual(arr1, arr2) {
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) {
			return false
		}
	}
	return true
}

// =======================================
// Damage parser 
// String format: min,max,crit_chance,crit_multiplier
// Returns a function that generates damage
function strToDamageFn(str) {
	try {
		const [min, max, critChance, critMultiplier] = str.split(',').map(parseFloat)
		return () => {
			let amount = num(min, max)
			const crit = num(0, 1, 1) < critChance / 100
			if (crit) amount *= critMultiplier
			return [amount, crit]
		}
	} catch (err) {
		return () => [0, false]
	}
}

// =======================================
// Healthbar (abstracted to be reused across multiple mobs)
function createNametag(name, health, maxHealth) {
	const width = 60
	const $ui = app.create('ui', {
		width,
		height: 100,
		billboard: 'full',
	})
	const $name = app.create('uitext', {
		value: name,
		color: 'white',
		textAlign: 'center',
		fontSize: 10,
		fontWeight: 600,
	})
	$ui.add($name)
	const $health = app.create('uiview', {
		margin: [2, 0, 0, 0],
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		height: 5,
		flexDirection: 'row',
		alignItems: 'stretch',
	})
	$ui.add($health)
	const $healthBar = app.create('uiview', {
		backgroundColor: 'green',
		width: (health / maxHealth) * width
	})
	$health.add($healthBar)
	return {
		node: $ui,
		setName(value) {
			$name.value = value
		},
		setHealth(value) {
			$healthBar.width = (value / maxHealth) * width
			// Change color based on health
			if (value / maxHealth > 0.6) {
				$healthBar.backgroundColor = 'green'
			} else if (value / maxHealth > 0.3) {
				$healthBar.backgroundColor = 'yellow'
			} else {
				$healthBar.backgroundColor = 'red'
			}
		}
	}
}

// =======================================
// Threat Tables
function createThreatTable() {
	const map = new Map() // playerId => threat
	const ignored = new Set()
	const target = { playerId: null, threat: 0 }
	const check = () => {
		target.playerId = null
		target.threat = 0
		for (const [playerId, threat] of map.entries()) {
			if (threat > target.threat) {
				target.playerId = playerId
				target.threat = threat
			}
		}
	}
	return {
		get target() {
			return target.playerId
		},
		inc(playerId, amount = 1) {
			if (!playerId) return
			if (amount <= 0) return
			let threat = map.get(playerId) || 0
			threat += amount
			map.set(playerId, threat)
			if (threat > target.threat) {
				target.playerId = playerId
				target.threat = threat
			} else {
				check()
			}
		},
		dec(playerId, amount = 1) {
			if (!playerId) return
			if (amount <= 0) return
			let threat = map.get(playerId) || 0
			threat -= amount
			if (threat > 0) {
				map.set(playerId, threat)
			} else {
				map.delete(playerId)
			}
			check()
		},
		clear(playerId) {
			if (!playerId) return
			if (!map.has(playerId)) return
			map.delete(playerId)
			check()
		},
		ignore(playerId, shouldIgnore) {
			shouldIgnore ? ignored.add(playerId) : ignored.delete(playerId)
		},
		reset() {
			map.clear()
			target.playerId = null
			target.threat = 0
		}
	}
}

// =======================================
// Aggro Sphere
function createAggroSphere(parent, radius) {
	const body = app.create('rigidbody')
	const collider = app.create('collider', {
		type: 'sphere',
		radius,
		trigger: true
	})
	body.add(collider)
	let onAggro
	return {
		watch(callback) {
			onAggro = callback
			body.onTriggerEnter = e => {
				const { playerId } = e
				if (!playerId) return
				let dead = false
				function onResponse(isDead) {
					dead = isDead
				}
				const responseId = mobId
				world.on(`elemental:dead_response:${responseId}`, onResponse)
				app.emit(`elemental:dead_request`, ['player', playerId, responseId])
				world.off(`elemental:dead_response:${responseId}`, onResponse)
				if (!dead) onAggro(playerId)
			}
			parent.add(body)
		},
		unwatch() {
			body.onTriggerEnter = null
			parent.remove(body)
		}
	}
}
