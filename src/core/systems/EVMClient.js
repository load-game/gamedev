import { createPublicClient, formatEther, formatUnits, getAddress, http, parseUnits } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'

import { System } from './System'

const DEFAULT_CHAIN_ID = mainnet.id
const SUPPORTED_CHAINS = [mainnet, arbitrum, base, optimism, polygon]
const SUPPORTED_CHAINS_BY_ID = new Map(SUPPORTED_CHAINS.map(chain => [chain.id, chain]))
const TOKENS_BY_CHAIN_ID = {
  [mainnet.id]: {
    usdc: {
      address: getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
      decimals: 6,
    },
  },
  [arbitrum.id]: {
    usdc: {
      address: getAddress('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
      decimals: 6,
    },
  },
  [base.id]: {
    usdc: {
      address: getAddress('0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913'),
      decimals: 6,
    },
  },
  [optimism.id]: {
    usdc: {
      address: getAddress('0x0b2C639c533813f4Aa9D7837CaF62653d097Ff85'),
      decimals: 6,
    },
  },
  [polygon.id]: {
    usdc: {
      address: getAddress('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
      decimals: 6,
    },
  },
}

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

function getPlayerCustom(player) {
  const custom = player?.data?.custom
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null
  return custom
}

function getPlayerEvmAddress(player) {
  const value = getPlayerCustom(player)?.evm
  return typeof value === 'string' && value ? value : null
}

function getPlayerEvmChainId(player) {
  const value = getPlayerCustom(player)?.evmChainId
  return Number.isInteger(value) && value > 0 ? value : null
}

function buildPlayerCustomPatch(player, address, chainId) {
  const current = getPlayerCustom(player)
  return {
    ...(current || {}),
    evm: address || null,
    evmChainId: Number.isInteger(chainId) && chainId > 0 ? chainId : null,
  }
}

function normalizeChainId(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      const parsedHex = Number.parseInt(trimmed, 16)
      return Number.isInteger(parsedHex) && parsedHex > 0 ? parsedHex : null
    }
    const parsedDec = Number.parseInt(trimmed, 10)
    return Number.isInteger(parsedDec) && parsedDec > 0 ? parsedDec : null
  }
  return null
}

function extractInjectedChainId(args) {
  if (!Array.isArray(args) || !args.length) return null
  return normalizeChainId(args[0]) || normalizeChainId(args[1]) || null
}

function sameAddress(a, b) {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

function sameWalletState(currentAddress, currentChainId, nextAddress, nextChainId) {
  const addressesMatch =
    (!currentAddress && !nextAddress) || (currentAddress && nextAddress && sameAddress(currentAddress, nextAddress))
  return addressesMatch && (currentChainId || null) === (nextChainId || null)
}

export class EVM extends System {
  constructor(world) {
    super(world)
    this.walletAdapter = null
    this.address = null
    this.connected = null
    this.chainId = null
    this.pendingPlayerSync = false
    this.pendingNetworkSync = false
    this.networkAddress = null
    this.networkChainId = null
    this.publicClients = new Map()
    this.runtimeAPIs = new Map()
    this.utils = { formatEther, formatUnits, getAddress, parseUnits }
    this.abis = {
      erc20: ERC20_ABI,
    }
  }

  init() {
    this.world.inject?.({
      world: {
        evm: (...args) => this.getRuntimeAPI(extractInjectedChainId(args)),
      },
      player: {
        evm: {
          get: player => getPlayerEvmAddress(player),
        },
        evmChainId: {
          get: player => getPlayerEvmChainId(player),
        },
      },
    })
  }

  getRuntimeAPI(chainId = null) {
    const boundChainId = normalizeChainId(chainId)
    if (boundChainId) {
      this._requireSupportedChain(boundChainId)
    }

    const key = boundChainId || 'default'
    if (this.runtimeAPIs.has(key)) {
      return this.runtimeAPIs.get(key)
    }

    const runtimeAPI = {
      utils: this.utils,
      abis: this.abis,
      getAddress: () => this.getAddress(),
      isConnected: () => this.isConnected(),
      getChainId: params => this.getChainId(this._mergeRuntimeOptions(params, boundChainId)),
      readContract: params => this.readContract(params, { chainId: boundChainId }),
      sendTransaction: params => this.sendTransaction(params, { chainId: boundChainId }),
      writeContract: params => this.writeContract(params, { chainId: boundChainId }),
      waitForTransactionReceipt: params => this.waitForTransactionReceipt(params, { chainId: boundChainId }),
      switchChain: params => this.switchChain(params, { chainId: boundChainId }),
      getNativeBalance: address => this.getNativeBalance(address, { chainId: boundChainId }),
      getTokenBalance: (tokenAddress, address, decimals) =>
        this.getTokenBalance(tokenAddress, address, decimals, { chainId: boundChainId }),
      getUSDCBalance: address => this.getUSDCBalance(address, { chainId: boundChainId }),
      transferNative: (to, amount) => this.transferNative(to, amount, { chainId: boundChainId }),
      transferToken: (tokenAddress, to, amount, decimals) =>
        this.transferToken(tokenAddress, to, amount, decimals, { chainId: boundChainId }),
      transferUSDC: (to, amount) => this.transferUSDC(to, amount, { chainId: boundChainId }),
    }

    this.runtimeAPIs.set(key, runtimeAPI)
    return runtimeAPI
  }

  start() {
    this.world.on?.('ready', this.onReady)
  }

  update() {
    this._syncPlayerState()
    this._syncNetworkState()
  }

  destroy() {
    this.world.off?.('ready', this.onReady)
  }

  onReady = () => {
    this.pendingPlayerSync = true
    this.pendingNetworkSync = true
    this._syncPlayerState()
    this._syncNetworkState()
  }

  bind({ walletAdapter, address, isConnected, chainId } = {}) {
    this.walletAdapter = walletAdapter || null

    if (typeof address === 'string' && address) {
      this.address = address
    } else {
      this.address = this.walletAdapter?.getAddress?.() || null
    }

    if (typeof isConnected === 'boolean') {
      this.connected = isConnected
    } else {
      this.connected = this.walletAdapter?.isConnected?.() ?? null
    }

    this.chainId = normalizeChainId(chainId)

    this.pendingPlayerSync = true
    this.pendingNetworkSync = true
    this._syncPlayerState()
    this._syncNetworkState()
  }

  getAddress() {
    return this.address || this.walletAdapter?.getAddress?.() || null
  }

  isConnected() {
    if (typeof this.connected === 'boolean') return this.connected
    return !!this.walletAdapter?.isConnected?.()
  }

  async getChainId({ request = false, chainId } = {}) {
    const requestedChainId = normalizeChainId(chainId)
    if (requestedChainId) {
      this._requireSupportedChain(requestedChainId)
      return requestedChainId
    }

    if (Number.isInteger(this.chainId) && this.chainId > 0) {
      return this.chainId
    }

    if (this.isConnected() && typeof this.walletAdapter?.getChainId === 'function') {
      const activeChainId = normalizeChainId(await this.walletAdapter.getChainId({ request }))
      if (activeChainId) {
        this.chainId = activeChainId
        return activeChainId
      }
    }

    return DEFAULT_CHAIN_ID
  }

  _mergeRuntimeOptions(params, boundChainId) {
    const options = params && typeof params === 'object' && !Array.isArray(params) ? params : {}
    if (!boundChainId) return options
    return {
      ...options,
      chainId: boundChainId,
    }
  }

  _requireWalletAdapter() {
    if (!this.walletAdapter) {
      throw new Error('Wallet not connected')
    }
    return this.walletAdapter
  }

  _requireSupportedChain(chainId) {
    const chain = SUPPORTED_CHAINS_BY_ID.get(chainId)
    if (!chain) {
      throw new Error(`Unsupported chainId: ${chainId}`)
    }
    return chain
  }

  _getPublicClient(chainId) {
    const targetChain = this._requireSupportedChain(chainId)
    let publicClient = this.publicClients.get(targetChain.id)
    if (!publicClient) {
      publicClient = createPublicClient({
        chain: targetChain,
        transport: http(),
      })
      this.publicClients.set(targetChain.id, publicClient)
    }
    return publicClient
  }

  _getTokenConfig(symbol, chainId) {
    const token = TOKENS_BY_CHAIN_ID[chainId]?.[symbol] || null
    if (!token) {
      throw new Error(`${symbol.toUpperCase()} not configured for chainId ${chainId}`)
    }
    return token
  }

  _normalizeAddress(address, fieldName = 'address') {
    if (typeof address !== 'string' || !address.trim()) {
      throw new Error(`${fieldName} is required`)
    }
    try {
      return getAddress(address.trim())
    } catch {
      throw new Error(`Invalid ${fieldName}`)
    }
  }

  _parseAmountToUnits(amount, decimals, fieldName = 'amount') {
    const asString = typeof amount === 'number' ? String(amount) : typeof amount === 'string' ? amount.trim() : ''
    if (!asString) {
      throw new Error(`${fieldName} is required`)
    }
    if (!/^\d+(\.\d+)?$/.test(asString)) {
      throw new Error(`Invalid ${fieldName}`)
    }
    const parsed = Number(asString)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${fieldName} must be greater than 0`)
    }
    try {
      return parseUnits(asString, decimals)
    } catch {
      throw new Error(`Invalid ${fieldName}`)
    }
  }

  async _resolveOperationChainId(explicitChainId = null) {
    const requestedChainId = normalizeChainId(explicitChainId)
    if (requestedChainId) {
      this._requireSupportedChain(requestedChainId)
      return requestedChainId
    }

    if (Number.isInteger(this.chainId) && this.chainId > 0) {
      return this.chainId
    }

    if (this.isConnected() && typeof this.walletAdapter?.getChainId === 'function') {
      const activeChainId = normalizeChainId(await this.walletAdapter.getChainId({ request: false }))
      if (activeChainId) {
        this.chainId = activeChainId
        return activeChainId
      }
    }

    return DEFAULT_CHAIN_ID
  }

  _resolveReadContext({ chainId } = {}) {
    const requestedChainId = normalizeChainId(chainId)
    if (requestedChainId) {
      return {
        chainId: this._requireSupportedChain(requestedChainId).id,
        useWalletAdapter: false,
      }
    }

    if (Number.isInteger(this.chainId) && this.chainId > 0) {
      if (SUPPORTED_CHAINS_BY_ID.has(this.chainId)) {
        return {
          chainId: this.chainId,
          useWalletAdapter: false,
        }
      }
      return {
        chainId: this.chainId,
        useWalletAdapter: true,
      }
    }

    return {
      chainId: DEFAULT_CHAIN_ID,
      useWalletAdapter: false,
    }
  }

  async _ensureWalletChain(chainId = null) {
    if (!chainId) return null
    const targetChainId = this._requireSupportedChain(chainId).id
    const currentChainId = normalizeChainId(await this._requireWalletAdapter().getChainId({ request: true }))

    if (currentChainId !== targetChainId) {
      await this.switchChain({ chainId: targetChainId })
    }

    return targetChainId
  }

  _syncPlayerState() {
    if (!this.pendingPlayerSync) return
    const player = this.world?.entities?.player
    if (!player || typeof player.modify !== 'function') return

    const nextAddress = this.isConnected() ? this.getAddress() : null
    const nextChainId = this.isConnected() ? normalizeChainId(this.chainId) : null
    const currentAddress = getPlayerEvmAddress(player)
    const currentChainId = getPlayerEvmChainId(player)

    if (!sameWalletState(currentAddress, currentChainId, nextAddress, nextChainId)) {
      player.modify({ custom: buildPlayerCustomPatch(player, nextAddress, nextChainId) })
    }

    this.pendingPlayerSync = false
  }

  _syncNetworkState() {
    if (!this.pendingNetworkSync) return

    const network = this.world?.network
    const ws = network?.ws
    if (!network?.isClient || !ws || ws.readyState !== 1) return
    const player = this.world?.entities?.player
    if (!player?.data?.id) return

    const nextAddress = this.isConnected() ? this.getAddress() : null
    const nextChainId = this.isConnected() ? normalizeChainId(this.chainId) : null

    if (!sameWalletState(this.networkAddress, this.networkChainId, nextAddress, nextChainId)) {
      network.send('entityModified', {
        id: player.data.id,
        custom: buildPlayerCustomPatch(player, nextAddress, nextChainId),
      })
    }

    this.networkAddress = nextAddress
    this.networkChainId = nextChainId
    this.pendingNetworkSync = false
  }

  async readContract(params, { chainId } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : params
    const requestedChainId = normalizeChainId(request?.chainId) || normalizeChainId(chainId)
    if (request && typeof request === 'object' && !Array.isArray(request)) {
      delete request.chainId
    }

    if (!requestedChainId && !normalizeChainId(this.chainId) && this.isConnected() && this.walletAdapter?.readContract) {
      return this.walletAdapter.readContract(request)
    }

    const context = this._resolveReadContext({ chainId: requestedChainId })
    if (context.useWalletAdapter) {
      return this._requireWalletAdapter().readContract(request)
    }
    return this._getPublicClient(context.chainId).readContract(request)
  }

  async sendTransaction(params, { chainId } = {}) {
    const walletAdapter = this._requireWalletAdapter()
    const txParams = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : {}
    const requestedChainId = normalizeChainId(txParams.chainId) || normalizeChainId(chainId)
    delete txParams.chainId

    if (requestedChainId) {
      await this._ensureWalletChain(requestedChainId)
    }

    return walletAdapter.sendTransaction(txParams)
  }

  async writeContract(params, { chainId } = {}) {
    const walletAdapter = this._requireWalletAdapter()
    const txParams = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : {}
    const requestedChainId = normalizeChainId(txParams.chainId) || normalizeChainId(chainId)
    delete txParams.chainId

    if (requestedChainId) {
      await this._ensureWalletChain(requestedChainId)
    }

    return walletAdapter.writeContract(txParams)
  }

  async waitForTransactionReceipt(params, { chainId } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : params
    const requestedChainId = normalizeChainId(request?.chainId) || normalizeChainId(chainId)
    if (request && typeof request === 'object' && !Array.isArray(request)) {
      delete request.chainId
    }

    if (
      !requestedChainId &&
      !normalizeChainId(this.chainId) &&
      this.isConnected() &&
      this.walletAdapter?.waitForTransactionReceipt
    ) {
      return this.walletAdapter.waitForTransactionReceipt(request)
    }

    const context = this._resolveReadContext({ chainId: requestedChainId })
    if (context.useWalletAdapter) {
      return this._requireWalletAdapter().waitForTransactionReceipt(request)
    }
    return this._getPublicClient(context.chainId).waitForTransactionReceipt(request)
  }

  async switchChain(params, { chainId } = {}) {
    const requestedChainId =
      normalizeChainId(typeof params === 'object' && params !== null ? params.chainId : params) || normalizeChainId(chainId)

    if (!requestedChainId) {
      throw new Error('chainId is required')
    }

    const targetChainId = this._requireSupportedChain(requestedChainId).id
    const result = await this._requireWalletAdapter().switchChain({ chainId: targetChainId })
    this.chainId = normalizeChainId(result?.id) || targetChainId
    this.pendingPlayerSync = true
    this.pendingNetworkSync = true
    this._syncPlayerState()
    this._syncNetworkState()
    return {
      id: this.chainId,
    }
  }

  async getNativeBalance(address = this.getAddress(), { chainId } = {}) {
    const target = this._normalizeAddress(address, 'address')
    const requestedChainId = normalizeChainId(chainId)

    if (!requestedChainId && !normalizeChainId(this.chainId) && this.isConnected() && this.walletAdapter?.getBalance) {
      const balance = await this.walletAdapter.getBalance({ address: target, request: false })
      return Number(formatEther(balance))
    }

    const context = this._resolveReadContext({ chainId: requestedChainId })

    if (context.useWalletAdapter) {
      const balance = await this._requireWalletAdapter().getBalance({ address: target, request: false })
      return Number(formatEther(balance))
    }

    const balance = await this._getPublicClient(context.chainId).getBalance({ address: target })
    return Number(formatEther(balance))
  }

  async getTokenBalance(tokenAddress, address = this.getAddress(), decimals = 18, { chainId } = {}) {
    const token = this._normalizeAddress(tokenAddress, 'tokenAddress')
    const owner = this._normalizeAddress(address, 'address')

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid decimals')
    }

    const balance = await this.readContract(
      {
        address: token,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [owner],
      },
      { chainId }
    )

    return Number(formatUnits(balance, decimals))
  }

  async getUSDCBalance(address = this.getAddress(), { chainId } = {}) {
    const targetChainId = await this._resolveOperationChainId(chainId)
    const usdc = this._getTokenConfig('usdc', targetChainId)
    return this.getTokenBalance(usdc.address, address, usdc.decimals, { chainId: targetChainId })
  }

  async transferNative(to, amount, { chainId } = {}) {
    const walletAdapter = this._requireWalletAdapter()
    const destination = this._normalizeAddress(to, 'to')
    const value = this._parseAmountToUnits(amount, 18, 'amount')
    const targetChainId = normalizeChainId(chainId)

    if (targetChainId) {
      await this._ensureWalletChain(targetChainId)
    }

    const hash = await walletAdapter.sendTransaction({
      to: destination,
      value,
    })
    const receipt = await this.waitForTransactionReceipt({ hash }, { chainId: targetChainId })

    return {
      hash: receipt?.transactionHash || hash,
      receipt,
    }
  }

  async transferToken(tokenAddress, to, amount, decimals = 18, { chainId } = {}) {
    const walletAdapter = this._requireWalletAdapter()
    const token = this._normalizeAddress(tokenAddress, 'tokenAddress')
    const destination = this._normalizeAddress(to, 'to')
    const targetChainId = normalizeChainId(chainId)

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid decimals')
    }

    if (targetChainId) {
      await this._ensureWalletChain(targetChainId)
    }

    const value = this._parseAmountToUnits(amount, decimals, 'amount')
    const hash = await walletAdapter.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [destination, value],
    })
    const receipt = await this.waitForTransactionReceipt({ hash }, { chainId: targetChainId })

    return {
      hash: receipt?.transactionHash || hash,
      receipt,
    }
  }

  async transferUSDC(to, amount, { chainId } = {}) {
    const targetChainId = await this._resolveOperationChainId(chainId)
    const usdc = this._getTokenConfig('usdc', targetChainId)
    return this.transferToken(usdc.address, to, amount, usdc.decimals, { chainId: targetChainId })
  }
}
