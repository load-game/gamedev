// EVM WALLET CONNECT

console.log('')
console.log('🎯 EVM WALLET CONNECT - FINAL VERSION')
console.log('')

// Configuration
app.configure([
  {
    key: 'hotKeyToggle',
    type: 'text',
    label: 'Toggle UI Hotkey',
    hint: 'Keyboard key to show/hide the wallet UI (single character).',
    initial: 'I',
  },
  {
    key: 'hotKeyConnect',
    type: 'text',
    label: 'Quick Connect Hotkey',
    hint: 'Keyboard key for quick wallet connect (single character).',
    initial: 'Q',
  },
])

// State
let connected = false
let address = null
let ensName = null
let uiVisible = true

// Hotkey system variables
let control = null
let hotKeyToggleCtrl = null
let hotKeyConnectCtrl = null
let toggleKeyPrevPressed = false
let connectKeyPrevPressed = false

// Create UI (must add to app at the end)
const mainUI = app.create('ui', {
  space: 'screen',
  pivot: 'top-center',
  position: [0.9, 0.05, 0],
  width: 250,
  height: 145,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderRadius: 12,
  padding: 16,
  flexDirection: 'column',
  gap: 12,
})

// Button container (clickable)
const connectButton = app.create('uiview', {
  width: 220,
  height: 55,
  backgroundColor: '#6366f1',
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'not-allowed',
})

// Button text (child of button)
const buttonText = app.create('uitext', {
  value: 'Initializing...',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
})

// Status text (child of ui, not app)
const statusText = app.create('uitext', {
  value: '🌐 Disconnected',
  color: '#cccccc',
  fontSize: 14,
  textAlign: 'center',
})

// Hotkey hints text
const hotkeysText = app.create('uitext', {
  value: 'I: Toggle UI • Q: Quick Connect',
  color: '#64748b',
  fontSize: 10,
  textAlign: 'center',
  opacity: 0.7,
})

// Add text to button, button to ui, ui to app
connectButton.add(buttonText)
mainUI.add(connectButton)
mainUI.add(statusText)
mainUI.add(hotkeysText)
app.add(mainUI)

// Initialize hotkey system
function initHotkeys() {
  if (!world.isClient) return

  try {
    control = app.control()
    if (!control) return

    console.log('[Wallet] Initializing hotkey system')

    // Function to map a single character to control key handle
    function resolveKey(char, fallbackChar) {
      const letter = (char || fallbackChar || '').trim().toUpperCase()
      const k = control['key' + letter]
      return k || control['key' + fallbackChar]
    }

    function refreshKeyBindings() {
      // Release previous captures
      if (hotKeyToggleCtrl) hotKeyToggleCtrl.capture = false
      if (hotKeyConnectCtrl) hotKeyConnectCtrl.capture = false

      // Get keys from app props - try both app.props and global props
      const toggleKey =
        (app.props && app.props.hotKeyToggle) || (typeof props !== 'undefined' && props.hotKeyToggle) || 'I'
      const connectKey =
        (app.props && app.props.hotKeyConnect) || (typeof props !== 'undefined' && props.hotKeyConnect) || 'Q'

      hotKeyToggleCtrl = resolveKey(toggleKey, 'I')
      hotKeyConnectCtrl = resolveKey(connectKey, 'Q')

      // Capture the keys
      if (hotKeyToggleCtrl) {
        hotKeyToggleCtrl.capture = true
        console.log('[Wallet] Bound toggle key:', toggleKey, 'to control:', hotKeyToggleCtrl)
      }
      if (hotKeyConnectCtrl) {
        hotKeyConnectCtrl.capture = true
        console.log('[Wallet] Bound connect key:', connectKey, 'to control:', hotKeyConnectCtrl)
      }

      console.log('[Wallet] Hotkeys configured:', {
        toggle: toggleKey,
        connect: connectKey,
        toggleControl: !!hotKeyToggleCtrl,
        connectControl: !!hotKeyConnectCtrl,
      })
    }

    // Initial binding
    refreshKeyBindings()
    // Store on control for access in update loop
    control._refreshWalletKeyBindings = refreshKeyBindings
  } catch (error) {
    console.error('[Wallet] Error initializing hotkeys:', error)
  }
}

// Quick connect/disconnect function
async function quickConnect() {
  if (connected) {
    disconnectWallet()
  } else {
    connectWallet()
  }
}

// Resolve ENS name for address
async function resolveENS(address) {
  if (!address || !world.isClient) return null

  try {
    console.log('[Wallet] Resolving ENS for:', address)
    // Use viem client from EVM system
    const name = await world.evm.getEnsName(address)
    console.log('[Wallet] ENS result:', name)
    return name
  } catch (error) {
    console.log('[Wallet] ENS resolution failed:', error.message)
    return null
  }
}

// Toggle UI visibility
function toggleUI() {
  uiVisible = !uiVisible
  mainUI.active = uiVisible
  console.log('[Wallet] UI', uiVisible ? 'shown' : 'hidden')
}

// Initialize hotkeys on client
if (world.isClient) {
  initHotkeys()
}

// CRITICAL: Enable button only after EVM is ready
setTimeout(() => {
  console.log('✅ EVM ready - enabling button')
  connectButton.backgroundColor = '#00a000'
  connectButton.cursor = 'pointer'
  buttonText.value = 'Connect Wallet'
  statusText.value = 'Ready to connect'
}, 1500)

// CRITICAL: Proper event handler for Hyperfy (from starknetkit pattern)
connectButton.onPointerDown = () => {
  console.log('[Wallet] Connect button clicked')

  if (connected) {
    disconnectWallet()
  } else {
    connectWallet()
  }
}

// Hover effects (from starknetkit pattern)
connectButton.onPointerOver = () => {
  if (connected) {
    connectButton.backgroundColor = '#cc0000' // Darker red on hover
  } else {
    connectButton.backgroundColor = '#008000' // Darker green on hover
  }
}

connectButton.onPointerOut = () => {
  if (connected) {
    connectButton.backgroundColor = '#ff4444' // Red for disconnect
  } else {
    connectButton.backgroundColor = '#00a000' // Green for connect
  }
}

// Connect wallet
async function connectWallet() {
  console.log('')
  console.log('🎯 Connecting wallet...')

  statusText.value = '⏳ Connecting...'
  statusText.color = '#f59e0b'

  try {
    // Wait for MetaMask to be ready
    await new Promise(resolve => setTimeout(resolve, 300))

    const result = await world.evm.connect()
    console.log('✅ Result:', result)

    if (result.success && result.address) {
      console.log('✅ CONNECTED! Address:', result.address)
      connected = true
      address = result.address
      ensName = await resolveENS(address)
      updateUI()
    } else {
      console.error('❌ Connection failed:', result.reason)
      statusText.value = '❌ Failed: ' + (result.reason || 'Unknown error')
      statusText.color = '#ff4444'
      setTimeout(updateUI, 3000)
    }
  } catch (error) {
    console.error('❌ Caught exception:', error.message)
    console.error('Error:', error)
    statusText.value = '❌ Error: ' + error.message
    statusText.color = '#ff4444'
    setTimeout(updateUI, 3000)
  }
}

// Disconnect wallet
async function disconnectWallet() {
  console.log('')
  console.log('🎯 Disconnecting wallet...')

  try {
    const result = await world.evm.disconnect()
    console.log('✅ Result:', result)

    if (result.success) {
      connected = false
      address = null
      ensName = null
      updateUI()
    } else {
      statusText.value = '❌ Failed: ' + result.reason
      statusText.color = '#ff4444'
      setTimeout(updateUI, 3000)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    statusText.value = '❌ Error'
    statusText.color = '#ff4444'
    setTimeout(updateUI, 3000)
  }
}

// Update UI
function updateUI() {
  if (connected && address) {
    const displayName = ensName || address.substring(0, 6) + '...' + address.substring(38)
    statusText.value = `✅ ${displayName}`
    statusText.color = '#00a000'
    buttonText.value = 'Disconnect'
    connectButton.backgroundColor = '#ff4444'
  } else {
    statusText.value = '🌐 Disconnected'
    statusText.color = '#cccccc'
    buttonText.value = 'Connect Wallet'
    connectButton.backgroundColor = '#00a000'
  }
}

// Update loop for hotkey detection (inspired by starknetkit)
app.on('update', () => {
  if (!world.isClient || !control) return

  // Refresh key bindings in case props changed
  if (control._refreshWalletKeyBindings) {
    control._refreshWalletKeyBindings()
  }

  // Handle toggle UI hotkey
  if (hotKeyToggleCtrl?.pressed && !toggleKeyPrevPressed) {
    toggleUI()
  }
  toggleKeyPrevPressed = hotKeyToggleCtrl?.pressed

  // Handle quick connect/disconnect hotkey
  if (hotKeyConnectCtrl?.pressed && !connectKeyPrevPressed) {
    quickConnect()
  }
  connectKeyPrevPressed = hotKeyConnectCtrl?.pressed
})

console.log('✅ App initialized, waiting for clicks...')
