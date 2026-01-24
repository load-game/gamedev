// EVM Wallet Connect - Cartridge-style implementation

// Configuration
app.configure([
  {
    key: 'buttonText',
    type: 'text',
    label: 'Connect Button Text',
    hint: 'Text displayed on the action button.',
    initial: 'Connect Wallet',
  },
  {
    key: 'buttonColor',
    type: 'color',
    label: 'Button Color',
    hint: 'Color of the connect button.',
    initial: '#6366f1',
  },
  {
    key: 'quickActionEnabled',
    type: 'switch',
    label: 'Quick Action Key',
    hint: 'Enable Q key for instant connect/disconnect.',
    options: [
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' }
    ],
    initial: 'enabled',
  },
  {
    key: 'triggerZone',
    type: 'switch',
    label: 'Trigger Zone Control',
    hint: 'Show/hide UI when player enters trigger zone.',
    options: [
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' }
    ],
    initial: 'enabled',
  },
])

// State
app.state.connected = false
app.state.address = null

// Get entities
const walletBody = app.get('WalletConnectLogo')
const triggerBody = app.get('AreaTrigger')

// Create minimal status UI
const statusUI = app.create('ui', {
  space: 'screen',
  position: [0.89, 0.1, 0],
  width: 150,
  height: 40,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderRadius: 6,
  padding: 8,
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
})

const statusText = app.create('uitext', {
  value: '🌐 Disconnected',
  color: '#cccccc',
  fontSize: 14,
  textAlign: 'center',
})

statusUI.add(statusText)
walletBody.add(statusUI)

// Create Action for wallet connection
const connectAction = app.create('action', {
  label: app.state.connected ? 'Disconnect Wallet' : 'Connect Wallet',
  distance: 4,
  duration: 0.3,
  onTrigger: () => {
    if (app.state.connected) {
      disconnectWallet()
    } else {
      connectWallet()
    }
  }
})

walletBody.add(connectAction)

// Initialize trigger zone
let isPlayerNearby = false
const localPlayer = world.getPlayer()

if (triggerBody && app.props.triggerZone === 'enabled') {
  triggerBody.onTriggerEnter = (e) => {
    if (e.playerId) {
      const player = world.getPlayer(e.playerId)
      const isLocalPlayer = player && player.id === localPlayer?.id
      if (isLocalPlayer) {
        isPlayerNearby = true
        connectAction.active = true
      }
    }
  }

  triggerBody.onTriggerLeave = (e) => {
    if (e.playerId) {
      const player = world.getPlayer(e.playerId)
      const isLocalPlayer = player && player.id === localPlayer?.id
      if (isLocalPlayer) {
        isPlayerNearby = false
        connectAction.active = false
      }
    }
  }
} else {
  connectAction.active = true
}

// Connection functions
async function connectWallet() {
  // Check if already connected - this prevents the "already_connected" error
  if (app.state.connected) {
    console.log('[Wallet] Already connected (app.state), skipping connect attempt')
    return
  }

  try {
    statusText.value = '⏳ Connecting...'
    statusText.color = '#f59e0b'

    // Wait for MetaMask to be ready
    await new Promise(resolve => setTimeout(resolve, 300))

    const result = await world.evm.connect()
    // Log result safely (avoid circular reference errors)
    try {
      console.log('✅ Result:', result)
    } catch (e) {
      console.log('✅ Result:', { success: result.success, address: result.address, reason: result.reason })
    }

    // Check if the result has the expected structure
    if (typeof result !== 'object' || result === null) {
      console.error('❌ Invalid result from connect():', result)
      statusText.value = '❌ Invalid response from wallet'
      statusText.color = '#ff4444'
      setTimeout(() => {
        statusText.value = '🌐 Disconnected'
        statusText.color = '#cccccc'
      }, 3000)
    } else if (result.success === true) {
      // Connection succeeded! But address might be null on first attempt due to timing
      console.log('✅ Connection successful')
      app.state.connected = true

      // Check if we have an address
      if (result.address) {
        console.log('✅ Address received immediately:', result.address)
        app.state.address = result.address
        const short = result.address.substring(0, 6) + '...' + result.address.substring(38)
        statusText.value = `✅ ${short}`
      } else if (world.evm._reactData?.address) {
        // Address available from React data
        console.log('✅ Address available from React:', world.evm._reactData.address)
        app.state.address = world.evm._reactData.address
        const short = app.state.address.substring(0, 6) + '...' + app.state.address.substring(38)
        statusText.value = `✅ ${short}`
      } else {
        // Connection succeeded but address not yet available
        // This happens on first connect due to EVMClient's 2-second timeout waiting for React
        console.log('✅ Connected (address pending...)')
        statusText.value = '✅ Connected'
        app.state.address = null // Clear any stale address
      }

      statusText.color = '#10b981'
      connectAction.label = 'Disconnect Wallet'

      app.emit('walletConnected', {
        connected: true,
        address: app.state.address,
      })
    } else if (result.reason === 'already_connected') {
      // Handle already connected as SUCCESS, not error
      console.log('[Wallet] Already connected according to EVM client')
      app.state.connected = true

      // Try to get the address from the EVM client
      if (world.evm._reactData?.address) {
        app.state.address = world.evm._reactData.address
        const short = app.state.address.substring(0, 6) + '...' + app.state.address.substring(38)
        statusText.value = `✅ ${short}`
      } else {
        statusText.value = '✅ Connected (already)'
      }
      statusText.color = '#10b981'
      connectAction.label = 'Disconnect Wallet'

      app.emit('walletConnected', {
        connected: true,
        address: app.state.address,
      })
    } else if (result.success === false) {
      // Explicit failure from the EVM client
      console.warn('⚠️ Connection failed from EVM:', result.reason || 'No reason provided')
      statusText.value = '⚠️ Failed: ' + (result.reason || 'Unknown reason')
      statusText.color = '#f59e0b'
      setTimeout(() => {
        statusText.value = '🌐 Disconnected'
        statusText.color = '#cccccc'
      }, 3000)
    } else {
      // Unexpected result structure
      console.error('❌ Unexpected result structure:', result)
      statusText.value = '❌ Unexpected response'
      statusText.color = '#ff4444'
      setTimeout(() => {
        statusText.value = '🌐 Disconnected'
        statusText.color = '#cccccc'
      }, 3000)
    }
  } catch (error) {
    // Check for user cancellation
    if (
      error.message &&
      (error.message.includes('User cancelled') ||
        error.message.includes('User rejected') ||
        error.message.includes('User denied') ||
        error.message.includes('Modal closed'))
    ) {
      console.log('[Wallet] User cancelled connection')
      statusText.value = '🌐 Disconnected'
      statusText.color = '#cccccc'
      return
    }

    // Real connection error
    console.error('[Wallet] Connection failed:', error)
    statusText.value = 'Connection failed'
    statusText.color = '#ef4444'

    setTimeout(() => {
      if (!app.state.connected) {
        statusText.value = '🌐 Disconnected'
        statusText.color = '#cccccc'
      }
    }, 2000)
  }
}

async function disconnectWallet() {
  // Check if already disconnected - this prevents the "not_connected" error
  if (!app.state.connected) {
    console.log('[Wallet] Already disconnected (app.state), skipping disconnect attempt')
    return
  }

  try {
    const result = await world.evm.disconnect()
    // Log result safely (avoid circular reference errors)
    try {
      console.log('✅ Result:', result)
    } catch (e) {
      console.log('✅ Result:', { success: result.success, reason: result.reason })
    }

    if (result.success) {
      app.state.connected = false
      app.state.address = null

      // Update UI for disconnected state
      statusText.value = '🌐 Disconnected'
      statusText.color = '#cccccc'
      connectAction.label = 'Connect Wallet'

      app.emit('walletDisconnected', {})

      console.log('[Wallet] Disconnected')
    } else if (result.reason === 'not_connected') {
      // Handle not connected as SUCCESS, not error
      console.log('[Wallet] Already disconnected according to EVM client')
      app.state.connected = false
      app.state.address = null

      statusText.value = '🌐 Disconnected'
      statusText.color = '#cccccc'
      connectAction.label = 'Connect Wallet'
    } else {
      console.error('❌ Disconnect failed:', result.reason)
      statusText.value = '❌ Disconnect failed'
      statusText.color = '#ef4444'
      setTimeout(() => {
        statusText.value = '🌐 Disconnected'
        statusText.color = '#cccccc'
      }, 3000)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    statusText.value = '❌ Error'
    statusText.color = '#ff4444'
    setTimeout(() => {
      statusText.value = '🌐 Disconnected'
      statusText.color = '#cccccc'
    }, 3000)
  }
}

// Quick action hotkey
if (app.props.quickActionEnabled === 'enabled' && world.isClient) {
  const control = app.control()
  if (!control) {
    console.log('[Wallet] Controls not available')
  } else {
    const quickKey = control.keyQ
    if (quickKey) {
      quickKey.capture = true
    }

    let quickKeyPressed = false

    app.on('update', () => {
      if (quickKey?.pressed && !quickKeyPressed) {
        if (app.state.connected) {
          disconnectWallet()
        } else {
          connectWallet()
        }
      }
      quickKeyPressed = quickKey?.pressed
    })
  }
}

// Update loop for UI visibility based on trigger zone
app.on('update', () => {
  statusUI.active = triggerZoneVisible()
})

function triggerZoneVisible() {
  return !app.props.triggerZone || app.props.triggerZone === 'disabled' || isPlayerNearby
}

// Example: Resolve ENS name for connected address
async function showEnsName() {
  if (!app.state.connected || !app.state.address) return

  try {
    const result = await world.evm.resolveName(app.state.address)
    if (result.success && result.name) {
      console.log('[Wallet] ENS name:', result.name)
      statusText.value = `✅ ${result.name}`
    }
  } catch (error) {
    console.log('[Wallet] ENS resolution failed:', error.message)
  }
}

// Call when wallet connects
try {
  app.on('walletConnected', () => {
    console.log('[Wallet] Connected event received')
    // Uncomment to automatically resolve ENS
    // showEnsName()
  })
} catch (error) {
  console.log('[Wallet] Event listener setup failed')
}

// Example: Lookup address from ENS name
async function lookupFromEns(ensName) {
  try {
    const result = await world.evm.lookupName(ensName)
    if (result.success && result.address) {
      console.log(`[Wallet] ${ensName} resolves to:`, result.address)
      return result.address
    }
    return null
  } catch (error) {
    console.error('[Wallet] ENS lookup failed:', error.message)
    return null
  }
}

console.log('✅ Wallet connect app initialized')
console.log('📧 ENS resolution methods available:')
console.log('   - world.evm.resolveName(address)')
console.log('   - world.evm.lookupName(ensName)')
console.log('   - Automatic caching to prevent rate limits')
