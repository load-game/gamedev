const NUM_EMOTES = 6

const fields = [
	{
		key: 'icon',
		type: 'image',
		label: 'Button Icon',
		// hidden: true,
	},
	{
		key: 'hide',
		type: 'toggle',
		label: 'Hide',
	}
]

for (let i = 0; i < NUM_EMOTES; i++) {
	fields.push({
		key: `section${i}`,
		type: 'section',
		label: `Emote`
	})
	fields.push({
		key: `emote${i}`,
		type: 'emote',
		label: `File`
	})
	fields.push({
		key: `label${i}`,
		type: 'text',
		label: `Label`
	})
	fields.push({
		key: `icon${i}`,
		type: 'image',
		label: `Icon`
	})
	fields.push({
		key: `gaze${i}`,
		type: 'toggle',
		label: `Gaze`
	})
}

app.configure(fields)

if (config.hide) {
	const block = app.get('Block')
	app.remove(block)
}

const btn = app.create('ui', {
	space: 'screen',
	width: 50,
	height: 50,
	backgroundColor: 'rgba(0, 0, 0, 0.3)',
	borderRadius: 25,
	pivot: 'bottom-right',
	position: [1, 1],
	offset: [-30, -120],
	cursor: 'pointer',
	onPointerDown: toggle,
	alignItems: 'center',
	justifyContent: 'center',
})
const icon = app.create('uiimage', {
	width: 20,
	height: 20,
	src: config.icon?.url,
})
btn.add(icon)
const hotkey = app.create('uitext', {
	value: 'G',
	absolute: true,
	bottom: 10,
	right: 10,
	color: 'rgba(255, 255, 255, 0.7)',
	fontSize: 10,
	fontWeight: 500,
})
// todo: only add if not touch device
// btn.add(hotkey)
app.add(btn)

let close
let control

if (world.isClient) {
	control = app.control()
	control.keyG.onPress = toggle
}

function toggle() {
	close ? close() : open()
}

function open() {
	const player = world.getPlayer()
	// Use smaller size for mobile-friendly menu (240px for better mobile fit)
	// Original was 330px which is too large for mobile
	const uiSize = 240
	const itemSize = 60 // Smaller buttons for mobile (60/240 ≈ 90/330)
	const radius = (uiSize / 2) - (itemSize / 2)
	const centerX = uiSize / 2
	const centerY = uiSize / 2
	// create container
	const ui = app.create('ui', {
		space: 'screen',
		width: uiSize,
		height: uiSize,
		pivot: 'center',
		position: [0.5, 0.5],
		// backgroundColor: 'red',
	})
	app.add(ui)
	// gather available (configured) emotes
	const items = []
	for (let i = 0; i < NUM_EMOTES; i++) {
		const num = i + 1
		const labelStr = config[`label${i}`] || ''
		const iconUrl = config[`icon${i}`]?.url
		let emoteUrl = config[`emote${i}`]?.url
		const gaze = config[`gaze${i}`]
		if (gaze) emoteUrl += `?g=1`
		if (emoteUrl) {
			const exec = () => {
				player.applyEffect({ emote: emoteUrl, cancellable: true })
				close(true)
			}
			const item = app.create('uiview', {
				width: itemSize,
				height: itemSize,
				backgroundColor: 'rgba(11, 10, 21, 0.9)',
				borderRadius: 8, // Scaled from 12 (8/60 ≈ 12/90)
				absolute: true,
				top: 0,
				left: 0,
				cursor: 'pointer',
				onPointerDown: exec,
				flexDirection: 'column',
				alignItems: 'stretch',
			})
			if (iconUrl) {
				const icon = app.create('uiimage', {
					src: iconUrl,
					width: itemSize,
					height: itemSize,
				})
				item.add(icon)
			} else {
				const outer = app.create('uiview', {
					height: itemSize,
					width: itemSize,
					justifyContent: 'center'
				})
				item.add(outer)
				const label = app.create('uitext', {
					value: labelStr || 'Unknown',
					color: 'white',
					fontSize: 10, // Scaled from 14 (10/60 ≈ 14/90)
					fontWeight: 500,
					lineHeight: 1.6,
					textAlign: 'center',
				})
				outer.add(label)
			}
			const hotkey = app.create('uitext', {
				absolute: true,
				top: 5, // Scaled from 8 (5/60 ≈ 8/90)
				left: 5, // Scaled from 8 (5/60 ≈ 8/90)
				value: num,
				color: 'rgba(255, 255, 255, 0.7)',
				fontSize: 8, // Scaled from 10 (8/60 ≈ 10/90)
				fontWeight: 500,
			})
			item.add(hotkey)
			items.push(item)
			// bind key
			control[`digit${num}`].onPress = exec
		}
	}
	// distribute items in a perfect circle
	for (let i = 0; i < items.length; i++) {
		const item = items[i]
		const angle = (i / items.length) * 2 * Math.PI - Math.PI / 2 // start from top
		// calc position on circle
		const x = centerX + radius * Math.cos(angle)
		const y = centerY + radius * Math.sin(angle)
		// center button on calculated point
		item.left = x - (itemSize / 2)
		item.top = y - (itemSize / 2)
		ui.add(item)
	}
	// unlock pointer
	control.pointer.unlock()
	// darken main btn
	btn.backgroundColor = 'rgba(11, 10, 21, 0.9)'
	// when pointer locks again, close
	const update = () => {
		if (control.pointer.locked) {
			close()
		}
	}
	app.on('update', update)
	// bind close
	close = (lockPointer) => {
		app.off('update', update)
		app.remove(ui)
		btn.backgroundColor = 'rgba(0, 0, 0, 0.3)'
		for (let i = 0; i < items.length; i++) {
			const num = i + 1
			control[`digit${num}`].onPress = null
		}
		if (lockPointer) control.pointer.lock()
		close = null
	}
}