import { System } from './System'
import {
  HttpTransport,
  InfoClient,
  ExchangeClient,
  WebSocketTransport,
  SubscriptionClient,
} from '@nktkas/hyperliquid'
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
    this.pendingDeposit = false
    this.runtimeAPIs = new Map()
    this.streamTransport = null
    this.streamSubscriptionClient = null
    this.streamTransportClosePromise = null
    this.streams = new Map()
    this.streamListenerId = 0
  }

  init() {
    this.world.inject({
      world: {
        hyperliquid: (...args) => this.getRuntimeAPI(this._resolveInjectedRuntimeArgs(args)),
      },
    })
  }

  _resolveInjectedRuntimeArgs(args = []) {
    if (!args.length) {
      return { owner: null, address: null }
    }

    const [firstArg, secondArg = null] = args
    if (
      firstArg === null ||
      firstArg === undefined ||
      typeof firstArg === 'string' ||
      typeof firstArg === 'number'
    ) {
      return { owner: null, address: firstArg ?? null }
    }

    return {
      owner: firstArg,
      address: secondArg,
    }
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

  _getRuntimeCache(owner, address) {
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
    const runtimeCache = this._getRuntimeCache(owner, boundAddress)
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
      subscribeMids: listener => this.subscribeMids(listener, { owner }),
      subscribeTrades: (params, listener) => this.subscribeTrades(params, listener, { owner }),
      subscribeOrderBook: (params, listener) => this.subscribeOrderBook(params, listener, { owner }),
      subscribeCandles: (params, listener) => this.subscribeCandles(params, listener, { owner }),
      subscribeAccount: listener => this.subscribeAccount(listener, { owner, address: boundAddress }),
      buy: (ticker, amount, slippage) => {
        assertWritableRuntime('buy')
        return this.buy(ticker, amount, slippage)
      },
      sell: (ticker, amount, slippage) => {
        assertWritableRuntime('sell')
        return this.sell(ticker, amount, slippage)
      },
      closePosition: (ticker, slippage) => {
        assertWritableRuntime('closePosition')
        return this.closePosition(ticker, slippage)
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
    const descriptor = this._normalizeTradesStreamParams({ ticker })
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
    const descriptor = this._normalizeOrderBookStreamParams({ ticker, nSigFigs, mantissa })
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
    const descriptor = this._normalizeCandleStreamParams({ ticker, interval })
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

    const parsed =
      typeof value === 'number' && Number.isInteger(value) ? value : Number.parseInt(String(value), 10)
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

  _formatMarketStreamKeyPart(value) {
    return value === null || value === undefined ? 'null' : String(value)
  }

  _parseHyperliquidNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value ?? ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }

  _normalizePosition(position) {
    return {
      ticker: position.coin,
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

  _normalizeTradesStreamParams({ ticker } = {}) {
    const coin = this._normalizeMarketTicker(ticker)
    return {
      ticker: coin,
      coin,
      key: `trades:${coin}`,
    }
  }

  _normalizeOrderBookStreamParams({ ticker, nSigFigs = null, mantissa = null } = {}) {
    const coin = this._normalizeMarketTicker(ticker)
    const aggregation = this._normalizeOrderBookAggregation({ nSigFigs, mantissa })

    return {
      ticker: coin,
      coin,
      nSigFigs: aggregation.nSigFigs,
      mantissa: aggregation.mantissa,
      key: `l2Book:${coin}:${this._formatMarketStreamKeyPart(aggregation.nSigFigs)}:${this._formatMarketStreamKeyPart(
        aggregation.mantissa
      )}`,
    }
  }

  _normalizeCandleStreamParams({ ticker, interval } = {}) {
    const coin = this._normalizeMarketTicker(ticker)
    const normalizedInterval = this._normalizeCandleInterval(interval)

    return {
      ticker: coin,
      coin,
      interval: normalizedInterval,
      key: `candle:${coin}:${normalizedInterval}`,
    }
  }

  async _getMeta() {
    return this.infoClient.meta()
  }

  async _getClearinghouseState({ address = null } = {}) {
    return this.infoClient.clearinghouseState({ user: this._getReadAddress(address) })
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

  // TODO: A future pass can serve getBalance/getPositions from the latest streamed
  // account snapshot when the runtime already has one for its bound target address.
  async getBalance({ address = null } = {}) {
    const state = await this._getClearinghouseState({ address })
    return parseFloat(state?.marginSummary?.accountValue || 0)
  }

  async getPositions({ address = null } = {}) {
    const state = await this._getClearinghouseState({ address })
    if (!state?.assetPositions) return []

    return state.assetPositions
      .map(assetPosition => assetPosition?.position)
      .filter(position => this._parseHyperliquidNumber(position?.szi) !== 0)
      .map(position => this._normalizePosition(position))
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
    await this._destroyStreams()
    await this._closeStreamTransport()
  }
}
