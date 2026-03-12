import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAddress } from 'viem'

import { EVM } from '../../src/core/systems/EVMClient.js'
import { EVM as ServerEVM } from '../../src/core/systems/EVMServer.js'
import { Hyperliquid } from '../../src/core/systems/HyperliquidClient.js'

test('EVM client tracks bound wallet state', () => {
  const evm = new EVM({})

  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    walletAdapter: null,
  })

  assert.equal(evm.getAddress(), '0x00000000000000000000000000000000000000AA')
  assert.equal(evm.isConnected(), true)
})

test('EVM client injects world and player APIs', async () => {
  let injected = null
  const world = {
    inject(runtime) {
      injected = runtime
    },
  }

  const evm = new EVM(world)
  evm.init()
  const runtime = injected.world.evm()
  const arbitrumRuntime = injected.world.evm(42161)

  assert.equal(typeof injected.world.evm, 'function')
  assert.equal(injected.world.evm(), runtime)
  assert.equal(injected.world.evm(42161), arbitrumRuntime)
  assert.equal(runtime.actions, undefined)
  assert.equal(runtime.connect, undefined)
  assert.equal(runtime.disconnect, undefined)
  assert.equal(await runtime.getChainId(), 1)
  assert.equal(await arbitrumRuntime.getChainId(), 42161)
  assert.equal(
    injected.player.evm.get({ data: { custom: { evm: '0x00000000000000000000000000000000000000AA' } } }),
    '0x00000000000000000000000000000000000000AA'
  )
  assert.equal(injected.player.evmChainId.get({ data: { custom: { evmChainId: 42161 } } }), 42161)
  assert.equal(injected.player.evm.get({ data: { custom: { evm: null } } }), null)
  assert.equal(injected.player.evm.get({ data: { custom: null } }), null)
})

test('EVM server injects world and player APIs', async () => {
  let injected = null
  const world = {
    inject(runtime) {
      injected = runtime
    },
  }

  const evm = new ServerEVM(world)
  evm.init()
  const runtime = injected.world.evm()
  const arbitrumRuntime = injected.world.evm(42161)

  assert.equal(typeof injected.world.evm, 'function')
  assert.equal(injected.world.evm(), runtime)
  assert.equal(injected.world.evm(42161), arbitrumRuntime)
  assert.equal(runtime.actions, undefined)
  assert.equal(runtime.sendTransaction, undefined)
  assert.equal(runtime.writeContract, undefined)
  assert.equal(runtime.switchChain, undefined)
  assert.equal(await runtime.getChainId(), 1)
  assert.equal(await arbitrumRuntime.getChainId(), 42161)
  assert.equal(
    injected.player.evm.get({ data: { custom: { evm: '0x00000000000000000000000000000000000000AA' } } }),
    '0x00000000000000000000000000000000000000AA'
  )
  assert.equal(injected.player.evmChainId.get({ data: { custom: { evmChainId: 42161 } } }), 42161)
})

test('EVM client uses fixed-chain public clients for multichain reads', async () => {
  const calls = []
  const evm = new EVM({})
  evm.publicClients.set(42161, {
    async getBalance({ address }) {
      calls.push(['getBalance', address])
      return 1500000000000000000n
    },
    async readContract(params) {
      calls.push(['readContract', params])
      return 2500000n
    },
    async waitForTransactionReceipt({ hash }) {
      calls.push(['waitForTransactionReceipt', hash])
      return { transactionHash: hash }
    },
  })

  const runtime = evm.getRuntimeAPI(42161)
  const address = '0x00000000000000000000000000000000000000AA'

  assert.equal(await runtime.getChainId(), 42161)
  assert.equal(await runtime.getNativeBalance(address), 1.5)
  assert.equal(await runtime.getUSDCBalance(address), 2.5)
  assert.equal(calls[0][0], 'getBalance')
  assert.equal(calls[1][0], 'readContract')
  assert.equal(calls[1][1].address.toLowerCase(), '0xaf88d065e77c8cc2239327c5edb3a432268e5831')
})

test('EVM client keeps unbound reads wallet-backed while chain state is unresolved', async () => {
  const calls = []
  const evm = new EVM({})
  evm.publicClients.set(1, {
    async getBalance() {
      throw new Error('unexpected mainnet balance read')
    },
    async readContract() {
      throw new Error('unexpected mainnet contract read')
    },
    async waitForTransactionReceipt() {
      throw new Error('unexpected mainnet receipt read')
    },
  })
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    chainId: null,
    walletAdapter: {
      async getBalance({ address, request }) {
        calls.push(['getBalance', address, request])
        return 500000000000000000n
      },
      async readContract(params) {
        calls.push(['readContract', params])
        return 25n
      },
      async waitForTransactionReceipt({ hash }) {
        calls.push(['waitForTransactionReceipt', hash])
        return { transactionHash: hash }
      },
    },
  })

  const address = '0x00000000000000000000000000000000000000AA'
  assert.equal(await evm.getNativeBalance(address), 0.5)
  assert.equal(await evm.readContract({ address, abi: [], functionName: 'balanceOf', args: [address] }), 25n)
  assert.equal((await evm.waitForTransactionReceipt({ hash: '0xhash' })).transactionHash, '0xhash')
  assert.deepEqual(
    calls.map(call => call[0]),
    ['getBalance', 'readContract', 'waitForTransactionReceipt']
  )
})

test('EVM client resolves wallet chain before unbound USDC reads', async () => {
  const calls = []
  const evm = new EVM({})
  evm.publicClients.set(42161, {
    async readContract(params) {
      calls.push(['readContract', params])
      return 3500000n
    },
  })
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    chainId: null,
    walletAdapter: {
      async getChainId({ request }) {
        calls.push(['getChainId', request])
        return 42161
      },
    },
  })

  const runtime = evm.getRuntimeAPI()
  const address = '0x00000000000000000000000000000000000000AA'

  assert.equal(await runtime.getUSDCBalance(address), 3.5)
  assert.equal(await runtime.getChainId(), 42161)
  assert.deepEqual(
    calls.map(call => call[0]),
    ['getChainId', 'readContract']
  )
  assert.equal(calls[1][1].address.toLowerCase(), '0xaf88d065e77c8cc2239327c5edb3a432268e5831')
})

test('EVM client fixed-chain writes switch wallet before sending', async () => {
  const calls = []
  let currentChainId = 1
  const evm = new EVM({})
  evm.publicClients.set(42161, {
    async waitForTransactionReceipt({ hash }) {
      calls.push(['waitForTransactionReceipt', hash])
      return { transactionHash: hash }
    },
  })
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    chainId: currentChainId,
    walletAdapter: {
      async getChainId() {
        calls.push(['getChainId', currentChainId])
        return currentChainId
      },
      async switchChain({ chainId }) {
        calls.push(['switchChain', chainId])
        currentChainId = chainId
        return { id: chainId }
      },
      async sendTransaction(params) {
        calls.push(['sendTransaction', params])
        return '0xnativehash'
      },
    },
  })

  const result = await evm.getRuntimeAPI(42161).transferNative(
    '0x00000000000000000000000000000000000000BB',
    '0.25'
  )

  assert.equal(result.hash, '0xnativehash')
  assert.deepEqual(
    calls.map(call => call[0]),
    ['getChainId', 'switchChain', 'sendTransaction', 'waitForTransactionReceipt']
  )
  assert.equal(calls[1][1], 42161)
})

test('EVM client resolves wallet chain before unbound USDC transfers', async () => {
  const calls = []
  const evm = new EVM({})
  evm.publicClients.set(42161, {
    async waitForTransactionReceipt({ hash }) {
      calls.push(['waitForTransactionReceipt', hash])
      return { transactionHash: hash }
    },
  })
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    chainId: null,
    walletAdapter: {
      async getChainId({ request }) {
        calls.push(['getChainId', request])
        return 42161
      },
      async writeContract(params) {
        calls.push(['writeContract', params])
        return '0xusdchash'
      },
    },
  })

  const result = await evm.transferUSDC('0x00000000000000000000000000000000000000CC', '1.5')

  assert.equal(result.hash, '0xusdchash')
  assert.deepEqual(
    calls.map(call => call[0]),
    ['getChainId', 'getChainId', 'writeContract', 'waitForTransactionReceipt']
  )
  assert.equal(calls[2][1].address.toLowerCase(), '0xaf88d065e77c8cc2239327c5edb3a432268e5831')
})

test('EVM client transfers native token via wallet adapter', async () => {
  const calls = []
  const evm = new EVM({})
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    walletAdapter: {
      async sendTransaction(params) {
        calls.push(['sendTransaction', params])
        return '0xnativehash'
      },
      async waitForTransactionReceipt({ hash }) {
        calls.push(['waitForTransactionReceipt', hash])
        return { transactionHash: hash }
      },
    },
  })

  const result = await evm.transferNative('0x00000000000000000000000000000000000000BB', '0.25')
  assert.equal(result.hash, '0xnativehash')
  assert.equal(calls[0][0], 'sendTransaction')
  assert.equal(calls[0][1].to.toLowerCase(), '0x00000000000000000000000000000000000000bb')
  assert.equal(typeof calls[0][1].value, 'bigint')
  assert.equal(calls[1][0], 'waitForTransactionReceipt')
  assert.equal(calls[1][1], '0xnativehash')
})

test('EVM client transfers USDC via ERC20 transfer', async () => {
  const calls = []
  const evm = new EVM({})
  evm.publicClients.set(42161, {
    async waitForTransactionReceipt({ hash }) {
      calls.push(['waitForTransactionReceipt', hash])
      return { transactionHash: hash }
    },
  })
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    chainId: 42161,
    walletAdapter: {
      async getChainId() {
        return 42161
      },
      async writeContract(params) {
        calls.push(['writeContract', params])
        return '0xusdchash'
      },
    },
  })

  const result = await evm.transferUSDC('0x00000000000000000000000000000000000000CC', '1.5')
  assert.equal(result.hash, '0xusdchash')
  assert.equal(calls[0][0], 'writeContract')
  assert.equal(calls[0][1].address.toLowerCase(), '0xaf88d065e77c8cc2239327c5edb3a432268e5831')
  assert.equal(calls[0][1].functionName, 'transfer')
  assert.equal(calls[0][1].args[0].toLowerCase(), '0x00000000000000000000000000000000000000cc')
  assert.equal(calls[0][1].args[1], 1500000n)
  assert.equal(calls[1][0], 'waitForTransactionReceipt')
  assert.equal(calls[1][1], '0xusdchash')
})

test('EVM client syncs connected wallet state into player custom data', () => {
  const sent = []
  const modified = []
  const player = {
    data: {
      id: 'player-1',
      custom: {
        nickname: 'tester',
      },
    },
    modify(patch) {
      modified.push(patch)
      this.data = { ...this.data, ...patch }
    },
  }
  const evm = new EVM({
    network: {
      id: 'player-1',
      isClient: true,
      ws: { readyState: 1 },
      send(name, data) {
        sent.push([name, data])
      },
    },
    entities: { player },
  })

  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    walletAdapter: {},
    chainId: 42161,
  })

  evm.bind({
    address: '0x00000000000000000000000000000000000000BB',
    isConnected: true,
    walletAdapter: {},
    chainId: 42161,
  })

  assert.deepEqual(modified[0], {
    custom: {
      nickname: 'tester',
      evm: getAddress('0x00000000000000000000000000000000000000AA'),
      evmChainId: 42161,
    },
  })
  assert.deepEqual(sent[0], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        nickname: 'tester',
        evm: getAddress('0x00000000000000000000000000000000000000AA'),
        evmChainId: 42161,
      },
    },
  ])

  assert.deepEqual(modified[1], {
    custom: {
      nickname: 'tester',
      evm: '0x00000000000000000000000000000000000000BB',
      evmChainId: 42161,
    },
  })
  assert.deepEqual(sent[1], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        nickname: 'tester',
        evm: '0x00000000000000000000000000000000000000BB',
        evmChainId: 42161,
      },
    },
  ])

  evm.bind({
    address: null,
    isConnected: false,
    walletAdapter: {},
    chainId: null,
  })

  assert.deepEqual(modified[2], {
    custom: {
      nickname: 'tester',
      evm: null,
      evmChainId: null,
    },
  })
  assert.deepEqual(sent[2], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        nickname: 'tester',
        evm: null,
        evmChainId: null,
      },
    },
  ])
})

test('EVM client does not resync when wallet address is unchanged', () => {
  const sent = []
  const modified = []
  const player = {
    data: {
      id: 'player-1',
      custom: null,
    },
    modify(patch) {
      modified.push(patch)
      this.data = { ...this.data, ...patch }
    },
  }
  const evm = new EVM({
    network: {
      id: 'player-1',
      isClient: true,
      ws: { readyState: 1 },
      send(name, data) {
        sent.push([name, data])
      },
    },
    entities: { player },
  })

  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    walletAdapter: {},
    chainId: 42161,
  })

  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    walletAdapter: {},
    chainId: 42161,
  })

  assert.deepEqual(modified[0], {
    custom: {
      evm: getAddress('0x00000000000000000000000000000000000000AA'),
      evmChainId: 42161,
    },
  })
  assert.deepEqual(sent[0], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        evm: getAddress('0x00000000000000000000000000000000000000AA'),
        evmChainId: 42161,
      },
    },
  ])
  assert.equal(modified.length, 1)
  assert.equal(sent.length, 1)
})

test('Hyperliquid returns sorted ticker list', async () => {
  const hl = new Hyperliquid({})
  hl.infoClient = {
    async meta() {
      return {
        universe: [{ name: 'SOL' }, { name: 'BTC' }, { name: 'ETH' }],
      }
    },
  }

  const tickers = await hl.getAvailableTickers()
  assert.deepEqual(tickers, ['BTC', 'ETH', 'SOL'])
})

test('Hyperliquid injects a stable runtime API per owner and address', () => {
  let injected = null
  const world = {
    inject(runtime) {
      injected = runtime
    },
  }

  const hl = new Hyperliquid(world)
  hl.init()

  const ownerA = { id: 'app-a' }
  const ownerB = { id: 'app-b' }
  const watchedAddress = '0x00000000000000000000000000000000000000AA'
  const secondWatchedAddress = '0x00000000000000000000000000000000000000BB'
  const defaultRuntime = injected.world.hyperliquid()
  const otherDefaultRuntime = injected.world.hyperliquid()
  const watchedRuntime = injected.world.hyperliquid(watchedAddress)
  const sameWatchedRuntime = injected.world.hyperliquid(` ${watchedAddress.toLowerCase()} `)
  const secondWatchedRuntime = injected.world.hyperliquid(secondWatchedAddress)
  const ownerADefaultRuntime = hl.getRuntimeAPI(ownerA)
  const ownerAWatchRuntime = hl.getRuntimeAPI(ownerA, watchedAddress)
  const ownerASecondWatchRuntime = hl.getRuntimeAPI({
    owner: ownerA,
    address: ` ${watchedAddress.toLowerCase()} `,
  })
  const ownerBWatchRuntime = hl.getRuntimeAPI(ownerB, watchedAddress)

  assert.equal(typeof injected.world.hyperliquid, 'function')
  assert.equal(defaultRuntime, otherDefaultRuntime)
  assert.equal(watchedRuntime, sameWatchedRuntime)
  assert.notEqual(defaultRuntime, watchedRuntime)
  assert.notEqual(watchedRuntime, secondWatchedRuntime)
  assert.equal(ownerAWatchRuntime, ownerASecondWatchRuntime)
  assert.notEqual(ownerADefaultRuntime, ownerAWatchRuntime)
  assert.notEqual(ownerAWatchRuntime, ownerBWatchRuntime)
  assert.equal(typeof ownerAWatchRuntime.getPrice, 'function')
  assert.equal(typeof ownerAWatchRuntime.subscribeMids, 'function')
  assert.equal(typeof ownerAWatchRuntime.subscribeTrades, 'function')
  assert.equal(typeof ownerAWatchRuntime.subscribeOrderBook, 'function')
  assert.equal(typeof ownerAWatchRuntime.subscribeCandles, 'function')
  assert.equal(typeof ownerAWatchRuntime.buy, 'function')
  assert.equal(typeof ownerAWatchRuntime.withdraw, 'function')
})

test('Hyperliquid runtime pull reads use the bound target address', async () => {
  const calls = []
  const hl = new Hyperliquid({})
  hl.infoClient = {
    async clearinghouseState({ user }) {
      calls.push(user)
      return {
        marginSummary: {
          accountValue: '1234.56',
        },
        assetPositions: [
          {
            position: {
              coin: 'ETH',
              szi: '1.25',
              entryPx: '2100',
              unrealizedPnl: '15.5',
              liquidationPx: '1800',
            },
          },
        ],
      }
    },
  }

  hl.bind({
    address: '0x00000000000000000000000000000000000000CC',
    isConnected: false,
  })

  const watchedRuntime = hl.getRuntimeAPI(' 0x00000000000000000000000000000000000000aa ')

  assert.equal(await watchedRuntime.getBalance(), 1234.56)
  assert.deepEqual(await watchedRuntime.getPositions(), [
    {
      ticker: 'ETH',
      size: 1.25,
      entryPrice: 2100,
      unrealizedPnl: 15.5,
      liquidationPrice: 1800,
    },
  ])
  assert.deepEqual(calls, [
    getAddress('0x00000000000000000000000000000000000000aa'),
    getAddress('0x00000000000000000000000000000000000000aa'),
  ])
})

function createHyperliquidMarketStreamHarness(methodNames, world = {}) {
  const hl = new Hyperliquid(world)
  const calls = []
  const failureSignal = { pending: true }
  const transport = {
    closeCalls: 0,
    async close() {
      this.closeCalls += 1
    },
  }
  const client = {}
  let transportCreations = 0
  let clientCreations = 0

  for (const methodName of methodNames) {
    client[methodName] = (...args) => {
      const onPayload = args[args.length - 1]
      const params = args.length === 2 ? args[0] : null
      const call = {
        methodName,
        params,
        onPayload,
        unsubscribeCalls: 0,
      }
      calls.push(call)

      return {
        failureSignal,
        async unsubscribe() {
          call.unsubscribeCalls += 1
        },
      }
    }
  }

  hl._createStreamTransport = () => {
    transportCreations += 1
    return transport
  }
  hl._createStreamSubscriptionClient = providedTransport => {
    clientCreations += 1
    assert.equal(providedTransport, transport)
    return client
  }

  return {
    hl,
    calls,
    failureSignal,
    transport,
    getTransportCreations() {
      return transportCreations
    },
    getClientCreations() {
      return clientCreations
    },
  }
}

function createClearinghouseStateEvent(user, overrides = {}) {
  return {
    user,
    dex: '',
    clearinghouseState: {
      marginSummary: {
        accountValue: '1000',
        totalNtlPos: '1500',
        totalRawUsd: '1000',
        totalMarginUsed: '45',
      },
      crossMarginSummary: {
        accountValue: '1000',
        totalNtlPos: '1500',
        totalRawUsd: '1000',
        totalMarginUsed: '45',
      },
      crossMaintenanceMarginUsed: '10',
      withdrawable: '955',
      assetPositions: [
        {
          type: 'oneWay',
          position: {
            coin: 'BTC',
            szi: '0.01',
            leverage: { type: 'cross', value: 5 },
            entryPx: '100000',
            positionValue: '1000',
            unrealizedPnl: '12.5',
            returnOnEquity: '0.12',
            liquidationPx: '90000',
            marginUsed: '20',
            maxLeverage: 40,
            cumFunding: {
              allTime: '1',
              sinceOpen: '0.5',
              sinceChange: '0.2',
            },
          },
        },
      ],
      time: 1700000000000,
      ...overrides,
    },
  }
}

test('Hyperliquid lazily creates and closes a shared stream transport', async () => {
  const hl = new Hyperliquid({})
  const transport = {
    closeCalls: 0,
    async close() {
      this.closeCalls += 1
    },
  }
  let transportCreations = 0
  let clientCreations = 0

  hl._createStreamTransport = () => {
    transportCreations += 1
    return transport
  }
  hl._createStreamSubscriptionClient = providedTransport => {
    clientCreations += 1
    return { transport: providedTransport }
  }

  assert.equal(hl.streamTransport, null)
  assert.equal(hl.streamSubscriptionClient, null)

  const client = hl._getStreamSubscriptionClient()
  const secondClient = hl._getStreamSubscriptionClient()

  assert.equal(client, secondClient)
  assert.equal(client.transport, transport)
  assert.equal(transportCreations, 1)
  assert.equal(clientCreations, 1)

  await hl.destroy()

  assert.equal(transport.closeCalls, 1)
  assert.equal(hl.streamTransport, null)
  assert.equal(hl.streamSubscriptionClient, null)

  await hl.destroy()
  assert.equal(transport.closeCalls, 1)
})

test('Hyperliquid tracks many local listeners on one shared stream entry', () => {
  const hl = new Hyperliquid({})
  const entry = hl._ensureStreamEntry({
    key: 'allMids',
    channel: 'allMids',
    flushMode: 'latest',
  })
  const sameEntry = hl._ensureStreamEntry({
    key: 'allMids',
    channel: 'allMids',
    flushMode: 'latest',
  })
  const firstListener = hl._addStreamListener(entry, () => {})
  const secondListener = hl._addStreamListener(sameEntry, () => {})

  assert.equal(entry, sameEntry)
  assert.equal(hl.streams.size, 1)
  assert.equal(entry.listeners.size, 2)
  assert.equal(entry.listeners.get(firstListener.id), firstListener)
  assert.equal(entry.listeners.get(secondListener.id), secondListener)
  assert.equal(entry.upstreamSubscription, null)
  assert.equal(entry.pendingLatest, undefined)
  assert.deepEqual(entry.pendingEvents, [])
})

test('Hyperliquid normalizes market stream params into deterministic keys', () => {
  const hl = new Hyperliquid({})

  const trades = hl._normalizeTradesStreamParams({ ticker: ' btc ' })
  const orderBook = hl._normalizeOrderBookStreamParams({
    ticker: ' eth ',
    nSigFigs: '3',
    mantissa: '2',
  })
  const orderBookWithSigFigsFive = hl._normalizeOrderBookStreamParams({
    ticker: 'eth',
    nSigFigs: 5,
    mantissa: '2',
  })
  const candles = hl._normalizeCandleStreamParams({ ticker: ' sol ', interval: '1m' })

  assert.equal(hl._getAllMidsStreamKey(), 'allMids')
  assert.deepEqual(trades, {
    ticker: 'BTC',
    coin: 'BTC',
    key: 'trades:BTC',
  })
  assert.deepEqual(orderBook, {
    ticker: 'ETH',
    coin: 'ETH',
    nSigFigs: 3,
    mantissa: null,
    key: 'l2Book:ETH:3:null',
  })
  assert.deepEqual(orderBookWithSigFigsFive, {
    ticker: 'ETH',
    coin: 'ETH',
    nSigFigs: 5,
    mantissa: 2,
    key: 'l2Book:ETH:5:2',
  })
  assert.deepEqual(candles, {
    ticker: 'SOL',
    coin: 'SOL',
    interval: '1m',
    key: 'candle:SOL:1m',
  })
  assert.throws(() => hl._normalizeCandleStreamParams({ ticker: 'SOL', interval: '10m' }), {
    message: 'Invalid Hyperliquid candle interval: 10m',
  })
})

test('Hyperliquid normalizes watched account addresses into deterministic stream keys', () => {
  const hl = new Hyperliquid({})
  hl.bind({
    address: '0x00000000000000000000000000000000000000CC',
    isConnected: false,
  })

  const explicit = hl._normalizeAccountStreamParams({
    address: ' 0x00000000000000000000000000000000000000aa ',
  })
  const connectedWallet = hl._normalizeAccountStreamParams()

  assert.deepEqual(explicit, {
    address: getAddress('0x00000000000000000000000000000000000000aa'),
    user: getAddress('0x00000000000000000000000000000000000000aa'),
    key: `clearinghouseState:${getAddress('0x00000000000000000000000000000000000000aa')}`,
  })
  assert.deepEqual(connectedWallet, {
    address: getAddress('0x00000000000000000000000000000000000000CC'),
    user: getAddress('0x00000000000000000000000000000000000000CC'),
    key: `clearinghouseState:${getAddress('0x00000000000000000000000000000000000000CC')}`,
  })
  assert.throws(() => hl._normalizeAccountStreamParams({ address: 'invalid-address' }), {
    message: 'Invalid address',
  })
})

test('Hyperliquid normalizes clearinghouse snapshots into scripting account payloads', () => {
  const hl = new Hyperliquid({})
  const snapshot = hl._normalizeAccountSnapshotEvent({
    user: '0x00000000000000000000000000000000000000AA',
    clearinghouseState: {
      marginSummary: {
        accountValue: '1234.56',
        totalNtlPos: '4567.89',
        totalRawUsd: '1234.56',
        totalMarginUsed: '34.44',
      },
      crossMarginSummary: {
        accountValue: '1234.56',
        totalNtlPos: '4567.89',
        totalRawUsd: '1234.56',
        totalMarginUsed: '34.44',
      },
      crossMaintenanceMarginUsed: '12.34',
      withdrawable: '1200.12',
      assetPositions: [
        {
          type: 'oneWay',
          position: {
            coin: 'BTC',
            szi: '0.001',
            leverage: { type: 'cross', value: 5 },
            entryPx: '104000',
            positionValue: '104',
            unrealizedPnl: '5.25',
            returnOnEquity: '0.15',
            liquidationPx: '95000',
            marginUsed: '15.2',
            maxLeverage: 40,
            cumFunding: {
              allTime: '1.1',
              sinceOpen: '0.5',
              sinceChange: '0.2',
            },
          },
        },
        {
          type: 'oneWay',
          position: {
            coin: 'ETH',
            szi: '0',
            leverage: { type: 'cross', value: 3 },
            entryPx: '2100',
            positionValue: '0',
            unrealizedPnl: '0',
            returnOnEquity: '0',
            liquidationPx: null,
            marginUsed: '0',
            maxLeverage: 25,
            cumFunding: {
              allTime: '0',
              sinceOpen: '0',
              sinceChange: '0',
            },
          },
        },
        {
          type: 'oneWay',
          position: {
            coin: 'SOL',
            szi: '-2',
            leverage: { type: 'isolated', value: 3, rawUsd: '20' },
            entryPx: '150',
            positionValue: '300',
            unrealizedPnl: '-8.5',
            returnOnEquity: '-0.1',
            liquidationPx: null,
            marginUsed: '20',
            maxLeverage: 10,
            cumFunding: {
              allTime: '-0.5',
              sinceOpen: '-0.2',
              sinceChange: '-0.1',
            },
          },
        },
      ],
      time: 1700000000000,
    },
  })

  assert.deepEqual(snapshot, {
    address: getAddress('0x00000000000000000000000000000000000000AA'),
    accountValue: 1234.56,
    withdrawable: 1200.12,
    totalMarginUsed: 34.44,
    totalNotionalPosition: 4567.89,
    positions: [
      {
        ticker: 'BTC',
        size: 0.001,
        entryPrice: 104000,
        unrealizedPnl: 5.25,
        liquidationPrice: 95000,
        marginUsed: 15.2,
        maxLeverage: 40,
        leverage: { type: 'cross', value: 5 },
      },
      {
        ticker: 'SOL',
        size: -2,
        entryPrice: 150,
        unrealizedPnl: -8.5,
        liquidationPrice: null,
        marginUsed: 20,
        maxLeverage: 10,
        leverage: { type: 'isolated', value: 3 },
      },
    ],
    timestamp: 1700000000000,
  })
})

test('Hyperliquid reuses one upstream clearinghouseState stream per normalized address', async () => {
  const { hl, calls, failureSignal } = createHyperliquidMarketStreamHarness(['clearinghouseState'])
  const watchedAddress = getAddress('0x00000000000000000000000000000000000000AA')
  const firstReceived = []
  const secondReceived = []

  const first = await hl.subscribeAccount(payload => firstReceived.push(payload), {
    address: watchedAddress,
  })
  const second = await hl.subscribeAccount(payload => secondReceived.push(payload), {
    address: ` ${watchedAddress.toLowerCase()} `,
  })

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, { user: watchedAddress })
  assert.equal(first.failureSignal, failureSignal)
  assert.equal(second.failureSignal, failureSignal)
  assert.equal(hl.streams.size, 1)

  calls[0].onPayload(
    createClearinghouseStateEvent(watchedAddress, {
      marginSummary: {
        accountValue: '1000',
        totalNtlPos: '1500',
        totalRawUsd: '1000',
        totalMarginUsed: '45',
      },
      withdrawable: '955',
      time: 1700000000000,
    })
  )
  calls[0].onPayload(
    createClearinghouseStateEvent(watchedAddress, {
      marginSummary: {
        accountValue: '1100',
        totalNtlPos: '1600',
        totalRawUsd: '1100',
        totalMarginUsed: '50',
      },
      withdrawable: '1040',
      time: 1700000001234,
    })
  )

  assert.deepEqual(firstReceived, [])
  assert.deepEqual(secondReceived, [])

  hl.update()

  assert.deepEqual(firstReceived, [
    {
      address: watchedAddress,
      accountValue: 1100,
      withdrawable: 1040,
      totalMarginUsed: 50,
      totalNotionalPosition: 1600,
      positions: [
        {
          ticker: 'BTC',
          size: 0.01,
          entryPrice: 100000,
          unrealizedPnl: 12.5,
          liquidationPrice: 90000,
          marginUsed: 20,
          maxLeverage: 40,
          leverage: { type: 'cross', value: 5 },
        },
      ],
      timestamp: 1700000001234,
    },
  ])
  assert.deepEqual(secondReceived, firstReceived)

  await first.unsubscribe()
  assert.equal(calls[0].unsubscribeCalls, 0)
  assert.equal(hl.streams.size, 1)

  await second.unsubscribe()
  assert.equal(calls[0].unsubscribeCalls, 1)
  assert.equal(hl.streams.size, 0)
})

test('Hyperliquid runtime subscribeAccount binds the default or addressed target', async () => {
  let injected = null
  const { hl, calls } = createHyperliquidMarketStreamHarness(['clearinghouseState'], {
    inject(runtime) {
      injected = runtime
    },
  })
  hl.init()
  hl.bind({
    address: '0x00000000000000000000000000000000000000CC',
    isConnected: false,
  })

  const defaultReceived = []
  const watchedReceived = []

  await injected.world.hyperliquid().subscribeAccount(payload => defaultReceived.push(payload))
  await injected.world.hyperliquid('0x00000000000000000000000000000000000000AA').subscribeAccount(payload =>
    watchedReceived.push(payload)
  )

  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(call => call.params), [
    { user: getAddress('0x00000000000000000000000000000000000000CC') },
    { user: getAddress('0x00000000000000000000000000000000000000AA') },
  ])

  calls[0].onPayload(
    createClearinghouseStateEvent(getAddress('0x00000000000000000000000000000000000000CC'), {
      marginSummary: {
        accountValue: '900',
        totalNtlPos: '1200',
        totalRawUsd: '900',
        totalMarginUsed: '35',
      },
      withdrawable: '865',
      time: 1700000002000,
    })
  )
  calls[1].onPayload(
    createClearinghouseStateEvent(getAddress('0x00000000000000000000000000000000000000AA'), {
      marginSummary: {
        accountValue: '1500',
        totalNtlPos: '2000',
        totalRawUsd: '1500',
        totalMarginUsed: '60',
      },
      withdrawable: '1440',
      time: 1700000003000,
    })
  )

  hl.update()

  assert.equal(defaultReceived[0].address, getAddress('0x00000000000000000000000000000000000000CC'))
  assert.equal(defaultReceived[0].accountValue, 900)
  assert.equal(watchedReceived[0].address, getAddress('0x00000000000000000000000000000000000000AA'))
  assert.equal(watchedReceived[0].accountValue, 1500)
})

test('Hyperliquid addressed runtimes are watch-only for write methods', async () => {
  const hl = new Hyperliquid({})
  const defaultRuntime = hl.getRuntimeAPI()
  const watchedRuntime = hl.getRuntimeAPI('0x00000000000000000000000000000000000000AA')

  let buyCalls = 0
  let hasAgentKeyCalls = 0
  hl.buy = async () => {
    buyCalls += 1
    return 'buy-ok'
  }
  hl.hasAgentKey = () => {
    hasAgentKeyCalls += 1
    return true
  }

  assert.equal(await defaultRuntime.buy('BTC', 1, 1), 'buy-ok')
  assert.equal(defaultRuntime.hasAgentKey(), true)
  assert.equal(buyCalls, 1)
  assert.equal(hasAgentKeyCalls, 1)

  await assert.rejects(async () => watchedRuntime.buy('BTC', 1, 1), {
    message: 'Hyperliquid addressed runtimes are watch-only; buy is only available on world.hyperliquid()',
  })
  await assert.rejects(async () => watchedRuntime.sell('BTC', 1, 1), {
    message: 'Hyperliquid addressed runtimes are watch-only; sell is only available on world.hyperliquid()',
  })
  await assert.rejects(async () => watchedRuntime.closePosition('BTC', 1), {
    message:
      'Hyperliquid addressed runtimes are watch-only; closePosition is only available on world.hyperliquid()',
  })
  await assert.rejects(async () => watchedRuntime.deposit(10), {
    message: 'Hyperliquid addressed runtimes are watch-only; deposit is only available on world.hyperliquid()',
  })
  await assert.rejects(async () => watchedRuntime.withdraw(10, '0x00000000000000000000000000000000000000BB'), {
    message: 'Hyperliquid addressed runtimes are watch-only; withdraw is only available on world.hyperliquid()',
  })
  await assert.rejects(async () => watchedRuntime.setupAgentKey('Agent'), {
    message:
      'Hyperliquid addressed runtimes are watch-only; setupAgentKey is only available on world.hyperliquid()',
  })
  assert.throws(() => watchedRuntime.hasAgentKey(), {
    message: 'Hyperliquid addressed runtimes are watch-only; hasAgentKey is only available on world.hyperliquid()',
  })
})

test('Hyperliquid reuses one upstream stream per key and tears it down on final unsubscribe', async () => {
  const { hl, calls, failureSignal } = createHyperliquidMarketStreamHarness(['allMids'])
  const firstReceived = []
  const secondReceived = []

  const first = await hl.subscribeMids(payload => firstReceived.push(payload))
  const second = await hl.subscribeMids(payload => secondReceived.push(payload))

  assert.equal(calls.length, 1)
  assert.equal(first.failureSignal, failureSignal)
  assert.equal(second.failureSignal, failureSignal)
  assert.equal(hl.streams.size, 1)

  calls[0].onPayload({ mids: { BTC: '101000' } })
  assert.deepEqual(firstReceived, [])
  assert.deepEqual(secondReceived, [])

  hl.update()
  assert.deepEqual(firstReceived, [{ mids: { BTC: '101000' } }])
  assert.deepEqual(secondReceived, [{ mids: { BTC: '101000' } }])

  await first.unsubscribe()
  assert.equal(calls[0].unsubscribeCalls, 0)
  assert.equal(hl.streams.size, 1)

  await second.unsubscribe()
  assert.equal(calls[0].unsubscribeCalls, 1)
  assert.equal(hl.streams.size, 0)

  await second.unsubscribe()
  assert.equal(calls[0].unsubscribeCalls, 1)
})

test('Hyperliquid coalesces mids, order book, and candle payloads until update', async () => {
  const { hl, calls } = createHyperliquidMarketStreamHarness(['allMids', 'l2Book', 'candle'])
  const midsReceived = []
  const orderBookReceived = []
  const candlesReceived = []

  await hl.subscribeMids(payload => midsReceived.push(payload))
  await hl.subscribeOrderBook({ ticker: ' eth ', nSigFigs: '5', mantissa: '2' }, payload =>
    orderBookReceived.push(payload)
  )
  await hl.subscribeCandles({ ticker: ' sol ', interval: '1m' }, payload => candlesReceived.push(payload))

  assert.equal(calls.length, 3)
  assert.deepEqual(calls.map(call => [call.methodName, call.params]), [
    ['allMids', null],
    ['l2Book', { coin: 'ETH', nSigFigs: 5, mantissa: 2 }],
    ['candle', { coin: 'SOL', interval: '1m' }],
  ])

  calls[0].onPayload({ mids: { BTC: '101000' } })
  calls[0].onPayload({ mids: { BTC: '102000' } })
  calls[1].onPayload({ levels: [['buy-1']] })
  calls[1].onPayload({ levels: [['buy-2']] })
  calls[2].onPayload({ c: '10' })
  calls[2].onPayload({ c: '11' })

  assert.deepEqual(midsReceived, [])
  assert.deepEqual(orderBookReceived, [])
  assert.deepEqual(candlesReceived, [])

  hl.update()

  assert.deepEqual(midsReceived, [{ mids: { BTC: '102000' } }])
  assert.deepEqual(orderBookReceived, [{ levels: [['buy-2']] }])
  assert.deepEqual(candlesReceived, [{ c: '11' }])
})

test('Hyperliquid flushes trades in arrival order during update', async () => {
  const { hl, calls } = createHyperliquidMarketStreamHarness(['trades'])
  const received = []

  await hl.subscribeTrades({ ticker: ' btc ' }, payload => received.push(payload))

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, { coin: 'BTC' })

  calls[0].onPayload([{ px: '101000' }])
  calls[0].onPayload([{ px: '102000' }])
  calls[0].onPayload([{ px: '103000' }])

  assert.deepEqual(received, [])

  hl.update()

  assert.deepEqual(received, [
    [{ px: '101000' }],
    [{ px: '102000' }],
    [{ px: '103000' }],
  ])
})

test('Hyperliquid prunes dead owner listeners automatically', async () => {
  const { hl, calls } = createHyperliquidMarketStreamHarness(['allMids'])
  const deadHook = { dead: false }
  const owner = {
    getDeadHook() {
      return deadHook
    },
  }
  const received = []
  const runtime = hl.getRuntimeAPI(owner)

  await runtime.subscribeMids(payload => received.push(payload))
  assert.equal(calls.length, 1)

  calls[0].onPayload({ mids: { BTC: '101000' } })
  hl.update()
  assert.deepEqual(received, [{ mids: { BTC: '101000' } }])
  assert.equal(hl.streams.size, 1)

  deadHook.dead = true
  calls[0].onPayload({ mids: { BTC: '102000' } })
  hl.update()
  await Promise.resolve()

  assert.deepEqual(received, [{ mids: { BTC: '101000' } }])
  assert.equal(calls[0].unsubscribeCalls, 1)
  assert.equal(hl.streams.size, 0)
})

test('Hyperliquid destroy unsubscribes market streams and closes the transport', async () => {
  const { hl, calls, transport, getTransportCreations, getClientCreations } =
    createHyperliquidMarketStreamHarness(['allMids', 'trades'])

  await hl.subscribeMids(() => {})
  await hl.subscribeTrades({ ticker: 'ETH' }, () => {})

  assert.equal(hl.streams.size, 2)
  assert.equal(getTransportCreations(), 1)
  assert.equal(getClientCreations(), 1)

  await hl.destroy()

  assert.equal(calls.length, 2)
  assert.equal(calls[0].unsubscribeCalls, 1)
  assert.equal(calls[1].unsubscribeCalls, 1)
  assert.equal(transport.closeCalls, 1)
  assert.equal(hl.streams.size, 0)
  assert.equal(hl.streamTransport, null)
  assert.equal(hl.streamSubscriptionClient, null)

  await hl.destroy()
  assert.equal(transport.closeCalls, 1)
})

test('Hyperliquid deposit uses wallet adapter contract operations', async () => {
  const calls = []

  const walletAdapter = {
    async getChainId() {
      calls.push(['getChainId'])
      return 42161
    },
    async switchChain() {
      calls.push(['switchChain'])
    },
    async readContract(params) {
      calls.push(['readContract', params.functionName])
      if (params.functionName === 'balanceOf') return 15_000_000n
      if (params.functionName === 'allowance') return 0n
      throw new Error(`Unexpected read contract fn: ${params.functionName}`)
    },
    async writeContract(params) {
      calls.push(['writeContract', params.functionName])
      if (params.functionName === 'approve') return '0xapprove'
      if (params.functionName === 'transfer') return '0xtransfer'
      throw new Error(`Unexpected write contract fn: ${params.functionName}`)
    },
    async waitForTransactionReceipt({ hash }) {
      calls.push(['waitForTransactionReceipt', hash])
      return { transactionHash: `${hash}-receipt` }
    },
    async signTypedData() {
      return '0x'
    },
  }

  const hl = new Hyperliquid({})
  hl.bind({
    address: '0x00000000000000000000000000000000000000AA',
    walletAdapter,
    isConnected: true,
  })

  const result = await hl.deposit(10)

  assert.equal(result.status, 'ok')
  assert.equal(result.txHash, '0xtransfer-receipt')
  assert.equal(calls.some(call => call[0] === 'switchChain'), false)
  assert.deepEqual(
    calls.filter(call => call[0] === 'readContract').map(call => call[1]),
    ['balanceOf', 'allowance']
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'writeContract').map(call => call[1]),
    ['approve', 'transfer']
  )
})

test('Hyperliquid deposit switches to Arbitrum when needed', async () => {
  let chainId = 1
  let switchCount = 0

  const walletAdapter = {
    async getChainId() {
      return chainId
    },
    async switchChain() {
      switchCount += 1
      chainId = 42161
    },
    async readContract(params) {
      if (params.functionName === 'balanceOf') return 20_000_000n
      if (params.functionName === 'allowance') return 20_000_000n
      throw new Error(`Unexpected read contract fn: ${params.functionName}`)
    },
    async writeContract() {
      return '0xtransfer'
    },
    async waitForTransactionReceipt() {
      return { transactionHash: '0xtransfer' }
    },
    async signTypedData() {
      return '0x'
    },
  }

  const hl = new Hyperliquid({})
  hl.bind({
    address: '0x00000000000000000000000000000000000000BB',
    walletAdapter,
    isConnected: true,
  })

  await hl.deposit(10)
  assert.equal(switchCount, 1)
})

test('Hyperliquid sets hardcoded referrer when none exists', async () => {
  const hl = new Hyperliquid({})
  hl.address = '0x00000000000000000000000000000000000000AA'
  hl.wallet = {
    address: hl.address,
    async signTypedData() {
      return '0x'
    },
  }

  let setReferrerCode = null
  hl.infoClient = {
    async referral() {
      return { referredBy: null }
    },
  }
  hl._createUserExchangeClient = () => ({
    async setReferrer({ code }) {
      setReferrerCode = code
      return { status: 'ok' }
    },
  })

  await hl._setConfiguredReferrerIfNeeded()
  assert.equal(setReferrerCode, 'LOBBY')
})

test('Hyperliquid does not set hardcoded referrer when already referred', async () => {
  const hl = new Hyperliquid({})
  hl.address = '0x00000000000000000000000000000000000000AA'
  hl.wallet = {
    address: hl.address,
    async signTypedData() {
      return '0x'
    },
  }

  let setReferrerCalled = false
  hl.infoClient = {
    async referral() {
      return {
        referredBy: {
          referrer: '0x00000000000000000000000000000000000000BB',
          code: 'OTHERCODE',
        },
      }
    },
  }
  hl._createUserExchangeClient = () => ({
    async setReferrer() {
      setReferrerCalled = true
      return { status: 'ok' }
    },
  })

  await hl._setConfiguredReferrerIfNeeded()
  assert.equal(setReferrerCalled, false)
})
