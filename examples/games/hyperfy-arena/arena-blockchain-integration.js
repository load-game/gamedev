// 🔥 Hyperfy Arena - Blockchain Integration
// Records arena tournament results on the blockchain via DojoEngine

app.configure({
  name: 'Hyperfy Arena Blockchain Integration',
  description: 'Records match results and awards blockchain titles/rewards'
})

const INTEGRATION_CONFIG = {
  // Blockchain recording settings
 .autoRecordMatches: true,
  minScoreForRecording: 10,    // Minimum score to qualify for blockchain
  minPlayersForRecording: 2,   // Minimum players for official tournament

  // Reward thresholds
  championTitleThreshold: 5,   // Wins needed for Warrior title
  legendaryTitleThreshold: 20, // Wins needed for Champion title
  skinRewardThreshold: 100,    // Score needed for special weapon skin

  // Network settings
  retryFailedTransactions: true,
  maxRetries: 3,
  retryDelay: 2000,

  // Season settings
  currentSeason: 1,
  seasonDuration: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
}

let blockchainReady = false
let pendingTransactions = new Map()
let tournamentHistory = []
let seasonStartTime = Date.now()

// Initialize blockchain integration
app.on('init', () => {
  console.log('🔗 Initializing Arena Blockchain Integration...')

  // Wait for contracts to be ready
  world.on('arena:contracts-ready', () => {
    console.log('✅ Arena contracts ready - enabling blockchain integration')
    blockchainReady = true
    setupBlockchainEvents()
  })

  // Initialize season tracking
  initializeSeasonTracking()
})

function setupBlockchainEvents() {
  console.log('📡 Setting up blockchain event handlers...')

  // Listen for match end to record results
  world.on('arena:match-ended', handleMatchEnded)

  // Listen for player elimination to track achievements
  world.on('arena:player-eliminated', handlePlayerElimination)

  // Listen for high score events
  world.on('arena:high-score', handleHighScore)

  // Listen for contract ready to process pending transactions
  world.on('arena:contracts-ready', processPendingTransactions)
}

async function handleMatchEnded(data) {
  if (!INTEGRATION_CONFIG.autoRecordMatches || !blockchainReady) {
    console.log('⏸️ Blockchain recording disabled or not ready')
    return
  }

  const { winner, results, duration } = data

  console.log('🏁 Processing match end for blockchain recording...')
  console.log('- Winner:', winner)
  console.log('- Results count:', results.length)

  try {
    // Check if match qualifies for blockchain recording
    if (!qualifiesForBlockchainRecording(results)) {
      console.log('⏭️ Match does not qualify for blockchain recording')
      return
    }

    // Prepare blockchain transaction data
    const transactionData = prepareMatchTransaction(winner, results, duration)

    // Record match result on blockchain
    await recordMatchResultOnBlockchain(transactionData)

    // Award champion titles and skins
    await awardAchievements(results)

    // Update tournament history
    addToTournamentHistory(transactionData)

    console.log('✅ Match results recorded on blockchain!')

  } catch (error) {
    console.error('❌ Failed to record match results on blockchain:', error)

    // Add to pending transactions for retry
    addPendingTransaction('match_result', { winner, results, duration })
  }
}

function qualifiesForBlockchainRecording(results) {
  // Check minimum player count
  if (results.length < INTEGRATION_CONFIG.minPlayersForRecording) {
    console.log(`❌ Not enough players: ${results.length} < ${INTEGRATION_CONFIG.minPlayersForRecording}`)
    return false
  }

  // Check if at least one player meets minimum score
  const qualifiesScore = results.some(result => result.score >= INTEGRATION_CONFIG.minScoreForRecording)
  if (!qualifiesScore) {
    console.log('❌ No players meet minimum score threshold')
    return false
  }

  return true
}

function prepareMatchTransaction(winner, results, duration) {
  // Generate unique match ID
  const matchId = generateMatchId()

  // Prepare participant data arrays
  const participants = []
  const playerScores = []
  const playerKills = []

  results.forEach(result => {
    participants.push(result.playerId)
    playerScores.push(result.score)
    playerKills.push(result.kills)
  })

  return {
    matchId,
    winner,
    participants,
    playerScores,
    playerKills,
    duration: Math.floor(duration / 1000), // Convert to seconds
    seasonId: INTEGRATION_CONFIG.currentSeason,
    tournamentType: 0, // Deathmatch
    timestamp: Date.now()
  }
}

function generateMatchId() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  return `arena_match_${timestamp}_${random}`
}

async function recordMatchResultOnBlockchain(transactionData) {
  console.log('📡 Recording match result on blockchain...')
  console.log('- Match ID:', transactionData.matchId)
  console.log('- Participants:', transactionData.participants.length)
  console.log('- Top Score:', Math.max(...transactionData.playerScores))

  try {
    // Execute blockchain transaction via the contract deployer
    const result = await app.executeContractCall?.('record_match_result', [
      transactionData.matchId,
      transactionData.winner,
      transactionData.participants,
      transactionData.playerScores,
      transactionData.playerKills,
      transactionData.seasonId,
      transactionData.tournamentType
    ])

    console.log('✅ Blockchain transaction result:', result)
    return result

  } catch (error) {
    console.error('❌ Blockchain transaction failed:', error)
    throw error
  }
}

async function awardAchievements(results) {
  console.log('🏆 Awarding blockchain achievements...')

  for (const result of results) {
    await checkAndAwardTitle(result)
    await checkAndAwardSkin(result)
  }
}

async function checkAndAwardTitle(result) {
  const { playerId, kills, score } = result

  try {
    // Get player's blockchain stats
    const playerStats = await app.getPlayerStats?.(playerId)

    if (!playerStats) {
      console.log(`⚠️ No blockchain stats found for player ${playerId}`)
      return
    }

    const totalWins = playerStats.total_wins || 0
    const newTotalWins = totalWins + (result.score > 0 ? 1 : 0)

    // Determine if player qualifies for new title
    const title = determinePlayerTitle(newTotalWins)
    const titleName = getTitleName(title)

    if (title > (playerStats.current_title || 0)) {
      console.log(`🎖️ Awarding "${titleName}" title to player ${playerId}`)

      await app.executeContractCall?.('award_champion_title', [
        playerId,
        title,
        titleName,
        generateMatchId() // Use current match as tournament reference
      ])

      // Show notification to player
      if (isLocalPlayer(playerId)) {
        app.showNotification?.(`🏆 New Title: ${titleName}!`, [1, 0.8, 0], 5000)
      }
    }

  } catch (error) {
    console.error(`❌ Failed to award title to player ${playerId}:`, error)
  }
}

async function checkAndAwardSkin(result) {
  const { playerId, score, kills } = result

  // Check if player qualifies for special weapon skin
  if (score >= INTEGRATION_CONFIG.skinRewardThreshold || kills >= 15) {
    try {
      const (skinType, skinName, rarity) = determineSkinReward(score, kills)
      const matchId = generateMatchId()

      console.log(`⚔️ Minting "${skinName}" skin for player ${playerId}`)

      const tokenId = await app.executeContractCall?.('mint_weapon_skin', [
        playerId,
        skinType,
        skinName,
        matchId,
        rarity
      ])

      console.log(`✅ Weapon skin minted with token ID: ${tokenId}`)

      // Show notification to player
      if (isLocalPlayer(playerId)) {
        app.showNotification?.(`⚔️ New Skin: ${skinName}!`, [0.2, 0.8, 1], 4000)
      }

    } catch (error) {
      console.error(`❌ Failed to mint skin for player ${playerId}:`, error)
    }
  }
}

function determinePlayerTitle(totalWins) {
  if (totalWins >= INTEGRATION_CONFIG.legendaryTitleThreshold) {
    return 3 // Legend
  } else if (totalWins >= INTEGRATION_CONFIG.championTitleThreshold) {
    return 2 // Champion
  } else if (totalWins >= 1) {
    return 1 // Warrior
  } else {
    return 0 // Novice
  }
}

function getTitleName(title) {
  const titles = ['Arena Novice', 'Arena Warrior', 'Arena Champion', 'Arena Legend']
  return titles[title] || 'Arena Novice'
}

function determineSkinReward(score, kills) {
  if (score >= 200 || kills >= 20) {
    return [3, 'Legendary Champion', 4] // Legendary
  } else if (score >= 150 || kills >= 15) {
    return [2, 'Elite Warrior', 3] // Epic
  } else if (score >= 100 || kills >= 10) {
    return [1, 'Skilled Fighter', 2] // Rare
  } else {
    return [0, 'Combatant', 1] // Common
  }
}

function handlePlayerElimination(playerId, killerId) {
  // Track special achievements like kill streaks
  // This could be expanded based on game mechanics
  console.log(`🔪 Player elimination: ${killerId} -> ${playerId}`)
}

function handleHighScore(data) {
  const { playerId, score } = data

  if (score >= INTEGRATION_CONFIG.skinRewardThreshold) {
    console.log(`🎯 High score achievement: ${playerId} scored ${score}`)
  }
}

function addToTournamentHistory(transactionData) {
  const historyEntry = {
    ...transactionData,
    recordedAt: Date.now(),
    status: 'recorded'
  }

  tournamentHistory.push(historyEntry)

  // Keep only last 100 entries
  if (tournamentHistory.length > 100) {
    tournamentHistory = tournamentHistory.slice(-100)
  }
}

function addPendingTransaction(type, data) {
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  pendingTransactions.set(id, {
    type,
    data,
    timestamp: Date.now(),
    retries: 0
  })

  console.log(`⏳ Added pending transaction: ${id}`)
}

async function processPendingTransactions() {
  console.log(`🔄 Processing ${pendingTransactions.size} pending transactions...`)

  const transactions = Array.from(pendingTransactions.entries())

  for (const [id, transaction] of transactions) {
    try {
      if (transaction.retries >= INTEGRATION_CONFIG.maxRetries) {
        console.log(`❌ Giving up on transaction ${id} after ${transaction.retries} retries`)
        pendingTransactions.delete(id)
        continue
      }

      // Process based on type
      if (transaction.type === 'match_result') {
        await handleMatchEnded(transaction.data)
        pendingTransactions.delete(id)
      }

    } catch (error) {
      console.error(`❌ Failed to process pending transaction ${id}:`, error)
      transaction.retries++
      transaction.lastAttempt = Date.now()
    }
  }
}

function initializeSeasonTracking() {
  seasonStartTime = Date.now()

  // Check for season rollover periodically
  setInterval(() => {
    checkSeasonRollover()
  }, 60000) // Check every minute
}

function checkSeasonRollover() {
  const seasonElapsed = Date.now() - seasonStartTime

  if (seasonElapsed >= INTEGRATION_CONFIG.seasonDuration) {
    console.log('📅 Season rollover detected!')
    INTEGRATION_CONFIG.currentSeason++
    seasonStartTime = Date.now()

    // Reset seasonal data and archive previous season
    archivePreviousSeason(INTEGRATION_CONFIG.currentSeason - 1)
  }
}

function archivePreviousSeason(seasonId) {
  console.log(`📦 Archiving season ${seasonId} data...`)

  // This could export seasonal data to files or long-term storage
  // For now, just log the season change
  tournamentHistory.filter(entry => entry.seasonId === seasonId)
    .forEach(entry => {
      entry.archived = true
      entry.archivedAt = Date.now()
    })
}

function isLocalPlayer(playerId) {
  // Check if this is the local player
  for (const [id, entity] of Object.entries(world.entities)) {
    if (entity.isPlayer && entity.isLocalPlayer && id === playerId) {
      return true
    }
  }
  return false
}

// Public API for other arena systems
app.isBlockchainReady = () => blockchainReady

app.getTournamentHistory = () => [...tournamentHistory]

app.getPlayerBlockchainStats = async (playerId) => {
  if (!blockchainReady) return null

  try {
    const [stats, titles, skins] = await Promise.all([
      app.getPlayerStats?.(playerId),
      app.getPlayerTitles?.(playerId),
      app.getPlayerSkins?.(playerId)
    ])

    return { stats, titles, skins }
  } catch (error) {
    console.error('❌ Failed to get blockchain stats:', error)
    return null
  }
}

app.forceRecordMatch = async (matchData) => {
  if (!blockchainReady) {
    throw new Error('Blockchain integration not ready')
  }

  return await recordMatchResultOnBlockchain(matchData)
}

// Debug utilities
app.debugBlockchainStatus = () => {
  console.log('🔧 Blockchain Integration Debug:')
  console.log('- Ready:', blockchainReady)
  console.log('- Pending Transactions:', pendingTransactions.size)
  console.log('- Tournament History:', tournamentHistory.length)
  console.log('- Current Season:', INTEGRATION_CONFIG.currentSeason)
  console.log('- Auto Record:', INTEGRATION_CONFIG.autoRecordMatches)

  const contractsInfo = app.getContractsInfo?.()
  if (contractsInfo) {
    console.log('- Contract Status:', contractsInfo.status)
  }
}

console.log('🔗 Hyperfy Arena Blockchain Integration script loaded')