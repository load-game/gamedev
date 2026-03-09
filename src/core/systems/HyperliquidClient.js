import { System } from './System'
import { HttpTransport, InfoClient, ExchangeClient } from '@nktkas/hyperliquid'
import { PrivateKeySigner } from '@nktkas/hyperliquid/signing'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const ARBITRUM_CHAIN_ID = 42161
const BRIDGE_ADDRESS = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7'
const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const MIN_DEPOSIT_AMOUNT = 5

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
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

export class Hyperliquid extends System {
  constructor(world) {
    super(world)

    this.address = null
    this.wallet = null
    this.walletAdapter = null

    this.agentKey = null
    this.agentAddress = null

    this.httpTransport = new HttpTransport()
    this.infoClient = new InfoClient({ transport: this.httpTransport })
    this.exchangeClient = null

    this._assetIndexCache = null
    this.pendingDeposit = false
  }

  init() {
    this.world.inject({
      world: {
        hyperliquid: () => ({
          getPrice: ticker => this.getPrice(ticker),
          getBalance: () => this.getBalance(),
          getPositions: () => this.getPositions(),
          getAvailableTickers: () => this.getAvailableTickers(),
          buy: (ticker, amount, slippage) => this.buy(ticker, amount, slippage),
          sell: (ticker, amount, slippage) => this.sell(ticker, amount, slippage),
          closePosition: (ticker, slippage) => this.closePosition(ticker, slippage),
          hasAgentKey: () => this.hasAgentKey(),
          setupAgentKey: name => this.setupAgentKey(name),
          deposit: amount => this.deposit(amount),
          withdraw: (amount, destination) => this.withdraw(amount, destination),
        }),
      },
    })
  }

  bind({ address, walletAdapter, isConnected } = {}) {
    this.address = address || null
    this.walletAdapter = walletAdapter || null

    if (this.address && this.walletAdapter && isConnected) {
      this.wallet = {
        address: this.address,
        signTypedData: async params => {
          const { domain, types, primaryType, message } = params
          return this.walletAdapter.signTypedData({
            domain,
            types,
            primaryType,
            message,
          })
        },
      }

      const agentData = this._loadAgentKey()
      if (agentData) {
        console.log('[Hyperliquid] Found agent key, using for trading:', agentData.address)
        this.agentKey = new PrivateKeySigner(agentData.privateKey)
        this.agentAddress = agentData.address
        this.exchangeClient = new ExchangeClient({
          transport: this.httpTransport,
          wallet: this.agentKey,
        })
      } else {
        console.log('[Hyperliquid] No agent key found, using main wallet')
        this.exchangeClient = new ExchangeClient({
          transport: this.httpTransport,
          wallet: this.wallet,
        })
      }
    } else {
      this.wallet = null
      this.walletAdapter = null
      this.agentKey = null
      this.agentAddress = null
      this.exchangeClient = null
    }
  }

  _requireWallet() {
    if (!this.exchangeClient || !this.walletAdapter) {
      throw new Error('Wallet not connected')
    }
  }

  _createUserExchangeClient() {
    if (!this.wallet) return null
    return new ExchangeClient({
      transport: this.httpTransport,
      wallet: this.wallet,
    })
  }

  async _setConfiguredReferrerIfNeeded() {
    const code = "LOBBY"
    if (!this.address) return

    try {
      const referral = await this.infoClient.referral({ user: this.address })
      const existingCode =
        typeof referral?.referredBy?.code === 'string' ? referral.referredBy.code.trim() : ''
      if (existingCode) {
        console.log('[Hyperliquid] Referrer already set, skipping referral setup')
        return
      }
    } catch (error) {
      // Non-fatal: continue and try to set the referral code.
      console.warn('[Hyperliquid] Failed to read referral status, attempting to set referrer anyway', error)
    }

    const userClient = this._createUserExchangeClient()
    if (!userClient || typeof userClient.setReferrer !== 'function') return

    try {
      console.log('[Hyperliquid] Setting configured referrer code')
      await userClient.setReferrer({ code })
      console.log('[Hyperliquid] Referrer code set')
    } catch (error) {
      const message = String(error?.message || error || '')
      if (/already.*referr|referr.*already|has.*referr/i.test(message)) {
        console.log('[Hyperliquid] Referrer already set')
        return
      }
      // Non-fatal: keep trading setup usable even if referral fails.
      console.warn('[Hyperliquid] Failed to set referrer code', error)
    }
  }

  async _ensureArbitrum() {
    if (!this.walletAdapter) {
      throw new Error('Wallet not connected')
    }

    try {
      const currentChainId = await this.walletAdapter.getChainId({ request: true })
      if (currentChainId !== ARBITRUM_CHAIN_ID) {
        await this.walletAdapter.switchChain({ chainId: ARBITRUM_CHAIN_ID })

        const nextChainId = await this.walletAdapter.getChainId({ request: false })
        if (nextChainId !== ARBITRUM_CHAIN_ID) {
          throw new Error(`Chain switch failed. Still on chain ${nextChainId}`)
        }
      }
    } catch (error) {
      if (error?.message?.includes('User rejected') || error?.code === 4001) {
        throw new Error('Please switch to Arbitrum to continue')
      }
      if (
        error?.message?.includes('Unrecognized chain') ||
        error?.message?.includes('wallet_addEthereumChain')
      ) {
        throw new Error('Please add Arbitrum network to your wallet')
      }
      throw new Error(`Failed to switch to Arbitrum: ${error?.message || error}`)
    }
  }

  async _getAllMids() {
    return this.infoClient.allMids()
  }

  async _getMeta() {
    return this.infoClient.meta()
  }

  async _getClearinghouseState() {
    if (!this.address) throw new Error('No wallet connected')
    return this.infoClient.clearinghouseState({ user: this.address })
  }

  async _getAssetIndex(ticker) {
    if (!this._assetIndexCache) {
      const meta = await this._getMeta()
      this._assetIndexCache = {}
      meta.universe.forEach((asset, index) => {
        this._assetIndexCache[asset.name] = index
      })
    }

    const index = this._assetIndexCache[ticker]
    if (index === undefined) {
      throw new Error(`Unknown asset: ${ticker}`)
    }
    return index
  }

  async getAvailableTickers() {
    const meta = await this._getMeta()
    return meta.universe.map(asset => asset.name).sort()
  }

  async _placeOrder(orders) {
    this._requireWallet()
    console.log(
      '[Hyperliquid] placeOrder: signing with',
      this.agentKey ? `agent (${this.agentAddress})` : 'main wallet'
    )
    return this.exchangeClient.order({ orders, grouping: 'na' })
  }

  async getPrice(ticker) {
    const mids = await this._getAllMids()
    const price = parseFloat(mids[ticker])
    if (!price) throw new Error(`No price for ${ticker}`)
    return price
  }

  async getBalance() {
    const state = await this._getClearinghouseState()
    return parseFloat(state?.marginSummary?.accountValue || 0)
  }

  async getPositions() {
    const state = await this._getClearinghouseState()
    if (!state?.assetPositions) return []

    return state.assetPositions
      .filter(p => parseFloat(p.position.szi) !== 0)
      .map(p => ({
        ticker: p.position.coin,
        size: parseFloat(p.position.szi),
        entryPrice: parseFloat(p.position.entryPx),
        unrealizedPnl: parseFloat(p.position.unrealizedPnl),
        liquidationPrice: p.position.liquidationPx ? parseFloat(p.position.liquidationPx) : null,
      }))
  }

  async buy(ticker, amount, slippage = 1) {
    this._requireWallet()

    const assetIndex = await this._getAssetIndex(ticker)
    const currentPrice = await this.getPrice(ticker)

    const slippageMultiplier = 1 + slippage / 100
    const price = (currentPrice * slippageMultiplier).toFixed(ticker === 'BTC' ? 0 : 2)

    console.log(`[Hyperliquid] buy: ${amount} ${ticker} @ ${price} (${slippage}% slippage)`)

    return this._placeOrder([
      {
        a: assetIndex,
        b: true,
        p: price,
        s: String(amount),
        r: false,
        t: { limit: { tif: 'Ioc' } },
      },
    ])
  }

  async sell(ticker, amount, slippage = 1) {
    this._requireWallet()

    const assetIndex = await this._getAssetIndex(ticker)
    const currentPrice = await this.getPrice(ticker)

    const slippageMultiplier = 1 - slippage / 100
    const price = (currentPrice * slippageMultiplier).toFixed(ticker === 'BTC' ? 0 : 2)

    console.log(`[Hyperliquid] sell: ${amount} ${ticker} @ ${price} (${slippage}% slippage)`)

    return this._placeOrder([
      {
        a: assetIndex,
        b: false,
        p: price,
        s: String(amount),
        r: false,
        t: { limit: { tif: 'Ioc' } },
      },
    ])
  }

  async closePosition(ticker, slippage = 1) {
    const positions = await this.getPositions()
    const position = positions.find(p => p.ticker === ticker)

    if (!position) throw new Error(`No open position for ${ticker}`)

    console.log(`[Hyperliquid] closePosition: ${ticker} size=${position.size}`)

    if (position.size > 0) {
      return this.sell(ticker, Math.abs(position.size), slippage)
    }
    return this.buy(ticker, Math.abs(position.size), slippage)
  }

  async withdraw(amount, destination) {
    this._requireWallet()

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const targetAddress = destination || this.address
    if (!targetAddress) {
      throw new Error('No destination address available')
    }

    const balance = await this.getBalance()
    if (amount > balance) {
      throw new Error(`Insufficient balance. Have ${balance}, need ${amount}`)
    }

    await this._ensureArbitrum()

    console.log(`[Hyperliquid] withdraw: ${amount} USDC to ${targetAddress}`)

    const time = Date.now()
    const typedData = {
      domain: {
        name: 'HyperliquidSignTransaction',
        version: '1',
        chainId: 42161,
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        'HyperliquidTransaction:Withdraw': [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'destination', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'time', type: 'uint64' },
        ],
      },
      primaryType: 'HyperliquidTransaction:Withdraw',
      message: {
        hyperliquidChain: 'Mainnet',
        destination: targetAddress,
        amount: String(amount),
        time,
      },
    }

    try {
      console.log('[Hyperliquid] Requesting signature...')
      const signature = await this.walletAdapter.signTypedData(typedData)

      const r = `0x${signature.slice(2, 66)}`
      const s = `0x${signature.slice(66, 130)}`
      const v = Number.parseInt(signature.slice(130, 132), 16)

      console.log('[Hyperliquid] Submitting withdrawal to API...')

      const response = await fetch('https://api.hyperliquid.xyz/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'withdraw3',
            signatureChainId: '0xa4b1',
            hyperliquidChain: 'Mainnet',
            destination: targetAddress,
            amount: String(amount),
            time,
          },
          signature: { r, s, v },
          nonce: time,
        }),
      })

      const result = await response.json()
      if (result.status === 'err') {
        throw new Error(result.response || 'Withdrawal failed')
      }

      console.log('[Hyperliquid] Withdrawal complete:', result)
      return result
    } catch (error) {
      if (error?.message?.includes('User rejected') || error?.code === 4001) {
        throw new Error('Withdrawal cancelled by user')
      }
      throw new Error(`Withdrawal failed: ${error?.message || error}`)
    }
  }

  async deposit(amount) {
    this._requireWallet()

    if (!amount || amount < MIN_DEPOSIT_AMOUNT) {
      throw new Error(`Minimum deposit is ${MIN_DEPOSIT_AMOUNT} USDC`)
    }

    if (this.pendingDeposit) {
      throw new Error('Deposit already in progress')
    }

    this.pendingDeposit = true

    try {
      console.log(`[Hyperliquid] deposit: ${amount} USDC from Arbitrum`)

      await this._ensureArbitrum()

      const balance = await this.walletAdapter.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.address],
      })

      const amountInWei = BigInt(Math.round(amount * 1_000_000))
      if (balance < amountInWei) {
        throw new Error(`Insufficient USDC. Have ${Number(balance) / 1_000_000}, need ${amount}`)
      }

      const allowance = await this.walletAdapter.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [this.address, BRIDGE_ADDRESS],
      })

      if (allowance < amountInWei) {
        console.log('[Hyperliquid] Approving USDC...')
        const approveTx = await this.walletAdapter.writeContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [BRIDGE_ADDRESS, amountInWei],
        })

        await this.walletAdapter.waitForTransactionReceipt({ hash: approveTx })
        console.log('[Hyperliquid] USDC approved')
      }

      console.log('[Hyperliquid] Sending USDC to bridge...')
      const transferTx = await this.walletAdapter.writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [BRIDGE_ADDRESS, amountInWei],
      })

      const receipt = await this.walletAdapter.waitForTransactionReceipt({ hash: transferTx })
      const txHash = receipt?.transactionHash || transferTx

      console.log('[Hyperliquid] Deposit submitted:', txHash)

      return {
        status: 'ok',
        txHash,
        amount,
        message: 'Funds will be credited within 1 minute',
      }
    } catch (error) {
      if (error?.message?.includes('User rejected')) {
        throw new Error('Deposit cancelled by user')
      }
      if (error?.message?.includes('switch')) {
        throw new Error('Network switch cancelled')
      }
      throw new Error(`Deposit failed: ${error?.message || error}`)
    } finally {
      this.pendingDeposit = false
    }
  }

  hasAgentKey() {
    return this._loadAgentKey() !== null
  }

  async setupAgentKey(agentName = 'HyperfyAgent') {
    console.log('[Hyperliquid] setupAgentKey: starting...')

    if (!this.walletAdapter) {
      throw new Error('Wallet not connected')
    }

    await this._ensureArbitrum()

    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const agentAddress = account.address

    console.log('[Hyperliquid] setupAgentKey: generated', agentAddress)

    const nonce = Date.now()
    const typedData = {
      domain: {
        name: 'HyperliquidSignTransaction',
        version: '1',
        chainId: 42161,
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        'HyperliquidTransaction:ApproveAgent': [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'agentAddress', type: 'address' },
          { name: 'agentName', type: 'string' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
      primaryType: 'HyperliquidTransaction:ApproveAgent',
      message: {
        hyperliquidChain: 'Mainnet',
        agentAddress,
        agentName: agentName || '',
        nonce,
      },
    }

    console.log('[Hyperliquid] setupAgentKey: requesting signature...')

    try {
      const signature = await this.walletAdapter.signTypedData(typedData)

      const r = `0x${signature.slice(2, 66)}`
      const s = `0x${signature.slice(66, 130)}`
      const v = Number.parseInt(signature.slice(130, 132), 16)

      console.log('[Hyperliquid] setupAgentKey: submitting to API...')

      const response = await fetch('https://api.hyperliquid.xyz/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'approveAgent',
            signatureChainId: '0xa4b1',
            hyperliquidChain: 'Mainnet',
            agentAddress,
            agentName: agentName || '',
            nonce,
          },
          signature: { r, s, v },
          nonce,
        }),
      })

      const result = await response.json()

      if (result.status === 'err') {
        throw new Error(result.response || 'Agent approval failed')
      }
    } catch (error) {
      if (error?.message?.includes('User rejected') || error?.code === 4001) {
        throw new Error('Agent approval cancelled by user')
      }
      throw new Error(`Agent approval failed: ${error?.message || error}`)
    }

    await this._setConfiguredReferrerIfNeeded()

    this._saveAgentKey({ privateKey, address: agentAddress, createdAt: Date.now() })

    this.agentKey = new PrivateKeySigner(privateKey)
    this.agentAddress = agentAddress
    this.exchangeClient = new ExchangeClient({
      transport: this.httpTransport,
      wallet: this.agentKey,
    })

    console.log('[Hyperliquid] setupAgentKey: complete!')
    return { address: agentAddress }
  }

  _getStorageKey() {
    return `hyperliquid_agent_${this.address}`
  }

  _saveAgentKey(data) {
    if (!this.address) return
    try {
      localStorage.setItem(this._getStorageKey(), JSON.stringify(data))
    } catch {
      // ignore storage failures
    }
  }

  _loadAgentKey() {
    if (!this.address) return null
    try {
      const stored = localStorage.getItem(this._getStorageKey())
      if (!stored) return null
      return JSON.parse(stored)
    } catch {
      return null
    }
  }

  async destroy() {
    // no-op
  }
}
