// Cartridge Wallet Dashboard - Comprehensive wallet management interface

// Configure dashboard properties
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
    key: 'theme',
    type: 'switch',
    label: 'Color Theme',
    hint: 'Dashboard color scheme.',
    options: [
      { label: 'Dark', value: 'dark' },
      { label: 'Light', value: 'light' },
    ],
    initial: 'dark',
  },
  {
    key: 'refreshInterval',
    type: 'number',
    label: 'Refresh Interval (seconds)',
    hint: 'How often to refresh wallet data (set to 0 for manual only).',
    min: 0,
    max: 300,
    step: 5,
    initial: 30,
  },
])

// Dashboard state
app.state.connected = false
app.state.address = null
app.state.balance = '0'
app.state.network = 'Unknown'
app.state.transactions = []
app.state.username = ''
app.state.refreshCountdown = 0

// Get Rigid Body attachment point with fallback
let dashboardBody = app.get('CartridgeLogo')
if (!dashboardBody) {
  console.log('[Dashboard] CartridgeLogo not found, using app object as attachment point')
  dashboardBody = app
}

// Theme colors
const themes = {
  dark: {
    bg: 'rgba(0, 0, 0, 0.95)',
    primary: '#10b981',
    secondary: '#64748b',
    accent: '#fbbf24',
    text: '#ffffff',
    card: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  light: {
    bg: 'rgba(255, 255, 255, 0.95)',
    primary: '#059669',
    secondary: '#6b7280',
    accent: '#d97706',
    text: '#1f2937',
    card: 'rgba(0, 0, 0, 0.03)',
    border: 'rgba(0, 0, 0, 0.1)',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
  }
}

function getTheme() {
  return themes[app.props.theme] || themes.dark
}

// Create main dashboard container
const dashboardUI = app.create('ui', {
  space: 'screen',
  pivot: 'top-center',
  position: [0.5, 0.05, 0],
  width: 480,
  height: 640,
  backgroundColor: getTheme().bg,
  borderRadius: 12,
  padding: 20,
  flexDirection: 'column',
  gap: 16,
  borderWidth: 1,
  borderColor: getTheme().border,
})

// Create header section
const headerView = app.create('uiview', {
  width: 440,
  height: 80,
  flexDirection: 'column',
  gap: 8,
})

const headerTitle = app.create('uitext', {
  value: '🚀 CARTRIDGE DASHBOARD',
  color: getTheme().accent,
  fontSize: 20,
  fontWeight: 'bold',
  textAlign: 'center',
})

const connectionStatus = app.create('uitext', {
  value: '🔌 Click to connect wallet',
  color: getTheme().secondary,
  fontSize: 14,
  textAlign: 'center',
})

// Create tab navigation
const tabView = app.create('uiview', {
  width: 440,
  height: 40,
  flexDirection: 'row',
  gap: 8,
  justifyContent: 'center',
})

function createTab(label, index) {
  const tab = app.create('uiview', {
    width: 100,
    height: 32,
    backgroundColor: getTheme().card,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  })

  const tabText = app.create('uitext', {
    value: label,
    color: getTheme().secondary,
    fontSize: 12,
    fontWeight: 'bold',
  })

  tab.add(tabText)
  tab.onPointerDown = () => switchToTab(index)
  return tab
}

const walletTab = createTab('💰 Wallet', 0)
const transactionsTab = createTab('📋 History', 1)
const settingsTab = createTab('⚙️ Settings', 2)

// Create content areas (hidden initially, show on tab selection)
const contentArea = app.create('uiview', {
  width: 440,
  height: 400,
  flexDirection: 'column',
  gap: 12,
})

// Wallet tab content
const walletContent = app.create('uiview', {
  width: 440,
  height: 400,
  flexDirection: 'column',
  gap: 12,
  visible: false,
})

// Account info card
const accountCard = app.create('uiview', {
  width: 440,
  height: 120,
  backgroundColor: getTheme().card,
  borderRadius: 8,
  padding: 12,
  flexDirection: 'column',
  gap: 6,
})

const usernameDisplay = app.create('uitext', {
  value: '',
  color: getTheme().accent,
  fontSize: 16,
  fontWeight: 'bold',
})

const addressDisplay = app.create('uitext', {
  value: 'No wallet connected',
  color: getTheme().text,
  fontSize: 12,
})

const networkDisplay = app.create('uitext', {
  value: '',
  color: getTheme().secondary,
  fontSize: 11,
})

// Balance card
const balanceCard = app.create('uiview', {
  width: 440,
  height: 80,
  backgroundColor: getTheme().card,
  borderRadius: 8,
  padding: 12,
  flexDirection: 'column',
  gap: 4,
})

const balanceLabel = app.create('uitext', {
  value: 'ETH Balance',
  color: getTheme().secondary,
  fontSize: 12,
})

const balanceAmount = app.create('uitext', {
  value: '0 ETH',
  color: getTheme().success,
  fontSize: 24,
  fontWeight: 'bold',
})

const refreshInfo = app.create('uitext', {
  value: 'Auto-refresh: OFF',
  color: getTheme().secondary,
  fontSize: 10,
  textAlign: 'right',
})

// Transactions tab content
const transactionsContent = app.create('uiview', {
  width: 440,
  height: 400,
  flexDirection: 'column',
  gap: 8,
  visible: false,
})

const transactionsHeader = app.create('uitext', {
  value: '📊 Transaction History',
  color: getTheme().accent,
  fontSize: 14,
  fontWeight: 'bold',
})

const transactionsList = app.create('uiview', {
  width: 440,
  height: 360,
  flexDirection: 'column',
  gap: 4,
})

// Settings tab content
const settingsContent = app.create('uiview', {
  width: 440,
  height: 400,
  flexDirection: 'column',
  gap: 12,
  visible: false,
})

const connectButton = app.create('uiview', {
  width: 440,
  height: 48,
  backgroundColor: getTheme().primary,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
})

const connectButtonText = app.create('uitext', {
  value: 'Connect Wallet',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 'bold',
})

const disconnectButton = app.create('uiview', {
  width: 440,
  height: 48,
  backgroundColor: getTheme().error,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
})

const disconnectButtonText = app.create('uitext', {
  value: 'Disconnect Wallet',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 'bold',
})

const refreshButton = app.create('uiview', {
  width: 440,
  height: 48,
  backgroundColor: getTheme().accent,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
})

const refreshButtonText = app.create('uitext', {
  value: '🔄 Refresh Data',
  color: '#000000',
  fontSize: 16,
  fontWeight: 'bold',
})

// Footer info
const footerView = app.create('uiview', {
  width: 440,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
})

const footerText = app.create('uitext', {
  value: 'Press ESC to close • Powered by Cartridge',
  color: getTheme().secondary,
  fontSize: 10,
  textAlign: 'center',
})

// Assemble UI
headerView.add(headerTitle)
headerView.add(connectionStatus)

tabView.add(walletTab)
tabView.add(transactionsTab)
tabView.add(settingsTab)

accountCard.add(usernameDisplay)
accountCard.add(addressDisplay)
accountCard.add(networkDisplay)

balanceCard.add(balanceLabel)
balanceCard.add(balanceAmount)
balanceCard.add(refreshInfo)

walletContent.add(accountCard)
walletContent.add(balanceCard)

connectButton.add(connectButtonText)
disconnectButton.add(disconnectButtonText)
refreshButton.add(refreshButtonText)

settingsContent.add(connectButton)
settingsContent.add(disconnectButton)
settingsContent.add(refreshButton)

transactionsContent.add(transactionsHeader)
transactionsContent.add(transactionsList)

contentArea.add(walletContent)
contentArea.add(transactionsContent)
contentArea.add(settingsContent)

footerView.add(footerText)

dashboardUI.add(headerView)
dashboardUI.add(tabView)
dashboardUI.add(contentArea)
dashboardUI.add(footerView)

dashboardBody.add(dashboardUI)

// State management
let currentTab = 0

function switchToTab(tabIndex) {
  currentTab = tabIndex

  // Hide all content
  walletContent.visible = false
  transactionsContent.visible = false
  settingsContent.visible = false

  // Show selected content
  switch(tabIndex) {
    case 0:
      walletContent.visible = true
      break
    case 1:
      transactionsContent.visible = true
      loadTransactions()
      break
    case 2:
      settingsContent.visible = true
      break
  }
}

// Cartridge integration functions
async function connectCartridge() {
  try {
    connectionStatus.value = '🔄 Connecting to Cartridge...'
    connectionStatus.color = getTheme().warning

    if (world.web3) {
      const result = await world.web3.connect()

      if (result && result.address) {
        app.state.connected = true
        app.state.address = result.address
        app.state.network = world.web3.getNetworkId() || 'Unknown'

        // Update UI state
        connectionStatus.value = '✅ Connected to Cartridge'
        connectionStatus.color = getTheme().success
        connectButton.visible = false
        disconnectButton.visible = true

        // Update account info
        const shortAddress = result.address.slice(0, 6) + '...' + result.address.slice(-4)
        addressDisplay.value = shortAddress
        networkDisplay.value = `Network: ${app.state.network}`

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
                usernameDisplay.value = `@${userResult.username}`
              }
            }
          }
        } catch (e) {
          console.log('[Dashboard] Could not fetch username:', e.message)
        }

        console.log('[Dashboard] Connected:', result.address)
        await refreshWalletData()
      } else {
        connectionStatus.value = '❌ Connection cancelled'
        connectionStatus.color = getTheme().error
      }
    }
  } catch (error) {
    console.error('[Dashboard] Connection failed:', error)
    connectionStatus.value = '❌ Connection failed'
    connectionStatus.color = getTheme().error
  }
}

async function disconnectCartridge() {
  try {
    if (world.web3 && app.state.connected) {
      await world.web3.disconnect()
    }

    app.state.connected = false
    app.state.address = null
    app.state.balance = '0'
    app.state.network = 'Unknown'
    app.state.username = ''

    // Reset UI
    connectionStatus.value = '🔌 Click to connect wallet'
    connectionStatus.color = getTheme().secondary
    usernameDisplay.value = ''
    addressDisplay.value = 'No wallet connected'
    networkDisplay.value = ''
    balanceAmount.value = '0 ETH'

    // Reset buttons
    connectButton.visible = true
    disconnectButton.visible = false

  } catch (error) {
    console.error('[Dashboard] Disconnect failed:', error)
  }
}

async function refreshWalletData() {
  if (!app.state.connected) return

  try {
    balanceAmount.value = '🔄 Loading...'

    // Get balance - this would require additional API integration
    // For now, simulate a balance
    setTimeout(() => {
      app.state.balance = '0.1234'
      balanceAmount.value = `${app.state.balance} ETH`
    }, 1000)

  } catch (error) {
    console.error('[Dashboard] Failed to refresh data:', error)
    balanceAmount.value = '❌ Failed to load'
  }
}

function loadTransactions() {
  // Clear existing transactions
  while (transactionsList.children.length > 0) {
    transactionsList.remove(transactionsList.children[0])
  }

  if (!app.state.connected) {
    const noData = app.create('uitext', {
      value: 'Connect wallet to view transactions',
      color: getTheme().secondary,
      fontSize: 12,
      textAlign: 'center',
    })
    transactionsList.add(noData)
    return
  }

  // Add placeholder transactions (would integrate with actual API)
  const placeholderTx = app.create('uitext', {
    value: '📊 Transaction history coming soon...',
    color: getTheme().secondary,
    fontSize: 12,
    textAlign: 'center',
  })
  transactionsList.add(placeholderTx)
}

// Event handlers
connectButton.onPointerDown = connectCartridge
disconnectButton.onPointerDown = disconnectCartridge
refreshButton.onPointerDown = refreshWalletData

// Keyboard controls
const control = app.control()
if (control && control.keyEscape) {
  control.keyEscape.capture = true
}

app.on('update', () => {
  // ESC to close
  if (control?.keyEscape?.pressed) {
    dashboardUI.active = false
  }

  // Auto-refresh countdown
  if (app.props.refreshInterval > 0 && app.state.connected) {
    app.state.refreshCountdown -= 1 / 60 // 60 FPS

    if (app.state.refreshCountdown <= 0) {
      refreshWalletData()
      app.state.refreshCountdown = app.props.refreshInterval
    }

    refreshInfo.value = `Auto-refresh: ${Math.ceil(app.state.refreshCountdown)}s`
  }
})

// UI positioning updates
function updateUIPosition() {
  if (app.props.uiSpace === 'world') {
    dashboardUI.space = 'world'
    dashboardUI.position.set(0, 1.5, 2)
    dashboardUI.billboard = 'full'
    dashboardUI.size = 0.01
  } else {
    dashboardUI.space = 'screen'
    dashboardUI.position[0] = 0.5
    dashboardUI.position[1] = 0.05
    dashboardUI.billboard = 'none'
    dashboardUI.size = 0.01
  }
}

// Position updates
app.on('update', () => {
  updateUIPosition()
})

// Initialize
switchToTab(0)
connectButton.visible = true
disconnectButton.visible = false

console.log('[Cartridge Dashboard] Initialized')
console.log('[Cartridge Dashboard] Theme:', app.props.theme)
console.log('[Cartridge Dashboard] UI Space:', app.props.uiSpace)