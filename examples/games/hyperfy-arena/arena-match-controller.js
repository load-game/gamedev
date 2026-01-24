// 🔥 Hyperfy Arena - Match Controller
// Handles match flow, player spawning, respawning, and game state

app.configure({
  name: 'Hyperfy Arena Match Controller',
  description: 'Manages arena matches, scoring, and player lifecycle'
})

const MATCH_CONFIG = {
  // Match timing
  preMatchTime: 10,      // Seconds before match starts
  matchDuration: 180,    // 3 minutes
  postMatchTime: 5,      // Seconds after match ends

  // Respawn system
  respawnTime: 3,        // Seconds before respawn
  invulnerabilityTime: 2, // Seconds of spawn protection

  // Match rules
  minPlayers: 2,         // Minimum players to start
  maxPlayers: 8,         // Maximum players
  killPoints: 3,         // Points for elimination
  assistPoints: 1,       // Points for assist
}

// Match state
let matchState = 'waiting'  // waiting, countdown, active, ended, respawning
let matchTimer = 0
let matchEndTime = 0
let spawnPoints = []
let playerStats = new Map()  // playerId -> stats
let playerTimers = new Map() // playerId -> respawn timers

// Initialize match controller
app.on('init', () => {
  console.log('🏟️ Initializing Arena Match Controller...')

  // Wait for arena map to be ready
  world.on('arena:map-ready', (data) => {
    spawnPoints = data.spawnPoints
    console.log(`✅ Match controller ready with ${spawnPoints.length} spawn points`)

    // Setup match management
    setupMatchEvents()
    startMatchManager()
  })
})

function setupMatchEvents() {
  // Player death handling
  world.on('elemental-combat:player-died', handlePlayerDeath)

  // Player damage for assist tracking
  world.on('elemental-combat:player-damaged', handlePlayerDamaged)

  // Boundary violations
  world.on('arena:player-exit-boundary', handlePlayerExitBoundary)

  // New player joins
  world.on('player:joined', handlePlayerJoined)

  // Player leaves
  world.on('player:left', handlePlayerLeft)
}

function startMatchManager() {
  console.log('🎮 Starting match manager...')

  // Periodic match state updates
  setInterval(() => {
    updateMatchState()
  }, 1000)

  // Auto-start matches
  setTimeout(() => {
    tryStartMatch()
  }, 2000)
}

function tryStartMatch() {
  const activePlayers = getActivePlayers()

  if (activePlayers.length >= MATCH_CONFIG.minPlayers && matchState === 'waiting') {
    console.log(`🚀 Starting match with ${activePlayers.length} players`)
    startMatchCountdown()
  } else if (activePlayers.length < MATCH_CONFIG.minPlayers && matchState === 'waiting') {
    // Keep checking for enough players
    setTimeout(() => {
      tryStartMatch()
    }, 5000)
  }
}

function startMatchCountdown() {
  matchState = 'countdown'
  matchTimer = MATCH_CONFIG.preMatchTime

  console.log(`⏰ Match starting in ${matchTimer} seconds...`)
  world.emit('arena:match-countdown', [{ timeLeft: matchTimer }])

  const countdownInterval = setInterval(() => {
    matchTimer--
    world.emit('arena:match-countdown-update', [{ timeLeft: matchTimer }])

    if (matchTimer <= 0) {
      clearInterval(countdownInterval)
      startMatch()
    }
  }, 1000)
}

function startMatch() {
  matchState = 'active'
  matchEndTime = Date.now() + (MATCH_CONFIG.matchDuration * 1000)

  console.log('⚔️ ARENA MATCH STARTED!')

  // Initialize player stats
  const activePlayers = getActivePlayers()
  activePlayers.forEach(playerId => {
    initializePlayerStats(playerId)
    spawnPlayer(playerId)
  })

  world.emit('arena:match-started', [{
    duration: MATCH_CONFIG.matchDuration,
    players: activePlayers
  }])

  // Start match timer
  setTimeout(() => {
    endMatch()
  }, MATCH_CONFIG.matchDuration * 1000)
}

function initializePlayerStats(playerId) {
  if (!playerStats.has(playerId)) {
    playerStats.set(playerId, {
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      score: 0,
      spawnIndex: assignSpawnIndex(),
      isAlive: true,
      spawnProtectionUntil: 0
    })
  }
}

function assignSpawnIndex() {
  // Simple round-robin spawn assignment
  const nextIndex = playerStats.size % spawnPoints.length
  return nextIndex
}

function spawnPlayer(playerId) {
  const stats = playerStats.get(playerId)
  if (!stats) return

  const spawnPoint = spawnPoints[stats.spawnIndex]
  const player = world.entities[playerId]

  if (player && spawnPoint) {
    console.log(`🔄 Spawning player ${playerId} at spawn point ${stats.spawnIndex}`)

    // Reset player state
    stats.isAlive = true
    stats.spawnProtectionUntil = Date.now() + (MATCH_CONFIG.invulnerabilityTime * 1000)

    // Position player
    player.position = spawnPoint.pos
    player.rotation = spawnPoint.rot

    // Reset health (using elemental combat system)
    if (player.playerProxy) {
      player.playerProxy.heal(100) // Full heal
    }

    world.emit('arena:player-spawned', [{
      playerId,
      spawnPoint: stats.spawnIndex,
      position: spawnPoint.pos
    }])
  }
}

function handlePlayerDeath(playerId, killerId = null) {
  if (matchState !== 'active') return

  const stats = playerStats.get(playerId)
  if (!stats) return

  stats.isAlive = false
  stats.deaths++

  console.log(`💀 Player ${playerId} eliminated`)

  // Update killer stats
  if (killerId && killerId !== playerId) {
    const killerStats = playerStats.get(killerId)
    if (killerStats) {
      killerStats.kills++
      killerStats.score += MATCH_CONFIG.killPoints
      console.log(`🎯 Player ${killerId} scored a kill!`)
    }
  }

  // Update assists (players who damaged the victim)
  updateAssistStats(playerId, killerId)

  // Schedule respawn
  scheduleRespawn(playerId)

  // Check for match end conditions
  checkMatchEndConditions()

  world.emit('arena:-player-eliminated', [{
    playerId,
    killerId,
    stats: Array.from(playerStats.entries())
  }])
}

function handlePlayerDamaged(playerId, damage, dealerId, isCritical) {
  if (matchState !== 'active') return

  const stats = playerStats.get(playerId)
  if (!stats) return

  // Track damage for assists
  if (!stats.damageByDealer) stats.damageByDealer = new Map()
  stats.damageByDealer.set(dealerId, (stats.damageByDealer.get(dealerId) || 0) + damage)

  // Update dealer damage dealt
  if (dealerId) {
    const dealerStats = playerStats.get(dealerId)
    if (dealerStats) {
      dealerStats.damageDealt += damage
    }
  }
}

function updateAssistStats(victimId, killerId) {
  const victimStats = playerStats.get(victimId)
  if (!victimStats?.damageByDealer) return

  // Award assist points to players who damaged the victim (except the killer)
  for (const [dealerId, damage] of victimStats.damageByDealer) {
    if (dealerId !== killerId && damage > 0) {
      const dealerStats = playerStats.get(dealerId)
      if (dealerStats) {
        dealerStats.assists++
        dealerStats.score += MATCH_CONFIG.assistPoints
        console.log(`🤝 Player ${dealerId} got an assist!`)
      }
    }
  }

  // Clear damage tracking for victim
  victimStats.damageByDealer.clear()
}

function scheduleRespawn(playerId) {
  const respawnDelay = MATCH_CONFIG.respawnTime * 1000

  setTimeout(() => {
    if (matchState === 'active') {
      spawnPlayer(playerId)
    }
  }, respawnDelay)

  world.emit('arena:player-respawn-scheduled', [{
    playerId,
    respawnTime: MATCH_CONFIG.respawnTime
  }])
}

function handlePlayerExitBoundary(playerId) {
  if (matchState !== 'active') return

  const player = world.entities[playerId]
  if (player) {
    // Push player back towards arena center
    const centerDir = [-player.position[0], 0, -player.position[2]]
    const normalizedDir = normalizeVector(centerDir)

    // Apply impulse towards center
    if (player.physicsBody) {
      player.physicsBody.velocity = [
        normalizedDir[0] * 10,
        5, // Small upward boost
        normalizedDir[2] * 10
      ]
    }

    console.log(`⚠️ Pushed player ${playerId} back into arena`)
  }
}

function handlePlayerJoined(playerId) {
  console.log(`👋 Player ${playerId} joined arena`)

  if (matchState === 'active') {
    // Late join - spawn immediately
    initializePlayerStats(playerId)
    spawnPlayer(playerId)
  } else if (matchState === 'waiting') {
    // Waiting for match to start
    initializePlayerStats(playerId)

    // Check if we can start now
    if (getActivePlayers().length >= MATCH_CONFIG.minPlayers) {
      tryStartMatch()
    }
  }
}

function handlePlayerLeft(playerId) {
  console.log(`👋 Player ${playerId} left arena`)

  // Clean up player data
  playerStats.delete(playerId)
  playerTimers.delete(playerId)

  // Check match conditions
  if (matchState === 'active') {
    checkMatchEndConditions()
  }
}

function checkMatchEndConditions() {
  const activePlayers = getActivePlayers()
  const alivePlayers = activePlayers.filter(playerId => {
    const stats = playerStats.get(playerId)
    return stats?.isAlive
  })

  // End match if only 1 or 0 players alive
  if (alivePlayers.length <= 1) {
    endMatch()
  }
}

function endMatch() {
  if (matchState !== 'active') return

  matchState = 'ended'
  console.log('🏁 ARENA MATCH ENDED!')

  // Calculate final results
  const results = calculateMatchResults()
  const winner = results[0] // Top player

  world.emit('arena:match-ended', [{
    winner: winner?.playerId || null,
    results,
    duration: MATCH_CONFIG.matchDuration
  }])

  // Schedule next match
  setTimeout(() => {
    resetMatch()
    tryStartMatch()
  }, MATCH_CONFIG.postMatchTime * 1000)
}

function calculateMatchResults() {
  const results = Array.from(playerStats.entries()).map(([playerId, stats]) => ({
    playerId,
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    damageDealt: stats.damageDealt,
    score: stats.score,
    kdr: stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills
  }))

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score)

  return results
}

function resetMatch() {
  console.log('🔄 Resetting match state...')

  matchState = 'waiting'
  matchTimer = 0
  matchEndTime = 0

  // Reset player stats
  playerStats.clear()
  playerTimers.clear()

  world.emit('arena:match-reset', [])
}

function updateMatchState() {
  if (matchState === 'active') {
    const remainingTime = Math.max(0, Math.floor((matchEndTime - Date.now()) / 1000))
    world.emit('arena:match-time-update', [{ timeLeft: remainingTime }])
  }
}

function getActivePlayers() {
  return Object.keys(world.entities).filter(id => {
    const entity = world.entities[id]
    return entity?.isPlayer && entity.playerProxy
  })
}

function normalizeVector(vec) {
  const magnitude = Math.sqrt(vec[0]**2 + vec[1]**2 + vec[2]**2)
  return magnitude > 0 ? vec.map(v => v / magnitude) : [0, 0, 0]
}

// Public API
app.getMatchState = () => ({
  state: matchState,
  timeLeft: matchState === 'active' ? Math.max(0, Math.floor((matchEndTime - Date.now()) / 1000)) : 0,
  players: getActivePlayers().length,
  stats: Array.from(playerStats.entries())
})

app.forceStartMatch = () => {
  if (matchState === 'waiting') {
    tryStartMatch()
  }
}

app.endMatch = () => {
  if (matchState === 'active') {
    endMatch()
  }
}

console.log('🎮 Hyperfy Arena Match Controller script loaded')