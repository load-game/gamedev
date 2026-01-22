import { BaseWeb3System } from './BaseWeb3System'
import ControllerProvider from '@cartridge/controller'
import { constants } from 'starknet'
import { web3Logger } from '../utils/web3Logger.js'
import { web3Environment } from '../utils/web3Environment.js'

/**
 * Client Web3 System
 *
 * - Runs on the client
 * - Provides Cartridge Controller integration for StarkNet wallet functionality
 * - Exposes wallet methods through world.web3 API
 *
 * IMPORTANT: This system operates at the browser level, not within the SES sandbox
 * Apps access this through the world.web3 API which is injected into their environment
 *
 */
export class ClientWeb3 extends BaseWeb3System {
  constructor(world) {
    super(world)
    this.controller = null
    this.account = null
    this.isInitializing = false
  }

  async init(options = {}) {
    try {
      web3Logger.info('Initializing Web3 system...')
      web3Logger.info(`Environment: ${web3Environment.isBrowser() ? 'Browser' : 'Unknown'}`)

      // We operate at the system level, not inside SES sandbox
      this.isInitializing = true
      await super.init(options)
      this.initWeb3({})
      web3Logger.success('Web3 system initialized successfully')
    } catch (error) {
      web3Logger.error('Failed to initialize Web3 system:', error)
      this.initError = error
      // Create a functioning mock API for graceful degradation
      this.createFunctionalMockAPI()
    } finally {
      this.isInitializing = false
    }
  }

  initWeb3({
    policies = null,
    chains = null,
    defaultChainId = constants.StarknetChainId.SN_SEPOLIA,
    keychainUrl = 'https://x.cartridge.gg',
    requireCartridge = true, // Make cartridge requirement explicit
  } = {}) {
    web3Logger.info('===== CARTRIDGE ENGINE FEATURE INITIALIZATION =====')
    web3Logger.info('Forcing cartridge initialization as engine requirement...')

    // Cartridge is now a required engine feature - fail fast if not available
    web3Environment.validateBrowser(['browser', 'localStorage', 'websocket'])

    if (!web3Environment.hasLocalStorage()) {
      throw new Error('CARTRIDGE ENGINE ERROR: LocalStorage required for cartridge integration. Browser security settings may be blocking access.')
    }

    const config = {
      keychainUrl,
      defaultChainId,
    }

    // Add policies if provided
    if (policies) {
      config.policies = policies
    }

    // Add custom chain configuration if provided
    if (chains) {
      config.chains = chains
    } else {
      // Default chains
      config.chains = [
        { rpcUrl: 'https://api.cartridge.gg/x/starknet/sepolia' },
        { rpcUrl: 'https://api.cartridge.gg/x/starknet/mainnet' },
      ]
    }

    const env = web3Environment.detectEnvironment()
    web3Logger.info('Environment Validation:')
    web3Logger.success(`✅ window: ${env.isBrowser}`)
    web3Logger.success(`✅ localStorage: ${env.hasLocalStorage}`)
    web3Logger.success(`✅ WebSocket: ${env.hasWebSocket}`)

    // === ENGINE FEATURE: CARTRIDGE CONTROLLER INITIALIZATION ===
    web3Logger.info('===== INITIALIZING CARTRIDGE CONTROLLER (ENGINE LEVEL) =====')
    web3Logger.info('Configuration:', config)

    try {
      web3Logger.info('🎯 Attempting to create ControllerProvider...')
      web3Logger.debug(`ControllerProvider import check: ${typeof ControllerProvider}`)
      web3Logger.debug('Config being passed:', JSON.stringify(config, null, 2))
      this.controller = new ControllerProvider(config)
      web3Logger.success('✅ ControllerProvider created successfully')
    } catch (error) {
      // ===== ENGINE FAILURE: CARTRIDGE FEATURE NOT INITIALIZED =====
      web3Logger.error('======================================================')
      web3Logger.error('❌ CARTRIDGE ENGINE FEATURE INITIALIZATION FAILED')
      web3Logger.error('======================================================')
      web3Logger.error('CRITICAL ERROR: Cartridge controller could not be initialized')
      web3Logger.error('Engine Status: FAILED')
      web3Logger.error('Error:', error.message)
      web3Logger.error('Stack:', error.stack)
      web3Logger.error('======================================================')
      web3Logger.error('SOLUTIONS:')
      web3Logger.error('1. Ensure running in browser environment (not Node.js)')
      web3Logger.error('2. Check cartridge dependencies: npm install @cartridge/controller')
      web3Logger.error('3. Verify browser supports required APIs (LocalStorage, WebSocket)')
      web3Logger.error('4. Check network connectivity to Cartridge infrastructure')
      web3Logger.error('======================================================')

      // Store initialization error for later retrieval
      this.initError = error
      web3Logger.error(`🚨 Storing initialization error for debugging: ${error.message}`)

      // FAIL HARD - Cartridge is a required engine feature
      throw new Error(`CRITICAL ENGINE FAILURE: Cartridge controller initialization failed - ${error.message}. Cartridge integration is required for this Hyperfy deployment.`)
    }

    // ===== SUCCESS: CARTRIDGE ENGINE FEATURE INITIALIZED =====
    web3Logger.info('======================================================')
    web3Logger.success('✅ CARTRIDGE ENGINE FEATURE INITIALIZED SUCCESSFULLY')
    web3Logger.info('======================================================')
    web3Logger.info('Engine Status: OPERATIONAL')
    web3Logger.info('Feature: Cartridge Controller v0.10.7')
    web3Logger.info('Environment: Browser Client')
    web3Logger.info('Networks: Sepolia + Mainnet Ready')
    web3Logger.info('API: world.web3 available for apps')
    web3Logger.info('======================================================')

    // Create the world.web3 API with proper binding
    this.createWorldWeb3API()
    web3Logger.success('✅ World API attached: world.web3')
  }

  getControllerInitError() {
    if (this.initError) {
      return this.initError.message
    }
    if (!web3Environment.isBrowser()) {
      return 'Browser environment required'
    }
    return 'Unknown initialization error'
  }

  createFunctionalMockAPI() {
    web3Logger.error('❌ CARTRIDGE ENGINE FEATURE REQUIRED - FAILED TO INITIALIZE')
    web3Logger.error('==========================================================')
    web3Logger.error('CRITICAL: Cartridge controller is a required engine feature')
    web3Logger.error('This deployment cannot proceed without cartridge integration')
    web3Logger.error('==========================================================')

    // Cartridge is now required - no fallback simulation, only clear error messages
    this.world.web3 = {
      connect: async () => {
        throw new Error(`CARTRIDGE ENGINE ERROR: Cannot connect wallet - required cartridge controller failed to initialize. ${this.initError?.message || 'Unknown initialization error'}`)
      },
      disconnect: async () => {
        throw new Error('CARTRIDGE ENGINE ERROR: Cannot disconnect - cartridge controller not initialized. This deployment requires cartridge integration.')
      },
      isConnected: () => false,

      // Account info - all throw errors since cartridge is required
      getAddress: () => {
        throw new Error('CARTRIDGE ENGINE ERROR: Cannot get address - cartridge controller not initialized. This deployment requires cartridge integration.')
      },
      getNetworkId: () => {
        throw new Error('CARTRIDGE ENGINE ERROR: Cannot get network ID - cartridge controller not initialized. This deployment requires cartridge integration.')
      },
      getAccount: () => {
        throw new Error('CARTRIDGE ENGINE ERROR: Cannot get account - cartridge controller not initialized. This deployment requires cartridge integration.')
      },

      // Transaction methods
      execute: async (calls, options = {}) => {
        throw new Error('CARTRIDGE ENGINE ERROR: Cannot execute transactions - cartridge controller not initialized. This deployment requires cartridge integration.')
      },

      // Event listeners - use base class methods
      on: this.on.bind(this),
      off: this.off.bind(this),

      // Configuration
      init: this.initWeb3.bind(this),

      // Direct controller access for advanced usage
      getController: () => {
        throw new Error('CARTRIDGE ENGINE ERROR: Cannot access controller - cartridge initialization failed. This deployment requires cartridge integration.')
      },

      // Debug information - enhanced to show critical failure
      getDebugInfo: () => this.createDebugInfo({
        initialized: false,
        engineFeatureRequired: 'CARTRIDGE CONTROLLER',
        status: 'CRITICAL FAILURE',
        error: this.initError?.message || 'Cartridge controller initialization failed',
        environment: web3Environment.detectEnvironment(),
        requirementsMet: false,
        deploymentStatus: 'FAILED - Cartridge integration required'
      })
    }
  }

  createWorldWeb3API() {
    web3Logger.info('Creating WORLD WEB3 API - REAL CARTRIDGE INTEGRATION')
    web3Logger.info('======================================================')
    web3Logger.info('✅ Engine Feature: Cartridge Controller v0.10.7')
    web3Logger.info('✅ Integration: Real @cartridge/controller')
    web3Logger.info('✅ Networks: StarkNet Sepolia + Mainnet')
    web3Logger.info('✅ API: Real transaction execution')
    web3Logger.info('======================================================')

    // Create the real world.web3 API with actual cartridge integration
    this.world.web3 = {
      // Connection methods - bound to maintain 'this' context
      connect: this.connect.bind(this),
      disconnect: this.disconnect.bind(this),
      isConnected: () => this.isConnected,

      // Account info - real data from cartridge controller
      getAddress: () => this.address,
      getNetworkId: () => this.networkId,
      getAccount: () => this.account,

      // Transaction methods - real StarkNet execution
      execute: this.execute.bind(this),

      // Event listeners - use base class methods
      on: this.on.bind(this),
      off: this.off.bind(this),

      // Configuration
      init: this.initWeb3.bind(this),

      // Direct controller access for advanced usage
      getController: () => this.controller,

      // Debug information - enhanced to show real integration status
      getDebugInfo: () => this.createDebugInfo({
        engineFeatureStatus: 'OPERATIONAL',
        integrationType: 'REAL CARTRIDGE CONTROLLER',
        hasController: !!this.controller,
        controllerVersion: 'v0.10.7',
        environment: web3Environment.detectEnvironment(),
        supportedNetworks: ['SN_SEPOLIA', 'SN_MAINNET'],
        deploymentStatus: 'READY - Cartridge engine feature active'
      })
    }

    web3Logger.success('✅ WORLD WEB3 API CREATED - Real cartridge integration ready')
  }

  connect = async () => {
    try {
      this.isConnecting = true
      web3Logger.network('Connecting to CARTRIDGE CONTROLLER (REAL INTEGRATION)')
      web3Logger.info('======================================================')
      web3Logger.info(`Controller exists: ${!!this.controller}`)
      web3Logger.info(`Controller type: ${typeof this.controller}`)
      web3Logger.info(`Controller.connect type: ${typeof this.controller?.connect}`)

      this.account = await this.controller.connect()
      web3Logger.info(`Connect result: ${!!this.account}`)
      web3Logger.info(`Account object type: ${typeof this.account}`)

      if (this.account) {
        web3Logger.info(`Account.address: ${this.account.address}`)
        web3Logger.debug(`Account object methods: ${Object.getOwnPropertyNames(this.account).filter(name => typeof this.account[name] === 'function').join(', ')}`)

        this.isConnected = true
        this.address = this.account.address
        this.networkId = await this.account.getChainId()

        web3Logger.success('✅ REAL CARTRIDGE CONNECTION ESTABLISHED:')
        web3Logger.info(`  Address: ${this.address}`)
        web3Logger.info(`  Network ID: ${this.networkId}`)
        web3Logger.info('  Controller: @cartridge/controller v0.10.7')
        web3Logger.info('  Integration: REAL (no simulation)')

        this.emitSafe('connected', {
          address: this.address,
          chainId: this.networkId,
          integration: 'REAL_CARTRIDGE_CONTROLLER',
        })

        return {
          address: this.address,
          chainId: this.networkId,
          account: this.account,
          integration: 'REAL_CARTRIDGE_CONTROLLER',
        }
      }

      throw new Error('REAL CARTRIDGE CONNECTION FAILED: No account returned from controller')
    } catch (error) {
      web3Logger.error('❌ REAL CARTRIDGE CONNECTION FAILED:', error)
      web3Logger.error('This is a real cartridge controller connection failure')
      this.emitSafe('error', { type: 'connection', error, integration: 'REAL_CARTRIDGE' })
      throw error
    } finally {
      this.isConnecting = false
    }
  }

  disconnect = async () => {
    try {
      web3Logger.info('Disconnecting...')

      if (this.controller && this.controller.disconnect) {
        await this.controller.disconnect()
      }

      this.account = null
      this.isConnected = false
      this.address = null
      this.networkId = null

      this.emitSafe('disconnected')

      web3Logger.success('Disconnected')
    } catch (error) {
      web3Logger.error('Disconnect failed:', error)
      this.emitSafe('error', { type: 'disconnect', error })
      throw error
    }
  }

  execute = async (calls, options = {}) => {
    if (!this.isConnected || !this.account) {
      throw new Error('CARTRIDGE ENGINE ERROR: Real cartridge wallet not connected. Call world.web3.connect() first to connect with real cartridge controller.')
    }

    try {
      web3Logger.transaction('Executing REAL STARKNET TRANSACTION')
      web3Logger.info('=========================================')
      web3Logger.info('Calls:', calls)
      web3Logger.info('Options:', options)
      web3Logger.info(`Network: ${this.networkId}`)
      web3Logger.info('Controller: @cartridge/controller v0.10.7')

      const result = await this.account.execute(calls, options)

      web3Logger.success('✅ REAL STARKNET TRANSACTION EXECUTED:')
      web3Logger.info(`  Transaction Hash: ${result.transaction_hash}`)
      web3Logger.info(`  Network: ${this.networkId}`)
      web3Logger.info('  Integration: REAL (no simulation)')
      web3Logger.info('  Status: Broadcast to StarkNet')

      this.emitSafe('transaction', {
        result,
        integration: 'REAL_CARTRIDGE_CONTROLLER',
        network: this.networkId
      })

      return result
    } catch (error) {
      web3Logger.error('❌ REAL STARKNET TRANSACTION FAILED:', error)
      web3Logger.error('This is a real transaction failure on StarkNet network')
      this.emitSafe('error', { type: 'transaction', error, integration: 'REAL_CARTRIDGE' })
      throw error
    }
  }

  destroy() {
    this.disconnect()
    if (this.world.web3) {
      delete this.world.web3
    }
    super.destroy()
    web3Logger.info('Destroyed')
  }
}
