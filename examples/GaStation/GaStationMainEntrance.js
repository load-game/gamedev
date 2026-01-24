app.configure([
	{
		key: 'signalName',
		type: 'text',
		label: 'Signal Name',
		initial: 'Door:Open',
	},
	{
		key: 'animState',
		type: 'switch',
		label: 'Door State',
		options: [
			{ label: 'Open', value: 'Open' },
			{ label: 'Close', value: 'Close' },
			{ label: 'Opened', value: 'BigOpen' },
			{ label: 'Closed', value: 'Closed' },
		],
		initial: 'Closed'
	},
	{
		key: 'autoCloseDelay',
		type: 'number',
		label: 'Auto Close Delay (ms)',
		initial: 5000,
		min: 1000,
		max: 30000,
		step: 1000
	},
	{
		key: 'debug',
		type: 'toggle',
		label: 'Debug Mode',
		initial: false
	}
])
const rig = app.get('MainEntranceRig')
const col = app.get('hitboxCollider')
const anims = rig.anims
var isAnimating = false
var hasOpened = false
var animState = 'Closed'
var openTimerId = null
var shouldAutoClose = true
const debug = props.debug
const logDebug = msg => { if (debug) console.log(`[BIGDOOR DEBUG] ${msg}`) }

world.on(props.signalName, () => {
	openDoor()
})


function openDoor() {
	logDebug('openDoor() called')
	if (isAnimating || hasOpened) {
		logDebug(`openDoor() early return - isAnimating:${isAnimating}, hasOpened:${hasOpened}`)
		return
	}

	// Mark any previous auto-close timer as invalid
	if (openTimerId !== null) {
		logDebug(`Invalidating previous timer: ${openTimerId}`)
		openTimerId = null
	}

	shouldAutoClose = true
	isAnimating = true
	animState = 'Opening'
	rig.play({name: 'OPEN', loop: false, fade: 0.5})

	setTimeout(()=>{
		logDebug('Door opening animation complete')
		animState = 'Open'
		col.active = false
		rig.play({name:'OPENED', loop: false, fade: 0.5})
		isAnimating = false
		hasOpened = true

		// Set auto-close timer
		const currentTimerId = Math.random()
		openTimerId = currentTimerId
		logDebug(`Setting auto-close timer ${currentTimerId} for ${props.autoCloseDelay}ms`)

		setTimeout(()=>{
			// Only close if this timer is still valid and auto-close is enabled
			if (openTimerId === currentTimerId && shouldAutoClose) {
				logDebug(`Timer ${currentTimerId} is valid, closing door`)
				openTimerId = null
				closeDoor()
			} else {
				logDebug(`Timer ${currentTimerId} is invalid (openTimerId: ${openTimerId}, shouldAutoClose: ${shouldAutoClose}), skipping close`)
			}
		}, props.autoCloseDelay)
	}, 1000)
}

function closeDoor() {
	logDebug('closeDoor() called')
	if (isAnimating || !hasOpened) {
		logDebug(`closeDoor() early return - isAnimating:${isAnimating}, hasOpened:${hasOpened}`)
		return
	}

	// Mark auto-close as disabled to prevent race conditions
	shouldAutoClose = false

	// Invalidate any pending auto-close timer
	if (openTimerId !== null) {
		logDebug(`Invalidating auto-close timer: ${openTimerId}`)
		openTimerId = null
	}

	isAnimating = true
	animState = 'Closing'
	rig.play({name: 'CLOSE', loop: false, fade: 0.5})

	setTimeout(()=>{
		logDebug('Door closing animation complete')
		animState = 'Closed'
		col.active = true
		rig.play({name:'CLOSED', loop: false, fade: 0.5})
		isAnimating = false
		hasOpened = false
		logDebug('Door is now Closed')
	}, 1000)
}

app.cleanup = () => {
	// Invalidate any pending auto-close timer
	if (openTimerId !== null) {
		logDebug(`Invalidating auto-close timer on cleanup: ${openTimerId}`)
		openTimerId = null
	}
	shouldAutoClose = false
	logDebug('Cleanup completed')
}
