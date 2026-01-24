// Cartridge Gaming Integration - Game-focused wallet features

// Configure gaming properties
app.configure([
  {
    key: 'uiSpace',
    type: 'switch',
    label: 'UI Space',
    hint: 'Display in screen space or world space.',
    options: [
      { label: 'Screen', value: 'screen' },
      { label: 'World', value: 'world' },
    ],
    initial: 'screen',
  },
  {
    key: 'gameMode',
    type: 'switch',
    label: 'Game Mode',
    hint: 'Interface style for gaming context.',
    options: [
      { label: 'HUD', value: 'hud' },
      { label: 'Menu', value: 'menu' },
    ],
    initial: 'hud',
  },
  {
    key: 'sessionKeyEnabled',
    type: 'switch',
    label: 'Session Keys',
    hint: 'Enable session key management for seamless gameplay.',
    options: [
      { label: 'Enabled', value: true },
      { label: 'Disabled', value: false },
    ],
    initial: true,
  },
  {
    key: 'achievementsEnabled',
    type: 'switch',
    label: 'Achievements',
    hint: 'Show achievement tracking and notifications.',
    options: [
      { label: 'Enabled', value: true },
      { label: 'Disabled', value: false },
    ],
    initial: true,
  },
])

// Gaming state
app.state.connected = false
app.state.address = null
app.state.username = ''
app.state.sessionKeyActive = false
app.state.achievements = []
app.state.inventorySlots = 12
app.state.items = []
app.state.gameTokens = []
app.state.questProgress = {}

// Get attachment point with fallback
let gameBody = app.get('CartridgeLogo')
if (!gameBody) {
  console.log('[Gaming] CartridgeLogo not found, using app object as attachment point')
  gameBody = app
}

// Gaming color scheme - optimized for game UI
const gameColors = {
  hud: {
    bg: 'rgba(0, 0, 0, 0.85)',
    accent: '#00ffcc',
    success: '#00cc66',
    warning: '#ffaa00',
    error: '#ff3366',
    neutral: '#8899aa',
    panel: 'rgba(0, 20, 40, 0.9)',
    border: '#00ffcc',
  },
  menu: {
    bg: 'rgba(20, 25, 35, 0.95)',
    accent: '#10b981',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    neutral: '#6b7280',
    panel: 'rgba(255, 255, 255, 0.05)',
    border: '#10b981',
  }
}

function getColors() {
  return gameColors[app.props.gameMode] || gameColors.hud
}

// Main gaming container
const gamingUI = app.create('ui', {
  space: 'screen',
  pivot: app.props.gameMode === 'hud' ? 'top-right' : 'top-center',
  position: app.props.gameMode === 'hud' ? [0.98, 0.15, 0] : [0.5, 0.05, 0],
  width: app.props.gameMode === 'hud' ? 180 : 400,
  height: app.props.gameMode === 'hud' ? 300 : 600,
  backgroundColor: getColors().bg,
  borderRadius: app.props.gameMode === 'hud' ? 6 : 12,
  padding: app.props.gameMode === 'hud' ? 8 : 16,
  flexDirection: 'column',
  gap: 8,
  borderWidth: app.props.gameMode === 'hud' ? 1 : 2,
  borderColor: getColors().border,
})

// Quick status indicator (HUD mode)
if (app.props.gameMode === 'hud') {
  const statusIndicator = app.create('uiview', {
    width: 164,
    height: 40,
    backgroundColor: getColors().panel,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  })

  const statusText = app.create('uitext', {
    value: '🎮 GAME WALLET',
    color: getColors().accent,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  })

  statusIndicator.add(statusText)
  gamingUI.add(statusIndicator)
}

// Connection status
const connectionStatus = app.create('uiview', {
  width: app.props.gameMode === 'hud' ? 164 : 368,
  height: app.props.gameMode === 'hud' ? 30 : 50,
  backgroundColor: getColors().panel,
  borderRadius: app.props.gameMode === 'hud' ? 4 : 8,
  justifyContent: 'center',
  alignItems: 'center',
})

const connectionText = app.create('uitext', {
  value: '🔌 Not Connected',
  color: getColors().neutral,
  fontSize: app.props.gameMode === 'hud' ? 10 : 12,
  fontWeight: 'bold',
  textAlign: 'center',
})

connectionStatus.add(connectionText)
gamingUI.add(connectionStatus)

// Session key status (if enabled)
if (app.props.sessionKeyEnabled) {
  const sessionStatus = app.create('uiview', {
    width: app.props.gameMode === 'hud' ? 164 : 368,
    height: app.props.gameMode === 'hud' ? 30 : 40,
    backgroundColor: getColors().panel,
    borderRadius: app.props.gameMode === 'hud' ? 4 : 8,
    justifyContent: 'center',
    alignItems: 'center',
  })

  const sessionText = app.create('uitext', {
    value: '🔑 Session: OFF',
    color: getColors().warning,
    fontSize: app.props.gameMode === 'hud' ? 10 : 11,
    fontWeight: 'bold',
    textAlign: 'center',
  })

  sessionStatus.add(sessionText)
  gamingUI.add(sessionStatus)
}

// Game stats (Menu mode specific)
if (app.props.gameMode === 'menu') {
  const statsHeader = app.create('uitext', {
    value: '📊 PLAYER STATS',
    color: getColors().accent,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  })
  gamingUI.add(statsHeader)

  // Player stats panel
  const statsPanel = app.create('uiview', {
    width: 368,
    height: 100,
    backgroundColor: getColors().panel,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'column',
    gap: 6,
  })

  const usernameDisplay = app.create('uitext', {
    value: 'Player: Not Connected',
    color: getColors().neutral,
    fontSize: 13,
    fontWeight: 'bold',
  })

  const walletInfo = app.create('uitext', {
    value: 'Wallet: ---',
    color: getColors().neutral,
    fontSize: 11,
  })

  const gameplayTime = app.create('uitext', {
    value: 'Session: 00:00:00',
    color: getColors().neutral,
    fontSize: 11,
  })

  statsPanel.add(usernameDisplay)
  statsPanel.add(walletInfo)
  statsPanel.add(gameplayTime)
  gamingUI.add(statsPanel)
}

// Achievements section (if enabled)
if (app.props.achievementsEnabled) {
  if (app.props.gameMode === 'menu') {
    const achievementsHeader = app.create('uitext', {
      value: '🏆 ACHIEVEMENTS',
      color: getColors().accent,
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    })
    gamingUI.add(achievementsHeader)
  }

  const achievementsPanel = app.create('uiview', {
    width: app.props.gameMode === 'hud' ? 164 : 368,
    height: app.props.gameMode === 'hud' ? 60 : 120,
    backgroundColor: getColors().panel,
    borderRadius: app.props.gameMode === 'hud' ? 4 : 8,
    padding: app.props.gameMode === 'hud' ? 6 : 12,
    flexDirection: 'column',
    gap: 4,
  })

  const achievementsTitle = app.create('uitext', {
    value: app.props.gameMode === 'hud' ? '🏆' : 'Recent Achievements',
    color: getColors().accent,
    fontSize: app.props.gameMode === 'hud' ? 10 : 12,
    fontWeight: 'bold',
    textAlign: 'center',
  })

  const achievementsList = app.create('uitext', {
    value: '🎮 First Login • 💎 Treasure Hunter',
    color: getColors().neutral,
    fontSize: app.props.gameMode === 'hud' ? 9 : 11,
    textAlign: app.props.gameMode === 'hud' ? 'center' : 'left',
  })

  achievementsPanel.add(achievementsTitle)
  achievementsPanel.add(achievementsList)
  gamingUI.add(achievementsPanel)
}

// Inventory section
if (app.props.gameMode === 'menu') {
  const inventoryHeader = app.create('uitext', {
    value: '🎒 INVENTORY',
    color: getColors().accent,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  })
  gamingUI.add(inventoryHeader)

  const inventoryGrid = app.create('uiview', {
    width: 368,
    height: 200,
    backgroundColor: getColors().panel,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  })

  // Create inventory slots
  for (let i = 0; i < app.state.inventorySlots; i++) {
    const slot = app.create('uiview', {
      width: 50,
      height: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: i < 2 ? getColors().accent : getColors().neutral,
      justifyContent: 'center',
      alignItems: 'center',
    })

    const slotText = app.create('uitext', {
      value: i < 2 ? '⚔️' : '📦',
      fontSize: 20,
      textAlign: 'center',
    })

    slot.add(slotText)
    inventoryGrid.add(slot)
  }

  gamingUI.add(inventoryGrid)
}

// Game tokens section
if (app.props.gameMode === 'menu') {
  const tokensHeader = app.create('uitext', {
    value: '💰 GAME TOKENS',
    color: getColors().accent,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  })
  gamingUI.add(tokensHeader)

  const tokensPanel = app.create('uiview', {
    width: 368,
    height: 80,
    backgroundColor: getColors().panel,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  })

  const goldDisplay = app.create('uiview', {
    width: 100,
    height: 60,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  })

  const goldIcon = app.create('uitext', {
    value: '🪙',
    fontSize: 20,
  })

  const goldAmount = app.create('uitext', {
    value: '1,250',
    color: getColors().warning,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  })

  goldDisplay.add(goldIcon)
  goldDisplay.add(goldAmount)

  const gemDisplay = app.create('uiview', {
    width: 100,
    height: 60,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  })

  const gemIcon = app.create('uitext', {
    value: '💎',
    fontSize: 20,
  })

  const gemAmount = app.create('uitext', {
    value: '89',
    color: getColors().accent,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  })

  gemDisplay.add(gemIcon)
  gemDisplay.add(gemAmount)

  const energyDisplay = app.create('uiview', {
    width: 100,
    height: 60,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  })

  const energyIcon = app.create('uitext', {
    value: '⚡',
    fontSize: 20,
  })

  const energyAmount = app.create('uitext', {
    value: '75%',
    color: getColors().success,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  })

  energyDisplay.add(energyIcon)
  energyDisplay.add(energyAmount)

  tokensPanel.add(goldDisplay)
  tokensPanel.add(gemDisplay)
  tokensPanel.add(energyDisplay)
  gamingUI.add(tokensPanel)
}

// Action buttons
const actionButtons = app.create('uiview', {
  width: app.props.gameMode === 'hud' ? 164 : 368,
  height: app.props.gameMode === 'hud' ? 60 : 180,
  flexDirection: 'column',
  gap: 6,
})

const connectButton = app.create('uiview', {
  width: app.props.gameMode === 'hud' ? 164 : 368,
  height: app.props.gameMode === 'hud' ? 25 : 45,
  backgroundColor: getColors().accent,
  borderRadius: app.props.gameMode === 'hud' ? 4 : 8,
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
})

const connectButtonText = app.create('uitext', {
  value: 'Connect Gaming Wallet',
  color: '#000000',
  fontSize: app.props.gameMode === 'hud' ? 10 : 12,
  fontWeight: 'bold',
  textAlign: 'center',
})

connectButton.add(connectButtonText)

const sessionButton = app.create('uiview', {
  width: app.props.gameMode === 'hud' ? 164 : 368,
  height: app.props.gameMode === 'hud' ? 25 : 45,
  backgroundColor: getColors().success,
  borderRadius: app.props.gameMode === 'hud' ? 4 : 8,
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  visible: false,
})

const sessionButtonText = app.create('uitext', {
  value: 'Activate Session Key',
  color: '#ffffff',
  fontSize: app.props.gameMode === 'hud' ? 10 : 12,
  fontWeight: 'bold',
  textAlign: 'center',
})

sessionButton.add(sessionButtonText)

actionButtons.add(connectButton)
actionButtons.add(sessionButton)
gamingUI.add(actionButtons)

gameBody.add(gamingUI)

// Gaming functions
async function connectGamingWallet() {
  try {
    connectionText.value = '🔄 Connecting...'
    connectionText.color = getColors().warning

    if (world.web3) {
      const result = await world.web3.connect()

      if (result && result.address) {
        app.state.connected = true
        app.state.address = result.address

        // Update UI
        connectionText.value = '✅ Connected'
        connectionText.color = getColors().success
        connectButton.visible = false
        sessionButton.visible = true

        // Get username
        try {
          const response = await fetch('https://api.cartridge.gg/accounts/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              addresses: [result.address.toLowerCase()]
            })
          })

          if (response.ok) {
            const data = await response.json()
            if (data && data.results && data.results.length > 0) {
              const userResult = data.results.find(apiResult =>
                apiResult.addresses && apiResult.addresses.map(a => a.toLowerCase()).includes(result.address.toLowerCase())
              )

              if (userResult && userResult.username) {
                app.state.username = userResult.username
                if (app.props.gameMode === 'menu' && usernameDisplay) {
                  usernameDisplay.value = `Player: @${userResult.username}`
                }
                if (walletInfo) {
                  walletInfo.value = `Wallet: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`
                }
              }
            }
          }
        } catch (e) {
          console.log('[Gaming] Could not fetch username:', e.message)
        }

        console.log('[Gaming] Wallet connected for gaming:', result.address)
      }
    }
  } catch (error) {
    console.error('[Gaming] Connection failed:', error)
    connectionText.value = '❌ Failed'
    connectionText.color = getColors().error
  }
}

async function toggleSessionKey() {
  if (!app.state.connected) return

  try {
    if (!app.state.sessionKeyActive) {
      // Activate session key
      sessionText.value = '🔑 Session: ON'
      sessionText.color = getColors().success
      sessionButtonText.value = 'Deactivate Session Key'

      app.state.sessionKeyActive = true
      console.log('[Gaming] Session key activated for seamless gameplay')
    } else {
      // Deactivate session key
      sessionText.value = '🔑 Session: OFF'
      sessionText.color = getColors().warning
      sessionButtonText.value = 'Activate Session Key'

      app.state.sessionKeyActive = false
      console.log('[Gaming] Session key deactivated')
    }
  } catch (error) {
    console.error('[Gaming] Session key toggle failed:', error)
  }
}

// Game time tracking
const gameStartTime = Date.now()

function updateGameTime() {
  if (app.props.gameMode === 'menu' && gameplayTime) {
    const elapsed = Date.now() - gameStartTime
    const hours = Math.floor(elapsed / 3600000)
    const minutes = Math.floor((elapsed % 3600000) / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)

    gameplayTime.value = `Session: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
}

// Event handlers
connectButton.onPointerDown = connectGamingWallet
sessionButton.onPointerDown = toggleSessionKey

// Update loop
app.on('update', () => {
  updateGameTime()
})

// Position updates
function updateUIPosition() {
  if (app.props.uiSpace === 'world') {
    gamingUI.space = 'world'
    gamingUI.position.set(2, 1.8, 1) // Slightly to the right and up for gaming visibility
    gamingUI.billboard = 'full'
    gamingUI.size = 0.01
  } else {
    gamingUI.space = 'screen'
    if (app.props.gameMode === 'hud') {
      gamingUI.position[0] = 0.98
      gamingUI.position[1] = 0.15
      gamingUI.position[2] = 0
    } else {
      gamingUI.position[0] = 0.5
      gamingUI.position[1] = 0.05
      gamingUI.position[2] = 0
    }
    gamingUI.billboard = 'none'
    gamingUI.size = 0.01
  }
}

app.on('update', () => {
  updateUIPosition()
})

console.log('[Cartridge Gaming] Initialized')
console.log('[Cartridge Gaming] Mode:', app.props.gameMode)
console.log('[Cartridge Gaming] Session Keys:', app.props.sessionKeyEnabled)
console.log('[Cartridge Gaming] Achievements:', app.props.achievementsEnabled)