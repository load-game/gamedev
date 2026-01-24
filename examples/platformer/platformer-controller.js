app.configure([
  { type: 'section', label: 'Platformer Controller' },
  {
    type: 'toggle',
    key: 'autoGenerate',
    label: 'Auto Generate on Start',
    initial: true
  },
  {
    type: 'toggle',
    key: 'enableMechanics',
    label: 'Enable All Mechanics',
    initial: true
  },

  { type: 'section', label: 'Procedural Settings' },
  {
    type: 'number',
    key: 'seed',
    label: 'Level Seed (0 = random)',
    min: 0,
    max: 999999,
    initial: 0
  },
  {
    type: 'number',
    key: 'difficulty',
    label: 'Difficulty',
    min: 1,
    max: 10,
    initial: 3
  },
  {
    type: 'number',
    key: 'levelLength',
    label: 'Level Length',
    min: 20,
    max: 150,
    initial: 60
  },

  { type: 'section', label: 'Controls' },
  {
    type: 'button',
    label: 'Generate New Level',
    onClick: () => app.send('generate')
  },
  {
    type: 'button',
    label: 'Regenerate with Same Seed',
    onClick: () => app.send('regenerate')
  },
  {
    type: 'button',
    label: 'Clear Level',
    onClick: () => app.send('clear')
  },
])

// Global state
const mechanicApps = {}
let levelGenerator = null
let currentSeed = 0
let frameCount = 0

console.log('[PlatformerController] Initializing')

// App event handlers
app.on('generate', generateLevel)
app.on('regenerate', regenerateLevel)
app.on('clear', clearLevel)

// Load and initialize all mechanic systems
function initializeMechanics() {
  const mechanicConfigs = [
    { name: 'airDive', path: 'examples/platformer/platformer-air-dive.js' },
    { name: 'climbing', path: 'examples/platformer/platformer-climbing.js' },
    { name: 'grinding', path: 'examples/platformer/platformer-grinding.js' },
    { name: 'ledge', path: 'examples/platformer/platformer-ledge.js' }
  ]

  mechanicConfigs.forEach(config => {
    try {
      const mechanicApp = app.require(config.path)

      if (mechanicApp && typeof mechanicApp.init === 'function') {
        const appInstance = { ...mechanicApp }
        appInstance.init()

        mechanicApps[config.name] = appInstance
        console.log(`[PlatformerController] Loaded ${config.name} mechanic`)
      }
    } catch (error) {
      console.warn(`[PlatformerController] Failed to load ${config.name}:`, error.message)
    }
  })
}

function initializeLevelGenerator() {
  try {
    const generatorConfig = {
      name: 'levelGenerator',
      path: 'examples/platformer/platformer-level-generator.js'
    }

    const generatorApp = app.require(generatorConfig.path)

    if (generatorApp && typeof generatorApp.init === 'function') {
      levelGenerator = { ...generatorApp }
      levelGenerator.init()

      console.log('[PlatformerController] Loaded level generator')
    }
  } catch (error) {
    console.warn('[PlatformerController] Failed to load level generator:', error.message)
  }
}

function setupEventListeners() {
  app.on('air-dive-available', (playerId, diveArea) => {
    if (mechanicApps.airDive && app.props.enableMechanics !== false) {
      mechanicApps.airDive.attemptAirDive(playerId, diveArea)
    }
  })

  app.on('start-grinding', (playerId, railData) => {
    if (mechanicApps.grinding && app.props.enableMechanics !== false) {
      mechanicApps.grinding.attemptGrindStart(playerId, railData)
    }
  })

  setupInputControls()
}

function setupInputControls() {
  const control = app.control()
  if (!control) return

  let lastGrindPress = 0
  let lastDivePress = 0
  let lastLedgePress = 0

  app.on('update', () => {
    const now = Date.now()

    control.keyG.capture = true
    if (control.keyG.pressed && now - lastGrindPress > 500) {
      lastGrindPress = now
      attemptMechanicActivation('grind')
    }

    control.keyF.capture = true
    if (control.keyF.pressed && now - lastDivePress > 500) {
      lastDivePress = now
      attemptMechanicActivation('dive')
    }

    control.keyL.capture = true
    if (control.keyL.pressed && now - lastLedgePress > 500) {
      lastLedgePress = now
      attemptMechanicActivation('ledge')
    }

    control.keyC.capture = true
    if (app.props.enableMechanics !== false && mechanicApps.climbing) {
      const localPlayer = world.getPlayer()
      if (localPlayer) {
        mechanicApps.climbing.activePlayers.forEach((state, playerId) => {
          if (playerId === localPlayer.id) {
            if (control.keyW.pressed) state.direction = 1
            else if (control.keyS.pressed) state.direction = -1
            else state.direction = 0
          }
        })
      }
    }

    if (control.keyW.pressed && control.keySpace.pressed) {
      attemptMechanicActivation('climb')
      attemptMechanicActivation('ledge')
    }
  })
}

function attemptMechanicActivation(type) {
  const localPlayer = world.getPlayer()
  if (!localPlayer || !app.props.enableMechanics) return

  const playerId = localPlayer.id

  switch (type) {
    case 'dive':
      if (mechanicApps.airDive) {
        mechanicApps.airDive.attemptAirDive(playerId)
      }
      break

    case 'grind':
      // Grinding is handled by triggers in level generator
      break

    case 'climb':
      if (mechanicApps.climbing) {
        mechanicApps.climbing.attemptClimbStart(playerId)
      }
      break

    case 'ledge':
      if (mechanicApps.ledge) {
        mechanicApps.ledge.attemptLedgeGrab(playerId)
      }
      break
  }
}

function generateLevel() {
  console.log('[PlatformerController] Generating new level')

  const seedValue = app.props.seed || 0
  currentSeed = seedValue === 0 ? Date.now() : seedValue

  setupSeededRandom(currentSeed)

  // Generate level using level generator
  if (levelGenerator) {
    // The level generator needs to be called as an app
    app.send('generate-level', {
      difficulty: app.props.difficulty || 3,
      length: app.props.levelLength || 60,
      includeGrinding: true,
      includeClimbing: true,
      includeLedges: true,
      includeAirDive: true
    })
  }

  setTimeout(() => {
    const localPlayer = world.getPlayer()
    if (localPlayer) {
      localPlayer.teleport([0, 2, 5])
      console.log('[PlatformerController] Teleported player to level start')
    }
  }, 500)
}

function regenerateLevel() {
  if (currentSeed !== 0) {
    setupSeededRandom(currentSeed)
    generateLevel()
    console.log(`[PlatformerController] Regenerated with seed: ${currentSeed}`)
  } else {
    generateLevel()
  }
}

function clearLevel() {
  console.log('[PlatformerController] Clearing level')

  if (levelGenerator) {
    app.send('clear-all')
  }

  Object.values(mechanicApps).forEach(mechanic => {
    if (typeof mechanic.cleanup === 'function') {
      mechanic.cleanup()
    }
  })

  initializeMechanics()
}

function setupSeededRandom(seed) {
  let currentSeed = seed

  Math.randomSeeded = function() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280
    return currentSeed / 233280
  }

  Math.resetSeed = function(newSeed) {
    currentSeed = newSeed
  }
}

function updateMechanics(delta) {
  if (app.props.enableMechanics !== false) {
    Object.values(mechanicApps).forEach(mechanic => {
      if (typeof mechanic.update === 'function') {
        mechanic.update(delta)
      }
    })
  }

  if (levelGenerator && typeof levelGenerator.update === 'function') {
    levelGenerator.update(delta)
  }
}

function getMechanicStatus() {
  return {
    airDive: {
      active: !!mechanicApps.airDive,
      activePlayers: mechanicApps.airDive?.activePlayers?.size || 0
    },
    climbing: {
      active: !!mechanicApps.climbing,
      activePlayers: mechanicApps.climbing?.activePlayers?.size || 0
    },
    grinding: {
      active: !!mechanicApps.grinding,
      activePlayers: mechanicApps.grinding?.activePlayers?.size || 0,
      rails: mechanicApps.grinding?.grindRails?.size || 0
    },
    ledge: {
      active: !!mechanicApps.ledge,
      activePlayers: mechanicApps.ledge?.activePlayers?.size || 0
    },
    levelGenerator: {
      active: !!levelGenerator,
      platforms: levelGenerator?.platforms?.length || 0,
      totalMechanics: levelGenerator?.getTotalMechanics?.() || 0
    }
  }
}

// Initialize everything
initializeMechanics()
initializeLevelGenerator()
setupEventListeners()

// Auto-generate if enabled
if (app.props.autoGenerate !== false) {
  setTimeout(() => generateLevel(), 1000)
}

// Update loop
app.on('update', (delta) => {
  updateMechanics(delta)

  if (!frameCount) frameCount = 0

  frameCount++

  if (frameCount % 600 === 0) {
    console.log('[PlatformerController] Status check - All systems operational')
  }
})

// Cleanup
app.on('destroy', () => {
  console.log('[PlatformerController] Cleaning up')

  Object.values(mechanicApps).forEach(mechanic => {
    if (typeof mechanic.cleanup === 'function') {
      mechanic.cleanup()
    }
  })

  if (levelGenerator && typeof levelGenerator.cleanup === 'function') {
    levelGenerator.cleanup()
  }

  if (Math.randomOriginal) {
    Math.random = Math.randomOriginal
  }

  console.log('[PlatformerController] Cleanup complete')
})

console.log('[PlatformerController] Initialized with mechanics:', Object.keys(mechanicApps))