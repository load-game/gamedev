import { createPublicClient, erc20Abi, formatEther, formatUnits, getAddress, http } from 'viem'
import * as chains from 'viem/chains'
import * as utils from 'viem/utils'

import { System } from './System'

const DEFAULT_CHAIN_NAME = 'mainnet'
const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDC_DECIMALS = 6

function getPlayerCustom(player) {
  const custom = player?.data?.custom
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null
  return custom
}

function getPlayerEvmAddress(player) {
  const value = getPlayerCustom(player)?.evm
  return typeof value === 'string' && value ? value : null
}

function resolveServerChain() {
  const chainName = typeof process.env.PUBLIC_EVM === 'string' ? process.env.PUBLIC_EVM.trim() : ''
  const resolvedName = chainName || DEFAULT_CHAIN_NAME
  const chain = chains[resolvedName]
  if (!chain) {
    throw new Error(`invalid PUBLIC_EVM chain name: ${resolvedName}`)
  }
  return chain
}

export class EVM extends System {
  constructor(world) {
    super(world)

    this.chain = resolveServerChain()
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(),
    })
    this.utils = utils
    this.abis = {
      erc20: erc20Abi,
    }
    this.runtimeAPI = {
      utils: this.utils,
      abis: this.abis,
      getAddress: this.getAddress.bind(this),
      isConnected: this.isConnected.bind(this),
      getChainId: this.getChainId.bind(this),
      readContract: this.readContract.bind(this),
      waitForTransactionReceipt: this.waitForTransactionReceipt.bind(this),
      getNativeBalance: this.getNativeBalance.bind(this),
      getTokenBalance: this.getTokenBalance.bind(this),
      getUSDCBalance: this.getUSDCBalance.bind(this),
    }
  }

  init() {
    this.world.inject?.({
      world: {
        evm: () => this.getRuntimeAPI(),
      },
      player: {
        evm: {
          get: player => getPlayerEvmAddress(player),
        },
      },
    })
  }

  getRuntimeAPI() {
    return this.runtimeAPI
  }

  getAddress() {
    return null
  }

  isConnected() {
    return false
  }

  async getChainId() {
    return this.chain.id
  }

  _requirePublicClient() {
    if (!this.publicClient) {
      throw new Error('EVM public client unavailable')
    }
    return this.publicClient
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

  async readContract(params) {
    return this._requirePublicClient().readContract(params)
  }

  async getNativeBalance(address = this.getAddress()) {
    const target = this._normalizeAddress(address, 'address')
    const balance = await this._requirePublicClient().getBalance({ address: target })
    return Number(formatEther(balance))
  }

  async getTokenBalance(tokenAddress, address = this.getAddress(), decimals = 18) {
    const token = this._normalizeAddress(tokenAddress, 'tokenAddress')
    const owner = this._normalizeAddress(address, 'address')

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid decimals')
    }

    const balance = await this.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })

    return Number(formatUnits(balance, decimals))
  }

  async getUSDCBalance(address = this.getAddress()) {
    return this.getTokenBalance(ARBITRUM_USDC_ADDRESS, address, USDC_DECIMALS)
  }

  async waitForTransactionReceipt(params) {
    return this._requirePublicClient().waitForTransactionReceipt(params)
  }
}
