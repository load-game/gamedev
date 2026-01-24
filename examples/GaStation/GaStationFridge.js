app.configure([
  {
    key: 'image',
    type: 'file',
    kind: 'texture',
    label: 'Particle',
  },
  // #region DEBUG
  {
    type: 'section',
    key: 'debugSection',
    label: 'Debug Settings',
  },
  {
    key: 'debugMode',
    type: 'toggle',
    label: 'Enable Debug Logging',
    initial: false,
    hint: 'Show detailed console logs for troubleshooting',
  },
  // #endregion
  // #region AUDIO
  {
    type: 'section',
    key: 'audioSection',
    label: 'Audio Settings',
  },
  {
    key: 'doorSound',
    type: 'file',
    kind: 'audio',
    label: 'Door Sound Effect',
  },
  {
    key: 'fridgeHum',
    type: 'file',
    kind: 'audio',
    label: 'Fridge Ambient Hum',
  },
  // #endregion
])

// Debug logging utility
function debugLog(...args) {
  if (props.debugMode) {
    console.log('[Fridge]', ...args)
  }
}

let rig,
  col,
  isOn = false, // FIX: Explicitly initialize to false
  c,
  c2,
  c3,
  b,
  b2,
  doorSound,
  fridgeHum,
  particles = null,
  restockAction = null,
  particleTimeout = null // FIX: Track timeout for cleanup

let isInitialized = false // Prevent duplicate initialization

// Get all fridge items and hide them initially (they need to be restocked)
c = app.get('Cans1')
c2 = app.get('Cans2')
c3 = app.get('Cans3')
b = app.get('Bottles1')
b2 = app.get('Bottles2')

// Store all items in an array for easy management
const allItems = []
if (c) allItems.push({ node: c, name: 'Cans1' })
if (c2) allItems.push({ node: c2, name: 'Cans2' })
if (c3) allItems.push({ node: c3, name: 'Cans3' })
if (b) allItems.push({ node: b, name: 'Bottles1' })
if (b2) allItems.push({ node: b2, name: 'Bottles2' })

// Hide all items initially (they're out of stock)
allItems.forEach(function (item) {
  item.node.active = false
})

// Configure item disappearing behavior
const restockThreshold = 0 // show restock action when items == 0 (completely empty)

rig = app.get('FridgeDoorRig')
col = app.get('FridgeHit')

// DEBUG: Check if required nodes exist
if (!rig) {
  debugLog('❌ CRITICAL: FridgeDoorRig node not found in GLB!')
  debugLog('   Particles will not work without this node.')
} else {
  debugLog('✅ FridgeDoorRig found:', rig)
}

if (!col) {
  debugLog('⚠️  FridgeHit node not found - restock action may not work')
} else {
  debugLog('✅ FridgeHit found:', col)
}

// Get count of visible items
function getVisibleItemCount() {
  return allItems.filter(function (item) {
    return item.node.active
  }).length
}

// Take one item (remove a random item)
function takeItem() {
  const visibleItems = allItems.filter(function (item) {
    return item.node.active
  })

  if (visibleItems.length === 0) {
    return null // No items to take
  }

  // Pick a random visible item
  const randomItem = visibleItems[Math.floor(Math.random() * visibleItems.length)]

  // Hide it
  randomItem.node.active = false
  debugLog(`[Fridge] Took ${randomItem.name}`)

  // Play a sound effect if available
  if (doorSound) {
    doorSound.play()
  }

  // Emit signal for inventory tracking
  app.send('fridge:itemTaken', {
    playerId: world.isClient ? 'local' : null,
    itemName: randomItem.name,
    itemsRemaining: getVisibleItemCount(),
  })

  return randomItem.name
}

// DEBUG: Check particle configuration
const particleUrl = props.image?.url
debugLog('Particle configuration:', {
  url: particleUrl,
  hasUrl: !!particleUrl,
  rigExists: !!rig,
  alreadyInitialized: isInitialized,
})

// Initialize only once
if (!isInitialized) {
  debugLog('Initializing...')
  isInitialized = true
} else {
  debugLog('Already initialized, skipping...')
}

particles = app.create('particles', {
  image: props.image?.url,
  // FIX: Large box covering fridge opening + slow mist physics
  // [box, width, height, depth, thickness, origin, spherize]
  // width: 1.5m (fridge width), height: 2.0m, depth: 0.5m (thin plane)
  shape: ['box', 1.5, 2.0, 0.5, 0, 'edge', false], // 'edge' emits from surfaces for "spilling out" effect
  direction: 2, // upward (cold air rises slightly)
  speed: '0.01~0.05', // VERY SLOW for mist effect
  rate: 100, // Fewer particles for wispy look
  alpha: '0.2~0.4', // Semi-transparent like mist
  size: '0.5~1.5', // Varying sizes for depth
  rotate: '0~360',
  alphaOverLife: '0,0|0.2,0.8|0.8,0.8|1,0', // Fade in and out smoothly
  emissive: '2~4', // Softer glow
  lit: false,
  // FIX: Add downward force like cold air sinking/falling
  // Vector3 is available directly in SES, not as THREE.Vector3
  force: new Vector3(0, -0.02, 0), // Slight downward drift
})

debugLog('Particles created:', {
  exists: !!particles,
  hasImage: !!particles.image,
  rate: particles.rate,
  position: particles.position,
})

// CRITICAL FIX: Use app.add() like all working examples do!
// rig.add() causes particles to be invisible
particles.position.set(0, 1, -0.5) // Position in front of fridge
app.add(particles)
debugLog('✅ Particles added to app at:', particles.position.toArray())

particles.active = false
debugLog('Particles set to inactive (ready for activation)')

doorSound = app.create('audio', {
  src: props.doorSound?.url,
  volume: 0.7,
  group: 'sfx',
  spatial: true,
})
rig.add(doorSound)

fridgeHum = app.create('audio', {
  src: props.fridgeHum?.url,
  volume: 0.1,
  maxDistance: 4,
  refDistance: 1,
  rolloffFactor: 1,
  group: 'sfx',
  spatial: true,
  loop: true,
})
rig.add(fridgeHum)
fridgeHum.play()

// Restock action - players can use this to restock the fridge
restockAction = app.create('action', {
  label: 'Press E to Restock',
  distance: 3,
  duration: 3, // 2 second hold time to restock
  onStart: function () {
    debugLog('Player started restocking...')
    app.emit('animlib:play', {
      anim: 'vrmfixingkneeling124',
      target: 'player',
      playerId: 'local',
      options: {
        speed: 1.0,
        gaze: true,
        loop: false,
        cancellable: true,
      },
    })
  },
  onProgress: function (progress) {
    // Could show a progress bar here if needed
  },
  onTrigger: function () {
    debugLog('Restocked!')
    debugLog('Action triggered - current state:', {
      isOn: isOn,
      visibleItems: getVisibleItemCount(),
    })
    restockFridge()
    // FIX: Check status immediately after restock (no timeout delay)
    checkRestockStatus()
  },
})
// Add the restock action to the fridge collision area
if (col) {
  col.add(restockAction)
  debugLog('Restock action added to FridgeHit')
} else {
  debugLog('Could not add restock action - FridgeHit not found')
}

// Restock function - makes all items visible
function restockFridge() {
  debugLog('Restocking items...')
  // Play VRM|FixingKneeling@124 animation on player
  // Animation ID is 'vrmfixingkneeling124' (lowercase, no special chars)
  app.emit('animlib:play', {
    anim: 'vrmfixingkneeling124',
    target: 'player',
    playerId: 'local',
    options: {
      speed: 1.0,
      gaze: true,
      loop: false,
      cancellable: true,
    },
  })

  // Show all items
  allItems.forEach(function (item) {
    item.node.active = true
    debugLog('Restocked ' + item.name)
  })

  // // Play a restock sound effect if available
  // if (doorSound) {
  //   doorSound.play()
  // }

  debugLog('✅ Fridge restocked!')

  // Emit signal to other apps that fridge was restocked
  app.send('fridge:restocked', {
    playerId: world.isClient ? 'local' : null,
    items: allItems.map(function (item) {
      return item.name
    }),
  })
}

app.onPointerDown = function () {
  debugLog('Pointer clicked! Current state:', {
    isOn: isOn,
    particlesExist: !!particles,
    particleActive: particles ? particles.active : false,
    particleRate: particles ? particles.rate : 0,
    particleImage: particles ? particles.image : null,
  })

  if (!isOn) {
    // Turn on - start emitting particles
    debugLog('Opening door...')
    doorSound.play()
    rig.play({ name: 'FridgeOpen', loop: false })

    // FIX: Clear any existing particle timeout to prevent race conditions
    if (particleTimeout) {
      debugLog('Clearing pending particle timeout')
      clearTimeout(particleTimeout)
      particleTimeout = null
    }

    debugLog('Activating particles...')
    particles.rate = 200
    particles.active = true
    debugLog('Particles activated:', {
      active: particles.active,
      rate: particles.rate,
      position: particles.position,
    })

    isOn = true

    // Take one item when opening (if any available)
    const itemTaken = takeItem()
    if (itemTaken) {
      // Item was taken, check if we need to show restock action
      checkRestockStatus()
    } else {
      // No items available, check if restock should show
      checkRestockStatus()
    }
  } else {
    // Turn off - stop emitting and let existing particles fade naturally
    debugLog('Closing door...')
    rig.play({ name: 'FridgeClose', loop: false })
    doorSound.play()

    debugLog('Deactivating particles...')
    particles.rate = 0

    // FIX: Clear any existing timeout to prevent race conditions
    if (particleTimeout) {
      clearTimeout(particleTimeout)
      particleTimeout = null
    }

    // Wait for particles to die naturally before hiding (3 seconds should be enough)
    particleTimeout = setTimeout(function () {
      particles.active = false
      particleTimeout = null
      debugLog('Particles deactivated')
    }, 3000)

    isOn = false

    // Check restock status when closing (in case items ran out while open)
    checkRestockStatus()
  }
}

// Check if restock action should be shown (only when empty AND fridge is open)
// Call this whenever item count OR door state changes
function checkRestockStatus() {
  if (!restockAction || !col) return

  const visibleCount = getVisibleItemCount()
  const wasActive = restockAction.active

  // FIX: More explicit logic - show ONLY if BOTH conditions met
  const shouldShow = visibleCount === 0 && isOn

  // DEBUG: Log the current state
  debugLog('checkRestockStatus:', {
    visibleCount,
    isOn,
    shouldShow,
    wasActive,
    actionWillBe: shouldShow ? 'ACTIVE' : 'INACTIVE',
  })

  if (shouldShow && !wasActive) {
    // Show restock action
    restockAction.active = true
    debugLog('🔄 SHOW restock (empty + open)')
    if (fridgeHum) fridgeHum.stop()
  } else if (!shouldShow && wasActive) {
    // Hide restock action
    restockAction.active = false
    debugLog('❌ HIDE restock (has items or closed)')
  }
  // If no state change, do nothing
}

// Fix: Add cleanup handler to clear any pending timeouts
app.on('cleanup', function () {
  debugLog('Cleaning up...')
  if (particleTimeout) {
    clearTimeout(particleTimeout)
    particleTimeout = null
    debugLog('Cleared particle timeout')
  }
})
