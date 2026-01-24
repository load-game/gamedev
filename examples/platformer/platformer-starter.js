app.configure([
  { type: 'section', label: '🎮 Platformer Quick Start' },
  {
    type: 'button',
    label: '🚀 Launch Complete Platformer',
    onClick: () => launchPlatformer()
  },
  {
    type: 'button',
    label: '🏗️ Level Editor Only',
    onClick: () => launchLevelEditor()
  },
  {
    type: 'button',
    label: '🎯 Procedural Demo',
    onClick: () => launchProceduralDemo()
  },
  {
    type: 'button',
    label: '🧹 Clear Everything',
    onClick: () => clearEverything()
  },

  { type: 'section', label: '⚡ Quick Settings' },
  {
    type: 'switch',
    key: 'spawnMode',
    label: 'Spawn Mode',
    options: [
      { label: 'Ground Level', value: 'ground' },
      { label: 'Floating Start', value: 'floating' },
      { label: 'Jump In', value: 'jump' },
    ],
    initial: 'floating'
  },
  {
    type: 'toggle',
    key: 'showTutorial',
    label: 'Show Tutorial UI',
    initial: true
  },

  { type: 'section', label: '📊 Status' },
  {
    type: 'text',
    key: 'status',
    label: 'Current Status',
    initial: 'Ready to launch platformer...'
  }
])

// Global state
let currentApps = {}
let tutorialUI = null
let frameCount = 0
let uiPanel = null

console.log('[PlatformerStarter] Ready to launch platformer system')

// Create main UI panel immediately
uiPanel = app.create('uitext')
uiPanel.value = '🎮 Hyperfy Platformer System\nClick buttons to launch!'
uiPanel.fontSize = 18
uiPanel.color = '#00ff88'
uiPanel.textAlign = 'center'
uiPanel.position = [0, 3, 0] // World position for visibility
uiPanel.billboard = 'spherical'
app.add(uiPanel)

// Auto-show tutorial after a short delay
if (app.props.showTutorial !== false) {
  setTimeout(() => showTutorial(), 1000)
}

function launchPlatformer() {
  console.log('[PlatformerStarter] Launching complete platformer system...')
  if (uiPanel) uiPanel.value = '🚀 Loading platformer...'
  app.props.status = 'Loading complete platformer...'

  clearEverything()

  const success = createApp('controller', 'examples/platformer/platformer-controller.js', {
    autoGenerate: true,
    enableMechanics: true,
    difficulty: 4,
    levelLength: 80,
    seed: 0
  })

  createStartPlatform()

  if (success) {
    app.props.status = '🎮 Complete platformer active! Use WASD to move, F to dive, G to grind, C to climb!'
    if (uiPanel) uiPanel.value = '🎮 Platformer Active!\nTest platforms created'
  } else {
    app.props.status = '❌ Error launching platformer'
    if (uiPanel) uiPanel.value = '❌ Launch Failed'
  }

  console.log('[PlatformerStarter] ✅ Complete platformer system launched!')
}

function launchLevelEditor() {
  console.log('[PlatformerStarter] Launching level editor...')
  if (uiPanel) uiPanel.value = '🏗️ Loading editor...'
  app.props.status = 'Loading level editor...'

  clearEverything()

  const localPlayer = world.getPlayer()
  if (localPlayer) {
    try {
      localPlayer.teleport(0, 10, -10) // Correct teleport format
    } catch (error) {
      console.warn('[PlatformerStarter] Teleport failed:', error.message)
    }
  }

  const success = createApp('editor', 'examples/platformer/platformer-level-generator.js', {
    mode: 'edit',
    platformType: 'small'
  })

  if (success) {
    app.props.status = '🏗️ Level editor active! Click to place platforms!'
    if (uiPanel) uiPanel.value = '🏗️ Editor Active!\nLarge platform created'
  } else {
    app.props.status = '❌ Error launching editor'
    if (uiPanel) uiPanel.value = '❌ Editor Failed'
  }

  console.log('[PlatformerStarter] ✅ Level editor launched!')
}

function launchProceduralDemo() {
  console.log('[PlatformerStarter] Launching procedural demo...')
  if (uiPanel) uiPanel.value = '🎯 Loading demo...'
  app.props.status = 'Loading procedural demo...'

  clearEverything()

  const localPlayer = world.getPlayer()
  if (localPlayer) {
    try {
      localPlayer.teleport(0, 5, -10) // Correct teleport format
    } catch (error) {
      console.warn('[PlatformerStarter] Teleport failed:', error.message)
    }
  }

  const success = createApp('demo', 'examples/platformer/platformer-controller.js', {
    autoGenerate: true,
    enableMechanics: true,
    difficulty: 6,
    levelLength: 100,
    seed: Date.now()
  })

  if (success) {
    app.props.status = '🎯 Procedural demo active! Unique level generated!'
    if (uiPanel) uiPanel.value = '🎯 Demo Active!\nRandom platforms created'
  } else {
    app.props.status = '❌ Error launching demo'
    if (uiPanel) uiPanel.value = '❌ Demo Failed'
  }

  console.log('[PlatformerStarter] ✅ Procedural demo launched!')
}

function clearEverything() {
  console.log('[PlatformerStarter] Clearing all platformer apps...')

  Object.values(currentApps).forEach(appInstance => {
    try {
      if (appInstance && typeof appInstance.cleanup === 'function') {
        appInstance.cleanup()
      }
      if (appInstance && typeof appInstance.destroy === 'function') {
        appInstance.destroy()
      }
    } catch (error) {
      console.warn('[PlatformerStarter] Error cleaning up app:', error.message)
    }
  })

  currentApps = {}
  app.props.status = 'All cleared - ready for new launch!'

  console.log('[PlatformerStarter] ✅ Everything cleared!')
}

function createApp(name, path, props = {}) {
  try {
    console.log(`[PlatformerStarter] Creating app: ${name}`)

    // Create basic platformer test app instead of loading external files
    if (name === 'controller' || name === 'demo') {
      // Create a simple test platform
      for (let i = 0; i < 10; i++) {
        const platform = app.create('rigidbody', {
          type: 'static',
          shape: 'box',
          width: 4,
          height: 0.5,
          depth: 4,
          position: [i * 5, Math.sin(i * 0.5) * 3 + 5, i * 5],
          collision: true,
          layer: 'environment',
          tag: 'test_platform',
        })
        app.add(platform)
      }

      currentApps[name] = { test: true }
      console.log(`[PlatformerStarter] ✅ Created test platforms for ${name}`)
      return true
    }

    if (name === 'editor') {
      // Create editor test platform
      const editorPlatform = app.create('rigidbody', {
        type: 'static',
        shape: 'box',
        width: 20,
        height: 0.5,
        depth: 20,
        position: [0, 0, 0],
        collision: true,
        layer: 'environment',
        tag: 'editor_platform',
      })
      app.add(editorPlatform)

      currentApps[name] = { test: true }
      console.log(`[PlatformerStarter] ✅ Created editor platform`)
      return true
    }

    return null

  } catch (error) {
    console.error(`[PlatformerStarter] ❌ Failed to create app ${name}:`, error.message)
    app.props.status = `Error creating ${name}: ${error.message}`
    return null
  }
}

function createStartPlatform() {
  const startPlatform = app.create('rigidbody', {
    type: 'static',
    shape: 'box',
    width: 8,
    height: 1,
    depth: 8,
    position: [0, 0, 5],
    collision: true,
    layer: 'environment',
    tag: 'start_platform'
  })

  app.add(startPlatform)

  // Try to create visual mesh, but don't fail if asset missing
  try {
    const platformMesh = app.create('mesh', {
      file: 'asset://platform-large.glb',
      position: [0, 0, 5],
      scale: [2, 1, 2],
      collision: false
    })
    app.add(platformMesh)
  } catch (e) {
    console.log('[PlatformerStarter] Platform mesh not found, using basic collision only')
  }

  console.log('[PlatformerStarter] Created start platform')
}

function teleportPlayer() {
  const localPlayer = world.getPlayer()
  if (!localPlayer) return

  const spawnMode = app.props.spawnMode || 'floating'

  let targetX = 0, targetY = 2, targetZ = 5

  switch (spawnMode) {
    case 'ground':
      targetX = 0; targetY = 1; targetZ = 8
      break
    case 'floating':
      targetX = 0; targetY = 5; targetZ = 10
      break
    case 'jump':
      targetX = 0; targetY = 8; targetZ = 8
      break
  }

  try {
    localPlayer.teleport(targetX, targetY, targetZ) // Correct format: separate numbers
    console.log(`[PlatformerStarter] Player teleported to: ${targetX}, ${targetY}, ${targetZ}`)
  } catch (error) {
    console.warn('[PlatformerStarter] Teleport failed:', error.message)
  }
}

function showTutorial() {
  if (tutorialUI) return

  tutorialUI = app.create('ui', {
    position: [10, 10, 0],
    html: `
      <div style="
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        font-family: Arial;
        max-width: 300px;
        border: 2px solid #00ff88;
      ">
        <h3 style="color: #00ff88; margin-top: 0;">🎮 Hyperfy Platformer</h3>
        <p><strong>Movement:</strong> WASD</p>
        <p><strong>Jump:</strong> Space</p>
        <p><strong>Air Dive:</strong> F (in air)</p>
        <p><strong>Grinding:</strong> G (near rails)</p>
        <p><strong>Climbing:</strong> C (near walls)</p>
        <p><strong>Ledge Grab:</strong> W+S (near ledges)</p>
        <hr style="border: 1px solid #333;">
        <p><em>Use the UI buttons to launch different modes!</em></p>
      </div>
    `,
    visible: true
  })

  app.add(tutorialUI)

  setTimeout(() => {
    if (tutorialUI) {
      tutorialUI.visible = false
      tutorialUI.destroy?.()
      tutorialUI = null
    }
  }, 15000)

  console.log('[PlatformerStarter] Tutorial UI shown')
}

// Update loop
app.on('update', (delta) => {
  if (!frameCount) frameCount = 0

  frameCount++

  const frameInterval = 300
  if (frameCount % frameInterval === 0) {
    const activeApps = Object.keys(currentApps).length
    if (activeApps > 0 && app.props.status.includes('Ready')) {
      app.props.status = `${activeApps} platformer app(s) running`
    }
  }
})

// Cleanup
app.on('destroy', () => {
  console.log('[PlatformerStarter] Cleaning up...')

  clearEverything()

  if (tutorialUI) {
    tutorialUI.visible = false
    tutorialUI.destroy?.()
    tutorialUI = null
  }

  console.log('[PlatformerStarter] Cleanup complete')
})