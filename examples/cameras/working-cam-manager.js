// Camera Control System - Advanced Implementation
// Multiple cameras with real-time settings adjustment

// Global variables for camera system
const cameras = []
let control = null
let currentCameraIndex = 0
let settingsUI = null
let managementUI = null

// Camera presets
const cameraPresets = [
	{
		name: 'Cinematic Wide',
		position: [8, 3, 8],
		rotation: [-0.2, 0.785, 0],
		fov: 35,
		freeFlying: false,
		dof: { enabled: true, fStop: 1.4, focusDistance: 10, maxBlur: 0.05 },
		motion: { enabled: true, bobAmount: 0.003, swayAmount: 0.002 },
		color: '#ff6b6b'
	},
	{
		name: 'Close-up Portrait',
		position: [2, 1.5, 2],
		rotation: [-0.1, 0.5, 0],
		fov: 85,
		freeFlying: false,
		dof: { enabled: true, fStop: 0.8, focusDistance: 3, maxBlur: 0.08 },
		motion: { enabled: false },
		color: '#4ecdc4'
	},
	{
		name: 'Free-Flying Spectator',
		position: [5, 5, 5],
		rotation: [-0.5, 0.785, 0],
		fov: 75,
		freeFlying: true,
		flySpeed: 8,
		flyBoostMultiplier: 3,
		lookSensitivity: 0.003,
		smoothMovement: true,
		dof: { enabled: false },
		motion: { enabled: false },
		color: '#9b59b6'
	},
	{
		name: 'Action Cam',
		position: [0, 0.5, 1],
		rotation: [0, 0, 0],
		fov: 120,
		freeFlying: false,
		dof: { enabled: false },
		motion: { enabled: true, bobAmount: 0.01, swayAmount: 0.005, handheldShake: 0.002 },
		color: '#45b7d1'
	},
	{
		name: 'Surveillance',
		position: [0, 8, 0],
		rotation: [-Math.PI / 2, 0, 0],
		fov: 60,
		freeFlying: false,
		dof: { enabled: false },
		motion: { enabled: false },
		color: '#96ceb4'
	}
]

// Function to add a new camera
function addNewCamera() {
	if (!world.isClient || !control || !control.camera) return

	const playerPos = control.camera.position
	const newIndex = cameras.length

	// Create a new camera preset
	const newPreset = {
		name: `Custom Camera ${newIndex + 1}`,
		position: [playerPos.x + 5, playerPos.y + 2, playerPos.z + 5],
		rotation: [-0.2, 0.5, 0],
		fov: props.cameraFOV || 50,
		freeFlying: false,  // New cameras are static by default
		dof: {
			enabled: props.enableDOF,
			fStop: 2.8,
			focusDistance: 10,
			maxBlur: 0.03
		},
		motion: {
			enabled: props.enableMotion,
			bobAmount: 0.002,
			swayAmount: 0.001
		},
		color: `hsl(${newIndex * 90}, 70%, 60%)` // Different color for each camera
	}

	// Add to presets array
	cameraPresets.push(newPreset)

	// Create the camera
	const worldPos = [
		playerPos.x + newPreset.position[0],
		playerPos.y + newPreset.position[1],
		playerPos.z + newPreset.position[2]
	]

	const camera = app.create('camera', {
		name: `camera-${newIndex}`,
		position: worldPos,
		rotation: newPreset.rotation,
		active: true,
		autoActivate: false,
		attachToRig: false,
		isPlayerCamera: false,
		showHelper: true,
		helperScale: 0.25,

		// Free-flying settings
		freeFlying: newPreset.freeFlying || false,
		flySpeed: newPreset.flySpeed || 5,
		flyBoostMultiplier: newPreset.flyBoostMultiplier || 3,
		lookSensitivity: newPreset.lookSensitivity || 0.003,
		smoothMovement: newPreset.smoothMovement !== false,

		fov: newPreset.fov,
		near: 0.1,
		far: 2000,

		motion: {
			enabled: newPreset.motion.enabled,
			bobAmount: newPreset.motion.bobAmount,
			bobSpeed: 0.02,
			swayAmount: newPreset.swayAmount,
			swaySpeed: 0.01,
			dampingFactor: 0.98
		},

		dof: {
			enabled: newPreset.dof.enabled,
			fStop: newPreset.dof.fStop,
			focusDistance: newPreset.dof.focusDistance,
			maxBlur: newPreset.dof.maxBlur,
			autofocus: true
		},

		bloom: { enabled: false, intensity: 0.5 },
		vignette: { enabled: false, offset: 0.35, darkness: 0.4 },
		filmGrain: { enabled: false, intensity: 0.25 }
	})

	cameras.push(camera)
	app.add(camera)

	// Debug: Check if camera helper was created
	console.log(`[Camera] Added new camera:`, {
		name: newPreset.name,
		hasHelper: !!camera.cameraHelper,
		helperVisible: camera.cameraHelper?.visible,
		showHelper: camera.data?.showHelper
	})

	// Update UI
	if (managementUI && managementUI.countInfo) {
		managementUI.countInfo.value = `Cameras: ${cameras.length}`
	}

	console.log(`[Camera] Added new camera: ${newPreset.name}`)
}

// Function to remove current camera
function removeCurrentCamera() {
	if (!world.isClient || cameras.length <= 1) {
		console.log('[Camera] Cannot remove the last camera')
		return
	}

	const cameraToRemove = cameras[currentCameraIndex]

	// Remove from app
	app.remove(cameraToRemove)

	// Remove from arrays
	cameras.splice(currentCameraIndex, 1)
	cameraPresets.splice(currentCameraIndex, 1)

	// Adjust current index if needed
	if (currentCameraIndex >= cameras.length) {
		currentCameraIndex = cameras.length - 1
	}

	// Activate the new current camera
	if (cameras[currentCameraIndex]) {
		cameras[currentCameraIndex].active = true
	}

	// Update UI
	if (managementUI && managementUI.countInfo) {
		managementUI.countInfo.value = `Cameras: ${cameras.length}`
	}
	if (settingsUI && settingsUI.currentInfo) {
		settingsUI.currentInfo.value = `Current: ${cameraPresets[currentCameraIndex].name}`
	}

	console.log(`[Camera] Removed camera, now using: ${cameraPresets[currentCameraIndex].name}`)
}

// Function to switch to a specific camera preset
function switchCamera(index) {
	if (index < 0 || index >= cameras.length) return

	// Set render camera via CameraManager (keep nodes mounted)
	currentCameraIndex = index
	cameras[currentCameraIndex]?.activate?.()

	// Update UI
	if (settingsUI && settingsUI.currentInfo) {
		settingsUI.currentInfo.value = `Current: ${cameraPresets[currentCameraIndex].name}`
	}

	console.log(`[Camera] Switched to: ${cameraPresets[currentCameraIndex].name}`)
}



// Function to ensure camera helpers are visible
function ensureCameraHelpersVisible() {
	if (!world.isClient) return

	console.log(`[Camera] Ensuring camera helpers are visible - showHelpers:`, props.showHelpers)

	cameras.forEach((camera, index) => {
		if (camera && camera.camera) {
			// Always create a helper if it doesn't exist
			if (!camera.cameraHelper) {
				console.log(`[Camera] Creating CameraHelper for camera ${index}`)
				try {
					camera.cameraHelper = new THREE.CameraHelper(camera.camera)
					console.log(`[Camera] Created CameraHelper for camera ${index}`)
				} catch (error) {
					console.error(`[Camera] Failed to create CameraHelper for camera ${index}:`, error)
					return
				}
			}

			// Try to add to scene if not already added
			if (camera.cameraHelper && !camera.cameraHelper.parent) {
				console.log(`[Camera] Adding CameraHelper to scene for camera ${index}`)

				// Try multiple ways to add to scene
				let added = false

				// Method 1: Try camera's context scene
				if (camera.ctx?.world?.stage?.scene) {
					camera.ctx.world.stage.scene.add(camera.cameraHelper)
					added = true
					console.log(`[Camera] Added helper to camera context scene for camera ${index}`)
				}

				// Method 2: Try to find world scene through app
				if (!added && app.ctx?.world?.stage?.scene) {
					app.ctx.world.stage.scene.add(camera.cameraHelper)
					added = true
					console.log(`[Camera] Added helper to app context scene for camera ${index}`)
				}

				if (!added) {
					console.log(`[Camera] Could not find scene to add helper for camera ${index}`)
				}
			}

			// Set visibility based on props
			if (camera.cameraHelper) {
				camera.cameraHelper.visible = props.showHelpers !== false
				console.log(`[Camera] Set CameraHelper visibility for camera ${index}:`, camera.cameraHelper.visible)
			}
		}
	})
}

// Configure app with UI options
app.configure([
	{
		type: 'section',
		key: 'cameraControls',
		label: 'Camera Controls'
	},
	{
		type: 'toggle',
		key: 'enableMotion',
		label: 'Enable Motion',
		initial: true,
		trueLabel: 'On',
		falseLabel: 'Off'
	},
	{
		type: 'toggle',
		key: 'enableDOF',
		label: 'Enable Depth of Field',
		initial: true,
		trueLabel: 'On',
		falseLabel: 'Off'
	},
	{
		type: 'number',
		key: 'cameraFOV',
		label: 'Camera FOV',
		min: 10,
		max: 120,
		step: 5,
		initial: 50
	},
	{
		type: 'toggle',
		key: 'showHelpers',
		label: 'Show Camera Helpers',
		initial: true,
		trueLabel: 'Show',
		falseLabel: 'Hide'
	},
	{
		type: 'section',
		key: 'cameraManagement',
		label: 'Camera Management'
	},
	{
		type: 'toggle',
		key: 'showUI',
		label: 'Show Control UI',
		initial: true,
		trueLabel: 'Show',
		falseLabel: 'Hide'
	},
	{
		type: 'section',
		key: 'cameraActions',
		label: 'Camera Actions'
	},
	{
		type: 'button',
		key: 'addCamera',
		label: 'Add New Camera',
		onClick: () => {
			addNewCamera()
		}
	},
	{
		type: 'button',
		key: 'removeCamera',
		label: 'Remove Current Camera',
		onClick: () => {
			removeCurrentCamera()
		}
	},
	{
		type: 'button',
		key: 'fixHelpers',
		label: 'Fix Camera Helpers',
		onClick: () => {
			if (world.isClient) {
				ensureCameraHelpersVisible()
			}
		}
	}
])

if (world.isClient) {
	console.log('[Camera] Starting advanced camera control system...')

	// Keep app active
	app.keepActive = true

	// Initialize on first update
	let initialized = false

	app.on('update', () => {
		if (!initialized) {
			// Get control interface
			control = app.control()
			if (!control || !control.camera) {
				console.warn('[Camera] Waiting for control interface...')
				return
			}

			console.log('[Camera] Control acquired')

			// Get player position
			const playerPos = control.camera.position
			console.log('[Camera] Player position:', playerPos)

			// Create all camera presets
			createCameraPresets(playerPos)

			// Ensure camera helpers are visible
			setTimeout(() => {
				ensureCameraHelpersVisible()
			}, 100) // Small delay to ensure cameras are fully mounted

			// Create UI for camera controls
			createSettingsUI()

			// Create management UI with buttons
			createManagementUI()

			// Listen for configuration changes
			app.on('config', () => {
				updateFromConfig()
			})

			// Capture keys
			if (control.keyC) control.keyC.capture = true
			if (control.bracketLeft) control.bracketLeft.capture = true  // [
			if (control.bracketRight) control.bracketRight.capture = true  // ]
			if (control.keyF) control.keyF.capture = true
			if (control.keyG) control.keyG.capture = true
			if (control.keyH) control.keyH.capture = true

			initialized = true
			console.log('[Camera] Setup complete!')
			console.log('Controls:')
			console.log('  C - Toggle current camera')
			console.log('  [ ] - Cycle camera presets')
			console.log('  F - Toggle DOF')
			console.log('  G - Toggle motion')
			console.log('  H - Toggle UI')
			console.log('')
			console.log('Free-Flying Camera Controls:')
			console.log('  WASD - Move horizontally')
			console.log('  Q/Space - Move up')
			console.log('  E - Move down')
			console.log('  Shift - Speed boost')
			console.log('  Mouse - Look around')
		}

		// Handle key presses
		if (initialized && control) {
			if (control.keyC && control.keyC.pressed) {
				toggleCurrentCamera()
			}
			if (control.bracketLeft && control.bracketLeft.pressed) {
				cycleCamera(-1) // Previous camera
			}
			if (control.bracketRight && control.bracketRight.pressed) {
				cycleCamera(1) // Next camera
			}
			if (control.keyF && control.keyF.pressed) toggleDOF()
			if (control.keyG && control.keyG.pressed) toggleMotion()
			if (control.keyH && control.keyH.pressed) toggleUI()

			// Escape back to default camera
			if (control.escape && control.escape.pressed) {
				world.activateDefaultCamera?.()
			}
		}
	})

	// Create all camera presets
	function createCameraPresets(playerPos) {
		cameraPresets.forEach((preset, index) => {
			// Calculate world position relative to player
			const worldPos = [
				playerPos.x + preset.position[0],
				playerPos.y + preset.position[1],
				playerPos.z + preset.position[2]
			]

			// Create camera
			const camera = app.create('camera', {
				name: `camera-${index}`,
				position: worldPos,
				rotation: preset.rotation,
				active: true,
				autoActivate: false,
				attachToRig: false,
				isPlayerCamera: false,
				showHelper: true,
				helperScale: 0.25,

				// Free-flying settings
				freeFlying: preset.freeFlying || false,
				flySpeed: preset.flySpeed || 5,
				flyBoostMultiplier: preset.flyBoostMultiplier || 3,
				lookSensitivity: preset.lookSensitivity || 0.003,
				smoothMovement: preset.smoothMovement !== false,

				fov: preset.fov,
				near: 0.1,
				far: 2000,

				motion: {
					enabled: preset.motion.enabled,
					bobAmount: preset.motion.bobAmount || 0.002,
					bobSpeed: 0.02,
					swayAmount: preset.motion.swayAmount || 0.001,
					swaySpeed: 0.01,
					dampingFactor: 0.98,
					handheldShake: preset.motion.handheldShake || 0
				},

				dof: {
					enabled: preset.dof.enabled,
					fStop: preset.dof.fStop || 2.8,
					focusDistance: preset.dof.focusDistance || 10,
					maxBlur: preset.dof.maxBlur || 0.03,
					autofocus: true
				},

				bloom: { enabled: false, intensity: 0.5 },
				vignette: { enabled: false, offset: 0.35, darkness: 0.4 },
				filmGrain: { enabled: false, intensity: 0.25 }
			})

			cameras.push(camera)
			app.add(camera)

			// Debug: Check if camera helper was created
			console.log(`[Camera] Created camera ${index}:`, {
				name: camera.name,
				hasHelper: !!camera.cameraHelper,
				helperVisible: camera.cameraHelper?.visible,
				showHelper: camera.data?.showHelper
			})
		})

		console.log(`[Camera] Created ${cameras.length} camera presets`)
	}

	// Create settings UI
	function createSettingsUI() {
		settingsUI = app.create('ui', {
			width: 400,
			height: 300,
			backgroundColor: 'rgba(0, 15, 30, 0.9)',
			borderRadius: 15,
			padding: 20,
			billboard: 'full',
			pivot: 'top-left',
			position: [2, 3, 0],
			size: 0.003,
			active: props.showUI
		})

		// Title
		const title = app.create('uitext', {
			value: 'CAMERA CONTROLS',
			color: '#00ffaa',
			fontSize: 20,
			fontWeight: 'bold',
			textAlign: 'center',
			marginBottom: 15
		})

		// Current camera info
		const currentInfo = app.create('uitext', {
			value: `Current: ${cameraPresets[currentCameraIndex].name}`,
			color: '#ffffff',
			fontSize: 16,
			marginBottom: 10
		})

		// Controls list
		const controls = app.create('uitext', {
			value: `C - Toggle Camera
[ ] - Cycle Presets
F - Toggle DOF
G - Toggle Motion
H - Toggle UI

Free-Flying Cam:
WASD - Move
Q/Space - Up
E - Down
Shift - Boost
Mouse - Look`,
			color: '#cccccc',
			fontSize: 14,
			lineHeight: 1.4
		})

		settingsUI.add(title)
		settingsUI.add(currentInfo)
		settingsUI.add(controls)

		app.add(settingsUI)

		// Store reference for updates
		settingsUI.currentInfo = currentInfo
	}

	// Create management UI with buttons
	function createManagementUI() {
		managementUI = app.create('ui', {
			width: 350,
			height: 200,
			backgroundColor: 'rgba(15, 0, 30, 0.9)',
			borderRadius: 15,
			padding: 20,
			billboard: 'full',
			pivot: 'top-right',
			position: [-2, 3, 0],
			size: 0.003,
			active: true
		})

		// Title
		const title = app.create('uitext', {
			value: 'CAMERA MANAGEMENT',
			color: '#ff6b6b',
			fontSize: 18,
			fontWeight: 'bold',
			textAlign: 'center',
			marginBottom: 15
		})

		// Add camera button
		const addButton = app.create('uitext', {
			value: '[ + ADD CAMERA ]',
			color: '#4ecdc4',
			fontSize: 16,
			fontWeight: 'bold',
			backgroundColor: 'rgba(0, 0, 0, 0.3)',
			padding: 10,
			borderRadius: 8,
			textAlign: 'center',
			marginBottom: 10
		})

		// Remove camera button
		const removeButton = app.create('uitext', {
			value: '[ - REMOVE CAMERA ]',
			color: '#ff6b6b',
			fontSize: 16,
			fontWeight: 'bold',
			backgroundColor: 'rgba(0, 0, 0, 0.3)',
			padding: 10,
			borderRadius: 8,
			textAlign: 'center',
			marginBottom: 10
		})

		// Camera count info
		const countInfo = app.create('uitext', {
			value: `Cameras: ${cameras.length}`,
			color: '#ffffff',
			fontSize: 14,
			textAlign: 'center'
		})

		// Button interactions
		addButton.onPointerDown = () => {
			addButton.color = '#ffffff'
		}
		addButton.onPointerUp = () => {
			addButton.color = '#4ecdc4'
			addNewCamera()
		}

		removeButton.onPointerDown = () => {
			removeButton.color = '#ffffff'
		}
		removeButton.onPointerUp = () => {
			removeButton.color = '#ff6b6b'
			removeCurrentCamera()
		}

		managementUI.add(title)
		managementUI.add(addButton)
		managementUI.add(removeButton)
		managementUI.add(countInfo)

		app.add(managementUI)

		// Store references for updates
		managementUI.countInfo = countInfo
		managementUI.addButton = addButton
		managementUI.removeButton = removeButton
	}

	// Switch to a specific camera preset
	function switchCamera(index) {
		if (index < 0 || index >= cameras.length) return

		// Set render camera via CameraManager (keep nodes mounted)
		currentCameraIndex = index
		const cam = cameras[currentCameraIndex]
		if (cam) {
			// Ensure registered then activate via manager to avoid unmounts
			world.setActiveCameraById?.(cam.id) || cam.activate?.()
		}

		// Update UI
		if (settingsUI && settingsUI.currentInfo) {
			settingsUI.currentInfo.value = `Current: ${cameraPresets[currentCameraIndex].name}`
		}

		console.log(`[Camera] Switched to: ${cameraPresets[currentCameraIndex].name}`)
		// Normalize default camera look when switching away
		if (!cam) return
	}

	// Cycle through cameras (direction: -1 for previous, 1 for next)
	function cycleCamera(direction) {
		let newIndex = currentCameraIndex + direction

		// Wrap around
		if (newIndex < 0) {
			newIndex = cameras.length - 1
		} else if (newIndex >= cameras.length) {
			newIndex = 0
		}

		switchCamera(newIndex)
	}

	// Toggle current camera on/off
	function toggleCurrentCamera() {
		const cam = cameras[currentCameraIndex]
		if (!cam) return
		const isActive = world.cameraManager?.activeCamera?.id === cam.id
		if (isActive) {
			// Go back to default camera through world method (added for reliability)
			if (!world.activateDefaultCamera?.()) {
				const fb = world.defaultCameraNode || world.cameraManager?.defaultCamera
				if (fb) world.cameraManager.setActiveCamera(fb)
			}
			restoreDefaultCameraLook()
			console.log(`[Camera] ${cameraPresets[currentCameraIndex].name}: DEACTIVATED`)
		} else {
			// Ensure this node is registered and then activate
			cam.activate?.()
			// If still not active, try explicit setActive by id
			if (world.cameraManager?.activeCamera?.id !== cam.id) {
				world.setActiveCameraById?.(cam.id)
			}
			console.log(`[Camera] ${cameraPresets[currentCameraIndex].name}: ACTIVATED`)
		}
	}

	// Ensure returning to default camera looks the same every time
	function restoreDefaultCameraLook() {
		try {
			world.prefs?.setDOFEnabled(false)
			world.prefs?.setDOFBokehScale(1)
			world.prefs?.setDOFFocusDistance(10)
			world.prefs?.setDOFFocusRange(5)
			world.prefs?.setFocalLength(24)
			if (world.camera) {
				world.camera.near = 0.2
				world.camera.far = 1200
				world.camera.updateProjectionMatrix()
			}
		} catch (_) { }
	}

	// Toggle DOF on current camera
	function toggleDOF() {
		if (!cameras[currentCameraIndex]) return

		const camera = cameras[currentCameraIndex]
		camera.dof.enabled = !camera.dof.enabled

		console.log(`[Camera] DOF ${camera.dof.enabled ? 'ENABLED' : 'DISABLED'} on ${cameraPresets[currentCameraIndex].name}`)
	}

	// Toggle motion on current camera
	function toggleMotion() {
		if (!cameras[currentCameraIndex]) return

		const camera = cameras[currentCameraIndex]
		camera.motion.enabled = !camera.motion.enabled

		console.log(`[Camera] Motion ${camera.motion.enabled ? 'ENABLED' : 'DISABLED'} on ${cameraPresets[currentCameraIndex].name}`)
	}

	// Toggle UI visibility
	function toggleUI() {
		if (settingsUI) {
			settingsUI.active = !settingsUI.active
			console.log(`[Camera] UI ${settingsUI.active ? 'SHOWN' : 'HIDDEN'}`)
		}
	}





	// Update cameras from configuration
	function updateFromConfig() {
		// Update UI visibility
		if (settingsUI) {
			settingsUI.active = props.showUI
		}

		// Handle camera helper visibility (THREE.js CameraHelper)
		console.log(`[Camera] Config change - showHelpers:`, props.showHelpers)

		// Always ensure helpers reflect the showHelpers preference
		cameras.forEach((cam) => {
			if (cam && cam._ref) {
				cam._ref.data = cam._ref.data || {}
				cam._ref.data.showHelper = props.showHelpers === true
			}
		})
		ensureCameraHelpersVisible()

		// Update all cameras with new settings
		cameras.forEach((camera, index) => {
			if (camera) {
				// Update FOV
				camera.fov = props.cameraFOV || 50
				if (camera.camera) {
					camera.camera.fov = camera.fov
					camera.camera.updateProjectionMatrix()
				}

				// Update motion
				camera.motion.enabled = props.enableMotion

				// Update DOF
				camera.dof.enabled = props.enableDOF
			}
		})

		console.log('[Camera] Updated all cameras from configuration')
	}

	console.log('[Camera] Advanced camera control system loaded')
}