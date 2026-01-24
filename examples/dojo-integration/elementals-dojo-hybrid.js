// Elementals + Dojo Hybrid - REAL Integration
// Enhances existing Elementals system with DojoEngine blockchain persistence

console.log('🔥 ELEMENTALS + DOJO HYBRID - Real Integration Starting...')

// Configure blockchain enhancement settings
app.configure([
  {
    key: 'blockchainMode',
    type: 'switch',
    label: 'Blockchain Enhancement',
    options: [
      { label: 'Dojo Enhanced', value: 'dojo' },
      { label: 'Classic Only', value: 'offline' }
    ],
    initial: world.dojo ? 'dojo' : 'offline'
  },
  {
    key: 'nftRewards',
    type: 'switch',
    label: 'NFT Rewards',
    options: [
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' }
    ],
    initial: 'enabled'
  },
  {
    key: 'achievementTracking',
    type: 'switch',
    label: 'Achievement Persistence',
    options: [
      { label: 'Persistent', value: 'persistent' },
      { label: 'Local Only', value: 'local' }
    ],
    initial: 'persistent'
  }
])

// Integration state
app.state.integrationActive = false
app.state.enhancedMobs = new Map() // mobId → mob data
app.state.playerProfiles = new Map() // playerId → profile
app.state.currentLegendaryID = null
app.state.blockchainEvents = []

// Initialize integration when Elementals system is ready
app.on('init', () => {
  console.log('🚀 Dojo-Elementals integration init')

  if (app.props.blockchainMode === 'dojo' && world.dojo) {
    startDojoIntegration()
  } else {
    console.log('📍 Running Elementals in classic mode')
  }
})

// Start Dojo integration with real Elementals system
function startDojoIntegration() {
  console.log('⛓️ Starting Dojo-Elementals integration')
  console.log(`   Network: ${world.dojo.getNetwork()}`)
  console.log(`   World: ${world.dojo.getWorldAddress()}`)

  app.state.integrationActive = true
  app.state.networkId = world.dojo.getNetwork()
  app.state.worldAddress = world.dojo.getWorldAddress()

  // Hook into existing Elementals events
  setupElementalEventHooks()

  // Create blockchain enhancement UI
  createIntegrationUI()

  console.log('✅ Dojo-Elementals integration ready!')
}

// Hook into existing Elementals system events
function setupElementalEventHooks() {
  console.log('🎣 Hooking into Elementals events...')

  // Listen for mob damage events (from elemental-mob.js)
  world.on('elemental-mob:dmg', (mobId, damage, crit) => {
    if (!app.state.integrationActive) return
    handleMobDamage(mobId, damage, crit)
  })

  // Listen for mob death (when health reaches 0)
  world.on('elemental-mob:health', (mobId, health) => {
    if (!app.state.integrationActive) return
    if (health <= 0) {
      handleMobDeath(mobId)
    }
  })

  // Listen for player damage to elementals
  world.on('elemental-item:dmg', (playerId, damage, crit) => {
    if (!app.state.integrationActive) return
    handlePlayerDamageDeal(playerId, damage, crit)
  })

  console.log('✅ Elemental event hooks established')
}

// Handle mob being damaged by player
function handleMobDamage(mobId, damage, crit) {
  console.log(`🗡️ Mob ${mobId} took ${damage} damage${crit ? ' (CRIT!)' : ''}`)

  // Get or create enhanced mob data
  if (!app.state.enhancedMobs.has(mobId)) {
    enhanceMobWithDojo(mobId)
  }

  const mobData = app.state.enhancedMobs.get(mobId)

  // Track blockchain-relevant damage
  if (damage > 30 || crit) {
    recordSignificantDamage(mobId, damage, crit)
  }

  // Visual damage enhancement for blockchain mode
  if (app.props.nftRewards === 'enabled') {
    showEnhancedDamage(mobId, damage, crit)
  }
}

// Handle mob death and blockchain rewards
function handleMobDeath(mobId) {
  console.log(`💀 Mob ${mobId} defeated - processing blockchain rewards`)

  const mobData = app.state.enhancedMobs.get(mobId)
  if (!mobData) return

  // Determine reward type based on mob properties
  const rewardType = determineRewardType(mobData)

  if (app.props.nftRewards === 'enabled') {
    mintBlockchainReward(mobId, rewardType)
  }

  if (app.props.achievementTracking === 'persistent') {
    recordAchievement(mobId, rewardType)
  }

  // Clean up mob data
  app.state.enhancedMobs.delete(mobId)
}

// Handle player dealing damage (for achievements)
function handlePlayerDamageDeal(playerId, damage, crit) {
  if (!app.state.playerProfiles.has(playerId)) {
    createPlayerProfile(playerId)
  }

  const profile = app.state.playerProfiles.get(playerId)
  profile.totalDamageDealt += damage
  profile.criticalHits += crit ? 1 : 0

  // Sync profile to blockchain
  syncPlayerProfile(playerId)
}

// Enhance existing mob with Dojo properties
function enhanceMobWithDojo(mobId) {
  console.log(`⚡ Enhancing mob ${mobId} with Dojo properties`)

  const mobData = {
    mobId: mobId,
    elementalType: determineElementType(mobId),
    spawnTime: Date.now(),
    blockchainID: `mob_${mobId}_${Date.now()}`,
    enhanced: true
  }

  // Check if this should be a legendary mob
  if (shouldBeLegendary(mobId)) {
    mobData.isLegendary = true
    mobData.legendaryID = `legendary_${Date.now()}`
    app.state.currentLegendaryID = mobData.legendaryID
    console.log(`⚡ LEGENDARY MOB DETECTED: ${mobId}`)
  }

  app.state.enhancedMobs.set(mobId, mobData)
  console.log(`✅ Mob ${mobId} enhanced for blockchain tracking`)
}

// Helper functions for mob enhancement
function determineElementType(mobId) {
  // In real implementation, we'd inspect the mob app properties
  // For now, assign random types like the real system would
  const types = ['fire', 'ice', 'lightning', 'earth']
  return types[Math.floor(Math.random() * types.length)]
}

function shouldBeLegendary(mobId) {
  // Make legendaries rare (5% chance)
  return Math.random() < 0.05 && app.state.currentLegendaryID === null
}

function determineRewardType(mobData) {
  if (mobData.isLegendary) {
    return {
      type: 'legendary_essence',
      rarity: 'legendary',
      power: 100,
      blockchainID: mobData.legendaryID,
      mintAsNFT: true
    }
  }

  const isRare = Math.random() < 0.2
  return {
    type: `${mobData.elementalType}_essence`,
    rarity: isRare ? 'rare' : 'common',
    power: isRare ? 50 : 25,
    blockchainID: `${mobData.blockchainID}_reward`,
    mintAsNFT: isRare && app.props.nftRewards === 'enabled'
  }
}

// Blockchain integration functions
function createPlayerProfile(playerId) {
  const profile = {
    playerId: playerId,
    totalDamageDealt: 0,
    criticalHits: 0,
    elementalKills: 0,
    legendaryKills: 0,
    nftsMinted: 0,
    achievements: []
  }

  app.state.playerProfiles.set(playerId, profile)
  console.log(`👤 Created blockchain profile for player ${playerId}`)

  // Add Dojo sync for this player
  const player = world.getPlayer(playerId)
  if (player && world.dojo) {
    player.add('dojo', {
      worldAddress: world.dojo.getWorldAddress(),
      components: ['Position', 'Health', 'CombatStats', 'ElementalCollection'],
      syncInterval: 1500
    })
  }
}

function syncPlayerProfile(playerId) {
  if (!world.dojo?.isConnected()) return

  const profile = app.state.playerProfiles.get(playerId)
  if (!profile) return

  try {
    world.dojo.setComponent(
      playerId,
      'CombatStats',
      {
        totalDamageDealt: profile.totalDamageDealt,
        criticalHits: profile.criticalHits,
        elementalKills: profile.elementalKills,
        legendaryKills: profile.legendaryKills
      }
    )
  } catch (error) {
    console.log('⚠️ Profile sync failed:', error.message)
  }
}

async function recordSignificantDamage(mobId, damage, crit) {
  if (!world.dojo?.isConnected()) return

  try {
    await world.dojo.execute([{
      target: world.dojo.getWorldAddress(),
      method: 'recordSignificantDamage',
      args: [mobId, damage, crit]
    }])
  } catch (error) {
    console.log('⚠️ Damage recording failed:', error.message)
  }
}

async function mintBlockchainReward(mobId, rewardType) {
  if (!world.dojo?.isConnected() || !rewardType.mintAsNFT) return

  try {
    const result = await world.dojo.execute([{
      target: world.dojo.getWorldAddress(),
      method: 'mintElementalReward',
      args: [
        rewardType.type,
        rewardType.rarity,
        rewardType.power,
        rewardType.blockchainID
      ]
    }])

    console.log(`🏆 NFT Minted: ${rewardType.type} (${rewardType.rarity})`)
    console.log(`   Transaction: ${result.transaction_hash}`)

    // Show blockchain notification
    showBlockchainMintNotification(rewardType)

  } catch (error) {
    console.log('⚠️ NFT minting failed:', error.message)
  }
}

async function recordAchievement(mobId, rewardType) {
  if (!world.dojo?.isConnected()) return

  try {
    await world.dojo.execute([{
      target: world.dojo.getWorldAddress(),
      method: 'recordElementalKill',
      args: [
        mobId,
        rewardType.type,
        rewardType.rarity,
        Date.now()
      ]
    }])
  } catch (error) {
    console.log('⚠️ Achievement recording failed:', error.message)
  }
}

// Visual enhancement functions
function showEnhancedDamage(mobId, damage, crit) {
  // In real implementation, this would enhance the existing damage numbers
  // with blockchain-specific visual effects
  console.log(`💎 Enhanced damage display: ${damage}${crit ? ' 💎CRIT💎' : ''}`)
}

function showBlockchainMintNotification(rewardType) {
  // Create notification for NFT mint
  const notification = app.create('ui', {
    position: [0, 3, 0],
    width: 500,
    height: 100,
    backgroundColor: [0, 0, 0, 0.9],
    borderRadius: 15
  })

  const title = app.create('uitext', {
    text: `🏆 NFT MINTED! 🏆`,
    position: [0, 70, 0],
    fontSize: 24,
    color: [1, 0.8, 0],
    fontWeight: 'bold'
  })
  notification.add(title)

  const details = app.create('uitext', {
    text: `${rewardType.rarity.toUpperCase()} ${rewardType.type}\nPower: ${rewardType.power}`,
    position: [0, 40, 0],
    fontSize: 16,
    color: [1, 1, 1]
  })
  notification.add(details)

  const subtitle = app.create('uitext', {
    text: `Token ID: ${rewardType.blockchainID}`,
    position: [0, 10, 0],
    fontSize: 12,
    color: [0.8, 0.8, 0.8]
  })
  notification.add(subtitle)

  setTimeout(() => app.remove(notification), 5000)
}

// Create the integration UI
function createIntegrationUI() {
  console.log('🎨 Creating Dojo-Elementals integration UI')

  const ui = app.create('ui', {
    width: 400,
    height: 250,
    position: [0, 2.5, -2],
    backgroundColor: [0.05, 0.05, 0.1, 0.9],
    borderRadius: 12
  })

  // Title
  const title = app.create('uitext', {
    text: '⛓️ ELEMENTALS + DOJO',
    position: [0, 110, 0],
    fontSize: 20,
    color: [0.8, 0.9, 1]
  })
  ui.add(title)

  // Network status
  const network = app.create('uitext', {
    text: `🌐 ${app.state.networkId} • Connected`,
    position: [0, 85, 0],
    fontSize: 12,
    color: [0.2, 0.8, 0.2]
  })
  ui.add(network)

  // Enhancement status
  const status = app.create('uitext', {
    text: '✅ Integration Active',
    position: [0, 65, 0],
    fontSize: 14,
    color: [0.8, 0.8, 0.8]
  })
  ui.add(status)

  // Features
  const features = app.create('uitext', {
    text: `🏆 NFT Rewards: ${app.props.nftRewards === 'enabled' ? 'ON' : 'OFF'}\n📊 Achievements: ${app.props.achievementTracking === 'persistent' ? 'PERSISTENT' : 'LOCAL'}`,
    position: [0, 35, 0],
    fontSize: 12,
    color: [0.6, 0.6, 0.6]
  })
  ui.add(features)

  // Enhanced mobs count
  const mobCount = app.create('uitext', {
    text: '👹 Enhanced Mobs: 0',
    position: [0, 5, 0],
    fontSize: 12,
    color: [0.6, 0.6, 0.6]
  })
  ui.add(mobCount)

  // Instructions
  const instructions = app.create('uitext', {
    text: '▶️ Play Elementals normally\n💎 Rare/legendary drops mint as NFTs\n📊 All achievements recorded on-chain',
    position: [0, -25, 0],
    fontSize: 10,
    color: [0.4, 0.4, 0.4]
  })
  ui.add(instructions)

  // Make UI face camera
  ui.lookAt = () => {
    const cameraPos = world.camera.position
    const uiPos = ui.position
    const direction = cameraPos.clone().sub(uiPos).normalize()
    ui.quaternion.setFromUnitVectors([0, 0, 1], direction.toArray())
  }

  app.state.ui = { ui, network, status, features, mobCount, instructions }
  console.log('✅ Integration UI created')
}

// Update loop for UI and periodic sync
app.on('update', () => {
  if (!app.state.integrationActive) return

  // Update UI to face camera
  if (app.state.ui?.ui.lookAt) {
    app.state.ui.ui.lookAt()
  }

  // Update enhanced mobs count
  if (app.state.ui?.mobCount) {
    app.state.ui.mobCount.text = `👹 Enhanced Mobs: ${app.state.enhancedMobs.size}`
  }

  // Periodic player profile sync (every 5 seconds)
  if (!app.state.lastSync || Date.now() - app.state.lastSync > 5000) {
    app.state.playerProfiles.forEach((profile, playerId) => {
      syncPlayerProfile(playerId)
    })
    app.state.lastSync = Date.now()
  }
})

// Clean up when integration stops
app.on('cleanup', () => {
  console.log('🧹 Cleaning up Dojo-Elementals integration')
  app.state.integrationActive = false
  app.state.enhancedMobs.clear()
  app.state.playerProfiles.clear()
  app.state.currentLegendaryID = null
})

console.log('⛓️ Dojo-Elementals Real Integration loaded')
console.log('   This enhances existing Elemental mobs with blockchain persistence')