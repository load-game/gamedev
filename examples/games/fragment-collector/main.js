// Fragment Collector - Code Fragment Collection Game
// Players collect 10 code fragments and deploy completion proof

console.log('🎮 Fragment Collector Initializing...')

app.configure([
  {
    key: 'fragmentCount',
    type: 'number',
    label: 'Number of Fragments',
    initial: 10,
    min: 5,
    max: 20,
  },
  {
    key: 'gameMode',
    type: 'switch',
    label: 'Game Mode',
    options: [
      { label: 'Blockchain', value: 'blockchain' },
      { label: 'Offline', value: 'offline' },
    ],
    initial: 'blockchain',
  },
])

// Game state
app.state.gameStarted = false
app.state.fragments = []
app.state.fragmentsCollected = 0
app.state.totalFragments = app.props.fragmentCount
app.state.player = null
app.state.deployUI = null

// Initialize game
app.on('init', () => {
  console.log('🚀 Game init triggered')
  initGame()
})

async function initGame() {
  console.log('🎯 Initializing Fragment Collector...')

  // Wait for Dojo if in blockchain mode
  if (app.props.gameMode === 'blockchain') {
    await waitForDojo()
  } else {
    console.log('⚠️ OFFLINE MODE - No blockchain sync')
  }

  createArena()
  spawnFragments(app.state.totalFragments)
  setupCollection()
  createGameUI()

  app.state.gameStarted = true
  console.log('✅ Game initialized')
}

async function waitForDojo() {
  console.log('⏳ Waiting for Dojo connection...')

  return new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (world.dojo?.isConnected()) {
        clearInterval(checkInterval)
        console.log('✅ Dojo connected:', world.dojo.getNetwork())
        resolve()
      } else {
        console.log('⏳ Still waiting for Dojo...')
      }
    }, 1000)

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval)
      console.warn('⚠️ Dojo timeout - continuing in offline mode')
      app.props.gameMode = 'offline'
      resolve()
    }, 10000)
  })
}

function createArena() {
  console.log('🏗️ Creating arena...')

  // Floor
  const floor = app.create('prim', {
    type: 'box',
    scale: [30, 0.2, 30],
    position: [0, -0.1, 0],
    color: '#1a1a2e',
    metalness: 0.1,
    roughness: 0.9,
    physics: 'static',
  })
  app.add(floor)

  // Walls
  const wallHeight = 5
  const wallThickness = 0.5
  const arenaSize = 30

  // North wall
  app.add(
    app.create('prim', {
      type: 'box',
      scale: [arenaSize, wallHeight, wallThickness],
      position: [0, wallHeight / 2, -arenaSize / 2],
      color: '#16213e',
      physics: 'static',
    })
  )

  // South wall
  app.add(
    app.create('prim', {
      type: 'box',
      scale: [arenaSize, wallHeight, wallThickness],
      position: [0, wallHeight / 2, arenaSize / 2],
      color: '#16213e',
      physics: 'static',
    })
  )

  // East wall
  app.add(
    app.create('prim', {
      type: 'box',
      scale: [wallThickness, wallHeight, arenaSize],
      position: [arenaSize / 2, wallHeight / 2, 0],
      color: '#16213e',
      physics: 'static',
    })
  )

  // West wall
  app.add(
    app.create('prim', {
      type: 'box',
      scale: [wallThickness, wallHeight, arenaSize],
      position: [-arenaSize / 2, wallHeight / 2, 0],
      color: '#16213e',
      physics: 'static',
    })
  )

  console.log('✅ Arena created')
}

function spawnFragments(count) {
  console.log(`🎯 Spawning ${count} fragments...`)

  app.state.fragments = []

  for (let i = 0; i < count; i++) {
    const fragment = createFragment(i)
    app.state.fragments.push(fragment)
    app.add(fragment)
  }

  console.log('✅ Fragments spawned')
}

function createFragment(index) {
  const x = (Math.random() - 0.5) * 25
  const y = 0.5 + Math.random() * 3
  const z = (Math.random() - 0.5) * 25

  const fragment = app.create('prim', {
    type: 'cylinder',
    scale: [0.3, 0.8, 0.3],
    position: [x, y, z],
    color: '#00ff00',
    emissive: '#00ff00',
    emissiveIntensity: 3,
    metalness: 0.8,
    roughness: 0.2,
    trigger: true,
    tag: `fragment_${index}`,
  })

  // Add Dojo sync if available
  if (world.dojo?.isConnected() && app.props.gameMode === 'blockchain') {
    fragment.add('dojo', {
      components: ['Position', 'Owner', 'Collected'],
      syncInterval: 1000,
    })
  }

  fragment.isCollected = false
  fragment.fragmentId = `fragment_${index}`

  // Add floating animation
  fragment.baseY = y
  fragment.floatOffset = Math.random() * Math.PI * 2

  return fragment
}

function setupCollection() {
  console.log('🔧 Setting up collection handlers...')

  app.on('triggerenter', event => {
    const { object, other } = event

    if (other.playerId && object.tag?.startsWith('fragment_')) {
      const fragment = app.state.fragments.find(f => f === object)
      if (fragment) {
        collectFragment(fragment, other)
      }
    }
  })

  console.log('✅ Collection handlers set up')
}

async function collectFragment(fragment, player) {
  if (fragment.isCollected) return

  console.log(`💎 Collecting fragment: ${fragment.fragmentId}`)

  // Visual feedback
  createCollectEffect(fragment.position)
  app.remove(fragment)
  fragment.isCollected = true

  // Update state
  app.state.fragmentsCollected++
  updateUI()

  // Onchain transaction if available
  if (app.props.gameMode === 'blockchain' && world.dojo?.isConnected()) {
    try {
      const playerEntity = world.entities.getLocalPlayer()
      if (playerEntity) {
        // Format for StarkNet execute (contractAddress, entrypoint, calldata)
        const calls = [
          {
            contractAddress: world.dojo.getWorldAddress(),
            entrypoint: 'collect_fragment',
            calldata: [playerEntity.data.id, fragment.fragmentId],
          },
        ]

        console.log('📡 Sending transaction to blockchain:', calls)
        const result = await world.dojo.execute(calls)
        console.log('✅ Fragment collection synced to blockchain! Tx:', result.transaction_hash)
      }
    } catch (error) {
      console.warn('⚠️ Onchain sync failed:', error.message)
    }
  }

  // Check completion
  if (app.state.fragmentsCollected >= app.state.totalFragments) {
    showCompletionUI()
  }
}

function createCollectEffect(position) {
  const particles = []
  for (let i = 0; i < 12; i++) {
    const particle = app.create('prim', {
      type: 'sphere',
      scale: [0.1, 0.1, 0.1],
      position: [...position],
      color: '#00ff00',
      emissive: '#00ff00',
      emissiveIntensity: 5,
    })

    app.add(particle)
    particles.push({
      prim: particle,
      velocity: [(Math.random() - 0.5) * 8, Math.random() * 6 + 3, (Math.random() - 0.5) * 8],
      lifetime: 1,
    })
  }

  // Animate particles
  let elapsed = 0
  const updateParticles = dt => {
    elapsed += dt
    particles.forEach(p => {
      p.prim.position.x += p.velocity[0] * dt
      p.prim.position.y += p.velocity[1] * dt - 9.8 * dt * dt
      p.prim.position.z += p.velocity[2] * dt
      p.lifetime -= dt

      if (p.lifetime <= 0) {
        app.remove(p.prim)
      }
    })

    if (elapsed > 1) {
      app.off('update', updateParticles)
    }
  }

  app.on('update', updateParticles)
}

function createGameUI() {
  console.log('🎨 Creating game UI...')

  // Main UI backdrop
  const backdrop = app.create('ui', {
    width: 350,
    height: 200,
    position: [0, 3, -2],
    backgroundColor: [0.1, 0.1, 0.15, 0.9],
    borderRadius: 10,
  })

  // Title
  const title = app.create('uitext', {
    text: '💎 Fragment Collector',
    position: [0, 80, 0],
    fontSize: 20,
    color: [0.2, 1, 0.2],
  })
  backdrop.add(title)

  // Status
  app.state.statusText = app.create('uitext', {
    text: `Fragments: 0 / ${app.state.totalFragments}`,
    position: [0, 40, 0],
    fontSize: 16,
    color: [0.8, 0.8, 0.8],
  })
  backdrop.add(app.state.statusText)

  // Mode indicator
  const modeText = app.create('uitext', {
    text: app.props.gameMode === 'blockchain' ? '🌐 Blockchain Mode' : '⚠️ Offline Mode',
    position: [0, 10, 0],
    fontSize: 12,
    color: app.props.gameMode === 'blockchain' ? [0.2, 0.8, 0.2] : [0.8, 0.6, 0.2],
  })
  backdrop.add(modeText)

  // Instructions
  const instructions = app.create('uitext', {
    text: 'Walk into green cylinders to collect code fragments',
    position: [0, -30, 0],
    fontSize: 11,
    color: [0.5, 0.5, 0.5],
  })
  backdrop.add(instructions)

  app.state.ui = { backdrop, title }

  // Make UI face camera
  backdrop.lookAt = () => {
    if (world.camera) {
      const cameraPos = world.camera.position
      const uiPos = backdrop.position
      const direction = cameraPos.clone().sub(uiPos).normalize()
      backdrop.quaternion.setFromUnitVectors([0, 0, 1], direction.toArray())
    }
  }

  console.log('✅ Game UI created')
}

function updateUI() {
  if (app.state.statusText) {
    app.state.statusText.text = `Fragments: ${app.state.fragmentsCollected} / ${app.state.totalFragments}`
  }
}

function showCompletionUI() {
  console.log('🎉 Showing completion UI...')

  // Remove game UI
  if (app.state.ui?.backdrop) {
    app.remove(app.state.ui.backdrop)
  }

  // Create completion UI
  const deployUI = app.create('ui', {
    width: 600,
    height: 400,
    position: [0, 2, -3],
    backgroundColor: [0.1, 0.1, 0.15, 0.95],
    borderRadius: 15,
  })

  const title = app.create('uitext', {
    text: '🎉 All Fragments Collected!',
    position: [0, 150, 0],
    fontSize: 28,
    color: [0.2, 1, 0.2],
  })
  deployUI.add(title)

  const subtitle = app.create('uitext', {
    text: 'Deploy your completion proof to the blockchain',
    position: [0, 100, 0],
    fontSize: 16,
    color: [0.8, 0.8, 0.8],
  })
  deployUI.add(subtitle)

  const deployButton = app.create('uibutton', {
    text: '🚀 Deploy Smart Contract',
    position: [0, 0, 0],
    width: 280,
    height: 60,
    backgroundColor: [0.2, 0.8, 0.2],
    borderRadius: 10,
    onClick: () => deployCompletionContract(),
  })
  deployUI.add(deployButton)

  // Make UI face camera
  deployUI.lookAt = () => {
    if (world.camera) {
      const cameraPos = world.camera.position
      const uiPos = deployUI.position
      const direction = cameraPos.clone().sub(uiPos).normalize()
      deployUI.quaternion.setFromUnitVectors([0, 0, 1], direction.toArray())
    }
  }

  app.state.deployUI = deployUI
  app.add(deployUI)

  // Show notification
  app.showNotification?.('🎉 Congratulations! All fragments collected!', [0.2, 1, 0.2], 5000)
}

async function deployCompletionContract() {
  console.log('📜 Deploying completion contract...')
  
  app.showNotification?.('📜 Deploying completion proof to blockchain...', [0.2, 0.8, 1], 3000)
  
  try {
    const playerEntity = world.entities.getLocalPlayer()
    if (!playerEntity) {
      throw new Error('No player entity found')
    }
    
    // Format for StarkNet execute (contractAddress, entrypoint, calldata)
    const calls = [{
      contractAddress: world.dojo.getWorldAddress(),
      entrypoint: 'deploy_completion_nft',
      calldata: [playerEntity.data.id, app.state.fragmentsCollected]
    }]
    
    console.log('📡 Sending deployment transaction:', calls)
    const result = await world.dojo.execute(calls)
    
    console.log('✅ Contract deployed! Tx:', result.transaction_hash)
    
    app.showNotification?.(`✅ Deployed! Tx: ${result.transaction_hash}`, [0.2, 1, 0.2], 5000)
    
    // Show transaction link
    showTransactionLink(result.transaction_hash)
    
  } catch (error) {
    console.error('❌ Deployment failed:', error)
    app.showNotification?.(`❌ Deployment failed: ${error.message}`, [1, 0.2, 0.2], 5000)
  }
}

    const result = await world.dojo.execute([
      {
        target: world.dojo.getWorldAddress(),
        method: 'deploy_completion_nft',
        args: [playerEntity.data.id, app.state.fragmentsCollected],
      },
    ])

    console.log('✅ Contract deployed:', result.transaction_hash)

    app.showNotification?.(`✅ Deployed! Tx: ${result.transaction_hash}`, [0.2, 1, 0.2], 5000)

    // Show transaction link
    showTransactionLink(result.transaction_hash)
  } catch (error) {
    console.error('❌ Deployment failed:', error)
    app.showNotification?.(`❌ Deployment failed: ${error.message}`, [1, 0.2, 0.2], 5000)
  }
}

function showTransactionLink(txHash) {
  const linkUI = app.create('ui', {
    width: 500,
    height: 100,
    position: [0, -1, -2],
    backgroundColor: [0.1, 0.1, 0.15, 0.9],
    borderRadius: 10,
  })

  const linkText = app.create('uitext', {
    text: `🔗 Transaction: ${txHash.substring(0, 10)}...`,
    position: [0, 20, 0],
    fontSize: 14,
    color: [0.2, 0.8, 1],
  })
  linkUI.add(linkText)

  const copyButton = app.create('uibutton', {
    text: 'Copy Transaction Hash',
    position: [0, -20, 0],
    width: 200,
    height: 30,
    onClick: () => {
      navigator.clipboard?.writeText(txHash)
      app.showNotification?.('📋 Copied to clipboard!', [0.2, 0.8, 1], 2000)
    },
  })
  linkUI.add(copyButton)

  app.add(linkUI)

  // Auto-remove after 10 seconds
  setTimeout(() => app.remove(linkUI), 10000)
}

// Main update loop
app.on('update', () => {
  if (!app.state.gameStarted) return

  // Update UI to face camera
  if (app.state.ui?.backdrop?.lookAt) {
    app.state.ui.backdrop.lookAt()
  }
  if (app.state.deployUI?.lookAt) {
    app.state.deployUI.lookAt()
  }

  // Animate fragments
  app.state.fragments.forEach(fragment => {
    if (!fragment.isCollected) {
      fragment.position.y = fragment.baseY + Math.sin(Date.now() * 0.002 + fragment.floatOffset) * 0.2
      fragment.rotation.y += 0.01
    }
  })
})

console.log('🎮 Fragment Collector script loaded')
