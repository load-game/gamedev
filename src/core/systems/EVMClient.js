import { System } from './System'
import { storage } from '../storage'

const key = 'hyp:solana:auths'
const template = 'Connect to world:\n{address}'

export class EVM extends System {
  constructor(world) {
    super(world)
    this.auths = storage.get(key, []) // [...{ address, signature }]
    this.connected = false
    // Store previous React state to detect actual changes
    this._cachedReactIsConnected = false
    this._cachedReactAddress = null
  }

  async bind({ connectors, connect, config, actions, abis, address, isConnected, isConnecting, disconnect }) {
    // Store the action bindings
    this.actions = actions
    this.abis = abis
    this.connection = { connect, disconnect, connectors }
    this.config = config

    // Cache React-provided data (for checking if state actually changed)
    this._cachedReactIsConnected = isConnected
    this._cachedReactAddress = address

    // Don't let bind() call this from React's stale state after explicit operations
    // Skip state updates if we're in the middle of an explicit connect/disconnect operation
    this.address = address

    // Initialize ENS cache to prevent rate limiting
    this.ensCache = new Map()
    this.ensCacheTimeout = 5 * 60 * 1000 // 5 minutes

    // Update _reactData always (this is just caching React state)
    if (this._reactData) {
      this._reactData.isConnected = isConnected
      this._reactData.address = address
    }

    // Cache current React state for comparison next time
    if (this._cachedReactIsConnected === undefined) {
      this._cachedReactIsConnected = isConnected
      this._cachedReactAddress = address
      this.connected = isConnected  // Initialize on first bind
      if (isConnected) {
        this.emit('evmConnect', address)
      }
      return
    }

    // Only update this.connected if React state has ACTUALLY changed
    const isConnectedChanged = isConnected !== this._cachedReactIsConnected
    const addressChanged = address !== this._cachedReactAddress

    // Cache the new state for next comparison
    this._cachedReactIsConnected = isConnected
    this._cachedReactAddress = address

    // Update only if the connection state changed (not just address updates)
    if (isConnectedChanged) {
      if (isConnected) {
        this.connected = true
        this.address = address // Store the address too
        // Emit local event only - wallet connection is client-side
        this.emit('evmConnect', address)
      } else {
        this.connected = false
        this.address = null // Clear address on disconnect
        // Emit local event only - wallet disconnection is client-side
        this.emit('evmDisconnect')
      }
    }

    // Periodic cache cleanup (run once on bind)
    this.cleanupCache()
  }

  // Public method for apps to call - simplified wrapper
  async connect() {
    // Mark that we're performing an explicit operation
    // (but only very briefly, React needs to update us!)
    this._explicitOperationTimestamp = Date.now()

    // If React has updated but isn't done connecting yet, don't block it
    // Check both local state and we have an address, or we're still connecting
    if (this.connected && this._reactData?.isConnecting) {
      console.log('[EVM] Already connected locally, but React is still processing')
    }

    // Check if already connected using both local state AND we have an address
    const isAlreadyConnected = this.connected && (this.address || this._reactData?.address || this._cachedReactAddress)

    if (isAlreadyConnected) {
      console.log('[EVM] Already connected (has connection and address), skipping...')
      // Get address from React data if available
      const address = this._reactData?.address || this.address
      return { success: false, reason: 'already_connected', address }
    }

    if (!this.connection || !this.connection.connect) {
      console.error('[EVM] Connection not bound yet')
      return { success: false, reason: 'not_bound' }
    }

    if (!this.connection.connectors || this.connection.connectors.length === 0) {
      console.error('[EVM] No connectors available')
      return { success: false, reason: 'no_connectors' }
    }

    try {
      const connector = this.connection.connectors[0]

      await this.connection.connect({ connector })

      // Wait for React to update with the address (max 2 seconds)
      console.log('[EVM] Waiting for address from React...')
      const maxWait = 2000
      const startTime = Date.now()

      while (Date.now() - startTime < maxWait) {
        const address = this._reactData?.address || this.address
        if (address) {
          console.log('[EVM] Address received:', address)
          this.address = address
          this.connected = true
          return { success: true, connector, address }
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.warn('[EVM] Address not received within timeout')
      // Don't set this.connected = true here - we don't have an address yet!
      // Let bind() set it when React updates with the address
      return { success: true, connector, address: null }
    } catch (err) {
      return { success: false, error: err.message, reason: 'connection_failed' }
    }
  }

  // Public disconnect method for apps
  async disconnect() {
    // Mark that we're performing an explicit operation
    this._explicitOperationTimestamp = Date.now()

    // Check BOTH states
    const isActuallyConnected = this.connected || this._reactData?.isConnected

    if (!isActuallyConnected) {
      return { success: false, reason: 'not_connected' }
    }

    if (!this.connection || !this.connection.disconnect) {
      return { success: false, reason: 'not_bound' }
    }

    try {
      // Call the actual disconnect function from wagmi
      const disconnectResult = await this.connection.disconnect()

      // Reset states
      this.connected = false
      this.address = null // Clear cached address
      this._cachedReactIsConnected = false // Clear cached React state
      this._cachedReactAddress = null // Clear cached React address
      if (this._reactData) {
        this._reactData.isConnected = false
        this._reactData.address = null
      }

      // Emit disconnect event locally only
      this.emit('evmDisconnect')

      return { success: true }

    } catch (err) {
      // Even on error, reset our state to be safe
      this.connected = false
      this._cachedReactIsConnected = false // Clear cached state even on error
      if (this._reactData) {
        this._reactData.isConnected = false
      }

      return { success: false, error: err.message, reason: 'disconnect_failed' }
    }
  }

  deposit(playerId, amount) {
    throw new Error('[solana] deposit can only be called on the server')
  }

  withdraw(playerId, amount) {
    throw new Error('[solana] withdraw can only be called on the server')
  }

  async onDepositRequest({ depositId, serializedTx }) {
    this.world.network.send('depositResponse', { depositId, serializedSignedTx })
  }

  async onWithdrawRequest({ withdrawId, serializedTx }) {
    this.world.network.send('withdrawResponse', { withdrawId, serializedSignedTx })
  }

  // ENS Resolution with caching to prevent rate limits
  async resolveName(address) {
    if (!address) {
      return { success: false, reason: 'no_address' }
    }

    // Check cache first
    const cacheKey = `name:${address.toLowerCase()}`
    const cached = this.ensCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.ensCacheTimeout) {
      console.log('[EVM] ENS name resolved from cache:', cached.value)
      return { success: true, name: cached.value }
    }

    try {
      // Use viem's getEnsName action through the bound actions
      if (!this.actions?.getEnsName) {
        console.error('[EVM] ENS resolution not available - getEnsName not bound')
        return { success: false, reason: 'ens_not_available' }
      }

      console.log('[EVM] Resolving ENS name for address:', address)
      const name = await this.actions.getEnsName(this.config, { address })

      if (name) {
        // Cache the result
        this.ensCache.set(cacheKey, {
          value: name,
          timestamp: Date.now()
        })
        console.log('[EVM] ENS name resolved:', name)
        return { success: true, name }
      } else {
        console.log('[EVM] No ENS name found for address:', address)
        return { success: true, name: null }
      }
    } catch (error) {
      console.error('[EVM] ENS name resolution failed:', error.message)
      // Cache failures briefly to prevent repeated attempts
      this.ensCache.set(cacheKey, {
        value: null,
        timestamp: Date.now() - (this.ensCacheTimeout - 60000) // Cache for 1 minute
      })
      return { success: false, reason: 'resolution_failed', error: error.message }
    }
  }

  async lookupName(ensName) {
    if (!ensName) {
      return { success: false, reason: 'no_name' }
    }

    // Validate ENS name format
    if (!ensName.endsWith('.eth')) {
      console.log('[EVM] Not an ENS name:', ensName)
      return { success: true, address: null }
    }

    // Check cache first
    const cacheKey = `address:${ensName.toLowerCase()}`
    const cached = this.ensCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.ensCacheTimeout) {
      console.log('[EVM] ENS address resolved from cache:', cached.value)
      return { success: true, address: cached.value }
    }

    try {
      // Use viem's getEnsAddress action through the bound actions
      if (!this.actions?.getEnsAddress) {
        console.error('[EVM] ENS resolution not available - getEnsAddress not bound')
        return { success: false, reason: 'ens_not_available' }
      }

      console.log('[EVM] Resolving ENS address for name:', ensName)
      const address = await this.actions.getEnsAddress(this.config, { name: ensName })

      if (address) {
        // Cache the result
        this.ensCache.set(cacheKey, {
          value: address,
          timestamp: Date.now()
        })
        console.log('[EVM] ENS address resolved:', address)
        return { success: true, address }
      } else {
        console.log('[EVM] No address found for ENS name:', ensName)
        return { success: true, address: null }
      }
    } catch (error) {
      console.error('[EVM] ENS address resolution failed:', error.message)
      // Cache failures briefly to prevent repeated attempts
      this.ensCache.set(cacheKey, {
        value: null,
        timestamp: Date.now() - (this.ensCacheTimeout - 60000) // Cache for 1 minute
      })
      return { success: false, reason: 'resolution_failed', error: error.message }
    }
  }

  // Clear expired cache entries
  cleanupCache() {
    const now = Date.now()
    let cleaned = 0
    for (const [key, entry] of this.ensCache.entries()) {
      if (now - entry.timestamp > this.ensCacheTimeout) {
        this.ensCache.delete(key)
        cleaned++
      }
    }
    if (cleaned > 0) {
      console.log(`[EVM] Cleaned ${cleaned} expired ENS cache entries`)
    }
  }
}
