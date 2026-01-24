// Cartridge integration app - Simple hypscript

// Configure UI properties
app.configure([
  {
    key: 'buttonText',
    type: 'text',
    label: 'Connect Button Text',
    hint: 'Text displayed on the main connect button.',
    initial: 'Connect Cartridge',
  },
  {
    key: 'buttonColor',
    type: 'color',
    label: 'Button Color',
    hint: 'Background color of the connect button (hex or color name).',
    initial: '#fbbf24',
  },
  {
    key: 'quickActionEnabled',
    type: 'switch',
    label: 'Quick Action Key',
    hint: 'Enable Q key for instant connect/disconnect (alternative to holding E near action).',
    options: [
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' }
    ],
    initial: 'enabled',
  },
  {
    key: 'uiSpace',
    type: 'switch',
    label: 'UI Space',
    hint: 'Display UI in screen space or world space.',
    options: [
      { label: 'Screen', value: 'screen' },
      { label: 'World', value: 'world' },
    ],
    initial: 'screen',
  },
  {
    key: 'triggerZone',
    type: 'switch',
    label: 'Trigger Zone UI Control',
    hint: 'Show/hide UI when player enters the trigger zone.',
    options: [
      { label: 'Enabled', value: 'enabled' },
      { label: 'Disabled', value: 'disabled' },
    ],
    initial: 'enabled',
  },
  {
    key: 'triggerMeshVisibility',
    type: 'switch',
    label: 'Trigger Mesh Visibility',
    hint: 'Show/hide the trigger zone mesh.',
    options: [
      { label: 'Visible', value: 'visible' },
      { label: 'Invisible', value: 'invisible' }
    ],
    initial: 'invisible',
  },
])

// Cartridge state
app.state.connected = false
app.state.address = null
app.state.cartridge = null

// Get entities
const cartridgeBody = app.get('CartridgeLogo')
const triggerBody = app.get('AreaTrigger')
const triggerMesh = app.get('Sphere')

// Create a minimal status UI (non-interactive)
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
  visible: true,
})

const statusText = app.create('uitext', {
  value: '🌐 Disconnected',
  color: '#cccccc',
  fontSize: 14,
  textAlign: 'center',
})

statusUI.add(statusText)
cartridgeBody.add(statusUI)

// Create Action for wallet connection
const connectAction = app.create('action', {
  label: app.state.connected ? 'Disconnect Cartridge' : 'Connect Cartridge',
  distance: 4,
  duration: 0.3,
  onTrigger: () => {
    if (app.state.connected) {
      disconnectCartridge()
    } else {
      connectCartridge()
    }
  }
})

cartridgeBody.add(connectAction)

// Initialize trigger zone variables and handlers
let isPlayerNearby = false
const localPlayer = world.getPlayer()

// Area trigger event handlers (optional - controls visibility of action)
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
async function connectCartridge() {
  try {
    statusText.value = '⏳ Connecting...'
    statusText.color = '#f59e0b'

    if (world.web3) {
      console.log('[Cartridge] Attempting to connect...')
      const result = await world.web3.connect()

      if (result && result.address) {
        app.state.connected = true
        app.state.address = result.address
        app.state.cartridge = world.web3.controller

        // Update UI for connected state
        statusText.value = '🛜 Connected'
        statusText.color = '#10b981'
        connectAction.label = 'Disconnect Cartridge'

        app.emit('cartridgeConnected', {
          connected: true,
          address: result.address,
        })

        console.log('[Cartridge] Connected:', result.address)
      } else {
        // User cancelled the modal
        console.log('[Cartridge] User cancelled connection')
        statusText.value = '🌐 Disconnected'
        statusText.color = '#cccccc'
        return
      }
    } else {
      throw new Error('world.web3 not available')
    }
  } catch (error) {
    // Check if this is a user cancellation
    if (
      error.message &&
      (error.message.includes('User cancelled') ||
        error.message.includes('User rejected') ||
        error.message.includes('User denied') ||
        error.message.includes('No account returned from controller') ||
        error.message.includes('Modal closed'))
    ) {
      console.log('[Cartridge] User cancelled connection')
      statusText.value = '🌐 Disconnected'
      statusText.color = '#cccccc'
      return
    }

    // Check for Cartridge service errors (HTTP 500, OAuth issues)
    if (
      error.message && (
        error.message.includes('HTTP error! status: 500') ||
        error.message.includes('Could not establish connection') ||
        error.message.includes('Receiving end does not exist') ||
        error.message.includes('api.cartridge.gg') ||
        error.message.includes('Turnkey')
      )
    ) {
      console.error('[Cartridge] Cartridge service error:', error.message)
      statusText.value = 'Cartridge service unavailable'
      statusText.color = '#f59e0b'

      setTimeout(() => {
        if (!app.state.connected) {
          statusText.value = 'Try again later'
          statusText.color = '#f59e0b'
        }
      }, 3000)

      setTimeout(() => {
        if (!app.state.connected) {
          statusText.value = '🌐 Disconnected'
          statusText.color = '#cccccc'
        }
      }, 8000)

      return
    }

    // Real connection error
    console.error('[Cartridge] Connection failed:', error)
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

async function disconnectCartridge() {
  try {
    if (world.web3 && app.state.connected) {
      await world.web3.disconnect()
    }

    app.state.connected = false
    app.state.address = null
    app.state.cartridge = null

    // Update UI for disconnected state
    statusText.value = '🌐 Disconnected'
    statusText.color = '#cccccc'
    connectAction.label = 'Connect Cartridge'

    app.emit('cartridgeDisconnected', {})

    console.log('[Cartridge] Disconnected')
  } catch (error) {
    console.error('[Cartridge] Disconnect failed:', error)
  }
}

// Quick action hotkey
if (app.props.quickActionEnabled === 'enabled' && world.isClient) {
  const control = app.control()
  if (!control) {
    console.log('[Cartridge] Controls not available')
  } else {
    const quickKey = control.keyQ
    if (quickKey) {
      quickKey.capture = true
    }

    let quickKeyPressed = false

    app.on('update', () => {
      if (quickKey?.pressed && !quickKeyPressed) {
        if (app.state.connected) {
          disconnectCartridge()
        } else {
          connectCartridge()
        }
      }
      quickKeyPressed = quickKey?.pressed
    })
  }
}

// Handle trigger mesh visibility in update loop to catch timing issues
if (triggerMesh) {
  app.on('update', () => {
    if (app.props.triggerMeshVisibility === 'invisible') {
      triggerMesh.active = false
      triggerMesh.visible = false
    } else {
      triggerMesh.active = true
      triggerMesh.visible = true
    }
  })
}

app.on('update', () => {
  statusUI.active = triggerZoneVisible()
})

function triggerZoneVisible() {
  return !app.props.triggerZone || app.props.triggerZone === 'disabled' || isPlayerNearby
}
