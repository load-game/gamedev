import { System } from './System'
import { formatEther, formatUnits, getAddress, parseUnits } from 'viem'

const ARBITRUM_USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDC_DECIMALS = 6

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

export class EVM extends System {
  constructor(world) {
    super(world)
    this.walletAdapter = null
    this.address = null
    this.connected = false
  }

  init() {
    this.world.inject({
      world: {
        evm: () => ({
          getAddress: () => this.getAddress(),
          isConnected: () => this.isConnected(),
          getNativeBalance: address => this.getNativeBalance(address),
          getTokenBalance: (tokenAddress, address, decimals) => this.getTokenBalance(tokenAddress, address, decimals),
          getUSDCBalance: address => this.getUSDCBalance(address),
          transferNative: (to, amount) => this.transferNative(to, amount),
          transferToken: (tokenAddress, to, amount, decimals) =>
            this.transferToken(tokenAddress, to, amount, decimals),
          transferUSDC: (to, amount) => this.transferUSDC(to, amount),
        }),
      },
    })
  }

  bind({ walletAdapter, address, isConnected } = {}) {
    this.walletAdapter = walletAdapter || null

    if (typeof address === 'string' && address) {
      this.address = address
    } else {
      this.address = this.walletAdapter?.getAddress?.() || null
    }

    if (typeof isConnected === 'boolean') {
      this.connected = isConnected
    } else {
      this.connected = !!this.walletAdapter?.isConnected?.()
    }
  }

  getAddress() {
    return this.address || this.walletAdapter?.getAddress?.() || null
  }

  isConnected() {
    if (this.connected) return true
    return !!this.walletAdapter?.isConnected?.()
  }

  _requireWalletAdapter() {
    if (!this.walletAdapter) {
      throw new Error('Wallet not connected')
    }
    return this.walletAdapter
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

  async getNativeBalance(address = this.getAddress()) {
    const walletAdapter = this._requireWalletAdapter()
    const target = this._normalizeAddress(address, 'address')
    const balance = await walletAdapter.getBalance({ address: target, request: false })
    return Number(formatEther(balance))
  }

  async getTokenBalance(tokenAddress, address = this.getAddress(), decimals = 18) {
    const walletAdapter = this._requireWalletAdapter()
    const token = this._normalizeAddress(tokenAddress, 'tokenAddress')
    const owner = this._normalizeAddress(address, 'address')

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid decimals')
    }

    const balance = await walletAdapter.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [owner],
    })

    return Number(formatUnits(balance, decimals))
  }

  async getUSDCBalance(address = this.getAddress()) {
    return this.getTokenBalance(ARBITRUM_USDC_ADDRESS, address, USDC_DECIMALS)
  }

  async transferNative(to, amount) {
    const walletAdapter = this._requireWalletAdapter()
    const destination = this._normalizeAddress(to, 'to')
    const value = this._parseAmountToUnits(amount, 18, 'amount')

    const hash = await walletAdapter.sendTransaction({
      to: destination,
      value,
    })
    const receipt = await walletAdapter.waitForTransactionReceipt({ hash })

    return {
      hash: receipt?.transactionHash || hash,
      receipt,
    }
  }

  async transferToken(tokenAddress, to, amount, decimals = 18) {
    const walletAdapter = this._requireWalletAdapter()
    const token = this._normalizeAddress(tokenAddress, 'tokenAddress')
    const destination = this._normalizeAddress(to, 'to')

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid decimals')
    }

    const value = this._parseAmountToUnits(amount, decimals, 'amount')
    const hash = await walletAdapter.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [destination, value],
    })
    const receipt = await walletAdapter.waitForTransactionReceipt({ hash })

    return {
      hash: receipt?.transactionHash || hash,
      receipt,
    }
  }

  async transferUSDC(to, amount) {
    return this.transferToken(ARBITRUM_USDC_ADDRESS, to, amount, USDC_DECIMALS)
  }
}
