// Enhanced Wallet Connect App with Wallet Selection
// Shows wallet selection UI when multiple wallets are available

// Configure the app with customizable properties
app.configure([
	{
		key: 'walletType',
		type: 'switch',
		label: 'Wallet Type',
		hint: 'Choose which blockchain wallet type to support in the UI.',
		options: [
			{ label: 'Starknet', value: 'starknet' },
			{ label: 'Ethereum', value: 'ethereum' }
		],
		initial: 'starknet'
	},
	{
		key: 'buttonText',
		type: 'text',
		label: 'Connect Button Text',
		hint: 'Text displayed on the main connect wallet button.',
		initial: 'Connect Wallet'
	},
	{
		key: 'buttonColor',
		type: 'color',
		label: 'Button Color',
		hint: 'Background color of the connect button (hex or color name).',
		initial: '#6366f1'
	},
	{
		key: 'readyWalletLogo',
		type: 'file',
		kind: 'texture',
		label: 'Ready Wallet Logo (.webp)',
		hint: 'Upload a .webp logo for Ready Wallet (used in wallet selection).'
	},
	{
		key: 'braavosLogo',
		type: 'file',
		kind: 'texture',
		label: 'Braavos Logo (.webp)',
		hint: 'Upload a .webp logo for Braavos Wallet (used in wallet selection).'
	},
	{
		key: 'hotKeyToggle',
		type: 'text',
		label: 'Toggle UI Hotkey',
		hint: 'Keyboard key to show/hide the wallet UI (single character).',
		initial: 'I'
	},
	{
		key: 'hotKeyConnect',
		type: 'text',
		label: 'Quick Connect Hotkey',
		hint: 'Keyboard key for quick wallet connect (single character).',
		initial: 'Q'
	}
])

// Wallet connection state
let walletState = {
	connected: false,
	address: null,
	provider: null,
	walletName: null
}

let availableWallets = { starknet: [], ethereum: [] }
let showingWalletSelection = false

// Hotkey system variables (inspired by freecam.js)
let control = null
let uiVisible = true
let hotKeyToggleCtrl = null
let hotKeyConnectCtrl = null
let toggleKeyPrevPressed = false
let connectKeyPrevPressed = false

// Remember last connected wallet for quick connect
let lastConnectedWallet = null

// Create main UI container
const mainUI = app.create('ui', {
	space: 'screen',
	pivot: 'top-center', // Center the UI horizontally
	position: [0.9, 0.05, 0], // Position towards right side but not at edge
	width: 250, // Match wallet selection container
	height: 200,
	backgroundColor: 'rgba(0, 0, 0, 0.8)',
	borderRadius: 12,
	padding: 16,
	flexDirection: 'column',
	gap: 12
})

// Create connect button
const connectButton = app.create('uiview', {
	width: 220, // Adjust to fit new container width
	height: 45,
	backgroundColor: app.config?.buttonColor || '#6366f1',
	borderRadius: 8,
	justifyContent: 'center',
	alignItems: 'center'
})

const buttonText = app.create('uitext', {
	value: app.config?.buttonText || 'Connect Wallet',
	color: '#ffffff',
	fontSize: 16,
	fontWeight: 'bold',
	textAlign: 'center'
})

connectButton.add(buttonText)

// Create status text
const statusText = app.create('uitext', {
	value: 'Ready to connect',
	color: '#cccccc',
	fontSize: 14,
	textAlign: 'center'
})

// Add balance display
// Create wallet info container (logo + balance)
const walletInfoContainer = app.create('uiview', {
	width: 220,
	flexDirection: 'row',
	gap: 8,
	alignItems: 'center',
	justifyContent: 'center',
	display: 'none' // Hidden until connected
})

// Create connected wallet logo
const connectedWalletLogo = app.create('uiimage', {
	width: 20,
	height: 20,
	objectFit: 'contain',
	display: 'none'
})

// Create connected wallet emoji fallback
const connectedWalletEmoji = app.create('uitext', {
	value: '💰',
	fontSize: 16,
	display: 'none'
})

// Create balance display
const balanceText = app.create('uitext', {
	value: '',
	color: '#94a3b8', // Subtle gray-blue
	fontSize: 12,
	textAlign: 'center'
})

// Create hotkey hints text
const hotkeysText = app.create('uitext', {
	value: 'U: Toggle UI • Q: Quick Connect',
	color: '#64748b', // Muted gray
	fontSize: 10,
	textAlign: 'center',
	fontWeight: '400',
	opacity: 0.7
})

// Function to update hotkey hints
function updateHotkeyHints() {
	const toggleKey = (app.props && app.props.hotKeyToggle) || 'I'
	const connectKey = (app.props && app.props.hotKeyConnect) || 'Q'

	let connectHint = 'Quick Connect'
	if (walletState.connected) {
		connectHint = 'Disconnect'
	} else if (lastConnectedWallet) {
		connectHint = `Connect to ${lastConnectedWallet.name}`
	}

	hotkeysText.value = `${toggleKey}: Toggle UI • ${connectKey}: ${connectHint}`
}

// Create wallet selection container (initially hidden)
const walletSelectionContainer = app.create('uiview', {
	width: 220, // Correct width
	height: 250, // Height for wallet selection
	backgroundColor: 'rgba(15, 23, 42, 0.98)', // Premium dark background
	borderRadius: 16, // More modern rounded corners
	borderWidth: 1,
	borderColor: 'rgba(71, 85, 105, 0.3)', // Subtle border
	padding: [12, 8, 12, 8], // Reduced padding: top, right, bottom, left
	flexDirection: 'column',
	gap: 8, // Reduced spacing
	alignItems: 'center', // Center content horizontally
	justifyContent: 'center', // Center content vertically
	display: 'none'
})

const selectionTitle = app.create('uitext', {
	value: 'Select Wallet',
	color: '#f1f5f9', // Slightly off-white for better readability
	fontSize: 18, // Larger, more prominent title
	fontWeight: 'bold',
	textAlign: 'center',
	padding: 4 // Small padding around title
})

const walletButtonsContainer = app.create('uiview', {
	width: 180, // Correct width
	flexDirection: 'column',
	gap: 8, // Reduced spacing
	alignItems: 'center', // Center the wallet buttons
	justifyContent: 'center' // Center vertically too
})

const cancelButton = app.create('uiview', {
	width: 180, // Correct width
	height: 36, // Slightly taller for better touch target
	backgroundColor: 'rgba(75, 85, 99, 0.8)', // More transparent, modern look
	borderRadius: 10, // More rounded
	borderWidth: 1,
	borderColor: 'rgba(156, 163, 175, 0.3)', // Subtle border
	justifyContent: 'center',
	alignItems: 'center',
	margin: [4, 0, 0, 0] // Reduced top margin
})

const cancelButtonText = app.create('uitext', {
	value: 'Cancel',
	color: '#e2e8f0', // Slightly softer white
	fontSize: 14,
	fontWeight: '500', // Medium weight
	textAlign: 'center'
})

cancelButton.add(cancelButtonText)

walletSelectionContainer.add(selectionTitle)
walletSelectionContainer.add(walletButtonsContainer)
walletSelectionContainer.add(cancelButton)

// Add wallet info components to container
walletInfoContainer.add(connectedWalletLogo)
walletInfoContainer.add(connectedWalletEmoji)
walletInfoContainer.add(balanceText)

// Add components to main UI
mainUI.add(connectButton)
mainUI.add(statusText)
mainUI.add(walletInfoContainer)
mainUI.add(hotkeysText)
mainUI.add(walletSelectionContainer)

// Add main UI to app
app.add(mainUI)

// Initialize hotkey system (inspired by freecam.js)
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
			const toggleKey = (app.props && app.props.hotKeyToggle) || (typeof props !== 'undefined' && props.hotKeyToggle) || 'U'
			const connectKey = (app.props && app.props.hotKeyConnect) || (typeof props !== 'undefined' && props.hotKeyConnect) || 'Q'

			hotKeyToggleCtrl = resolveKey(toggleKey, 'U')
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
				connectControl: !!hotKeyConnectCtrl
			})
		}

		// Initial binding
		refreshKeyBindings()
		// Store on control for access in update loop (like freecam.js)
		control._refreshWalletKeyBindings = refreshKeyBindings

	} catch (error) {
		console.error('[Wallet] Error initializing hotkeys:', error)
	}
}

// Toggle UI visibility
function toggleUI() {
	uiVisible = !uiVisible
	mainUI.active = uiVisible
	console.log('[Wallet] UI', uiVisible ? 'shown' : 'hidden')
}

// Quick connect/disconnect
async function quickConnect() {
	if (walletState.connected) {
		// Disconnect
		disconnectWallet()
	} else {
		const wallets = detectWallets()
		const walletType = app.config?.walletType || 'starknet'
		const walletsToShow = walletType === 'starknet' ? wallets.starknet : wallets.ethereum

		// Try to connect to last connected wallet first
		if (lastConnectedWallet) {
			const matchingWallet = walletsToShow.find(w =>
				w.name === lastConnectedWallet.name ||
				w.provider === lastConnectedWallet.provider
			)

			if (matchingWallet) {
				console.log('[Wallet] Quick connecting to last wallet:', matchingWallet.name)
				statusText.value = `Connecting to ${matchingWallet.name}...`
				statusText.color = '#f59e0b'
				await connectToWallet(matchingWallet)
				return
			}
		}

		// Fallback to first available wallet
		if (walletsToShow.length > 0) {
			console.log('[Wallet] Quick connecting to:', walletsToShow[0].name)
			statusText.value = `Connecting to ${walletsToShow[0].name}...`
			statusText.color = '#f59e0b'
			await connectToWallet(walletsToShow[0])
		} else {
			statusText.value = 'No wallets detected'
			statusText.color = '#ef4444'
		}
	}
}

// Initialize hotkeys on client
if (world.isClient) {
	initHotkeys()
	// Set initial hotkey hints
	updateHotkeyHints()
}

// Hotkey update loop (inspired by freecam.js)
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

// Helper function to detect available wallets using world API
function detectWallets() {
	console.log('[Wallet] Detecting wallets using world API...')

	try {
		const wallets = world.detectWallets()
		console.log('[Wallet] Raw wallets detected:', wallets)

		// Deduplicate wallets to avoid ArgentX/Ready Wallet duplicates
		const deduplicatedWallets = {
			starknet: deduplicateStarknetWallets(wallets.starknet || []),
			ethereum: wallets.ethereum || []
		}

		console.log('[Wallet] Deduplicated wallets:', deduplicatedWallets)
		return deduplicatedWallets
	} catch (error) {
		console.error('[Wallet] Error detecting wallets:', error)
		return {
			starknet: [],
			ethereum: []
		}
	}
}

// Function to filter and deduplicate Starknet wallets (only Ready Wallet and Braavos)
function deduplicateStarknetWallets(starknetWallets) {
	const uniqueWallets = []
	const seenProviders = new Set()

	starknetWallets.forEach(wallet => {
		// Check if we've already seen this provider
		const providerKey = getProviderKey(wallet.provider)

		if (!seenProviders.has(providerKey)) {
			// Normalize the wallet name (ArgentX -> Ready Wallet)
			const normalizedName = normalizeWalletName(wallet.name)

			// Only include Ready Wallet and Braavos
			if (normalizedName === 'Ready Wallet' || normalizedName.toLowerCase().includes('braavos')) {
				seenProviders.add(providerKey)
				uniqueWallets.push({
					...wallet,
					name: normalizedName
				})
			}
		}
	})

	return uniqueWallets
}

// Function to get a unique key for a wallet provider
function getProviderKey(provider) {
	// Use the provider object itself as the key since it's the same object
	// This handles cases where the same provider is detected multiple times
	return provider
}

// Function to normalize wallet names (handle rebrands)
function normalizeWalletName(name) {
	const lowerName = name.toLowerCase()

	// Handle ArgentX -> Ready Wallet rebrand
	if (lowerName.includes('argentx') || lowerName.includes('argent')) {
		return 'Ready Wallet'
	}

	// Keep other names as-is
	return name
}

// Function to get wallet logo URL from app config
function getWalletLogoUrl(wallet) {
	const name = (wallet.name || '').toLowerCase()

	// Get logos from props configuration
	if (name.includes('ready') || name.includes('argent')) {
		return props.readyWalletLogo?.url || null
	}
	if (name.includes('braavos')) {
		return props.braavosLogo?.url || null
	}

	// No logo configured
	return null
}

// Function to get wallet emoji fallback
function getWalletEmojiFallback(wallet) {
	const name = (wallet.name || '').toLowerCase()

	// Use specific emojis as fallback if logo fails to load
	if (name.includes('ready') || name.includes('argent')) return '⚡'  // Ready Wallet/ArgentX
	if (name.includes('braavos')) return '🛡️'                          // Braavos

	// Default wallet emoji
	return '💰'
}

// Function to update connected wallet logo/emoji display
function updateConnectedWalletDisplay() {
	if (!walletState.connected || !walletState.walletName) {
		connectedWalletLogo.display = 'none'
		connectedWalletEmoji.display = 'none'
		return
	}

	// Try to show logo first
	const logoUrl = getWalletLogoUrl({ name: walletState.walletName })
	const fallbackEmoji = getWalletEmojiFallback({ name: walletState.walletName })

	if (logoUrl) {
		connectedWalletLogo.src = logoUrl
		connectedWalletLogo.display = 'flex'
		connectedWalletEmoji.display = 'none'
		console.log('[Wallet] Showing connected wallet logo for:', walletState.walletName)
	} else {
		connectedWalletEmoji.value = fallbackEmoji
		connectedWalletEmoji.display = 'flex'
		connectedWalletLogo.display = 'none'
		console.log('[Wallet] Showing connected wallet emoji for:', walletState.walletName, fallbackEmoji)
	}
}

// Function to fetch and display wallet balance
async function updateWalletBalance() {
	if (!walletState.connected || !world.isClient || !walletState.address) {
		walletInfoContainer.display = 'none'
		return
	}

	try {
		console.log('[Wallet] Fetching balance for:', walletState.address)

		// Show wallet logo/emoji
		updateConnectedWalletDisplay()

		// Add a small delay to ensure wallet connection is fully established
		await new Promise(resolve => setTimeout(resolve, 1000))

		// For Braavos, try direct provider methods first
		if (walletState.walletName && walletState.walletName.toLowerCase().includes('braavos')) {
			console.log('[Wallet] Using Braavos-specific balance approach...')
			balanceText.value = 'Checking...'
			walletInfoContainer.display = 'flex'

			// Try direct balance call using the STRK contract
			const strkTokenAddress = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'

			// Method 1: Try using direct RPC call with proper entry point selector
			try {
				console.log('[Wallet] Trying direct RPC balance call for Braavos...')

				// balanceOf selector hash (keccak256 of 'balanceOf')
				const balanceOfSelector = '0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e'

				// Use Starknet's public RPC endpoint
				const rpcResponse = await fetch('https://starknet-mainnet.public.blastapi.io', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'starknet_call',
						params: [
							{
								contract_address: strkTokenAddress,
								entry_point_selector: balanceOfSelector,
								calldata: [walletState.address]
							},
							'latest'
						],
						id: 1
					})
				})

				const rpcData = await rpcResponse.json()
				console.log('[Wallet] RPC response:', rpcData)

				if (rpcData.result && rpcData.result.length > 0) {
					const balanceHex = rpcData.result[0]
					const balanceWei = BigInt(balanceHex)
					const balanceStrk = Number(balanceWei) / Math.pow(10, 18)
					const formattedBalance = balanceStrk.toFixed(4).replace(/\.?0+$/, '')
					balanceText.value = `${formattedBalance} STRK`
					console.log('[Wallet] Braavos balance via RPC call:', formattedBalance, 'STRK')
					return
				} else if (rpcData.error) {
					console.log('[Wallet] RPC error:', rpcData.error)
				}
			} catch (rpcError) {
				console.log('[Wallet] Direct RPC call failed:', rpcError.message)
			}

			// Method 2: Try using the world API with better account setting
			try {
				// Force set the account in the world API
				if (world.starknet) {
					world.starknet.account = walletState.provider
					world.starknet.address = walletState.address
					console.log('[Wallet] Set Braavos account in world.starknet manually')
				}

				const balance = await world.getStarknetBalance(walletState.address)
				if (balance !== null && balance !== undefined) {
					const formattedBalance = parseFloat(balance).toFixed(4).replace(/\.?0+$/, '')
					balanceText.value = `${formattedBalance} STRK`
					console.log('[Wallet] Braavos balance via world API:', formattedBalance, 'STRK')
					return
				}
			} catch (worldError) {
				console.log('[Wallet] World API failed for Braavos:', worldError.message)
			}

			// If all methods fail, show connected status without balance
			balanceText.value = 'Connected'
			console.log('[Wallet] All balance methods failed for Braavos, showing connected status')
			return
		}

		// Try multiple methods to get balance for other wallets
		const strkTokenAddress = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d' // STRK on Starknet mainnet

		// Method 1: Try using the wallet provider directly
		if (walletState.provider && walletState.provider.account) {
			try {
				console.log('[Wallet] Trying provider balance call...')
				const balanceCall = await walletState.provider.account.callContract({
					contractAddress: strkTokenAddress,
					entrypoint: 'balanceOf',
					calldata: [walletState.address]
				})

				if (balanceCall && balanceCall.result && balanceCall.result.length > 0) {
					const balanceHex = balanceCall.result[0]
					const balanceWei = BigInt(balanceHex)
					const balanceStrk = Number(balanceWei) / Math.pow(10, 18)
					const formattedBalance = balanceStrk.toFixed(4).replace(/\.?0+$/, '')
					balanceText.value = `${formattedBalance} STRK`
					walletInfoContainer.display = 'flex'
					console.log('[Wallet] Balance updated via provider:', formattedBalance, 'STRK')
					return
				}
			} catch (providerError) {
				console.log('[Wallet] Provider balance call failed:', providerError.message)
			}
		}

		// Fallback to world API
		const balance = await world.getStarknetBalance(walletState.address)

		if (balance !== null && balance !== undefined) {
			// Format balance to show max 4 decimal places
			const formattedBalance = parseFloat(balance).toFixed(4).replace(/\.?0+$/, '')
			balanceText.value = `${formattedBalance} STRK`
			walletInfoContainer.display = 'flex'
			console.log('[Wallet] Balance updated via world API:', formattedBalance, 'STRK')
		} else {
			balanceText.value = 'Connected'
			walletInfoContainer.display = 'flex'
		}
	} catch (error) {
		console.error('[Wallet] Error fetching balance:', error)
		balanceText.value = 'Connected'
		walletInfoContainer.display = 'flex'
	}
}

// Function to create wallet selection buttons
function createWalletButtons(wallets) {
	// Clear existing buttons
	walletButtonsContainer.children.forEach(child => {
		walletButtonsContainer.remove(child)
	})

	const walletType = app.config?.walletType || 'starknet'
	const walletsToShow = walletType === 'starknet' ? wallets.starknet : wallets.ethereum

	walletsToShow.forEach((wallet, index) => {
		const walletButton = app.create('uiview', {
			width: 180, // Correct width
			height: 44, // Taller for better touch target
			backgroundColor: 'rgba(255, 255, 255, 0.08)', // More subtle background
			borderRadius: 12, // More rounded corners
			borderWidth: 1,
			borderColor: 'rgba(255, 255, 255, 0.1)', // Subtle border
			justifyContent: 'flex-start',
			alignItems: 'center',
			padding: 12, // More generous padding
			flexDirection: 'row',
			gap: 14 // Better spacing between icon and text
		})

		// Create wallet icon - use configured logo or fallback to emoji
		const logoUrl = getWalletLogoUrl(wallet)
		const fallbackEmoji = getWalletEmojiFallback(wallet)

		let walletIcon
		if (logoUrl) {
			// User has configured a logo for this wallet
			try {
				walletIcon = app.create('uiimage', {
					src: logoUrl,
					width: 24,
					height: 24,
					objectFit: 'contain'
				})
				console.log('[Wallet] Created UIImage for', wallet.name, 'with configured logo')
			} catch (error) {
				// If UIImage creation fails, fallback to emoji
				walletIcon = app.create('uitext', {
					value: fallbackEmoji,
					fontSize: 18
				})
				console.log('[Wallet] UIImage failed for', wallet.name, ', using emoji fallback:', fallbackEmoji)
			}
		} else {
			// No logo configured, use emoji
			walletIcon = app.create('uitext', {
				value: fallbackEmoji,
				fontSize: 18
			})
			console.log('[Wallet] No logo configured for', wallet.name, ', using emoji:', fallbackEmoji)
		}

		const walletName = app.create('uitext', {
			value: wallet.name,
			color: '#f8fafc', // Crisp white
			fontSize: 15, // Slightly larger
			fontWeight: '600' // Semi-bold for modern look
		})

		walletButton.add(walletIcon)
		walletButton.add(walletName)

		// Add click handler
		walletButton.onPointerDown = async () => {
			console.log('[Wallet] Selected wallet:', wallet.name)
			hideWalletSelection()
			await connectToWallet(wallet)
		}

		walletButton.onPointerOver = () => {
			walletButton.backgroundColor = 'rgba(255, 255, 255, 0.15)' // Subtle hover effect
			walletButton.borderColor = 'rgba(255, 255, 255, 0.25)' // Brighter border on hover
			// Add slight scale effect feel (via slightly increasing padding)
		}

		walletButton.onPointerOut = () => {
			walletButton.backgroundColor = 'rgba(255, 255, 255, 0.08)' // Return to normal
			walletButton.borderColor = 'rgba(255, 255, 255, 0.1)' // Return to normal border
		}

		walletButtonsContainer.add(walletButton)
	})
}

// Function to show wallet selection
function showWalletSelection() {
	showingWalletSelection = true
	connectButton.display = 'none'
	statusText.display = 'none'
	walletSelectionContainer.display = 'flex'

	// Adjust main UI height for larger, more spacious selection UI
	mainUI.height = 320
}

// Function to hide wallet selection
function hideWalletSelection() {
	showingWalletSelection = false
	connectButton.display = 'flex'
	statusText.display = 'flex'
	walletSelectionContainer.display = 'none'

	// Restore main UI height
	mainUI.height = 200
}

// Function to connect to a specific wallet
async function connectToWallet(wallet) {
	try {
		statusText.value = `Connecting to ${wallet.name}...`
		statusText.color = '#f59e0b'

		const walletType = app.config?.walletType || 'starknet'
		let result

		if (walletType === 'starknet') {
			// Handle different Starknet wallet behaviors
			console.log('[Wallet] Connecting to Starknet wallet:', wallet.name)

			try {
				// Try the standard approach first
				result = await world.connectStarknetWallet(wallet.provider)
			} catch (firstError) {
				console.log('[Wallet] Standard connection failed, trying alternative approach for', wallet.name)

				// Some wallets (like Braavos) might need direct enable call
				try {
					await wallet.provider.enable({ starknetVersion: 'v5' })

					// Get account info manually
					let address
					if (wallet.provider.selectedAddress) {
						address = wallet.provider.selectedAddress
					} else if (wallet.provider.account && wallet.provider.account.address) {
						address = wallet.provider.account.address
					} else if (wallet.provider.address) {
						address = wallet.provider.address
					} else {
						throw new Error('Could not retrieve wallet address')
					}

					result = {
						address: address,
						chainId: wallet.provider.chainId || 'starknet-mainnet',
						provider: wallet.provider
					}
				} catch (secondError) {
					console.error('[Wallet] Both connection methods failed:', firstError, secondError)
					throw secondError
				}
			}
		} else {
			result = await world.connectEthereumWallet(wallet.provider)
		}

		// Update state
		walletState = {
			connected: true,
			address: result.address,
			provider: result.provider,
			walletName: wallet.name
		}

		// Remember this wallet for quick connect
		lastConnectedWallet = {
			name: wallet.name,
			provider: wallet.provider
		}

		// Ensure the world API has the connection details for balance fetching
		if (world.starknet) {
			try {
				console.log('[Wallet] Setting account in world.starknet for balance queries')
				// Try the setAccount method first
				if (world.starknet.setAccount) {
					world.starknet.setAccount(result.provider, result.address)
				} else {
					// Fallback: set properties directly
					world.starknet.account = result.provider
					world.starknet.address = result.address
					world.starknet.provider = result.provider
				}
				console.log('[Wallet] Account set in world.starknet for:', wallet.name)
			} catch (worldError) {
				console.log('[Wallet] Could not set account in world.starknet:', worldError.message)
				// Force set properties directly as fallback
				try {
					world.starknet.account = result.provider
					world.starknet.address = result.address
					world.starknet.provider = result.provider
					console.log('[Wallet] Account force-set in world.starknet for:', wallet.name)
				} catch (forceError) {
					console.log('[Wallet] Could not force-set account:', forceError.message)
				}
			}
		}

		// Update hotkey hints
		updateHotkeyHints()

		// Update UI - Change button to "Disconnect"
		statusText.value = `Connected: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`
		statusText.color = '#10b981'

		// Show emoji + disconnect text for connected state (using emoji for button text)
		const fallbackEmoji = getWalletEmojiFallback(wallet)
		buttonText.value = `${fallbackEmoji} Disconnect`

		connectButton.backgroundColor = '#ef4444'

		// Emit wallet connected event
		app.emit('walletConnected', walletState)

		// Update wallet balance
		await updateWalletBalance()

		console.log('[Wallet] Wallet connected successfully:', walletState)

	} catch (error) {
		statusText.value = `Failed to connect to ${wallet.name}`
		statusText.color = '#ef4444'
		console.error('[Wallet] Connection error:', error)

		// Show more specific error message
		setTimeout(() => {
			statusText.value = 'Try selecting a different wallet'
			statusText.color = '#f59e0b'
		}, 3000)
	}
}

// Main wallet connection function
async function connectWallet() {
	try {
		if (walletState.connected) {
			// If already connected, disconnect
			disconnectWallet()
			return
		}

		statusText.value = 'Detecting wallets...'
		statusText.color = '#f59e0b'

		availableWallets = detectWallets()
		const walletType = app.config?.walletType || 'starknet'
		const walletsOfType = walletType === 'starknet' ? availableWallets.starknet : availableWallets.ethereum

		if (walletsOfType.length === 0) {
			statusText.value = `No ${walletType} wallet found`
			statusText.color = '#ef4444'
			return
		}

		if (walletsOfType.length === 1) {
			// Only one wallet, connect directly
			await connectToWallet(walletsOfType[0])
		} else {
			// Multiple wallets, show selection
			statusText.value = `Found ${walletsOfType.length} wallets`
			statusText.color = '#10b981'
			createWalletButtons(availableWallets)
			showWalletSelection()
		}

	} catch (error) {
		statusText.value = 'Error occurred'
		statusText.color = '#ef4444'
		console.error('[Wallet] Connection error:', error)
	}
}

// Disconnect function
function disconnectWallet() {
	const previousWalletName = walletState.walletName

	walletState = {
		connected: false,
		address: null,
		provider: null,
		walletName: null
	}

	// Update hotkey hints to show quick connect to last wallet
	updateHotkeyHints()

	// Reset UI to initial state
	statusText.value = 'Disconnected'
	statusText.color = '#cccccc'
	buttonText.value = app.config?.buttonText || 'Connect Wallet'
	connectButton.backgroundColor = app.config?.buttonColor || '#6366f1'
	walletInfoContainer.display = 'none' // Hide wallet info when disconnected

	app.emit('walletDisconnected', {})
	console.log('[Wallet] Wallet disconnected from:', previousWalletName)

	// Reset status after a moment
	setTimeout(() => {
		if (!walletState.connected) {
			statusText.value = 'Ready to connect'
			statusText.color = '#cccccc'
		}
	}, 2000)
}

// Event handlers
connectButton.onPointerDown = () => {
	console.log('[Wallet] Connect button clicked')
	connectWallet()
}

connectButton.onPointerOver = () => {
	if (walletState.connected) {
		connectButton.backgroundColor = '#dc2626' // Darker red on hover
	} else {
		connectButton.backgroundColor = '#4f46e5' // Darker blue on hover
	}
}

connectButton.onPointerOut = () => {
	if (walletState.connected) {
		connectButton.backgroundColor = '#ef4444' // Red for disconnect
	} else {
		connectButton.backgroundColor = app.config?.buttonColor || '#6366f1' // Blue for connect
	}
}

// Cancel button handler
cancelButton.onPointerDown = () => {
	console.log('[Wallet] Cancel wallet selection')
	hideWalletSelection()
	statusText.value = 'Selection cancelled'
	statusText.color = '#cccccc'
}

cancelButton.onPointerOver = () => {
	cancelButton.backgroundColor = 'rgba(107, 114, 128, 0.9)' // Slightly more opaque on hover
	cancelButton.borderColor = 'rgba(156, 163, 175, 0.5)' // Brighter border on hover
}

cancelButton.onPointerOut = () => {
	cancelButton.backgroundColor = 'rgba(75, 85, 99, 0.8)' // Return to normal state
	cancelButton.borderColor = 'rgba(156, 163, 175, 0.3)' // Return to normal border
}

// Update button appearance when config changes
app.on('config', () => {
	connectButton.backgroundColor = app.config?.buttonColor || '#6366f1'
	if (!walletState.connected) {
		buttonText.value = app.config?.buttonText || 'Connect Wallet'
	}
})

// Initial diagnostics
console.log('[Wallet] Enhanced wallet connect app initialized')
console.log('[Wallet] Running on:', world.isClient ? 'Client' : 'Server')

// Test wallet detection on startup (only on client)
if (world.isClient) {
	setTimeout(() => {
		console.log('[Wallet] Testing wallet detection after 1 second...')
		const wallets = detectWallets()
		const walletType = app.config?.walletType || 'starknet'
		const walletsOfType = walletType === 'starknet' ? wallets.starknet : wallets.ethereum

		if (walletsOfType.length === 0) {
			statusText.value = `No ${walletType} wallets detected`
			statusText.color = '#f59e0b'
		} else {
			statusText.value = `Found ${walletsOfType.length} ${walletType} wallet(s)`
			statusText.color = '#10b981'
		}
	}, 1000)
}
