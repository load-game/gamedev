const block = app.get('Block')
app.remove(block)

const RANGE = 200
const SPEED = 100
const DOWN = new Vector3(0, -1, 0)
const MAX_PER_SECOND = 3
const MAX_ANGLE_OFFSET = 25
const v1 = new Vector3()
const v2 = new Vector3()

if (world.isServer) {
	let available = MAX_PER_SECOND
	let replenishTime = 0
	app.on('update', delta => {
		replenishTime += delta
		if (replenishTime > 1) {
			available = MAX_PER_SECOND
			replenishTime = 0
		}
		if (!available) return
		const spawn = num(1, 100) > 70
		if (!spawn) return
		available--
		const item = {}
		item.start = [
			num(-RANGE, RANGE, 2),
			200,
			num(-RANGE, RANGE, 2)
		]
		const angleX = num(-MAX_ANGLE_OFFSET, MAX_ANGLE_OFFSET) * DEG2RAD
		const angleZ = num(-MAX_ANGLE_OFFSET, MAX_ANGLE_OFFSET) * DEG2RAD
		item.direction = [
			Math.sin(angleX),
			-Math.cos(angleX) * Math.cos(angleZ),
			Math.sin(angleZ)
		]
		v1.fromArray(item.start)
		v2.fromArray(item.direction).normalize()
		const hit = world.raycast(v1, v2)
		item.distance = hit ? hit.distance : item.start[1] * 2
		app.send('item', item)
	})
}

if (world.isClient) {
	const items = new Set()
	app.on('item', item => {
		console.log('item')
		item.trail = app.create('particles', {
			shape: ['sphere', 0.5, 1],
			direction: 1,
			rate: 0,
			color: 'orange',
			rateOverDistance: 10,
			life: '0~1',
			size: '0.1~0.5',
			alphaOverLife: '0,1|1,0',
			emissive: '10'
		})
		item.trail.position.fromArray(item.start)
		item.direction = new Vector3().fromArray(item.direction)
		item.travel = 0
		item.phase = 'fall'
		items.add(item)
		world.add(item.trail)
	})
	app.on('update', delta => {
		for (const item of items) {
			if (item.phase === 'fall') {
				const distance = SPEED * delta
				v1.copy(item.direction).multiplyScalar(distance)
				item.trail.position.add(v1)
				item.trail.rotation.y += 45 * DEG2RAD * delta
				item.travel += distance
				if (item.travel >= item.distance) {
					item.phase = 'hit'
					item.timer = 0
					item.explosion = app.create('particles', {
						shape: ['sphere', 0.5, 1],
						direction: 1,
						rate: 0,
						max: 200,
						bursts: [
							{ time: 0, count: 200 }
						],
						color: 'orange',
						size: '0.1~0.5',
						alphaOverLife: '0,1|1,0',
						emissive: '10',
						speed: '4~10',
						force: new Vector3(0, -20, 0)
					})
					item.explosion.position.copy(item.trail.position)
					world.add(item.explosion)
				}
			}
			if (item.phase === 'hit') {
				item.timer += delta
				if (item.timer > 3) {
					world.remove(item.trail)
					world.remove(item.explosion)
					items.delete(item)
				}
			}
		}
	})
}