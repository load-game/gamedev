import EventEmitter from 'eventemitter3'

/**
 * ConnectionManager - Standardized Web3 Connection State Management
 *
 * Extracts and standardizes all connection state management logic that's
 * duplicated across web3 systems (ClientWeb3, EVMClient, DojoSystem, etc).
 *
 * Features:
 * - Connection state transitions with validation
 * - EventEmitter for connection events
 * - Error handling and recovery
 * - Auto-reconnection with exponential backoff
 * - Connection metadata tracking
 * - Statistics tracking (connect time, disconnect count, etc)
 * - Provider-specific state extensions
 *
 * Events:
 * - 'connecting' - starting connection
 * - 'connected' - successfully connected
 * - 'disconnected' - disconnected
 * - 'error' - connection error
 * - 'stateChange' - any state update
 *
 * @example
 * const manager = new ConnectionManager('cartridge', { autoReconnect: true })
 * manager.on('connected', (data) => console.log('Connected:', data))
 * await manager.connect(connector)
 */
export class ConnectionManager extends EventEmitter {
  constructor(providerName, options = {}) {
    super()
    this.providerName = providerName
    this.options = {
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      reconnectBackoffMultiplier: 2,
      maxReconnectDelay: 30000,
      connectionTimeout: 30000,
      ...options
    }

    // Core connection state
    this.state = {
      isConnected: false,
      isConnecting: false,
      isDisconnecting: false,
      address: null,
      networkId: null,
      error: null,
      metadata: {}
    }

    // Internal state for reconnection and tracking
    this._reconnectAttempts = 0
    this._reconnectTimer = null
    this._connectionTimer = null
    this._connectStartTime = null
    this._totalConnectedTime = 0
    this._disconnectCount = 0
    this._lastConnectedTime = null
    this._connector = null

    // Statistics tracking
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      totalConnectedTime: 0,
      averageConnectionTime: 0,
      lastConnectionTime: null,
      lastDisconnectionTime: null,
      lastError: null
    }
  }

  /**
   * Initiate connection flow
   * @param {Object} connector - Provider-specific connector object
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection data
   */
  async connect(connector, options = {}) {
    // Prevent concurrent connections
    if (this.state.isConnecting || this.state.isConnected) {
      if (this.state.isConnected) {
        return this._getConnectionData()
      }
      throw new Error(`${this.providerName}: Connection already in progress`)
    }

    // Validate connector
    if (!connector || typeof connector.connect !== 'function') {
      throw new Error(`${this.providerName}: Invalid connector - must have connect method`)
    }

    this._connector = connector
    this._connectStartTime = Date.now()

    try {
      this._updateState({
        isConnecting: true,
        error: null,
        metadata: {
          ...this.state.metadata,
          connectionMethod: options.method || 'manual',
          connectionStartTime: this._connectStartTime
        }
      })

      this.emit('connecting', { provider: this.providerName, options })

      // Set connection timeout
      if (this.options.connectionTimeout) {
        this._connectionTimer = setTimeout(() => {
          this.setError(new Error(`${this.providerName}: Connection timeout after ${this.options.connectionTimeout}ms`))
          this._clearConnectionTimer()
        }, this.options.connectionTimeout)
      }

      // Call provider-specific connect
      const result = await connector.connect(options)

      // Process connection result
      const connectionData = this._processConnectionResult(result)

      this._clearConnectionTimer()

      // Mark as connected
      this._updateState({
        isConnected: true,
        isConnecting: false,
        address: connectionData.address,
        networkId: connectionData.networkId || connectionData.chainId,
        metadata: {
          ...this.state.metadata,
          connectionTime: Date.now(),
          connectionDuration: Date.now() - this._connectStartTime
        }
      })

      // Update statistics
      this._updateConnectionStats()

      // Reset reconnection attempts on successful connection
      this._reconnectAttempts = 0

      this.emit('connected', connectionData)
      this.emit('stateChange', { state: this.state, event: 'connected' })

      console.log(`[ConnectionManager:${this.providerName}] Connected:`, connectionData)

      return connectionData

    } catch (error) {
      this._clearConnectionTimer()
      this.setError(error)

      // Handle auto-reconnection
      if (this.options.autoReconnect && this._reconnectAttempts < this.options.maxReconnectAttempts) {
        this._scheduleReconnect()
      }

      throw error
    }
  }

  /**
   * Initiate disconnection flow
   * @param {Object} options - Disconnection options
   * @returns {Promise<void>}
   */
  async disconnect(options = {}) {
    if (!this.state.isConnected && !this.state.isConnecting) {
      return // Already disconnected
    }

    if (this.state.isDisconnecting) {
      throw new Error(`${this.providerName}: Disconnection already in progress`)
    }

    try {
      this._updateState({
        isDisconnecting: true
      })

      this.emit('disconnecting', { provider: this.providerName })

      // Clear any pending reconnection
      this._clearReconnectTimer()

      // Call provider-specific disconnect if available
      if (this._connector && typeof this._connector.disconnect === 'function') {
        await this._connector.disconnect(options)
      }

      // Update state
      this._updateState({
        isConnected: false,
        isConnecting: false,
        isDisconnecting: false,
        address: null,
        networkId: null,
        metadata: {
          ...this.state.metadata,
          disconnectionTime: Date.now(),
          disconnectionReason: options.reason || 'manual'
        }
      })

      // Update statistics
      this._updateDisconnectionStats()

      this.emit('disconnected', { provider: this.providerName })
      this.emit('stateChange', { state: this.state, event: 'disconnected' })

      console.log(`[ConnectionManager:${this.providerName}] Disconnected`)

    } catch (error) {
      this.setError(error)
      throw error
    }
  }

  /**
   * Validate current connection state
   * @returns {boolean} Whether connection is valid
   */
  validateConnection() {
    if (!this.state.isConnected) {
      return false
    }

    if (!this.state.address) {
      this.setError(new Error(`${this.providerName}: Connected but no address`))
      return false
    }

    // Additional provider-specific validation can be added here
    return true
  }

  /**
   * Update connection state with validation
   * @param {Object} updates - State updates
   */
  updateState(updates) {
    const oldState = { ...this.state }
    this._updateState(updates)
    this.emit('stateChange', { oldState, newState: this.state })
  }

  /**
   * Get current connection state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state }
  }

  /**
   * Get connected address
   * @returns {string|null} Connected address
   */
  getAddress() {
    return this.state.address
  }

  /**
   * Get connected network
   * @returns {string|null} Network ID
   */
  getNetwork() {
    return this.state.networkId
  }

  /**
   * Check if connection is ready for operations
   * @returns {boolean} Ready state
   */
  isReady() {
    return this.state.isConnected && !this.state.isConnecting && !this.state.isDisconnecting
  }

  /**
   * Set error state and emit error event
   * @param {Error} error - Error object
   */
  setError(error) {
    const errorObj = error instanceof Error ? error : new Error(error)

    this._updateState({
      error: errorObj,
      metadata: {
        ...this.state.metadata,
        lastErrorTime: Date.now()
      }
    })

    // Update error statistics
    this.stats.totalErrors++
    this.stats.lastError = errorObj

    this.emit('error', {
      provider: this.providerName,
      error: errorObj,
      state: this.state
    })

    console.error(`[ConnectionManager:${this.providerName}] Error:`, errorObj)
  }

  /**
   * Clear error state
   */
  clearError() {
    this._updateState({ error: null })
    this.emit('stateChange', { state: this.state, event: 'errorCleared' })
  }

  /**
   * Get connection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentConnectionTime: this.state.isConnected ?
        Date.now() - this._lastConnectedTime : 0
    }
  }

  /**
   * Get connection info for debugging
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      providerName: this.providerName,
      state: this.state,
      stats: this.getStats(),
      reconnectAttempts: this._reconnectAttempts,
      hasReconnectTimer: !!this._reconnectTimer,
      hasConnectionTimer: !!this._connectionTimer,
      options: this.options
    }
  }

  /**
   * Force reconnection attempt
   * @param {Object} options - Reconnection options
   */
  async forceReconnect(options = {}) {
    console.log(`[ConnectionManager:${this.providerName}] Forcing reconnection...`)

    // Clear any existing reconnection timer
    this._clearReconnectTimer()

    // Disconnect first if connected
    if (this.state.isConnected) {
      await this.disconnect({ reason: 'force_reconnect' })
    }

    // Reset reconnection attempts
    this._reconnectAttempts = 0

    // Connect
    return this.connect(this._connector, options)
  }

  /**
   * Cleanup method to clear timers and references
   */
  destroy() {
    this._clearReconnectTimer()
    this._clearConnectionTimer()
    this._connector = null
    this.removeAllListeners()
  }

  // Private methods

  _updateState(updates) {
    Object.assign(this.state, updates)
  }

  _processConnectionResult(result) {
    // Handle different response formats from providers
    if (!result) {
      throw new Error(`${this.providerName}: No connection result received`)
    }

    // Standardize connection data
    return {
      address: result.address || this._extractAddress(result),
      networkId: result.networkId || result.chainId || this._extractNetworkId(result),
      account: result.account || result,
      timestamp: Date.now(),
      provider: this.providerName
    }
  }

  _extractAddress(result) {
    // Try to extract address from various result formats
    if (result.account?.address) return result.account.address
    if (result.address) return result.address
    if (typeof result === 'string') return result
    throw new Error(`${this.providerName}: Could not extract address from connection result`)
  }

  _extractNetworkId(result) {
    // Try to extract network ID from various result formats
    if (result.account?.getChainId) return result.account.getChainId()
    if (result.chainId) return result.chainId
    if (result.networkId) return result.networkId
    return null
  }

  _getConnectionData() {
    return {
      address: this.state.address,
      networkId: this.state.networkId,
      provider: this.providerName,
      timestamp: Date.now()
    }
  }

  _scheduleReconnect() {
    this._reconnectAttempts++

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(this.options.reconnectBackoffMultiplier, this._reconnectAttempts - 1),
      this.options.maxReconnectDelay
    )

    console.log(`[ConnectionManager:${this.providerName}] Scheduling reconnect attempt ${this._reconnectAttempts}/${this.options.maxReconnectAttempts} in ${delay}ms`)

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(this._connector, {
          isReconnect: true,
          reconnectAttempt: this._reconnectAttempts
        })
      } catch (error) {
        console.error(`[ConnectionManager:${this.providerName}] Reconnect attempt ${this._reconnectAttempts} failed:`, error)

        if (this._reconnectAttempts < this.options.maxReconnectAttempts) {
          this._scheduleReconnect()
        } else {
          console.error(`[ConnectionManager:${this.providerName}] Max reconnection attempts reached`)
          this.emit('reconnectFailed', {
            provider: this.providerName,
            attempts: this._reconnectAttempts
          })
        }
      }
    }, delay)
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  _clearConnectionTimer() {
    if (this._connectionTimer) {
      clearTimeout(this._connectionTimer)
      this._connectionTimer = null
    }
  }

  _updateConnectionStats() {
    this.stats.totalConnections++
    this.stats.lastConnectionTime = new Date().toISOString()
    this._lastConnectedTime = Date.now()
  }

  _updateDisconnectionStats() {
    this.stats.totalDisconnections++
    this.stats.lastDisconnectionTime = new Date().toISOString()

    if (this._lastConnectedTime) {
      const connectionTime = Date.now() - this._lastConnectedTime
      this.stats.totalConnectedTime += connectionTime
      this.stats.averageConnectionTime = this.stats.totalConnectedTime / this.stats.totalConnections
    }
  }
}
