import { System } from '../../systems/System.js'
import { HttpTransport, InfoClient, ExchangeClient, WebSocketTransport, SubscriptionClient } from '@nktkas/hyperliquid'
import { PrivateKeySigner } from '@nktkas/hyperliquid/signing'
import { getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const ARBITRUM_CHAIN_ID = 42161
const BRIDGE_ADDRESS = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7'
const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const MIN_DEPOSIT_AMOUNT = 5
const DEFAULT_RUNTIME_API_OWNER = Symbol('hyperliquid-runtime-owner')
const DEFAULT_RUNTIME_API_ADDRESS = Symbol('hyperliquid-runtime-address')
const HYPERLIQUID_CANDLE_INTERVALS = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
])
const HYPERLIQUID_CANDLE_INTERVAL_MS = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
}
const HYPERLIQUID_ORDER_BOOK_SIG_FIGS = new Set([2, 3, 4, 5])
const HYPERLIQUID_ORDER_BOOK_MANTISSAS = new Set([2, 5])

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
    this._resolvedMarketCatalog = null
    this._resolvedMarketCatalogPromise = null
    this.pendingDeposit = false
    this.runtimeAPIs = new Map()
    this.streamTransport = null
    this.streamSubscriptionClient = null
    this.streamTransportClosePromise = null
    this.streams = new Map()
    this.streamListenerId = 0
  }

  _resolveRuntimeOptions(ownerOrOptions = null, maybeAddress = undefined) {
    if (ownerOrOptions && typeof ownerOrOptions === 'object' && !Array.isArray(ownerOrOptions)) {
      const hasOwner = Object.prototype.hasOwnProperty.call(ownerOrOptions, 'owner')
      const hasAddress = Object.prototype.hasOwnProperty.call(ownerOrOptions, 'address')
      if (hasOwner || hasAddress) {
        return {
          owner: ownerOrOptions.owner ?? null,
          address: ownerOrOptions.address ?? null,
        }
      }
    }

    if (maybeAddress !== undefined) {
      return {
        owner: ownerOrOptions ?? null,
        address: maybeAddress ?? null,
      }
    }

    if (typeof ownerOrOptions === 'string' || ownerOrOptions === null || ownerOrOptions === undefined) {
      return {
        owner: null,
        address: ownerOrOptions ?? null,
      }
    }

    return {
      owner: ownerOrOptions,
      address: null,
    }
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

  _normalizeRuntimeAddress(address) {
    if (address === null || address === undefined) {
      return null
    }

    return this._normalizeAddress(address, 'address')
  }

  _getRuntimeCache(owner) {
    const ownerKey = owner ?? DEFAULT_RUNTIME_API_OWNER
    let runtimeCache = this.runtimeAPIs.get(ownerKey)
    if (!runtimeCache) {
      runtimeCache = new Map()
      this.runtimeAPIs.set(ownerKey, runtimeCache)
    }
    return runtimeCache
  }

  _createWatchOnlyRuntimeError(methodName) {
    return new Error(
      `Hyperliquid addressed runtimes are watch-only; ${methodName} is only available on world.hyperliquid()`
    )
  }

  _getReadAddress(address = null) {
    if (address !== null && address !== undefined) {
      return this._normalizeRuntimeAddress(address)
    }

    if (!this.address) {
      throw new Error('No wallet connected')
    }

    return this._normalizeAddress(this.address, 'address')
  }

  getRuntimeAPI(ownerOrOptions = null, maybeAddress = undefined) {
    const { owner, address } = this._resolveRuntimeOptions(ownerOrOptions, maybeAddress)
    const boundAddress = this._normalizeRuntimeAddress(address)
    const runtimeCache = this._getRuntimeCache(owner)
    const addressKey = boundAddress ?? DEFAULT_RUNTIME_API_ADDRESS
    if (runtimeCache.has(addressKey)) {
      return runtimeCache.get(addressKey)
    }

    const assertWritableRuntime = methodName => {
      if (boundAddress !== null) {
        throw this._createWatchOnlyRuntimeError(methodName)
      }
    }

    const runtimeAPI = {
      getPrice: ticker => this.getPrice(ticker),
      getBalance: () => this.getBalance({ address: boundAddress }),
      getPositions: () => this.getPositions({ address: boundAddress }),
      getAvailableTickers: () => this.getAvailableTickers(),
      getPerpMarkets: options => this.getPerpMarkets(options),
      getSpotMarkets: () => this.getSpotMarkets(),
      getMarketCatalog: () => this.getMarketCatalog(),
      getCandles: params => this.getCandles(params),
      getOrderStatus: params => this.getOrderStatus(params, { address: boundAddress }),
      getUserFills: params => this.getUserFills(params, { address: boundAddress }),
      getUserFillsByTime: params => this.getUserFillsByTime(params, { address: boundAddress }),
      subscribeMids: listener => this.subscribeMids(listener, { owner }),
      subscribeTrades: (params, listener) => this.subscribeTrades(params, listener, { owner }),
      subscribeOrderBook: (params, listener) => this.subscribeOrderBook(params, listener, { owner }),
      subscribeCandles: (params, listener) => this.subscribeCandles(params, listener, { owner }),
      subscribeAccount: listener => this.subscribeAccount(listener, { owner, address: boundAddress }),
      buy: (ticker, amount, slippage, options) => {
        assertWritableRuntime('buy')
        return this.buy(ticker, amount, slippage, options)
      },
      sell: (ticker, amount, slippage, options) => {
        assertWritableRuntime('sell')
        return this.sell(ticker, amount, slippage, options)
      },
      closePosition: (ticker, slippage, options) => {
        assertWritableRuntime('closePosition')
        return this.closePosition(ticker, slippage, options)
      },
      updateLeverage: (ticker, leverage, options) => {
        assertWritableRuntime('updateLeverage')
        return this.updateLeverage(ticker, leverage, options)
      },
      hasAgentKey: () => {
        assertWritableRuntime('hasAgentKey')
        return this.hasAgentKey()
      },
      setupAgentKey: name => {
        assertWritableRuntime('setupAgentKey')
        return this.setupAgentKey(name)
      },
      deposit: amount => {
        assertWritableRuntime('deposit')
        return this.deposit(amount)
      },
      withdraw: (amount, destination) => {
        assertWritableRuntime('withdraw')
        return this.withdraw(amount, destination)
      },
    }

    runtimeCache.set(addressKey, runtimeAPI)
    return runtimeAPI
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
    const code = 'LOBBY'
    if (!this.address) return

    try {
      const referral = await this.infoClient.referral({ user: this.address })
      const existingCode = typeof referral?.referredBy?.code === 'string' ? referral.referredBy.code.trim() : ''
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
      if (error?.message?.includes('Unrecognized chain') || error?.message?.includes('wallet_addEthereumChain')) {
        throw new Error('Please add Arbitrum network to your wallet')
      }
      throw new Error(`Failed to switch to Arbitrum: ${error?.message || error}`)
    }
  }

  _createStreamTransport() {
    return new WebSocketTransport()
  }

  _createStreamSubscriptionClient(transport) {
    return new SubscriptionClient({ transport })
  }

  _getStreamTransport() {
    if (!this.streamTransport) {
      this.streamTransport = this._createStreamTransport()
    }
    return this.streamTransport
  }

  _getStreamSubscriptionClient() {
    if (!this.streamSubscriptionClient) {
      this.streamSubscriptionClient = this._createStreamSubscriptionClient(this._getStreamTransport())
    }
    return this.streamSubscriptionClient
  }

  async _closeStreamTransport() {
    if (this.streamTransportClosePromise) {
      return this.streamTransportClosePromise
    }
    if (!this.streamTransport) {
      this.streamSubscriptionClient = null
      return
    }

    const transport = this.streamTransport
    this.streamTransport = null
    this.streamSubscriptionClient = null
    this.streamTransportClosePromise = Promise.resolve()
      .then(() => transport.close?.())
      .finally(() => {
        this.streamTransportClosePromise = null
      })

    return this.streamTransportClosePromise
  }

  _createStreamEntry({ key, channel = null, params = null, flushMode = 'latest' } = {}) {
    return {
      key,
      channel,
      params,
      flushMode,
      upstreamSubscription: null,
      upstreamPromise: null,
      teardownPromise: null,
      listeners: new Map(),
      pendingLatest: undefined,
      pendingEvents: [],
    }
  }

  _getStreamEntry(key) {
    return this.streams.get(key) || null
  }

  _ensureStreamEntry(descriptor) {
    const key = descriptor?.key
    if (!key) {
      throw new Error('Hyperliquid stream key is required')
    }

    let entry = this.streams.get(key)
    if (entry) {
      return entry
    }

    entry = this._createStreamEntry(descriptor)
    this.streams.set(key, entry)
    return entry
  }

  _getStreamListenerDeadHook(owner) {
    if (!owner || typeof owner.getDeadHook !== 'function') {
      return null
    }
    return owner.getDeadHook()
  }

  _addStreamListener(entry, callback, owner = null) {
    if (!entry) {
      throw new Error('Hyperliquid stream entry is required')
    }
    if (typeof callback !== 'function') {
      throw new Error('Hyperliquid stream listener must be a function')
    }

    const listenerId = ++this.streamListenerId
    const listener = {
      id: listenerId,
      callback,
      owner,
      deadHook: this._getStreamListenerDeadHook(owner),
    }
    entry.listeners.set(listenerId, listener)
    return listener
  }

  _queueStreamPayload(entry, payload) {
    if (!entry) return
    if (entry.flushMode === 'queue') {
      entry.pendingEvents.push(payload)
      return
    }
    entry.pendingLatest = payload
  }

  async _ensureStreamUpstreamSubscription(entry, subscribeUpstream) {
    if (!entry) {
      throw new Error('Hyperliquid stream entry is required')
    }
    if (entry.upstreamSubscription) {
      return entry.upstreamSubscription
    }
    if (entry.upstreamPromise) {
      return entry.upstreamPromise
    }

    entry.upstreamPromise = Promise.resolve()
      .then(() =>
        subscribeUpstream(this._getStreamSubscriptionClient(), payload => {
          this._queueStreamPayload(entry, payload)
        })
      )
      .then(subscription => {
        entry.upstreamSubscription = subscription
        return subscription
      })
      .finally(() => {
        entry.upstreamPromise = null
      })

    return entry.upstreamPromise
  }

  async _teardownStreamEntry(entry) {
    if (!entry) {
      return
    }
    if (entry.teardownPromise) {
      return entry.teardownPromise
    }

    const upstreamSubscription = entry.upstreamSubscription
    entry.upstreamSubscription = null
    entry.pendingLatest = undefined
    entry.pendingEvents.length = 0
    this.streams.delete(entry.key)

    entry.teardownPromise = Promise.resolve()
      .then(() => upstreamSubscription?.unsubscribe?.())
      .finally(() => {
        entry.teardownPromise = null
      })

    return entry.teardownPromise
  }

  async _destroyStreams() {
    const entries = Array.from(this.streams.values())
    if (!entries.length) {
      return
    }

    await Promise.allSettled(entries.map(entry => this._teardownStreamEntry(entry)))
    this.streams.clear()
  }

  async _removeStreamListener(entry, listenerId) {
    if (!entry?.listeners.has(listenerId)) {
      return
    }

    entry.listeners.delete(listenerId)
    if (entry.listeners.size > 0) {
      return
    }

    await this._teardownStreamEntry(entry)
  }

  _getActiveStreamListeners(entry) {
    const listeners = []

    for (const [listenerId, listener] of entry.listeners) {
      if (listener.deadHook?.dead) {
        entry.listeners.delete(listenerId)
        continue
      }
      listeners.push(listener)
    }

    if (entry.listeners.size === 0) {
      void this._teardownStreamEntry(entry)
    }

    return listeners
  }

  _dispatchStreamPayload(entry, listeners, payload) {
    for (const listener of listeners) {
      try {
        listener.callback(payload)
      } catch (error) {
        console.error(`[Hyperliquid] Market stream listener failed for ${entry.key}`, error)
      }
    }
  }

  _createStreamHandle(entry, listener, failureSignal) {
    let unsubscribed = false

    return {
      failureSignal,
      unsubscribe: async () => {
        if (unsubscribed) {
          return
        }
        unsubscribed = true
        await this._removeStreamListener(entry, listener.id)
      },
    }
  }

  async subscribeMids(listener, { owner } = {}) {
    const key = this._getAllMidsStreamKey()
    const entry = this._ensureStreamEntry({
      key,
      channel: 'allMids',
      flushMode: 'latest',
    })
    const localListener = this._addStreamListener(entry, listener, owner)

    try {
      const upstreamSubscription = await this._ensureStreamUpstreamSubscription(
        entry,
        (subscriptionClient, onPayload) => subscriptionClient.allMids(onPayload)
      )
      return this._createStreamHandle(entry, localListener, upstreamSubscription.failureSignal)
    } catch (error) {
      entry.listeners.delete(localListener.id)
      if (entry.listeners.size === 0) {
        this.streams.delete(entry.key)
      }
      throw error
    }
  }

  async subscribeTrades({ ticker } = {}, listener, { owner } = {}) {
    const descriptor = await this._normalizeTradesStreamParams({ ticker })
    const entry = this._ensureStreamEntry({
      key: descriptor.key,
      channel: 'trades',
      params: {
        coin: descriptor.coin,
      },
      flushMode: 'queue',
    })
    const localListener = this._addStreamListener(entry, listener, owner)

    try {
      const upstreamSubscription = await this._ensureStreamUpstreamSubscription(
        entry,
        (subscriptionClient, onPayload) => subscriptionClient.trades({ coin: descriptor.coin }, onPayload)
      )
      return this._createStreamHandle(entry, localListener, upstreamSubscription.failureSignal)
    } catch (error) {
      entry.listeners.delete(localListener.id)
      if (entry.listeners.size === 0) {
        this.streams.delete(entry.key)
      }
      throw error
    }
  }

  async subscribeOrderBook({ ticker, nSigFigs = null, mantissa = null } = {}, listener, { owner } = {}) {
    const descriptor = await this._normalizeOrderBookStreamParams({ ticker, nSigFigs, mantissa })
    const params = {
      coin: descriptor.coin,
    }
    if (descriptor.nSigFigs !== null) {
      params.nSigFigs = descriptor.nSigFigs
    }
    if (descriptor.mantissa !== null) {
      params.mantissa = descriptor.mantissa
    }

    const entry = this._ensureStreamEntry({
      key: descriptor.key,
      channel: 'l2Book',
      params,
      flushMode: 'latest',
    })
    const localListener = this._addStreamListener(entry, listener, owner)

    try {
      const upstreamSubscription = await this._ensureStreamUpstreamSubscription(
        entry,
        (subscriptionClient, onPayload) => subscriptionClient.l2Book(params, onPayload)
      )
      return this._createStreamHandle(entry, localListener, upstreamSubscription.failureSignal)
    } catch (error) {
      entry.listeners.delete(localListener.id)
      if (entry.listeners.size === 0) {
        this.streams.delete(entry.key)
      }
      throw error
    }
  }

  async subscribeCandles({ ticker, interval } = {}, listener, { owner } = {}) {
    const descriptor = await this._normalizeCandleStreamParams({ ticker, interval })
    const params = {
      coin: descriptor.coin,
      interval: descriptor.interval,
    }
    const entry = this._ensureStreamEntry({
      key: descriptor.key,
      channel: 'candle',
      params,
      flushMode: 'latest',
    })
    const localListener = this._addStreamListener(entry, listener, owner)

    try {
      const upstreamSubscription = await this._ensureStreamUpstreamSubscription(
        entry,
        (subscriptionClient, onPayload) => subscriptionClient.candle(params, onPayload)
      )
      return this._createStreamHandle(entry, localListener, upstreamSubscription.failureSignal)
    } catch (error) {
      entry.listeners.delete(localListener.id)
      if (entry.listeners.size === 0) {
        this.streams.delete(entry.key)
      }
      throw error
    }
  }

  async subscribeAccount(listener, { owner = null, address = null } = {}) {
    const descriptor = this._normalizeAccountStreamParams({ address })
    const params = {
      user: descriptor.user,
    }
    const entry = this._ensureStreamEntry({
      key: descriptor.key,
      channel: 'clearinghouseState',
      params,
      flushMode: 'latest',
    })
    const localListener = this._addStreamListener(entry, listener, owner)

    try {
      const upstreamSubscription = await this._ensureStreamUpstreamSubscription(
        entry,
        (subscriptionClient, onPayload) =>
          subscriptionClient.clearinghouseState(params, payload => {
            onPayload(this._normalizeAccountSnapshotEvent(payload))
          })
      )
      return this._createStreamHandle(entry, localListener, upstreamSubscription.failureSignal)
    } catch (error) {
      entry.listeners.delete(localListener.id)
      if (entry.listeners.size === 0) {
        this.streams.delete(entry.key)
      }
      throw error
    }
  }

  _normalizeMarketTicker(ticker) {
    if (typeof ticker !== 'string') {
      throw new Error('Hyperliquid ticker must be a string')
    }

    const normalized = ticker.trim().toUpperCase()
    if (!normalized) {
      throw new Error('Hyperliquid ticker is required')
    }

    return normalized
  }

  _normalizeOptionalInteger(value, label) {
    if (value === undefined || value === null || value === '') {
      return null
    }

    const parsed = typeof value === 'number' && Number.isInteger(value) ? value : Number.parseInt(String(value), 10)
    if (!Number.isInteger(parsed)) {
      throw new Error(`Hyperliquid ${label} must be an integer`)
    }

    return parsed
  }

  _normalizeCandleInterval(interval) {
    if (typeof interval !== 'string') {
      throw new Error('Hyperliquid candle interval must be a string')
    }

    const normalized = interval.trim()
    if (!HYPERLIQUID_CANDLE_INTERVALS.has(normalized)) {
      throw new Error(`Invalid Hyperliquid candle interval: ${interval}`)
    }

    return normalized
  }

  _getCandleIntervalDurationMs(interval) {
    return HYPERLIQUID_CANDLE_INTERVAL_MS[interval] || HYPERLIQUID_CANDLE_INTERVAL_MS['1m']
  }

  _normalizeOrderBookAggregation({ nSigFigs = null, mantissa = null } = {}) {
    const normalizedSigFigs = this._normalizeOptionalInteger(nSigFigs, 'order book nSigFigs')
    if (normalizedSigFigs !== null && !HYPERLIQUID_ORDER_BOOK_SIG_FIGS.has(normalizedSigFigs)) {
      throw new Error(`Invalid Hyperliquid order book nSigFigs: ${nSigFigs}`)
    }

    let normalizedMantissa = this._normalizeOptionalInteger(mantissa, 'order book mantissa')
    if (normalizedMantissa !== null && !HYPERLIQUID_ORDER_BOOK_MANTISSAS.has(normalizedMantissa)) {
      throw new Error(`Invalid Hyperliquid order book mantissa: ${mantissa}`)
    }

    if (normalizedSigFigs !== 5) {
      normalizedMantissa = null
    }

    return {
      nSigFigs: normalizedSigFigs,
      mantissa: normalizedMantissa,
    }
  }

  _normalizeOrderIdentifier(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        throw new Error('Hyperliquid order oid or cloid is required')
      }
      if (/^0x[0-9a-fA-F]{32}$/.test(trimmed)) {
        return trimmed.toLowerCase()
      }
      const parsed = Number.parseInt(trimmed, 10)
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed
      }
    }

    throw new Error('Hyperliquid order oid or cloid is invalid')
  }

  _normalizeOptionalCloid(value) {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string') {
      throw new Error('Hyperliquid cloid must be a string')
    }

    const normalized = value.trim().toLowerCase()
    if (!/^0x[0-9a-f]{32}$/.test(normalized)) {
      throw new Error('Invalid Hyperliquid cloid')
    }
    return normalized
  }

  _normalizeTradeOrderOptions(options = null) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return {
        cloid: null,
      }
    }

    return {
      cloid: this._normalizeOptionalCloid(options.cloid),
    }
  }

  _normalizeTradeRequestArgs(slippageOrOptions = 1, maybeOptions = null) {
    let resolvedSlippage = slippageOrOptions
    let orderOptions = maybeOptions

    if (slippageOrOptions && typeof slippageOrOptions === 'object' && !Array.isArray(slippageOrOptions)) {
      resolvedSlippage = 1
      orderOptions = slippageOrOptions
    }

    return {
      slippage: this._parseHyperliquidNumber(resolvedSlippage, 1),
      orderOptions: this._normalizeTradeOrderOptions(orderOptions),
    }
  }

  _normalizeLeverageUpdateOptions(options = null) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return {
        type: 'cross',
      }
    }

    let type = options.type
    if (type === undefined && typeof options.isCross === 'boolean') {
      type = options.isCross ? 'cross' : 'isolated'
    }

    if (type === undefined || type === null || type === '') {
      return {
        type: 'cross',
      }
    }

    if (type !== 'cross' && type !== 'isolated') {
      throw new Error('Hyperliquid leverage type must be "cross" or "isolated"')
    }

    return { type }
  }

  _normalizeLeverageValue(value) {
    const parsed = this._normalizeOptionalInteger(value, 'leverage')
    if (parsed === null || parsed < 1) {
      throw new Error('Hyperliquid leverage must be an integer greater than or equal to 1')
    }
    return parsed
  }

  _formatMarketStreamKeyPart(value) {
    return value === null || value === undefined ? 'null' : String(value)
  }

  _parseHyperliquidNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value ?? ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }

  _normalizeNullableHyperliquidNumber(value) {
    if (value === null || value === undefined) return null
    return this._parseHyperliquidNumber(value, null)
  }

  _normalizeCandlePoint(candle, descriptor = {}) {
    return {
      t: this._normalizeOptionalInteger(candle?.t, 'candle open time'),
      T: this._normalizeOptionalInteger(candle?.T, 'candle close time'),
      s: descriptor.ticker || String(candle?.s || '').trim(),
      i: descriptor.interval || String(candle?.i || '').trim(),
      o: this._parseHyperliquidNumber(candle?.o, null),
      c: this._parseHyperliquidNumber(candle?.c, null),
      h: this._parseHyperliquidNumber(candle?.h, null),
      l: this._parseHyperliquidNumber(candle?.l, null),
      v: this._parseHyperliquidNumber(candle?.v, null),
      n: this._normalizeOptionalInteger(candle?.n, 'candle trade count'),
    }
  }

  _normalizeOrderStatusParams(params = {}, { address = null } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : { oid: params }
    const oid = this._normalizeOrderIdentifier(request.oid ?? request.cloid ?? request.orderId ?? request.clientOrderId)
    const user = this._getReadAddress(request.user ?? request.address ?? address)

    return {
      user,
      oid,
    }
  }

  _normalizeUserFillsParams(params = {}, { address = null } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : {}
    const aggregateByTime = typeof request.aggregateByTime === 'boolean' ? request.aggregateByTime : undefined

    return {
      user: this._getReadAddress(request.user ?? request.address ?? address),
      aggregateByTime,
    }
  }

  _normalizeUserFillsByTimeParams(params = {}, { address = null } = {}) {
    const request = params && typeof params === 'object' && !Array.isArray(params) ? { ...params } : {}
    const startTime = this._normalizeOptionalInteger(request.startTime, 'user fills startTime')
    if (startTime === null) {
      throw new Error('Hyperliquid user fills startTime is required')
    }

    const endTime = this._normalizeOptionalInteger(request.endTime, 'user fills endTime')
    if (endTime !== null && endTime < startTime) {
      throw new Error('Hyperliquid user fills endTime must be after startTime')
    }

    const base = this._normalizeUserFillsParams(request, { address })
    return {
      ...base,
      startTime,
      endTime,
    }
  }

  _normalizeOrderStatusResponse(response) {
    if (!response || response.status === 'unknownOid') {
      return {
        status: 'unknown',
      }
    }

    const rawOrder = response?.order?.order || {}
    const coin = String(rawOrder.coin || '').trim()
    let ticker = null
    if (coin) {
      try {
        ticker = this._normalizeMarketTicker(coin)
      } catch {
        ticker = coin
      }
    }

    return {
      status: 'order',
      order: {
        oid: Number.isFinite(rawOrder.oid) ? rawOrder.oid : this._normalizeOptionalInteger(rawOrder.oid, 'order oid'),
        cloid: this._normalizeOptionalCloid(rawOrder.cloid),
        coin: coin || null,
        ticker,
        side: rawOrder.side === 'B' ? 'buy' : rawOrder.side === 'A' ? 'sell' : null,
        limitPrice: this._parseHyperliquidNumber(rawOrder.limitPx, null),
        size: this._parseHyperliquidNumber(rawOrder.sz, null),
        originalSize: this._parseHyperliquidNumber(rawOrder.origSz, null),
        reduceOnly: !!rawOrder.reduceOnly,
        orderType: rawOrder.orderType || null,
        tif: rawOrder.tif || null,
        timestamp: this._normalizeOptionalInteger(rawOrder.timestamp, 'order timestamp'),
        status: response?.order?.status || null,
        statusTimestamp: this._normalizeOptionalInteger(response?.order?.statusTimestamp, 'order status timestamp'),
      },
    }
  }

  _normalizeUserFill(fill) {
    const coin = String(fill?.coin || '').trim()
    let ticker = null
    if (coin) {
      try {
        ticker = this._normalizeMarketTicker(coin)
      } catch {
        ticker = coin
      }
    }

    return {
      coin: coin || null,
      ticker,
      price: this._parseHyperliquidNumber(fill?.px, null),
      size: this._parseHyperliquidNumber(fill?.sz, null),
      side: fill?.side === 'B' ? 'buy' : fill?.side === 'A' ? 'sell' : null,
      time: this._normalizeOptionalInteger(fill?.time, 'fill time'),
      startPosition: this._parseHyperliquidNumber(fill?.startPosition, null),
      dir: typeof fill?.dir === 'string' ? fill.dir : null,
      closedPnl: this._parseHyperliquidNumber(fill?.closedPnl, 0),
      hash: typeof fill?.hash === 'string' ? fill.hash : null,
      oid: this._normalizeOptionalInteger(fill?.oid, 'fill oid'),
      crossed: !!fill?.crossed,
      fee: this._parseHyperliquidNumber(fill?.fee, 0),
      tid: this._normalizeOptionalInteger(fill?.tid, 'fill tid'),
      feeToken: typeof fill?.feeToken === 'string' ? fill.feeToken : null,
      twapId: this._normalizeOptionalInteger(fill?.twapId, 'fill twapId'),
      cloid: this._normalizeOptionalCloid(fill?.cloid),
    }
  }

  _normalizeUserFillResponse(response) {
    if (!Array.isArray(response)) {
      return []
    }

    return response.map(fill => this._normalizeUserFill(fill))
  }

  _normalizeSpotToken(token) {
    if (!token || typeof token !== 'object') return null
    return {
      index: Number.isFinite(token.index) ? token.index : null,
      name: token.name || null,
      fullName: token.fullName || null,
      szDecimals: Number.isFinite(token.szDecimals) ? token.szDecimals : null,
      weiDecimals: Number.isFinite(token.weiDecimals) ? token.weiDecimals : null,
      tokenId: token.tokenId || null,
      isCanonical: !!token.isCanonical,
      deployerTradingFeeShare: this._parseHyperliquidNumber(token.deployerTradingFeeShare),
      evmContractAddress: token.evmContract?.address || null,
      evmExtraWeiDecimals:
        token.evmContract && Number.isFinite(token.evmContract.evm_extra_wei_decimals)
          ? token.evmContract.evm_extra_wei_decimals
          : null,
    }
  }

  _formatBuilderRuntimeTicker(assetName, dex) {
    const normalizedAssetName = String(assetName || '').trim()
    if (!normalizedAssetName) return ''
    if (normalizedAssetName.includes(':')) return normalizedAssetName
    if (!dex) return normalizedAssetName
    return `${dex}:${normalizedAssetName}`
  }

  _stripTrailingZeros(value) {
    const normalized = String(value ?? '').trim()
    if (!normalized.includes('.')) return normalized
    return normalized.replace(/\.?0+$/, '')
  }

  _warnMarketCatalogFailure(scope, error) {
    const message = error?.message || String(error)
    console.warn(`[Hyperliquid] Market catalog ${scope} failed: ${message}`)
  }

  _normalizePerpMarket(asset, assetCtx, { venue, dex, dexLabel, dexIndex }, assetIndex) {
    const assetName = String(asset?.name || '').trim()
    const runtimeTicker = venue === 'builder' ? this._formatBuilderRuntimeTicker(assetName, dex) : assetName
    const ticker = this._normalizeMarketTicker(runtimeTicker)
    const assetId =
      venue === 'builder' && Number.isFinite(dexIndex) && Number.isFinite(assetIndex)
        ? 100000 + dexIndex * 10000 + assetIndex
        : Number.isFinite(assetIndex)
          ? assetIndex
          : null
    return {
      ticker,
      symbol: ticker,
      runtimeTicker,
      streamCoin: runtimeTicker,
      midPriceKey: runtimeTicker,
      asset: this._normalizeMarketTicker(assetName),
      assetIndex: Number.isFinite(assetIndex) ? assetIndex : null,
      assetId,
      marketType: 'perp',
      venue,
      dex,
      dexLabel,
      dexIndex,
      szDecimals: Number.isFinite(asset?.szDecimals) ? asset.szDecimals : null,
      maxLeverage: Number.isFinite(asset?.maxLeverage) ? asset.maxLeverage : null,
      marginTableId: Number.isFinite(asset?.marginTableId) ? asset.marginTableId : null,
      onlyIsolated: !!asset?.onlyIsolated,
      isDelisted: !!asset?.isDelisted,
      marginMode: asset?.marginMode || null,
      markPrice: this._parseHyperliquidNumber(assetCtx?.markPx),
      midPrice: this._normalizeNullableHyperliquidNumber(assetCtx?.midPx),
      oraclePrice: this._parseHyperliquidNumber(assetCtx?.oraclePx),
      funding: this._parseHyperliquidNumber(assetCtx?.funding),
      openInterest: this._parseHyperliquidNumber(assetCtx?.openInterest),
      premium: this._normalizeNullableHyperliquidNumber(assetCtx?.premium),
      impactPrices: Array.isArray(assetCtx?.impactPxs) ? assetCtx.impactPxs.slice() : [],
      dayBaseVolume: this._parseHyperliquidNumber(assetCtx?.dayBaseVlm),
      dayNotionalVolume: this._parseHyperliquidNumber(assetCtx?.dayNtlVlm),
      prevDayPrice: this._parseHyperliquidNumber(assetCtx?.prevDayPx),
    }
  }

  _normalizePerpMarketsFromMetaAndContexts(payload, descriptor) {
    const [meta, assetCtxs] = Array.isArray(payload) ? payload : []
    if (!meta || !Array.isArray(meta.universe)) return []
    const markets = []

    meta.universe.forEach((asset, index) => {
      try {
        const market = this._normalizePerpMarket(
          asset,
          Array.isArray(assetCtxs) ? assetCtxs[index] : null,
          descriptor,
          index
        )
        if (market?.asset) {
          markets.push(market)
        }
      } catch (error) {
        const label = descriptor?.venue === 'builder' ? `builder perp ${descriptor?.dex || 'unknown'}` : 'core perp'
        this._warnMarketCatalogFailure(`${label} normalization`, error)
      }
    })

    return this._sortMarketCatalogEntries(markets)
  }

  _normalizeSpotMarketsFromMetaAndContexts(payload) {
    const [spotMeta, assetCtxs] = Array.isArray(payload) ? payload : []
    if (!spotMeta || !Array.isArray(spotMeta.universe) || !Array.isArray(spotMeta.tokens)) return []

    const tokenMap = new Map()
    spotMeta.tokens.forEach(token => {
      const normalized = this._normalizeSpotToken(token)
      if (normalized && normalized.index !== null) {
        tokenMap.set(normalized.index, normalized)
      }
    })

    const markets = spotMeta.universe
      .map(market => {
        try {
          if (!market || !Array.isArray(market.tokens) || market.tokens.length < 2) return null
          const baseToken = tokenMap.get(market.tokens[0])
          const quoteToken = tokenMap.get(market.tokens[1])
          if (!baseToken || !quoteToken) return null

          const assetCtx = Array.isArray(assetCtxs) ? assetCtxs[market.index] : null
          const runtimeTicker = `${baseToken.name}/${quoteToken.name}`
          const ticker = this._normalizeMarketTicker(runtimeTicker)
          const pairIndex = Number.isFinite(market.index) ? market.index : null
          const pairId = typeof market.name === 'string' && market.name.trim() ? market.name.trim() : runtimeTicker
          return {
            ticker,
            symbol: ticker,
            runtimeTicker,
            streamCoin: pairId,
            midPriceKey: pairId,
            marketType: 'spot',
            venue: 'spot',
            pairId,
            pairIndex,
            assetId: Number.isFinite(pairIndex) ? 10000 + pairIndex : null,
            isCanonical: !!market.isCanonical,
            baseToken,
            quoteToken,
            szDecimals: baseToken.szDecimals,
            markPrice: this._parseHyperliquidNumber(assetCtx?.markPx),
            midPrice: this._normalizeNullableHyperliquidNumber(assetCtx?.midPx),
            circulatingSupply: this._parseHyperliquidNumber(assetCtx?.circulatingSupply),
            totalSupply: this._parseHyperliquidNumber(assetCtx?.totalSupply),
            dayBaseVolume: this._parseHyperliquidNumber(assetCtx?.dayBaseVlm),
            dayNotionalVolume: this._parseHyperliquidNumber(assetCtx?.dayNtlVlm),
            prevDayPrice: this._parseHyperliquidNumber(assetCtx?.prevDayPx),
          }
        } catch (error) {
          this._warnMarketCatalogFailure('spot market normalization', error)
          return null
        }
      })
      .filter(Boolean)

    return this._sortMarketCatalogEntries(markets)
  }

  _getSpotPrimaryMarkets(spotMarkets = []) {
    const primaryMarkets = new Map()

    for (const market of spotMarkets) {
      const baseName = String(market?.baseToken?.name || '').trim()
      if (!baseName) continue

      const current = primaryMarkets.get(baseName)
      if (!current) {
        primaryMarkets.set(baseName, market)
        continue
      }

      const currentQuote = String(current?.quoteToken?.name || '')
        .trim()
        .toUpperCase()
      const nextQuote = String(market?.quoteToken?.name || '')
        .trim()
        .toUpperCase()
      const prefersNext =
        (!!market?.isCanonical && !current?.isCanonical) || (nextQuote === 'USDC' && currentQuote !== 'USDC')
      if (prefersNext) {
        primaryMarkets.set(baseName, market)
      }
    }

    return primaryMarkets
  }

  _normalizeSpotPositions(spotClearinghouseState, spotMarkets = []) {
    if (!spotClearinghouseState || !Array.isArray(spotClearinghouseState.balances) || !spotMarkets.length) return []

    const primaryMarkets = this._getSpotPrimaryMarkets(spotMarkets)

    return spotClearinghouseState.balances
      .map(balance => {
        const baseName = String(balance?.coin || '').trim()
        const market = primaryMarkets.get(baseName)
        if (!market) return null

        const size = this._parseHyperliquidNumber(balance?.total)
        if (!size) return null

        const entryNotional = this._parseHyperliquidNumber(balance?.entryNtl)
        const markPrice = market.midPrice ?? market.markPrice ?? null
        return {
          ticker: market.ticker,
          size,
          entryPrice: size > 0 && entryNotional > 0 ? entryNotional / size : null,
          unrealizedPnl: markPrice !== null && entryNotional > 0 ? size * markPrice - entryNotional : 0,
          liquidationPrice: null,
        }
      })
      .filter(Boolean)
  }

  _sortMarketCatalogEntries(markets) {
    const typeOrder = {
      perp: 0,
      spot: 1,
    }
    const venueOrder = {
      core: 0,
      builder: 1,
      spot: 2,
    }

    return markets.slice().sort((left, right) => {
      const leftType = left?.marketType || ''
      const rightType = right?.marketType || ''
      if (leftType !== rightType) {
        return (typeOrder[leftType] ?? Number.MAX_SAFE_INTEGER) - (typeOrder[rightType] ?? Number.MAX_SAFE_INTEGER)
      }

      const leftVenue = left?.venue || ''
      const rightVenue = right?.venue || ''
      if (leftVenue !== rightVenue) {
        return (venueOrder[leftVenue] ?? Number.MAX_SAFE_INTEGER) - (venueOrder[rightVenue] ?? Number.MAX_SAFE_INTEGER)
      }

      const leftDex = left?.dex || ''
      const rightDex = right?.dex || ''
      if (leftDex !== rightDex) return leftDex.localeCompare(rightDex)

      return String(left?.ticker || '').localeCompare(String(right?.ticker || ''))
    })
  }

  _normalizePosition(position, { dex = null } = {}) {
    const runtimeTicker = dex
      ? this._formatBuilderRuntimeTicker(position?.coin, dex)
      : String(position?.coin || '').trim()
    return {
      ticker: this._normalizeMarketTicker(runtimeTicker),
      size: this._parseHyperliquidNumber(position.szi),
      entryPrice: this._parseHyperliquidNumber(position.entryPx),
      unrealizedPnl: this._parseHyperliquidNumber(position.unrealizedPnl),
      liquidationPrice:
        position.liquidationPx === null || position.liquidationPx === undefined
          ? null
          : this._parseHyperliquidNumber(position.liquidationPx),
    }
  }

  _normalizeAccountSnapshotPosition(position) {
    return {
      ...this._normalizePosition(position),
      marginUsed: this._parseHyperliquidNumber(position.marginUsed),
      maxLeverage: this._parseHyperliquidNumber(position.maxLeverage),
      leverage: {
        type: position.leverage?.type === 'isolated' ? 'isolated' : 'cross',
        value: this._parseHyperliquidNumber(position.leverage?.value),
      },
    }
  }

  _normalizeAccountSnapshot(clearinghouseState, address) {
    const normalizedAddress = this._normalizeAddress(address, 'address')
    const positions = Array.isArray(clearinghouseState?.assetPositions)
      ? clearinghouseState.assetPositions
          .map(assetPosition => assetPosition?.position)
          .filter(position => this._parseHyperliquidNumber(position?.szi) !== 0)
          .map(position => this._normalizeAccountSnapshotPosition(position))
      : []

    return {
      address: normalizedAddress,
      accountValue: this._parseHyperliquidNumber(clearinghouseState?.marginSummary?.accountValue),
      withdrawable: this._parseHyperliquidNumber(clearinghouseState?.withdrawable),
      totalMarginUsed: this._parseHyperliquidNumber(clearinghouseState?.marginSummary?.totalMarginUsed),
      totalNotionalPosition: this._parseHyperliquidNumber(clearinghouseState?.marginSummary?.totalNtlPos),
      positions,
      timestamp:
        typeof clearinghouseState?.time === 'number'
          ? clearinghouseState.time
          : this._parseHyperliquidNumber(clearinghouseState?.time),
    }
  }

  _normalizeAccountSnapshotEvent(event) {
    return this._normalizeAccountSnapshot(event?.clearinghouseState, event?.user)
  }

  _getAllMidsStreamKey() {
    return 'allMids'
  }

  _getClearinghouseStateStreamKey(address) {
    return `clearinghouseState:${address}`
  }

  _normalizeAccountStreamParams({ address = null } = {}) {
    const normalizedAddress = this._getReadAddress(address)
    return {
      address: normalizedAddress,
      user: normalizedAddress,
      key: this._getClearinghouseStateStreamKey(normalizedAddress),
    }
  }

  update() {
    for (const entry of this.streams.values()) {
      const listeners = this._getActiveStreamListeners(entry)
      if (!listeners.length) {
        entry.pendingLatest = undefined
        entry.pendingEvents.length = 0
        continue
      }

      if (entry.flushMode === 'queue') {
        if (!entry.pendingEvents.length) {
          continue
        }

        const pendingEvents = entry.pendingEvents.slice()
        entry.pendingEvents.length = 0
        for (const payload of pendingEvents) {
          this._dispatchStreamPayload(entry, listeners, payload)
        }
        continue
      }

      if (entry.pendingLatest === undefined) {
        continue
      }

      const payload = entry.pendingLatest
      entry.pendingLatest = undefined

      this._dispatchStreamPayload(entry, listeners, payload)
    }
  }

  async _normalizeTradesStreamParams({ ticker } = {}) {
    const market = await this._resolveMarketDescriptor(ticker)
    return {
      ticker: market.ticker,
      coin: market.streamCoin || market.runtimeTicker || market.ticker,
      key: `trades:${market.ticker}`,
    }
  }

  async _normalizeOrderBookStreamParams({ ticker, nSigFigs = null, mantissa = null } = {}) {
    const market = await this._resolveMarketDescriptor(ticker)
    const aggregation = this._normalizeOrderBookAggregation({ nSigFigs, mantissa })

    return {
      ticker: market.ticker,
      coin: market.streamCoin || market.runtimeTicker || market.ticker,
      nSigFigs: aggregation.nSigFigs,
      mantissa: aggregation.mantissa,
      key: `l2Book:${market.ticker}:${this._formatMarketStreamKeyPart(
        aggregation.nSigFigs
      )}:${this._formatMarketStreamKeyPart(aggregation.mantissa)}`,
    }
  }

  async _normalizeCandleStreamParams({ ticker, interval } = {}) {
    const market = await this._resolveMarketDescriptor(ticker)
    const normalizedInterval = this._normalizeCandleInterval(interval)

    return {
      ticker: market.ticker,
      coin: market.streamCoin || market.runtimeTicker || market.ticker,
      interval: normalizedInterval,
      key: `candle:${market.ticker}:${normalizedInterval}`,
    }
  }

  async _normalizeCandleHistoryParams({ ticker, interval, startTime = null, endTime = null, limit = 64 } = {}) {
    const descriptor = await this._normalizeCandleStreamParams({ ticker, interval })
    const normalizedStartTime = this._normalizeOptionalInteger(startTime, 'candle startTime')
    const normalizedEndTime = this._normalizeOptionalInteger(endTime, 'candle endTime')
    const normalizedLimit = this._normalizeOptionalInteger(limit, 'candle limit')
    const safeLimit = normalizedLimit === null ? 64 : normalizedLimit
    if (!Number.isInteger(safeLimit) || safeLimit <= 0) {
      throw new Error('Hyperliquid candle limit must be greater than 0')
    }

    const resolvedEndTime = normalizedEndTime ?? Date.now()
    const resolvedStartTime =
      normalizedStartTime ??
      Math.max(0, resolvedEndTime - this._getCandleIntervalDurationMs(descriptor.interval) * safeLimit)

    if (resolvedStartTime > resolvedEndTime) {
      throw new Error('Hyperliquid candle startTime must be before endTime')
    }

    return {
      ...descriptor,
      startTime: resolvedStartTime,
      endTime: resolvedEndTime,
      limit: safeLimit,
    }
  }

  async _getMeta() {
    return this.infoClient.meta()
  }

  async _getMetaAndAssetCtxs({ dex = null } = {}) {
    if (typeof this.infoClient?.metaAndAssetCtxs !== 'function') {
      const meta = typeof this.infoClient?.meta === 'function' ? await this.infoClient.meta() : { universe: [] }
      return [meta, []]
    }
    if (dex === null || dex === undefined || dex === '') {
      return this.infoClient.metaAndAssetCtxs()
    }
    return this.infoClient.metaAndAssetCtxs({ dex })
  }

  async _getSpotMetaAndAssetCtxs() {
    if (typeof this.infoClient?.spotMetaAndAssetCtxs !== 'function') {
      return [{ universe: [], tokens: [] }, []]
    }
    return this.infoClient.spotMetaAndAssetCtxs()
  }

  async _getPerpDexs() {
    if (typeof this.infoClient?.perpDexs !== 'function') return []
    return this.infoClient.perpDexs()
  }

  async _getAllMids({ dex = null } = {}) {
    if (dex === null || dex === undefined || dex === '') {
      return this.infoClient.allMids()
    }
    return this.infoClient.allMids({ dex })
  }

  async _getClearinghouseState({ address = null, dex = null } = {}) {
    if (typeof this.infoClient?.clearinghouseState !== 'function') return null
    const request = { user: this._getReadAddress(address) }
    if (dex !== null && dex !== undefined && dex !== '') {
      request.dex = dex
    }
    return this.infoClient.clearinghouseState(request)
  }

  async _getSpotClearinghouseState({ address = null } = {}) {
    if (typeof this.infoClient?.spotClearinghouseState !== 'function') return null
    return this.infoClient.spotClearinghouseState({ user: this._getReadAddress(address) })
  }

  async _buildPerpMarkets(options = {}) {
    const includeBuilderDexs = options?.includeBuilderDexs !== false
    const [coreMetaResult, perpDexsResult] = await Promise.allSettled([
      this._getMetaAndAssetCtxs(),
      includeBuilderDexs ? this._getPerpDexs() : [],
    ])

    const corePerps =
      coreMetaResult.status === 'fulfilled'
        ? this._normalizePerpMarketsFromMetaAndContexts(coreMetaResult.value, {
            venue: 'core',
            dex: null,
            dexLabel: null,
            dexIndex: null,
          })
        : []
    if (coreMetaResult.status !== 'fulfilled') {
      this._warnMarketCatalogFailure('core perps', coreMetaResult.reason)
    }

    const perpDexs = perpDexsResult.status === 'fulfilled' ? perpDexsResult.value : []
    if (perpDexsResult.status !== 'fulfilled') {
      this._warnMarketCatalogFailure('builder dex discovery', perpDexsResult.reason)
    }

    if (!includeBuilderDexs || !Array.isArray(perpDexs) || perpDexs.length <= 1) {
      return corePerps
    }

    const builderDexEntries = perpDexs
      .map((dex, dexIndex) => ({ dex, dexIndex }))
      .filter(entry => entry.dexIndex > 0 && entry.dex && typeof entry.dex.name === 'string' && entry.dex.name)

    const builderResults = await Promise.allSettled(
      builderDexEntries.map(entry => this._getMetaAndAssetCtxs({ dex: entry.dex.name }))
    )

    const builderPerps = []
    builderResults.forEach((result, index) => {
      const dexEntry = builderDexEntries[index]
      if (result.status !== 'fulfilled') {
        this._warnMarketCatalogFailure(`builder perp ${dexEntry?.dex?.name || 'unknown'}`, result.reason)
        return
      }
      builderPerps.push(
        ...this._normalizePerpMarketsFromMetaAndContexts(result.value, {
          venue: 'builder',
          dex: dexEntry.dex.name,
          dexLabel: dexEntry.dex.fullName || dexEntry.dex.name,
          dexIndex: dexEntry.dexIndex,
        })
      )
    })

    return this._sortMarketCatalogEntries(corePerps.concat(builderPerps))
  }

  async _buildSpotMarkets() {
    try {
      const spotMetaAndCtxs = await this._getSpotMetaAndAssetCtxs()
      return this._normalizeSpotMarketsFromMetaAndContexts(spotMetaAndCtxs)
    } catch (error) {
      this._warnMarketCatalogFailure('spot markets', error)
      return []
    }
  }

  async _buildMarketCatalog(options = {}) {
    const includeBuilderDexs = options?.includeBuilderDexs !== false
    const [spotResult, perpsResult] = await Promise.allSettled([
      this._buildSpotMarkets(),
      this._buildPerpMarkets({ includeBuilderDexs }),
    ])
    const spot = spotResult.status === 'fulfilled' ? spotResult.value : []
    const perps = perpsResult.status === 'fulfilled' ? perpsResult.value : []
    if (spotResult.status !== 'fulfilled') {
      this._warnMarketCatalogFailure('spot catalog assembly', spotResult.reason)
    }
    if (perpsResult.status !== 'fulfilled') {
      this._warnMarketCatalogFailure('perp catalog assembly', perpsResult.reason)
    }
    const corePerps = perps.filter(market => market.venue === 'core')
    const builderPerps = perps.filter(market => market.venue === 'builder')
    return {
      corePerps,
      builderPerps,
      spot,
      all: this._sortMarketCatalogEntries(corePerps.concat(builderPerps, spot)),
    }
  }

  async _getResolvedMarketCatalog() {
    if (this._resolvedMarketCatalog) {
      return this._resolvedMarketCatalog
    }
    if (this._resolvedMarketCatalogPromise) {
      return this._resolvedMarketCatalogPromise
    }

    this._resolvedMarketCatalogPromise = this._buildMarketCatalog({ includeBuilderDexs: true })
      .then(catalog => {
        this._resolvedMarketCatalog = catalog
        return catalog
      })
      .finally(() => {
        this._resolvedMarketCatalogPromise = null
      })

    return this._resolvedMarketCatalogPromise
  }

  async _resolveMarketDescriptor(ticker) {
    const normalizedTicker = this._normalizeMarketTicker(ticker)
    const catalog = await this._getResolvedMarketCatalog()
    const market = catalog.all.find(entry => this._normalizeMarketTicker(entry?.ticker) === normalizedTicker)
    if (market) return market
    throw new Error(`Unknown market: ${normalizedTicker}`)
  }

  async _getBuilderDexNames() {
    const catalog = await this._getResolvedMarketCatalog()
    return Array.from(new Set(catalog.builderPerps.map(market => market.dex).filter(Boolean)))
  }

  async _getBuilderClearinghouseStates({ address = null } = {}) {
    const dexNames = await this._getBuilderDexNames()
    if (!dexNames.length) return []

    const results = await Promise.allSettled(
      dexNames.map(async dex => ({
        dex,
        state: await this._getClearinghouseState({ address, dex }),
      }))
    )

    return results.filter(result => result.status === 'fulfilled').map(result => result.value)
  }

  _formatOrderPrice(price, market) {
    const safePrice = this._parseHyperliquidNumber(price, null)
    if (safePrice === null || safePrice <= 0) {
      throw new Error(`Invalid price for ${market?.ticker || 'market'}`)
    }

    const szDecimals = Number.isFinite(market?.szDecimals) ? Math.max(0, market.szDecimals) : 0
    const maxDecimals = market?.marketType === 'spot' ? Math.max(0, 8 - szDecimals) : Math.max(0, 6 - szDecimals)
    const magnitude = Math.floor(Math.log10(Math.abs(safePrice)))
    const maxSigFigDecimals = Math.max(0, 4 - magnitude)
    const decimals = Math.min(maxDecimals, maxSigFigDecimals)
    return this._stripTrailingZeros(safePrice.toFixed(decimals))
  }

  _formatOrderSize(amount, market) {
    const safeAmount = this._parseHyperliquidNumber(amount, null)
    if (safeAmount === null || safeAmount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const decimals = Number.isFinite(market?.szDecimals) ? Math.max(0, market.szDecimals) : 0
    return this._stripTrailingZeros(safeAmount.toFixed(decimals))
  }

  _getSpotUsdBalance(spotClearinghouseState) {
    if (!spotClearinghouseState || !Array.isArray(spotClearinghouseState.balances)) return 0
    return spotClearinghouseState.balances.reduce((sum, balance) => {
      const coin = String(balance?.coin || '')
        .trim()
        .toUpperCase()
      if (coin !== 'USDC') return sum
      return sum + this._parseHyperliquidNumber(balance?.total)
    }, 0)
  }

  async getAvailableTickers() {
    const meta = await this._getMeta()
    return meta.universe.map(asset => asset.name).sort()
  }

  async getPerpMarkets(options = {}) {
    return this._buildPerpMarkets(options)
  }

  async getSpotMarkets() {
    return this._buildSpotMarkets()
  }

  async getMarketCatalog() {
    return this._getResolvedMarketCatalog()
  }

  async getCandles(params = {}) {
    if (typeof this.infoClient?.candleSnapshot !== 'function') {
      return []
    }

    const descriptor = await this._normalizeCandleHistoryParams(params)
    const candles = await this.infoClient.candleSnapshot({
      coin: descriptor.coin,
      interval: descriptor.interval,
      startTime: descriptor.startTime,
      endTime: descriptor.endTime,
    })
    if (!Array.isArray(candles)) {
      return []
    }

    return candles.map(candle => this._normalizeCandlePoint(candle, descriptor))
  }

  async getOrderStatus(params = {}, { address = null } = {}) {
    if (typeof this.infoClient?.orderStatus !== 'function') {
      throw new Error('Hyperliquid order status is unavailable')
    }

    const descriptor = this._normalizeOrderStatusParams(params, { address })
    const response = await this.infoClient.orderStatus({
      user: descriptor.user,
      oid: descriptor.oid,
    })
    return this._normalizeOrderStatusResponse(response)
  }

  async getUserFills(params = {}, { address = null } = {}) {
    if (typeof this.infoClient?.userFills !== 'function') {
      return []
    }

    const descriptor = this._normalizeUserFillsParams(params, { address })
    const response = await this.infoClient.userFills({
      user: descriptor.user,
      aggregateByTime: descriptor.aggregateByTime,
    })
    return this._normalizeUserFillResponse(response)
  }

  async getUserFillsByTime(params = {}, { address = null } = {}) {
    if (typeof this.infoClient?.userFillsByTime !== 'function') {
      return []
    }

    const descriptor = this._normalizeUserFillsByTimeParams(params, { address })
    const response = await this.infoClient.userFillsByTime({
      user: descriptor.user,
      startTime: descriptor.startTime,
      endTime: descriptor.endTime,
      aggregateByTime: descriptor.aggregateByTime,
    })
    return this._normalizeUserFillResponse(response)
  }

  async _placeOrder(orders, options = null) {
    this._requireWallet()
    const orderOptions = this._normalizeTradeOrderOptions(options)
    const normalizedOrders = Array.isArray(orders)
      ? orders.map((order, index) => {
          if (!orderOptions.cloid || index > 0) return order
          return {
            ...order,
            c: orderOptions.cloid,
          }
        })
      : orders
    console.log(
      '[Hyperliquid] placeOrder: signing with',
      this.agentKey ? `agent (${this.agentAddress})` : 'main wallet'
    )
    return this.exchangeClient.order({ orders: normalizedOrders, grouping: 'na' })
  }

  async getPrice(ticker) {
    const market = await this._resolveMarketDescriptor(ticker)
    const mids = await this._getAllMids({ dex: market.venue === 'builder' ? market.dex : null })
    const candidateKeys = [market.midPriceKey, market.streamCoin, market.runtimeTicker, market.ticker].filter(Boolean)

    for (const key of candidateKeys) {
      const price = this._parseHyperliquidNumber(mids?.[key], null)
      if (price !== null && price > 0) {
        return price
      }
    }

    const fallbackPrice = market.midPrice ?? market.markPrice ?? null
    if (fallbackPrice !== null && fallbackPrice > 0) {
      return fallbackPrice
    }

    throw new Error(`No price for ${market.ticker}`)
  }

  // TODO: A future pass can serve getBalance/getPositions from the latest streamed
  // account snapshot when the runtime already has one for its bound target address.
  async getBalance({ address = null } = {}) {
    const [coreState, builderStates, spotState] = await Promise.all([
      this._getClearinghouseState({ address }),
      this._getBuilderClearinghouseStates({ address }),
      this._getSpotClearinghouseState({ address }),
    ])

    const coreAccountValue = this._parseHyperliquidNumber(coreState?.marginSummary?.accountValue)
    const builderAccountValue = builderStates.reduce(
      (sum, entry) => sum + this._parseHyperliquidNumber(entry?.state?.marginSummary?.accountValue),
      0
    )

    return coreAccountValue + builderAccountValue + this._getSpotUsdBalance(spotState)
  }

  async getPositions({ address = null } = {}) {
    const [coreState, builderStates, spotState, catalog] = await Promise.all([
      this._getClearinghouseState({ address }),
      this._getBuilderClearinghouseStates({ address }),
      this._getSpotClearinghouseState({ address }),
      this._getResolvedMarketCatalog(),
    ])

    const corePositions = Array.isArray(coreState?.assetPositions)
      ? coreState.assetPositions
          .map(assetPosition => assetPosition?.position)
          .filter(position => this._parseHyperliquidNumber(position?.szi) !== 0)
          .map(position => this._normalizePosition(position))
      : []

    const builderPositions = builderStates.flatMap(entry => {
      if (!Array.isArray(entry?.state?.assetPositions)) return []
      return entry.state.assetPositions
        .map(assetPosition => assetPosition?.position)
        .filter(position => this._parseHyperliquidNumber(position?.szi) !== 0)
        .map(position => this._normalizePosition(position, { dex: entry.dex }))
    })

    const spotPositions = this._normalizeSpotPositions(spotState, catalog.spot)
    return corePositions.concat(builderPositions, spotPositions)
  }

  async buy(ticker, amount, slippage = 1, options = null) {
    this._requireWallet()
    const { slippage: resolvedSlippage, orderOptions } = this._normalizeTradeRequestArgs(slippage, options)

    const market = await this._resolveMarketDescriptor(ticker)
    if (!Number.isFinite(market?.assetId)) {
      throw new Error(`No tradable asset id for ${market?.ticker || ticker}`)
    }

    const currentPrice = await this.getPrice(market.ticker)

    const slippageMultiplier = 1 + resolvedSlippage / 100
    const price = this._formatOrderPrice(currentPrice * slippageMultiplier, market)
    const size = this._formatOrderSize(amount, market)

    console.log(`[Hyperliquid] buy: ${size} ${market.ticker} @ ${price} (${resolvedSlippage}% slippage)`)

    return this._placeOrder(
      [
        {
          a: market.assetId,
          b: true,
          p: price,
          s: size,
          r: false,
          t: { limit: { tif: 'Ioc' } },
        },
      ],
      orderOptions
    )
  }

  async sell(ticker, amount, slippage = 1, options = null) {
    this._requireWallet()
    const { slippage: resolvedSlippage, orderOptions } = this._normalizeTradeRequestArgs(slippage, options)

    const market = await this._resolveMarketDescriptor(ticker)
    if (!Number.isFinite(market?.assetId)) {
      throw new Error(`No tradable asset id for ${market?.ticker || ticker}`)
    }

    const currentPrice = await this.getPrice(market.ticker)

    const slippageMultiplier = 1 - resolvedSlippage / 100
    const price = this._formatOrderPrice(currentPrice * slippageMultiplier, market)
    const size = this._formatOrderSize(amount, market)

    console.log(`[Hyperliquid] sell: ${size} ${market.ticker} @ ${price} (${resolvedSlippage}% slippage)`)

    return this._placeOrder(
      [
        {
          a: market.assetId,
          b: false,
          p: price,
          s: size,
          r: false,
          t: { limit: { tif: 'Ioc' } },
        },
      ],
      orderOptions
    )
  }

  async closePosition(ticker, slippage = 1, options = null) {
    const { slippage: resolvedSlippage, orderOptions } = this._normalizeTradeRequestArgs(slippage, options)
    const market = await this._resolveMarketDescriptor(ticker)
    const positions = await this.getPositions()
    const position = positions.find(p => p.ticker === market.ticker)

    if (!position) throw new Error(`No open position for ${market.ticker}`)

    console.log(`[Hyperliquid] closePosition: ${market.ticker} size=${position.size}`)

    if (position.size > 0) {
      return this.sell(market.ticker, Math.abs(position.size), resolvedSlippage, orderOptions)
    }
    return this.buy(market.ticker, Math.abs(position.size), resolvedSlippage, orderOptions)
  }

  async updateLeverage(ticker, leverage, options = null) {
    this._requireWallet()

    if (typeof this.exchangeClient?.updateLeverage !== 'function') {
      throw new Error('Hyperliquid leverage updates are unavailable')
    }

    const market = await this._resolveMarketDescriptor(ticker)
    if (market?.marketType !== 'perp') {
      throw new Error(`Leverage is only available for perpetual markets: ${market?.ticker || ticker}`)
    }
    if (!Number.isFinite(market?.assetId)) {
      throw new Error(`No tradable asset id for ${market?.ticker || ticker}`)
    }

    const value = this._normalizeLeverageValue(leverage)
    const { type } = this._normalizeLeverageUpdateOptions(options)

    console.log(`[Hyperliquid] updateLeverage: ${market.ticker} ${value}x (${type})`)

    return this.exchangeClient.updateLeverage({
      asset: market.assetId,
      isCross: type === 'cross',
      leverage: value,
    })
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
    await this._destroyStreams()
    await this._closeStreamTransport()
  }
}
