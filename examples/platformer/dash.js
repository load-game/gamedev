// =================================================================
// Place your rom scrip below:
// =================================================================



// =================================================================
// Config
// =================================================================
app.configure([
	{
		key: 'rName',
		type: 'text',
		label: 'Rom Name',
	},
	{
		key: 'color',
		type: 'dropdown',
		label: 'Color',
		options: [
			{
				label: 'Red',
				value: '0.0957',
			},
			{
				label: 'Orange',
				value: '0',
			},
			{
				label: 'Yellow',
				value: '0.4824',
			},
			{
				label: 'Green',
				value: '0.2633',
			},
			{
				label: 'Blue',
				value: '0.389',
			},
			{
				label: 'Indigo',
				value: '0.1777',
			},
			{
				label: 'Violet',
				value: '0.5098',
			},
		],
		initial: '0',
	},
	{
		key: 'chargeEmote',
		type: 'file',
		kind: 'emote',
		label: 'Charge Emote',
	},
]);

const CLASS_NAME = 'Vanguard'
const DEBUG_PLAYER = null // 'NXaaL9PrK5'
const DEBUG_HITS = false
const FORWARD = new Vector3(0, 0, -1)

const ENERGY_RATE = 1
const ENERGY_RATE_AMOUNT = 10
const ENERGY_MAX = 100

const ATTACK_RADIUS = 1
const ATTACK_DISTANCE = 1

const SPECIAL_RADIUS = 2.5

const chargeEmote = props.chargeEmote?.url + '?l=0'

const v1 = new Vector3()
const q1 = new Quaternion()
const e1 = new Euler(0, 0, 0, 'YXZ')


if (world.isClient) {
	const player = world.getPlayer()
	let control = app.control()
	let canDash = true;

	function getDirection(vec3) {
		e1.setFromQuaternion(control.camera.quaternion)
		e1.x = 0
		e1.z = 0
		q1.setFromEuler(e1)
		const dir = vec3.copy(FORWARD).applyQuaternion(q1)
		return dir
	}

	function charge() {
		if (player.hasEffect()) return
		if (!canDash) return
		canDash = false

		const dir = getDirection(v1)
		const force = dir.multiplyScalar(30)
		player.push(force)
		player.applyEffect({
			emote: chargeEmote,
			turn: true,
			duration: 0.4,
			onEnd: () => {
				canDash = true
			}
		})
	}

	app.on('update', delta => {
		if (control.keyF.pressed) {
			charge()
		}
	})
}


// =================================================================
// UI
// =================================================================
const ui = app.create('ui')
ui.rotation.y = 180 * DEG2RAD
ui.position.z = -0.12
ui.position.y = -0.46
ui.width = 20
const romName = app.create('uitext')
romName.fontSize = 4
romName.textAlign = 'center'
romName.color = '#000000'
romName.value = props.rName
romName.backgroundColor = '#ffffff'
romName.fontFamily = 'Arial Black'
const mesh = app.get('hyper-rom-orange_mesh')
const mat = mesh.material
// handle y color cases
if (props.color == 0.1777) {
	// indigo
	mat.textureY = 0.0684
} else if (props.color == 0.0957) {
	// red
	mat.textureY = -0.0645
} else if (props.color == 0.2633) {
	// green
	mat.textureY = -0.1772
} else {
	mat.textureY = 0
}
mat.textureX = props.color
// execute
ui.add(romName)
app.add(ui)
