import { System } from './System'
import { formatEther, formatUnits, getAddress, parseUnits } from 'viem'

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

function buildPlayerCustomPatch(player, address) {
  const current = getPlayerCustom(player)
  return {
    ...(current || {}),
    evm: address || null,
  }
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
    this.utils = { formatEther, formatUnits, getAddress, parseUnits }
    this.abis = {
      erc20: ERC20_ABI,
      erc721: null,
    }
    this.actions = {
      getBalance: params => this._requireWalletAdapter().getBalance(params),
      readContract: params => this._requireWalletAdapter().readContract(params),
      sendTransaction: params => this._requireWalletAdapter().sendTransaction(params),
      writeContract: params => this._requireWalletAdapter().writeContract(params),
      waitForTransactionReceipt: params => this._requireWalletAdapter().waitForTransactionReceipt(params),
      getChainId: params => this._requireWalletAdapter().getChainId(params),
      switchChain: params => this._requireWalletAdapter().switchChain(params),
      signTypedData: params => this._requireWalletAdapter().signTypedData(params),
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
    return {
      actions: this.actions,
      utils: this.utils,
      abis: this.abis,
      getAddress: () => this.getAddress(),
      isConnected: () => this.isConnected(),
      getChainId: params => this.getChainId?.(params),
      readContract: params => this.readContract?.(params),
      sendTransaction: params => this.sendTransaction?.(params),
      writeContract: params => this.writeContract?.(params),
      waitForTransactionReceipt: params => this.waitForTransactionReceipt?.(params),
      switchChain: params => this.switchChain?.(params),
      getNativeBalance: address => this.getNativeBalance(address),
      getTokenBalance: (tokenAddress, address, decimals) => this.getTokenBalance(tokenAddress, address, decimals),
      getUSDCBalance: address => this.getUSDCBalance(address),
      transferNative: (to, amount) => this.transferNative(to, amount),
      transferToken: (tokenAddress, to, amount, decimals) => this.transferToken(tokenAddress, to, amount, decimals),
      transferUSDC: (to, amount) => this.transferUSDC(to, amount),
    }
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

    if (Number.isInteger(chainId) && chainId > 0) {
      this.chainId = chainId
    } else {
      this.chainId = null
    }

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

  async getChainId({ request = false } = {}) {
    if (Number.isInteger(this.chainId) && this.chainId > 0) {
      return this.chainId
    }
    return this._requireWalletAdapter().getChainId({ request })
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

  _syncPlayerState() {
    if (!this.pendingPlayerSync) return
    const player = this.world?.entities?.player
    if (!player || typeof player.modify !== 'function') return

    const nextAddress = this.isConnected() ? this.getAddress() : null
    const currentAddress = getPlayerEvmAddress(player)
    const sameAddress =
      (!currentAddress && !nextAddress) ||
      (currentAddress &&
        nextAddress &&
        currentAddress.toLowerCase() === nextAddress.toLowerCase())

    if (!sameAddress) {
      player.modify({ custom: buildPlayerCustomPatch(player, nextAddress) })
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
    const sameAddress =
      (!this.networkAddress && !nextAddress) ||
      (this.networkAddress &&
        nextAddress &&
        this.networkAddress.toLowerCase() === nextAddress.toLowerCase())

    if (!sameAddress) {
      network.send('entityModified', {
        id: player.data.id,
        custom: buildPlayerCustomPatch(player, nextAddress),
      })
    }

    this.networkAddress = nextAddress
    this.pendingNetworkSync = false
  }

  async readContract(params) {
    return this._requireWalletAdapter().readContract(params)
  }

  async sendTransaction(params) {
    return this._requireWalletAdapter().sendTransaction(params)
  }

  async writeContract(params) {
    return this._requireWalletAdapter().writeContract(params)
  }

  async waitForTransactionReceipt(params) {
    return this._requireWalletAdapter().waitForTransactionReceipt(params)
  }

  async switchChain(params) {
    const result = await this._requireWalletAdapter().switchChain(params)
    this.chainId = Number.isInteger(result?.id) ? result.id : this.chainId
    return result
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
