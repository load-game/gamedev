import { System } from './System.js'

/**
 * BaseWeb3System - Common foundation for all Web3 systems
 *
 * - Provides shared properties and methods for blockchain integration
 * - Standardizes event emission and error handling
 * - Supports both client and server contexts
 * - Offers consistent API patterns across all web3 implementations
 *
 * Abstract Methods (must be implemented by subclasses):
 * - connect() - Establish connection to blockchain/network
 * - disconnect() - Terminate connection
 *
 * Common properties available in all subclasses:
 * - isConnected: boolean - Connection status
 * - isConnecting: boolean - Connection in progress
 * - address: string | null - Connected wallet address
 * - networkId: string | null - Current network identifier
 * - listeners: Map - Event listener management
 * - initError: Error | null - Initialization error state
 * - hasWindow: boolean - Browser environment detection
 * - environment: string - Current environment description
 */
export class BaseWeb3System extends System {
  constructor(world) {
    super(world)

    // Connection state
    this.isConnected = false
    this.isConnecting = false

    // Account information
    this.address = null
    this.networkId = null

    // Event management
    this.listeners = new Map()

    // Error handling
    this.initError = null

    // Environment detection
    this.hasWindow = typeof window !== 'undefined'
    this.environment = this.hasWindow ? 'browser' : 'unknown'

    // Common configuration
    this.config = {}

    // State tracking
    this.isInitialized = false
  }

  /**
   * Initialize the web3 system with common setup logic
   * Subclasses should call super.init() before their specific initialization
   */
  async init(options = {}) {
    try {
      console.log(`[${this.constructor.name}] Initializing Web3 system...`)
      console.log(`[${this.constructor.name}] Environment:`, this.environment)

      // Merge configuration
      Object.assign(this.config, options)

      // Clear any previous initialization errors
      this.initError = null

      this.isInitialized = true
      console.log(`[${this.constructor.name}] Base initialization completed`)
    } catch (error) {
      console.error(`[${this.constructor.name}] Initialization failed:`, error)
      this.initError = error
      throw error
    }
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Establish connection to the blockchain/network
   */
  async connect() {
    throw new Error(`[${this.constructor.name}] connect() method must be implemented by subclass`)
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Terminate connection to the blockchain/network
   */
  async disconnect() {
    throw new Error(`[${this.constructor.name}] disconnect() method must be implemented by subclass`)
  }

  /**
   * Get the currently connected wallet address
   */
  getAddress() {
    return this.address
  }

  /**
   * Get the current network ID
   */
  getNetwork() {
    return this.networkId
  }

  /**
   * Check if the system is currently connected
   */
  isSystemConnected() {
    return this.isConnected
  }

  /**
   * Check if the system is currently connecting
   */
  isSystemConnecting() {
    return this.isConnecting
  }

  /**
   * Get initialization error if any
   */
  getInitError() {
    return this.initError
  }

  /**
   * Validate browser environment for client-side systems
   * @throws {Error} If running in non-browser environment
   */
  validateBrowser() {
    if (!this.hasWindow) {
      throw new Error(`[${this.constructor.name}] Browser environment required but not available`)
    }

    // Check for additional browser features that might be required
    const requirements = ['localStorage', 'WebSocket']
    const missing = requirements.filter(req => typeof window[req] === 'undefined')

    if (missing.length > 0) {
      throw new Error(`[${this.constructor.name}] Required browser features not available: ${missing.join(', ')}`)
    }
  }

  /**
   * Create a mock API that throws errors when methods are called
   * Useful for graceful degradation when initialization fails
   */
  createMockAPI(prefix = this.constructor.name) {
    const errorMessage = `${prefix} not initialized`

    return {
      // Connection methods
      connect: async () => {
        throw new Error(`${errorMessage}: Cannot connect`)
      },
      disconnect: async () => {
        throw new Error(`${errorMessage}: Cannot disconnect`)
      },
      isConnected: () => false,

      // Account methods
      getAddress: () => {
        throw new Error(`${errorMessage}: Cannot get address`)
      },
      getNetworkId: () => {
        throw new Error(`${errorMessage}: Cannot get network ID`)
      },

      // Transaction methods (common across web3 systems)
      execute: async (calls, options = {}) => {
        throw new Error(`${errorMessage}: Cannot execute transactions`)
      },

      // Event listeners
      on: this.on.bind(this),
      off: this.off.bind(this),

      // Debug info
      getDebugInfo: () => this.createDebugInfo({
        error: errorMessage,
        status: 'FAILED'
      })
    }
  }

  /**
   * Create standardized debug information object
   */
  createDebugInfo(additional = {}) {
    return {
      system: this.constructor.name,
      initialized: this.isInitialized,
      connected: this.isConnected,
      connecting: this.isConnecting,
      address: this.address,
      networkId: this.networkId,
      environment: this.environment,
      hasWindow: this.hasWindow,
      initError: this.initError?.message || null,
      ...additional
    }
  }

  /**
   * Safe event emission with error handling
   */
  emitSafe(event, data) {
    try {
      this.emit(event, data)
    } catch (error) {
      console.error(`[${this.constructor.name}] Error emitting event '${event}':`, error)
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  /**
   * Emit event to all listeners with error handling
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[${this.constructor.name}] Event listener error (${event}):`, error)
        }
      })
    }
  }

  /**
   * Clear all event listeners
   */
  clearListeners() {
    this.listeners.clear()
  }

  /**
   * Common destroy method for cleanup
   * Subclasses should call super.destroy() before their specific cleanup
   */
  destroy() {
    console.log(`[${this.constructor.name}] Destroying Web3 system...`)

    // Reset connection state
    this.isConnected = false
    this.isConnecting = false
    this.address = null
    this.networkId = null

    // Clear event listeners
    this.clearListeners()

    // Clear errors
    this.initError = null
    this.isInitialized = false

    console.log(`[${this.constructor.name}] Web3 system destroyed`)
  }
}
