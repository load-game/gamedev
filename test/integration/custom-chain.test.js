import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { localEvmChains } from '../../packages/extra-systems/localEvmChain.js'
import { RuntimeWalletAdapter } from '../../packages/client/wallet-adapter.js'

test('custom chains are opt-in, retain default 31337 and accept 31339 on both sides', () => {
  assert.deepEqual(localEvmChains({}, {}), [])
  assert.equal(localEvmChains({ LOCAL_EVM_RPC_URL: 'http://127.0.0.1:8558' }, {})[0].id, 31337)
  assert.equal(
    localEvmChains({ LOCAL_EVM_RPC_URL: 'http://127.0.0.1:8558', LOCAL_EVM_CHAIN_ID: '31339' }, {})[0].id,
    31339
  )
  assert.equal(
    localEvmChains({}, { PUBLIC_LOCAL_EVM_RPC_URL: 'https://example.test/rpc', PUBLIC_LOCAL_EVM_CHAIN_ID: '31339' })[0]
      .id,
    31339
  )
  for (const id of ['0', '-1', '1.5', 'wat', '9007199254740992'])
    assert.throws(() => localEvmChains({ LOCAL_EVM_RPC_URL: 'http://127.0.0.1', LOCAL_EVM_CHAIN_ID: id }, {}))
  assert.throws(() => localEvmChains({ LOCAL_EVM_RPC_URL: 'file:///etc/passwd' }, {}))
})

test('world wallet add-chain verifies metadata, disconnect remains disconnected, rejected switch never adds', async () => {
  const previous = globalThis.window
  const account = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    calls = []
  let id = 1,
    added = false,
    reject = false
  globalThis.window = {
    ethereum: {
      request: async r => {
        calls.push(r)
        if (r.method === 'eth_accounts' || r.method === 'eth_requestAccounts') return [account]
        if (r.method === 'eth_chainId') return '0x' + id.toString(16)
        if (r.method === 'wallet_addEthereumChain') {
          added = true
          return null
        }
        if (r.method === 'wallet_switchEthereumChain') {
          if (reject) throw Object.assign(new Error('Rejected'), { code: 4001 })
          if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 })
          id = 31339
          return null
        }
      },
    },
  }
  const adapter = new RuntimeWalletAdapter({ authBridge: null, walletBridge: null, refreshIntervalMs: 0 })
  try {
    await adapter.connect()
    const chain = localEvmChains(
      {},
      { PUBLIC_LOCAL_EVM_RPC_URL: 'https://example.test/rpc', PUBLIC_LOCAL_EVM_CHAIN_ID: '31339' }
    )[0]
    await adapter.switchChain({ chainId: 31339, chain })
    assert.equal(adapter.getSnapshot().chainId, 31339)
    assert.equal(calls.filter(r => r.method === 'wallet_addEthereumChain').length, 1)
    assert.equal(
      calls.find(r => r.method === 'wallet_addEthereumChain').params[0].rpcUrls[0],
      'https://example.test/rpc'
    )
    adapter.disconnect()
    assert.equal((await adapter.refresh()).connected, false)
    assert.equal((await adapter.connect()).address, account)
    reject = true
    await assert.rejects(adapter.switchChain({ chainId: 31339, chain }), /Rejected/)
    assert.equal(calls.filter(r => r.method === 'wallet_addEthereumChain').length, 1)
  } finally {
    adapter.destroy()
    globalThis.window = previous
  }
})

test('bound chain metadata and queried RPC chain remain distinct', async () => {
  const { EVM } = await import('../../packages/extra-systems/systems/EVMClient.js')
  const evm = new EVM({}),
    api = evm.getRuntimeAPI(1)
  let queried = 0
  evm.publicClients.set(1, {
    getChainId: async () => {
      queried++
      return 31337
    },
  })
  assert.equal(await api.getChainId(), 1)
  assert.equal(queried, 0)
  assert.equal(await api.getRpcChainId(), 31337)
  assert.equal(queried, 1)
})

test('provider changes synchronously invalidate subscribed wallet state', async () => {
  const previous = globalThis.window,
    listeners = {},
    seen = []
  let account = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  globalThis.window = {
    ethereum: {
      on: (e, fn) => {
        listeners[e] = fn
      },
      removeListener: e => {
        delete listeners[e]
      },
      request: async ({ method }) => (method === 'eth_chainId' ? '0x7a6b' : [account]),
    },
  }
  const adapter = new RuntimeWalletAdapter({ authBridge: null, walletBridge: null, refreshIntervalMs: 0 })
  try {
    await adapter.connect()
    adapter.subscribe(s => seen.push(s))
    account = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
    listeners.accountsChanged([account])
    assert.equal(seen[0].connected, false)
    assert.equal(seen[0].address, null)
    await adapter.refresh()
    assert.equal(adapter.getSnapshot().address, account)
    listeners.chainChanged('0x1')
    assert.equal(adapter.getSnapshot().connected, false)
    await adapter.refresh()
    listeners.disconnect()
    assert.equal(adapter.getSnapshot().connected, false)
  } finally {
    adapter.destroy()
    globalThis.window = previous
  }
  assert.equal(Object.keys(listeners).length, 0)
})
