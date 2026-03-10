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

test('EVM client injects world and player APIs', () => {
  let injected = null
  const world = {
    inject(runtime) {
      injected = runtime
    },
  }

  const evm = new EVM(world)
  evm.init()
  const runtime = injected.world.evm()

  assert.equal(typeof injected.world.evm, 'function')
  assert.equal(injected.world.evm(), runtime)
  assert.equal(runtime.actions, undefined)
  assert.equal(runtime.connect, undefined)
  assert.equal(runtime.disconnect, undefined)
  assert.equal(
    injected.player.evm.get({ data: { custom: { evm: '0x00000000000000000000000000000000000000AA' } } }),
    '0x00000000000000000000000000000000000000AA'
  )
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

  assert.equal(typeof injected.world.evm, 'function')
  assert.equal(injected.world.evm(), runtime)
  assert.equal(runtime.actions, undefined)
  assert.equal(runtime.sendTransaction, undefined)
  assert.equal(runtime.writeContract, undefined)
  assert.equal(runtime.switchChain, undefined)
  assert.equal(await runtime.getChainId(), evm.chain.id)
  assert.equal(
    injected.player.evm.get({ data: { custom: { evm: '0x00000000000000000000000000000000000000AA' } } }),
    '0x00000000000000000000000000000000000000AA'
  )
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
  evm.bind({
    address: '0x00000000000000000000000000000000000000AA',
    isConnected: true,
    walletAdapter: {
      async writeContract(params) {
        calls.push(['writeContract', params])
        return '0xusdchash'
      },
      async waitForTransactionReceipt({ hash }) {
        calls.push(['waitForTransactionReceipt', hash])
        return { transactionHash: hash }
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
    },
  })
  assert.deepEqual(sent[0], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        nickname: 'tester',
        evm: getAddress('0x00000000000000000000000000000000000000AA'),
      },
    },
  ])

  assert.deepEqual(modified[1], {
    custom: {
      nickname: 'tester',
      evm: '0x00000000000000000000000000000000000000BB',
    },
  })
  assert.deepEqual(sent[1], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        nickname: 'tester',
        evm: '0x00000000000000000000000000000000000000BB',
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
    },
  })
  assert.deepEqual(sent[2], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        nickname: 'tester',
        evm: null,
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
    },
  })
  assert.deepEqual(sent[0], [
    'entityModified',
    {
      id: 'player-1',
      custom: {
        evm: getAddress('0x00000000000000000000000000000000000000AA'),
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
