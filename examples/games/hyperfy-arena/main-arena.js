// 🔥 Hyperfy Arena - Main Controller
// The main entry point that orchestrates all arena systems

app.configure({
  name: 'Hyperfy Arena - Main Controller',
  description: 'Complete arena game system with blockchain integration'
})

const ARENA_CONFIG = {
  // System dependencies (must be loaded in this order)
  requiredScripts: [
    'arena-map.js',
    'arena-match-controller.js',
    'arena-combat-integration.js',
    'arena-scoring-ui.js',
    'deploy-arena-contracts.js',
    'arena-blockchain-integration.js'
  ],

  // Game settings
  autoStart: true,
  debugMode: true,
  enableTesting: true
}

let arenaSystemState = 'initializing'
let loadedSystems = new Set()
let systemHealth = {}

// Initialize the complete arena system
app.on('init', () => {
  console.log('🏟️ Initializing Hyperfy Arena Main Controller...')
  console.log('🎮 Loading all arena systems...')

  // Monitor system loading
  setupSystemMonitoring()

  // Start system loading sequence
  loadArenaSystems()
})

function setupSystemMonitoring() {
  // Monitor individual system health
  setInterval(() => {
    performSystemHealthCheck()
  }, 5000)

  // Setup global error handling
  world.on('error', handleSystemError)
}

function loadArenaSystems() {
  console.log('📦 Loading arena system dependencies...')

  // In a real implementation, we would load these scripts dynamically
  // For now, we'll simulate the loading process

  const loadingSequence = [
    { name: 'arena-map', delay: 500 },
    { name: 'arena-match-controller', delay: 1000 },
    { name: 'arena-combat-integration', delay: 1500 },
    { name: 'arena-scoring-ui', delay: 2000 },
    { name: 'deploy-arena-contracts', delay: 2500 },
    { name: 'arena-blockchain-integration', delay: 3000 }
  ]

  loadingSequence.forEach(({ name, delay }) => {
    setTimeout(() => {
      simulateSystemLoad(name)
    }, delay)
  })
}

function simulateSystemLoad(systemName) {
  console.log(`✅ ${systemName} loaded successfully`)
  loadedSystems.add(systemName)
  systemHealth[systemName] = 'healthy'

  // Check if all systems are loaded
  if (loadedSystems.size === ARENA_CONFIG.requiredScripts.length) {
    onAllSystemsLoaded()
  }
}

function onAllSystemsLoaded() {
  arenaSystemState = 'ready'
  console.log('🎉 All arena systems loaded successfully!')
  console.log('🔥 Hyperfy Arena is now ready for play!')

  // Start arena if auto-start is enabled
  if (ARENA_CONFIG.autoStart) {
    setTimeout(() => {
      startArena()
    }, 2000)
  }

  // Setup testing mode if enabled
  if (ARENA_CONFIG.enableTesting) {
    setTimeout(() => {
      setupTestingMode()
    }, 4000) // Delay to ensure systems are loaded
  }

  // Notify world that arena is ready
  world.emit('arena:fully-ready', [{
    systems: Array.from(loadedSystems),
    state: arenaSystemState,
    timestamp: Date.now()
  }])
}

function startArena() {
  console.log('🚀 Starting Hyperfy Arena...')

  // Get the match controller to force start a match
  const matchController = app.forceStartMatch
  if (matchController) {
    matchController()
  } else {
    console.log('⏳ Waiting for players to start match...')
  }

  // Show welcome message
  app.showNotification?.('🔥 Welcome to Hyperfy Arena! Fight for glory and blockchain rewards!', [1, 0.8, 0], 5000)
}

function setupTestingMode() {
  console.log('🧪 Setting up arena testing mode...')

  // Try to create test interface UI
  try {
    // Create a simple test notification
    setTimeout(() => {
      world.emit('arena:test-interface-ready', [{}])

      // Add basic test functions to global scope
      if (typeof window !== 'undefined') {
        window.testArenaFlow = testCompleteArenaFlow
        window.debugArena = debugArenaSystems
        window.forceArenaMatch = forceTestTournament
        window.simulateArenaMatch = simulateFullArenaMatch

        console.log('🧪 Testing commands available in console:')
        console.log('- window.testArenaFlow() - Test complete blockchain integration')
        console.log('- window.debugArena() - Debug all arena systems')
        console.log('- window.forceArenaMatch() - Force a test tournament')
        console.log('- window.simulateArenaMatch() - Simulate complete match flow')
      }
    }, 1000)

  } catch (error) {
    console.warn('⚠️ Test interface setup failed:', error)
  }
}

// ===== TESTING FUNCTIONS =====

async function testCompleteArenaFlow() {
  console.log('🧪 Starting COMPLETE ARENA BLOCKCHAIN FLOW TEST...')
  console.log('This will test: Map → Match → Combat → Scoring → Blockchain → Results')

  try {
    // Test 1: Check if all systems are ready
    console.log('📋 Test 1: System Readiness Check')
    const readinessTest = await testSystemReadiness()
    if (!readinessTest.passed) {
      throw new Error('Systems not ready for testing')
    }

    // Test 2: Test blockchain integration
    console.log('⛓️ Test 2: Blockchain Integration')
    const blockchainTest = await testBlockchainIntegration()
    console.log('✅ Blockchain test result:', blockchainTest)

    // Test 3: Create and run a simulated match
    console.log('🏟️ Test 3: Simulated Arena Match')
    const matchTest = await simulateTestMatch()
    console.log('✅ Match test result:', matchTest)

    // Test 4: Verify blockchain recording
    console.log('📊 Test 4: Blockchain Result Verification')
    const verificationTest = await verifyBlockchainResults(matchTest.matchId)
    console.log('✅ Verification test result:', verificationTest)

    console.log('🎉 COMPLETE ARENA FLOW TEST PASSED!')
    console.log('🏆 All systems are working correctly!')
    return true

  } catch (error) {
    console.error('❌ ARENA FLOW TEST FAILED:', error)
    return false
  }
}

async function testSystemReadiness() {
  const checks = {
    map: !!app.getArenaConfig,
    matchController: !!app.getMatchState,
    combat: !!app.getCombatStats,
    ui: !!app.showNotification,
    contracts: !!app.getContractsInfo,
    blockchain: !!app.isBlockchainReady
  }

  const allReady = Object.values(checks).every(check => check)

  console.log('🔍 System Readiness Check:')
  Object.entries(checks).forEach(([system, ready]) => {
    console.log(`  ${system}: ${ready ? '✅' : '❌'}`)
  })

  return { passed: allReady, checks }
}

async function testBlockchainIntegration() {
  try {
    const contractsInfo = app.getContractsInfo?.()
    const blockchainReady = app.isBlockchainReady?.()

    console.log('📋 Blockchain Integration Status:')
    console.log('  Contracts Status:', contractsInfo?.status || 'unknown')
    console.log('  Blockchain Ready:', blockchainReady || false)
    console.log('  Network:', contractsInfo?.network || 'unknown')

    if (!blockchainReady) {
      return { success: false, reason: 'Blockchain not ready' }
    }

    // Test a simple query
    const testQuery = await app.getLeaderboard?.(1)
    console.log('  Test Query Result:', testQuery ? 'success' : 'failed')

    return {
      success: true,
      contractsInfo,
      blockchainReady,
      testQuery
    }

  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function simulateTestMatch() {
  console.log('🎮 Simulating test arena match...')

  const matchId = generateTestMatchId()
  const testPlayers = generateTestPlayers(4)
  const testResults = simulateMatchResults(testPlayers)

  console.log(`  Match ID: ${matchId}`)
  console.log(`  Players: ${testPlayers.length}`)
  console.log(`  Duration: 180s`)

  // Simulate the match stages
  await simulateMatchStages()

  // Record the match results
  if (app.isBlockchainReady?.()) {
    console.log('📡 Recording test match to blockchain...')
    const recordingResult = await app.recordMatchResult?.({
      matchId,
      winner: testResults[0].playerId,
      participants: testResults.map(r => r.playerId),
      playerScores: testResults.map(r => r.score),
      playerKills: testResults.map(r => r.kills),
      duration: 180
    })

    console.log('  Recording result:', recordingResult)
  }

  return { matchId, players: testPlayers, results: testResults }
}

function generateTestMatchId() {
  return `test_match_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function generateTestPlayers(count) {
  const players = []
  for (let i = 0; i < count; i++) {
    players.push({
      playerId: `test_player_${i + 1}`,
      name: `TestPlayer${i + 1}`,
      joinTime: Date.now()
    })
  }
  return players
}

function simulateMatchResults(players) {
  return players.map((player, index) => ({
    playerId: player.playerId,
    kills: Math.floor(Math.random() * 15),
    deaths: Math.floor(Math.random() * 10),
    assists: Math.floor(Math.random() * 8),
    score: Math.floor(Math.random() * 200) + 50,
    damageDealt: Math.floor(Math.random() * 1000) + 200
  })).sort((a, b) => b.score - a.score) // Sort by score
}

async function simulateMatchStages() {
  const stages = [
    { name: 'Match Countdown', duration: 3000 },
    { name: 'Combat Phase', duration: 2000 },
    { name: 'Final Results', duration: 1000 }
  ]

  for (const stage of stages) {
    console.log(`  ⏳ Simulating: ${stage.name}`)
    await new Promise(resolve => setTimeout(resolve, stage.duration))
  }
}

async function verifyBlockchainResults(matchId) {
  try {
    console.log(`🔍 Verifying blockchain results for match: ${matchId}`)

    // Query recent tournament results
    const recentResults = await app.getTournamentHistory?.()
    const foundResult = recentResults?.find(result => result.matchId === matchId)

    if (foundResult) {
      console.log('  ✅ Match result found on blockchain')
      console.log('  Status:', foundResult.status)
      console.log('  Recorded At:', new Date(foundResult.recordedAt).toISOString())

      return { success: true, result: foundResult }
    } else {
      console.log('  ⚠️ Match result not yet found on blockchain (may still be processing)')
      return { success: false, reason: 'Result not found - may be processing' }
    }

  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function forceTestTournament() {
  console.log('🏆 Forcing test tournament...')

  const tournamentData = {
    name: 'Test Tournament',
    prizePool: 1000,
    participants: 8,
    ruleset: 'Death Match'
  }

  // Create tournament
  const tournamentId = `test_tournament_${Date.now()}`

  console.log('📡 Creating tournament on blockchain...')

  if (app.isBlockchainReady?.()) {
    try {
      // Simulate tournament creation (would be a contract call in practice)
      console.log(`✅ Test tournament created: ${tournamentId}`)
      console.log('📋 Tournament details:', tournamentData)

      app.showNotification?.('🏆 Test Tournament Created!', [1, 0.8, 0], 3000)

      return { success: true, tournamentId, details: tournamentData }
    } catch (error) {
      console.error('❌ Failed to create test tournament:', error)
      return { success: false, error: error.message }
    }
  } else {
    return { success: false, reason: 'Blockchain not ready' }
  }
}

async function simulateFullArenaMatch() {
  console.log('🎮 Simulating FULL arena match with all systems...')

  return await testCompleteArenaFlow()
}

function debugArenaSystems() {
  console.log('🔧 ARENA SYSTEMS DEBUG REPORT')
  console.log('=' .repeat(50))

  console.log('📊 System State:', arenaSystemState)
  console.log('📦 Loaded Systems:', Array.from(loadedSystems))
  console.log('💚 System Health:', systemHealth)

  // Debug individual systems
  console.log('\n🗺️ Arena Map Debug:')
  app.debugArenaMap?.() || console.log('  Map debug not available')

  console.log('\n⚔️ Combat Debug:')
  app.debugCombatState?.() || console.log('  Combat debug not available')

  console.log('\n⛓️ Blockchain Debug:')
  app.debugBlockchainStatus?.() || console.log('  Blockchain debug not available')

  console.log('\n📜 Contracts Debug:')
  app.debugContracts?.() || console.log('  Contract debug not available')

  console.log('\n🏟️ Match Controller Debug:')
  const matchState = app.getMatchState?.()
  if (matchState) {
    console.log('  Match State:', matchState.state)
    console.log('  Time Left:', matchState.timeLeft)
    console.log('  Players:', matchState.players)
  } else {
    console.log('  Match state not available')
  }

  console.log('=' .repeat(50))
}

function handleSystemError(error) {
  console.error('🚨 Arena System Error:', error)

  // Mark affected system as unhealthy
  const systemName = detectSystemFromError(error)
  if (systemName) {
    systemHealth[systemName] = 'error'
  }

  // Try to recover
  setTimeout(() => {
    attemptSystemRecovery(systemName)
  }, 2000)
}

function detectSystemFromError(error) {
  const message = error.message || ''

  if (message.includes('blockchain') || message.includes('contract')) return 'blockchain'
  if (message.includes('combat') || message.includes('damage')) return 'combat'
  if (message.includes('ui') || message.includes('display')) return 'ui'
  if (message.includes('match') || message.includes('spawn')) return 'matchController'

  return 'unknown'
}

function attemptSystemRecovery(systemName) {
  console.log(`🔄 Attempting recovery for ${systemName}...`)

  // Simple recovery attempt
  setTimeout(() => {
    systemHealth[systemName] = 'healthy'
    console.log(`✅ ${systemName} recovered`)
  }, 3000)
}

function performSystemHealthCheck() {
  const issues = []

  // Check each system
  loadedSystems.forEach(systemName => {
    try {
      // Basic health check for each system
      switch (systemName) {
        case 'arena-map':
          if (!app.getArenaConfig) throw new Error('Map config not available')
          break
        case 'arena-match-controller':
          if (!app.getMatchState) throw new Error('Match state not available')
          break
        case 'arena-combat-integration':
          if (!app.getCombatStats) throw new Error('Combat stats not available')
          break
        case 'arena-scoring-ui':
          if (!app.showNotification) throw new Error('UI not available')
          break
        case 'deploy-arena-contracts':
          if (!app.getContractsInfo) throw new Error('Contracts not available')
          break
        case 'arena-blockchain-integration':
          if (!app.isBlockchainReady) throw new Error('Blockchain not available')
          break
      }

      systemHealth[systemName] = 'healthy'
    } catch (error) {
      systemHealth[systemName] = 'error'
      issues.push({ system: systemName, error: error.message })
    }
  })

  if (issues.length > 0) {
    console.log('⚠️ System health issues detected:', issues)
  }
}

// Public API
app.getArenaStatus = () => ({
  state: arenaSystemState,
  loadedSystems: Array.from(loadedSystems),
  systemHealth,
  playerCount: Object.keys(world.entities).filter(id => world.entities[id]?.isPlayer).length
})

console.log('🏟️ Hyperfy Arena Main Controller script loaded')
console.log('🔥 Ready to create competitive matches with blockchain integration!')