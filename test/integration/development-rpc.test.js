import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { DevelopmentRpc } from '../../packages/extra-systems/developmentRpc.js'
import { EVM as ClientEVM } from '../../packages/extra-systems/systems/EVMClient.js'
import { EVM as ServerEVM } from '../../packages/extra-systems/systems/EVMServer.js'
import { RuntimeWalletAdapter } from '../../packages/client/wallet-adapter.js'

const chain = {
  id: 1000004663,
  development: true,
  name: 'Shared fork',
  nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://fork.example/robinhood/rpc'] } },
}
const input = generation => ({
  chainId: chain.id,
  sourceChainId: 4663,
  generation,
  manifestUrl: 'https://fork.example/robinhood/manifest.json',
  rpcUrl: `https://fork.example/robinhood/${generation}/rpc`,
  resetsAt: new Date(Date.now() + 3600000).toISOString(),
})
const manifest = state => ({ ...state, schemaVersion: 1, sourceChainId: 4663, phase: 'ready', ready: true })

test('a catalog read splits into batches accepted by the shared gateway', async () => {
  const originalFetch = globalThis.fetch
  const state = input('catalog'),
    batches = []
  globalThis.fetch = async (url, options) => {
    if (url === state.manifestUrl) return Response.json(manifest(state))
    assert.equal(url, state.rpcUrl)
    const body = JSON.parse(options.body)
    assert.ok(Array.isArray(body))
    batches.push(body.length)
    if (body.length > 32) return Response.json({ error: 'Invalid batch size' }, { status: 400 })
    return Response.json(body.map(item => ({ jsonrpc: '2.0', id: item.id, result: '0x' })))
  }
  try {
    const evm = new ClientEVM({})
    evm._requireSupportedChain = () => chain
    await evm.getRuntimeAPI(chain.id).configureRpc(state)
    const client = evm._getPublicClient(chain.id)
    const results = await Promise.all(
      Array.from({ length: 85 }, (_, i) =>
        client.request({
          method: 'eth_call',
          params: [
            { to: '0x1111111111111111111111111111111111111111', data: '0x' + i.toString(16).padStart(2, '0') },
            'latest',
          ],
        })
      )
    )
    assert.equal(results.length, 85)
    assert.ok(results.every(result => result === '0x'))
    assert.equal(
      batches.reduce((a, b) => a + b, 0),
      85
    )
    assert.ok(batches.every(size => size <= 32))
  } finally {
    globalThis.fetch = originalFetch
  }
})

// These tests replace only the external manifest/provider. They exercise the engine
// and wallet adapter together, including a reset during asynchronous wallet setup.
test('development RPC rejects redirects, unready fixtures and expired or mismatched generations', async () => {
  const originalFetch = globalThis.fetch
  const rpc = new DevelopmentRpc(chain)
  const state = input('first')
  let remote = manifest(state)
  globalThis.fetch = async () => Response.json(remote)
  try {
    assert.throws(() => new DevelopmentRpc({ ...chain, development: false }), /declared development/)
    for (const change of [
      { rpcUrl: 'https://other.example/robinhood/first/rpc' },
      { manifestUrl: 'http://fork.example/robinhood/manifest.json' },
      { rpcUrl: 'https://fork.example/robinhood/rpc' },
      { rpcUrl: 'https://fork.example/robinhood/first/rpc?key=secret' },
      { chainId: 4663 },
      { sourceChainId: chain.id },
      { generation: '../rpc' },
      { resetsAt: '2000-01-01T00:00:00Z' },
    ])
      await assert.rejects(rpc.configure({ ...state, ...change }), /Invalid/)
    await rpc.configure(state)
    const first = rpc.capture()
    await rpc.configure(state)
    assert.equal(rpc.capture(), first)
    remote = { ...remote, ready: false }
    await assert.rejects(rpc.assertFresh(), /generation changed/)
    remote = manifest(input('second'))
    await assert.rejects(rpc.assertFresh(), /generation changed/)
    rpc.pause()
    assert.throws(() => rpc.capture(), /rebuilding/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a pause invalidates an in-flight configuration instead of resurrecting its old fork', async () => {
  const originalFetch = globalThis.fetch
  let release
  globalThis.fetch = () =>
    new Promise(resolve => {
      release = resolve
    })
  const rpc = new DevelopmentRpc(chain),
    state = input('first')
  try {
    const pending = rpc.configure(state)
    rpc.pause()
    release(Response.json(manifest(state)))
    await assert.rejects(pending, /configuration changed/)
    assert.equal(rpc.current, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('client and server discard a receipt or read that finishes after the consumer changes generation', async () => {
  const originalFetch = globalThis.fetch
  const state = input('first')
  globalThis.fetch = async () => Response.json(manifest(state))
  try {
    for (const EVM of [ClientEVM, ServerEVM]) {
      const evm = new EVM({})
      evm._requireSupportedChain = () => chain
      const api = evm.getRuntimeAPI(chain.id)
      await api.configureRpc(state)
      let complete
      evm.publicClients.set(chain.id, {
        waitForTransactionReceipt: () =>
          new Promise(resolve => {
            complete = resolve
          }),
      })
      const pending = api.waitForTransactionReceipt({ hash: '0xold' })
      api.pauseRpc()
      complete({ status: 'success' })
      await assert.rejects(pending, /rebuilding/)
      assert.equal(api.getGeneration(), null)
      assert.throws(() => evm._getPublicClient(chain.id), /rebuilding/)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a reset during wallet initialization prevents both contract and native transaction signatures', async () => {
  const originalFetch = globalThis.fetch,
    previousWindow = globalThis.window
  const state = input('first'),
    calls = []
  let remote = manifest(state),
    resetDuringSetup = false
  const account = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  globalThis.fetch = async () => Response.json(remote)
  globalThis.window = {
    ethereum: {
      async request(request) {
        calls.push(request)
        if (request.method === 'eth_chainId') {
          if (resetDuringSetup) remote = manifest(input('second'))
          return '0x' + chain.id.toString(16)
        }
        if (['eth_accounts', 'eth_requestAccounts'].includes(request.method)) return [account]
        if (['wallet_addEthereumChain', 'wallet_switchEthereumChain'].includes(request.method)) return null
        if (request.method === 'eth_sendTransaction') return '0xsigned'
        throw new Error(request.method)
      },
    },
  }
  const adapter = new RuntimeWalletAdapter({ authBridge: null, walletBridge: null, refreshIntervalMs: 0 })
  const evm = new ClientEVM({})
  evm._requireSupportedChain = () => chain
  try {
    await adapter.connect()
    evm.bind({ walletAdapter: adapter, address: account, isConnected: true, chainId: chain.id })
    const api = evm.getRuntimeAPI(chain.id)
    await api.configureRpc(state)
    await api.switchChain()
    assert.equal(calls.find(call => call.method === 'wallet_addEthereumChain').params[0].rpcUrls[0], state.rpcUrl)
    resetDuringSetup = true
    for (const method of ['writeContract', 'sendTransaction']) {
      remote = manifest(state)
      await assert.rejects(api[method]({ to: account, value: 1n }), /generation changed/)
    }
    resetDuringSetup = false
    const prepare = adapter._getViemClients.bind(adapter)
    adapter._getViemClients = async options => {
      const clients = await prepare(options)
      remote = manifest(input('second'))
      return clients
    }
    for (const method of ['writeContract', 'sendTransaction']) {
      remote = manifest(state)
      await assert.rejects(api[method]({ to: account, value: 1n }), /generation changed/)
    }
    assert.equal(calls.filter(call => call.method === 'eth_sendTransaction').length, 0)
  } finally {
    adapter.destroy()
    globalThis.fetch = originalFetch
    globalThis.window = previousWindow
  }
})
