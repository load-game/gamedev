// 🔥 Hyperfy Arena - Scoring & UI System
// Real-time score tracking, leaderboard, and match HUD

app.configure({
  name: 'Hyperfy Arena Scoring UI',
  description: 'Real-time scoring, leaderboards, and match interface'
})

const UI_CONFIG = {
  // UI positioning
  hudPosition: [20, 80],  // x, y percentages from top-left
  leaderboardPosition: [80, 20], // x, y percentages from top-left

  // UI sizing
  hudHeight: 150,
  leaderboardWidth: 300,
  leaderboardHeight: 400,

  // Update frequencies
  scoreUpdateInterval: 100,  // ms
  leaderboardUpdateInterval: 1000, // ms

  // Visual settings
  maxLeaderboardEntries: 8,
  showFullMatchTime: true,
  highlightLocalPlayer: true
}

// UI state
let hudElements = {}
let leaderboardElement = null
let matchTimerElement = null
let scoreUpdateTicker = null
let leaderboardUpdateTicker = null
let localPlayerId = null

// Initialize scoring and UI
app.on('init', () => {
  console.log('📊 Initializing Arena Scoring and UI...')

  // Find local player (will be available after world loads)
  setTimeout(() => {
    findLocalPlayer()
    createHUD()
    createLeaderboard()
    setupEventListeners()
    startUIUpdates()
  }, 2000)
})

function findLocalPlayer() {
  // Find the local player entity
  for (const [id, entity] of Object.entries(world.entities)) {
    if (entity.isPlayer && entity.isLocalPlayer) {
      localPlayerId = id
      console.log(`🎮 Local player found: ${id}`)
      break
    }
  }
}

function createHUD() {
  console.log('🖼️ Creating arena HUD...')

  // Main HUD container
  const hudContainer = app.create('ui', {
    name: 'ArenaHUD',
    position: [UI_CONFIG.hudPosition[0], UI_CONFIG.hudPosition[1], 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: true,
    width: 400,
    height: UI_CONFIG.hudHeight,
    material: {
      color: [0, 0, 0, 0.7], // Semi-transparent black background
      opacity: 0.8
    }
  })

  hudElements.container = hudContainer

  // Match timer
  matchTimerElement = app.create('text', {
    name: 'MatchTimer',
    position: [0, 120, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: true,
    text: 'WAITING FOR MATCH',
    fontSize: 3,
    color: [1, 1, 1],
    parent: hudContainer
  })

  hudElements.timer = matchTimerElement

  // Local player score
  const localScoreText = app.create('text', {
    name: 'LocalScore',
    position: [0, 80, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: true,
    text: 'YOUR SCORE: 0',
    fontSize: 2,
    color: [0.2, 1, 0.2],
    parent: hudContainer
  })

  hudElements.localScore = localScoreText

  // Player status (health, kills, etc.)
  const playerStatusText = app.create('text', {
    name: 'PlayerStatus',
    position: [0, 50, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: true,
    text: 'HP: 100 | K: 0 | D: 0',
    fontSize: 1.5,
    color: [1, 1, 1],
    parent: hudContainer
  })

  hudElements.playerStatus = playerStatusText

  // Match countdown/notifications
  const notificationText = app.create('text', {
    name: 'MatchNotification',
    position: [0, 20, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: false,
    text: '',
    fontSize: 2,
    color: [1, 1, 0],
    parent: hudContainer
  })

  hudElements.notification = notificationText

  console.log('✅ HUD created')
}

function createLeaderboard() {
  console.log('🏆 Creating arena leaderboard...')

  // Leaderboard container
  const leaderboardContainer = app.create('ui', {
    name: 'ArenaLeaderboard',
    position: [UI_CONFIG.leaderboardPosition[0], UI_CONFIG.leaderboardPosition[1], 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: true,
    width: UI_CONFIG.leaderboardWidth,
    height: UI_CONFIG.leaderboardHeight,
    material: {
      color: [0, 0, 0, 0.7],
      opacity: 0.8
    }
  })

  leaderboardElement = leaderboardContainer

  // Leaderboard title
  const titleText = app.create('text', {
    name: 'LeaderboardTitle',
    position: [0, UI_CONFIG.leaderboardHeight - 30, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    collisionEnabled: false,
    visible: true,
    text: '🏆 LEADERBOARD',
    fontSize: 2.5,
    color: [1, 0.8, 0],
    parent: leaderboardContainer
  })

  // Create leaderboard entry slots
  for (let i = 0; i < UI_CONFIG.maxLeaderboardEntries; i++) {
    const entryText = app.create('text', {
      name: `LeaderboardEntry_${i}`,
      position: [0, UI_CONFIG.leaderboardHeight - 60 - (i * 35), 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      collisionEnabled: false,
      visible: true,
      text: `${i + 1}. --- 0 pts`,
      fontSize: 1.8,
      color: i < 3 ? [1, 0.8, 0] : [1, 1, 1], // Gold for top 3
      parent: leaderboardContainer
    })
  }

  console.log('✅ Leaderboard created')
}

function setupEventListeners() {
  console.log('📡 Setting up UI event listeners...')

  // Match state changes
  world.on('arena:match-countdown', (data) => {
    showCountdown(data.timeLeft)
  })

  world.on('arena:match-started', () => {
    hideNotification()
    updateMatchStatus('MATCH IN PROGRESS')
  })

  world.on('arena:match-ended', (data) => {
    showMatchResults(data)
  })

  world.on('arena:match-time-update', (data) => {
    updateMatchTimer(data.timeLeft)
  })

  // Player events
  world.on('arena:player-eliminated', (data) => {
    const [playerId, killerId] = data
    showKillNotification(playerId, killerId)
  })

  world.on('arena:player-spawned', (data) => {
    const { playerId } = data
    if (playerId === localPlayerId) {
      updateLocalHUD()
    }
  })

  // Score updates
  world.on('arena:score-updated', updateScores)
}

function startUIUpdates() {
  console.log('⏰ Starting UI update loops...')

  // Real-time score updates
  scoreUpdateTicker = setInterval(() => {
    updateLocalHUD()
    updateLeaderboard()
  }, UI_CONFIG.scoreUpdateInterval)

  // Leaderboard updates
  leaderboardUpdateTicker = setInterval(() => {
    updateLeaderboard()
  }, UI_CONFIG.leaderboardUpdateInterval)
}

function updateMatchTimer(timeLeft) {
  if (!matchTimerElement) return

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`

  matchTimerElement.text = timeString

  // Change color based on time left
  if (timeLeft <= 30) {
    matchTimerElement.color = [1, 0.2, 0.2] // Red
  } else if (timeLeft <= 60) {
    matchTimerElement.color = [1, 1, 0] // Yellow
  } else {
    matchTimerElement.color = [1, 1, 1] // White
  }
}

function updateLocalHUD() {
  if (!localPlayerId) return

  const matchState = app.getMatchState?.()
  if (!matchState) return

  const localStats = matchState.stats?.find(([id, stats]) => id === localPlayerId)
  const [, stats] = localStats || [localPlayerId, {}]

  // Update local score
  if (hudElements.localScore) {
    hudElements.localScore.text = `YOUR SCORE: ${stats.score || 0}`
  }

  // Update player status
  const combatStats = app.getCombatStats?.(localPlayerId)
  if (hudElements.playerStats && combatStats) {
    const kdr = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills
    hudElements.playerStats.text = `HP: ${combatStats.health}/${combatStats.maxHealth} | K: ${stats.kills || 0} | D: ${stats.deaths || 0} | K/D: ${kdr}`
  }
}

function updateLeaderboard() {
  if (!leaderboardElement) return

  const matchState = app.getMatchState?.()
  if (!matchState) return

  const sortedStats = matchState.stats
    ?.map(([id, stats]) => ({ playerId: id, ...stats }))
    ?.sort((a, b) => b.score - a.score) || []

  // Update leaderboard entries
  for (let i = 0; i < UI_CONFIG.maxLeaderboardEntries; i++) {
    const entryText = leaderboardElement.children?.find(child => child.name === `LeaderboardEntry_${i}`)
    if (!entryText) continue

    if (i < sortedStats.length) {
      const player = sortedStats[i]
      const isLocalPlayer = player.playerId === localPlayerId
      const playerName = isLocalPlayer ? 'YOU' : `P${player.playerId.slice(-4)}`
      const kdr = player.deaths > 0 ? (player.kills / player.deaths).toFixed(1) : player.kills

      entryText.text = `${i + 1}. ${playerName} ${player.score}pts (K:${player.kills} D:${player.deaths} K/D:${kdr})`
      entryText.color = isLocalPlayer && UI_CONFIG.highlightLocalPlayer ? [0.2, 1, 0.2] : (i < 3 ? [1, 0.8, 0] : [1, 1, 1])
    } else {
      entryText.text = `${i + 1}. --- 0 pts`
      entryText.color = [0.5, 0.5, 0.5]
    }
  }
}

function showCountdown(timeLeft) {
  if (!hudElements.notification) return

  if (timeLeft > 0) {
    hudElements.notification.text = `MATCH STARTS IN: ${timeLeft}`
    hudElements.notification.visible = true
    hudElements.notification.color = [1, 1, 0]
  } else {
    hudElements.notification.text = 'GO!'
    hudElements.notification.color = [0, 1, 0]

    setTimeout(() => {
      if (hudElements.notification) {
        hudElements.notification.visible = false
      }
    }, 1500)
  }
}

function showKillNotification(victimId, killerId) {
  if (!hudElements.notification) return

  const victimName = victimId === localPlayerId ? 'YOU' : `P${victimId.slice(-4)}`
  const killerName = killerId === localPlayerId ? 'YOU' : `P${killerId.slice(-4)}`

  let message = ''
  let color = [1, 1, 1]

  if (killerId === victimId) {
    message = `${victimName} eliminated themselves`
    color = [0.5, 0.5, 0.5]
  } else if (victimId === localPlayerId) {
    message = `You were eliminated by ${killerName}`
    color = [1, 0.2, 0.2]
  } else if (killerId === localPlayerId) {
    message = `You eliminated ${victimName}!`
    color = [0.2, 1, 0.2]
  } else {
    message = `${killerName} eliminated ${victimName}`
  }

  hudElements.notification.text = message
  hudElements.notification.color = color
  hudElements.notification.visible = true

  setTimeout(() => {
    if (hudElements.notification) {
      hudElements.notification.visible = false
    }
  }, 3000)
}

function showMatchResults(data) {
  const { winner, results } = data

  if (hudElements.notification) {
    const winnerName = winner === localPlayerId ? 'YOU WIN!' : `P${winner.slice(-4)} WINS!`
    hudElements.notification.text = `🏆 ${winnerName}`
    hudElements.notification.color = [1, 0.8, 0]
    hudElements.notification.visible = true

    setTimeout(() => {
      if (hudElements.notification) {
        hudElements.notification.visible = false
      }
    }, 5000)
  }

  updateMatchStatus('MATCH FINISHED')
}

function updateMatchStatus(status) {
  if (matchTimerElement) {
    matchTimerElement.text = status
    matchTimerElement.color = [1, 1, 1]
  }
}

function hideNotification() {
  if (hudElements.notification) {
    hudElements.notification.visible = false
  }
}

// Cleanup
app.on('cleanup', () => {
  console.log('🧹 Cleaning up arena scoring UI...')

  // Clear update intervals
  if (scoreUpdateTicker) clearInterval(scoreUpdateTicker)
  if (leaderboardUpdateTicker) clearInterval(leaderboardUpdateTicker)

  // Destroy UI elements
  Object.values(hudElements).forEach(element => {
    try {
      if (element) element.destroy()
    } catch (e) {
      console.warn('Failed to destroy HUD element:', e)
    }
  })

  if (leaderboardElement) {
    try {
      leaderboardElement.destroy()
    } catch (e) {
      console.warn('Failed to destroy leaderboard:', e)
    }
  }

  hudElements = {}
  leaderboardElement = null
  matchTimerElement = null
})

// Public API
app.showNotification = (message, color = [1, 1, 1], duration = 3000) => {
  if (hudElements.notification) {
    hudElements.notification.text = message
    hudElements.notification.color = color
    hudElements.notification.visible = true

    setTimeout(() => {
      if (hudElements.notification) {
        hudElements.notification.visible = false
      }
    }, duration)
  }
}

app.updateScores = (newScores) => {
  // Force immediate score update
  updateLocalHUD()
  updateLeaderboard()
}

console.log('📊 Hyperfy Arena Scoring UI script loaded')