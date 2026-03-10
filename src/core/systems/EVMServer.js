import { createPublicClient, erc20Abi, formatEther, formatUnits, getAddress, http } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'
import * as utils from 'viem/utils'

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

export class EVM extends System {
  constructor(world) {
    super(world)

    this.publicClients = new Map()
    this.runtimeAPIs = new Map()
    this.utils = utils
    this.abis = {
      erc20: erc20Abi,
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
      getAddress: this.getAddress.bind(this),
      isConnected: this.isConnected.bind(this),
      getChainId: params => this.getChainId(this._mergeRuntimeOptions(params, boundChainId)),
      readContract: params => this.readContract(params, { chainId: boundChainId }),
      waitForTransactionReceipt: params => this.waitForTransactionReceipt(params, { chainId: boundChainId }),
      getNativeBalance: address => this.getNativeBalance(address, { chainId: boundChainId }),
      getTokenBalance: (tokenAddress, address, decimals) =>
        this.getTokenBalance(tokenAddress, address, decimals, { chainId: boundChainId }),
      getUSDCBalance: address => this.getUSDCBalance(address, { chainId: boundChainId }),
    }

    this.runtimeAPIs.set(key, runtimeAPI)
    return runtimeAPI
  }

  _mergeRuntimeOptions(params, boundChainId) {
    const options = params && typeof params === 'object' && !Array.isArray(params) ? params : {}
    if (!boundChainId) return options
    return {
      ...options,
      chainId: boundChainId,
    }
  }

  getAddress() {
    return null
  }

  isConnected() {
    return false
  }

  async getChainId({ chainId } = {}) {
    const requestedChainId = normalizeChainId(chainId)
    if (requestedChainId) {
      return this._requireSupportedChain(requestedChainId).id
    }
    return DEFAULT_CHAIN_ID
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

  _resolveOperationChainId(explicitChainId = null) {
    const requestedChainId = normalizeChainId(explicitChainId)
    if (requestedChainId) {
      return this._requireSupportedChain(requestedChainId).id
    }
    return DEFAULT_CHAIN_ID
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

  async readContract(params, { chainId } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : params
    const requestedChainId = normalizeChainId(request?.chainId) || this._resolveOperationChainId(chainId)
    if (request && typeof request === 'object' && !Array.isArray(request)) {
      delete request.chainId
    }
    return this._getPublicClient(requestedChainId).readContract(request)
  }

  async getNativeBalance(address = this.getAddress(), { chainId } = {}) {
    const target = this._normalizeAddress(address, 'address')
    const targetChainId = this._resolveOperationChainId(chainId)
    const balance = await this._getPublicClient(targetChainId).getBalance({ address: target })
    return Number(formatEther(balance))
  }

  async getTokenBalance(tokenAddress, address = this.getAddress(), decimals = 18, { chainId } = {}) {
    const token = this._normalizeAddress(tokenAddress, 'tokenAddress')
    const owner = this._normalizeAddress(address, 'address')
    const targetChainId = this._resolveOperationChainId(chainId)

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid decimals')
    }

    const balance = await this.readContract(
      {
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [owner],
      },
      { chainId: targetChainId }
    )

    return Number(formatUnits(balance, decimals))
  }

  async getUSDCBalance(address = this.getAddress(), { chainId } = {}) {
    const targetChainId = this._resolveOperationChainId(chainId)
    const usdc = this._getTokenConfig('usdc', targetChainId)
    return this.getTokenBalance(usdc.address, address, usdc.decimals, { chainId: targetChainId })
  }

  async waitForTransactionReceipt(params, { chainId } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : params
    const requestedChainId = normalizeChainId(request?.chainId) || this._resolveOperationChainId(chainId)
    if (request && typeof request === 'object' && !Array.isArray(request)) {
      delete request.chainId
    }
    return this._getPublicClient(requestedChainId).waitForTransactionReceipt(request)
  }
}
