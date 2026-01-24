// Configuration for the app
app.configure([
  {
    key: 'visibility',
    type: 'switch',
    label: 'Visibility',
    hint: 'Whether the block is visible in the world',
    options: [
      { label: 'Visible', value: 'visible', hint: 'block is visible' },
      { label: 'Invisible', value: 'invisible', hint: 'block is hidden' },
    ],
    initial: 'visible',
  },
  {
    key: 'location',
    type: 'text',
    label: 'Place',
    hint: 'The command players will type to teleport here (e.g., "spawn", "home")',
    initial: 'place',
    placeholder: 'Enter command name (without slash)',
  },
  {
    key: 'color',
    type: 'text',
    label: 'Color',
    hint: 'The base color of the material. Can be set using any valid CSS color string (e.g. "red", "#ff0000", "rgb(255,0,0)").',
    initial: 'place',
    placeholder: 'white',
  },
])

app.keepActive = true

// SkinnedMesh
let rig, anims, posText, rotText, uiTitle
rig = app.get('PlaceRig')
anims = rig.anims
rig.play({ name: 'PlaceSpin', loop: true, fade: 0 })
// Toggle visibility of block model
const blockPlace = app.get('PlaceHit')
blockPlace.castShadow = false
blockPlace.recieveShadow = false
if (props.visibility === 'invisible') {
  blockPlace.active = false
  rig.active = false
}
// Conditionally create UI based on visibility setting
if (props.visibility === 'visible') {
  // Create UI container
  const ui = app.create('ui', {
    width: 250,
    height: 100,
    backgroundColor: 'rgba(0,15,30,0.9)',
    borderRadius: 8,
    padding: 5,
    justifyContent: 'center',
    gap: 7,
    alignItems: 'center',
  })
  ui.billboard = 'y' // Face camera on Y-axis
  ui.position.set(0, 0.5, 0) // 1.5 units above app

  // Create position display text
  posText = app.create('uitext', {
    value: `X: 0.00\nY: 0.00\nZ: 0.00`, // Initial value, multi-line
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'left',
  })

  // Create rotation display text
  rotText = app.create('uitext', {
    value: `RX: 0.00, RY: 0.00, RZ: 0.00`,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'left',
  })

  // Create instance ID display text
  uiTitle = app.create('uitext', {
    value: props.location,
    color: '#cccccc',
    textAlign: 'center',
    padding: 6,
  })

  // Add text to UI container
  ui.add(uiTitle)
  ui.add(posText)
  ui.add(rotText)

  // Add UI to app
  app.add(ui)
}

// Client-side: Handle teleport command
if (world.isClient) {
  world.on('command', e => {
    if (!e.args || e.args.length === 0) return

    // Check if the command matches props.location (case insensitive)
    if (e.args[0].toLowerCase() !== props.location.toLowerCase()) return

    // Get the current position of this app
    if (app && app.position) {
      const player = world.getPlayer()
      player.teleport(app.position)
      console.log(`Teleported to ${props.location} at`, app.position)
    } else {
      console.error('Could not get position for teleportation')
    }
  })
}

// // Keep the rotation
// app.on('update', delta => {
// 	app.rotation.y += 0.5 * delta
// })

// Update loop for position/rotation display and position emission
app.on('update', () => {
  if (app && app.position && app.rotation) {
    const pos = app.position
    const rot = app.rotation

    // Update position and rotation text if UI is visible
    if (posText) {
      posText.value = `X: ${pos.x.toFixed(2)}\nY: ${pos.y.toFixed(2)}\nZ: ${pos.z.toFixed(2)}`
    }
    if (rotText) {
      rotText.value = `RX: ${rot.x.toFixed(2)}, RY: ${rot.y.toFixed(2)}, RZ: ${rot.z.toFixed(2)}`
    }

    // Emit the app's position and instance ID using the configured location as the event key
    app.emit(props.location, {
      id: app.instanceId,
      position: {
        x: pos.x,
        y: pos.y,
        z: pos.z,
      },
    })
  }
})
