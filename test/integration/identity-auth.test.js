import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { createIdentityAuthBridge } from '../../packages/client/identity-auth.js'

const address = '0x' + 'a'.repeat(40)
const otherAddress = '0x' + 'b'.repeat(40)
const session = { user: { id: 'identity-subject', wallet: { type: 'ethereum', address } } }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function fixture({ signedIn = false, accounts = [], storage = new Map() } = {}) {
  const events = new Map()
  const calls = []
  let currentAccounts = accounts
  let failLogout = false
  let signature
  let verificationGate
  let reconnects = 0
  const wallet = {
    on(name, fn) {
      events.set(name, fn)
    },
    removeListener(name) {
      events.delete(name)
    },
    async request({ method }) {
      calls.push(method)
      if (method === 'eth_accounts') return currentAccounts
      if (method === 'eth_requestAccounts') {
        currentAccounts = [address]
        events.get('accountsChanged')?.(currentAccounts)
        return currentAccounts
      }
      if (method === 'eth_chainId') return '0x1'
      if (method === 'personal_sign') return signature || '0xsignature'
      throw new Error(method)
    },
  }
  const bridge = createIdentityAuthBridge(
    'https://game.test/identity',
    {},
    {
      provider: () => wallet,
      storage: {
        getItem: key => storage.get(key),
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
      },
      fetcher: async (url, init) => {
        const path = url.split('/').at(-1)
        calls.push(path)
        if (init.signal.aborted) throw new Error('aborted')
        if (path === 'me')
          return Response.json(signedIn ? session : { error: 'Sign in' }, { status: signedIn ? 200 : 401 })
        if (path === 'logout') {
          if (failLogout) throw new Error('offline')
          signedIn = false
        }
        if (path === 'verify') {
          await verificationGate
          signedIn = true
        }
        return Response.json(path === 'challenge' ? { message: 'Sign this nonce' } : {})
      },
    }
  )
  bridge.setConnectionIdentity(signedIn ? { userId: session.user.id } : null)
  bridge.attachTransport({
    suspend: () => calls.push('close-world'),
    reconnect: async () => {
      calls.push('reconnect')
      reconnects++
      bridge.setConnectionIdentity(signedIn ? { userId: session.user.id } : null)
    },
  })
  return {
    bridge,
    calls,
    storage,
    get reconnects() {
      return reconnects
    },
    change(next) {
      currentAccounts = next
      events.get('accountsChanged')?.(next)
    },
    failLogout() {
      failLogout = true
    },
    holdVerification() {
      let resolve
      verificationGate = new Promise(r => {
        resolve = r
      })
      return resolve
    },
    holdSignature() {
      let resolve
      signature = new Promise(r => {
        resolve = r
      })
      return resolve
    },
  }
}

test('guest initialization never prompts; guest choice survives a new page', async () => {
  const f = fixture()
  assert.equal(await f.bridge.initialize(), null)
  assert.equal(f.reconnects, 0)
  assert.equal(f.calls.includes('eth_requestAccounts'), false)
  assert.equal(f.bridge.shouldOfferSignIn(), true)
  f.bridge.continueAsGuest()
  assert.equal(fixture({ storage: f.storage }).bridge.shouldOfferSignIn(), false)
})

test('matching saved wallet session restores without signing; a guest socket cannot use its wallet', async () => {
  const f = fixture({ signedIn: true, accounts: [address] })
  assert.deepEqual(await f.bridge.initialize(), session)
  f.bridge.setConnectionIdentity(null)
  assert.equal(await f.bridge.getSessionUser(), null)
  assert.equal(await f.bridge.ensureWalletSession(), true)
  assert.equal(f.reconnects, 1)
  assert.equal(f.calls.includes('personal_sign'), false)
  const live = fixture({ signedIn: true, accounts: [address] })
  live.bridge.setConnectionIdentity({ userId: session.user.id })
  assert.equal(await live.bridge.ensureWalletSession(), true)
  assert.equal(live.reconnects, 0)
})

test('wallet login is single-flight and reconnects only after verification', async () => {
  const f = fixture()
  const first = f.bridge.connectWalletSession()
  assert.equal(first, f.bridge.connectWalletSession())
  assert.deepEqual(await first, session)
  assert.equal(f.reconnects, 1)
  assert.equal(f.calls.filter(x => x === 'personal_sign').length, 1)
  assert.equal(f.calls.includes('logout'), false)
  assert.ok(f.calls.indexOf('verify') < f.calls.indexOf('reconnect'))
  assert.deepEqual(await f.bridge.getSessionUser(), session)
})

test('account changes and disconnects close the world before logout and reconnect, including guests', async () => {
  for (const signedIn of [false, true]) {
    for (const accounts of [[otherAddress], []]) {
      const f = fixture({ signedIn, accounts: [address] })
      await f.bridge.initialize()
      f.change([address.toUpperCase()])
      assert.equal(f.reconnects, 0)
      f.change(accounts)
      f.change(accounts)
      await tick()
      assert.equal(f.reconnects, 1)
      assert.ok(f.calls.indexOf('close-world') < f.calls.indexOf('logout'))
      assert.ok(f.calls.indexOf('logout') < f.calls.indexOf('reconnect'))
    }
  }
})

test('switching wallets during signature cannot verify or expose the old account', async () => {
  const f = fixture()
  const finishSignature = f.holdSignature()
  const login = f.bridge.connectWalletSession()
  while (!f.calls.includes('personal_sign')) await tick()
  f.change([otherAddress])
  finishSignature('0xsignature')
  await assert.rejects(login, /Wallet changed/)
  assert.equal(f.calls.includes('verify'), false)
  assert.equal(f.reconnects, 1)
})

test('failed wallet-change logout is retried before restoring a session on the next page', async () => {
  const f = fixture({ signedIn: true, accounts: [address] })
  await f.bridge.initialize()
  f.failLogout()
  f.change([otherAddress])
  await tick()
  assert.equal(f.reconnects, 0)
  assert.equal(f.bridge.getState().phase, 'error')
  const next = fixture({ signedIn: true, accounts: [otherAddress], storage: f.storage })
  assert.equal(await next.bridge.initialize(), null)
  assert.equal(next.calls[0], 'logout')
  assert.equal(next.reconnects, 0)
})

test('a changed wallet detected on page load invalidates the remembered identity before joining', async () => {
  const f = fixture({ signedIn: true, accounts: [otherAddress] })
  assert.equal(await f.bridge.initialize(), null)
  assert.equal(f.reconnects, 1)
  assert.equal(f.calls.includes('logout'), true)
})

test('wallet changes during verification wait for its cookie before logout', async () => {
  const f = fixture()
  const finish = f.holdVerification()
  const login = f.bridge.connectWalletSession()
  while (!f.calls.includes('verify')) await tick()
  f.change([otherAddress])
  await tick()
  assert.equal(f.calls.includes('logout'), false)
  finish()
  await assert.rejects(login, /Wallet changed/)
  await tick()
  assert.equal(f.calls.includes('logout'), true)
  assert.equal(await f.bridge.getSessionUser(), null)
  assert.equal(f.bridge.getState().phase, 'idle')
})

test('failed handoff blocks wallet use and can retry without signing again', async () => {
  const f = fixture()
  let fail = true
  f.bridge.attachTransport({
    suspend() {},
    async reconnect() {
      if (fail) throw new Error('Instance unavailable')
      f.bridge.setConnectionIdentity({ userId: session.user.id })
    },
  })
  await assert.rejects(f.bridge.connectWalletSession(), /Instance unavailable/)
  assert.equal(f.bridge.getState().phase, 'error')
  assert.equal(await f.bridge.getSessionUser(), null)
  fail = false
  await f.bridge.retrySession()
  assert.deepEqual(await f.bridge.getSessionUser(), session)
  assert.equal(f.calls.filter(call => call === 'personal_sign').length, 1)
})

test('rapid wallet changes share one logout and guest handoff', async () => {
  const f = fixture({ signedIn: true, accounts: [address] })
  await f.bridge.initialize()
  f.change([otherAddress])
  f.change([])
  f.change(['0x' + 'c'.repeat(40)])
  await tick()
  assert.equal(f.calls.filter(call => call === 'logout').length, 1)
  assert.equal(f.reconnects, 1)
  assert.equal(f.bridge.getState().phase, 'idle')
})

test('hosted identity binds only a provider-linked EVM wallet without replacing its subject', async () => {
  let bound = false,
    reconnects = 0
  const wallet = {
    request: async ({ method }) =>
      method === 'eth_accounts' ? [] : method === 'eth_requestAccounts' ? [address] : null,
  }
  const auth = createIdentityAuthBridge(
    'https://game.test/identity',
    { clearRuntimeAuthState() {} },
    {
      provider: () => wallet,
      storage: null,
      fetcher: async (url, init) => {
        if (url.endsWith('/me'))
          return Response.json({
            user: { id: 'same-subject', wallet: bound ? { address } : null },
            identity: { authenticatedWith: 'identity' },
          })
        assert.equal(url.endsWith('/bind-wallet'), true)
        assert.deepEqual(JSON.parse(init.body), { address })
        bound = true
        return Response.json({ ok: true })
      },
    }
  )
  auth.setConnectionIdentity({ userId: 'same-subject', authenticatedWith: 'identity' })
  auth.attachTransport({
    suspend() {},
    async reconnect() {
      reconnects++
      auth.setConnectionIdentity({ userId: 'same-subject', authenticatedWith: 'identity', walletAddress: address })
    },
  })
  assert.equal(await auth.ensureWalletSession(), true)
  assert.equal(bound, true)
  assert.equal(reconnects, 1)
})

test('Solana linking signs the challenge, refreshes credentials and rejects account changes', async () => {
  const original = globalThis.solana
  const calls = []
  let change = false
  let current = 'SolanaAddress'
  globalThis.solana = {
    publicKey: { toString: () => current },
    connect: async () => ({ publicKey: { toString: () => current } }),
    signMessage: async bytes => {
      assert.equal(new TextDecoder().decode(bytes), 'Link wallet proof')
      if (change) current = 'DifferentAddress'
      return { signature: new Uint8Array([1, 2, 3]) }
    },
  }
  const bridge = createIdentityAuthBridge(
    'https://game.test/identity',
    {},
    {
      storage: null,
      fetcher: async (url, init) => {
        calls.push({ url, body: init.body && JSON.parse(init.body) })
        return Response.json(
          url.endsWith('/challenge')
            ? { challengeId: 'proof', message: 'Link wallet proof' }
            : { credentials: [{ family: 'solana', address: current }] }
        )
      },
    }
  )
  try {
    const result = await bridge.linkSolanaWallet()
    assert.equal(result.credentials[0].address, 'SolanaAddress')
    assert.equal(calls[1].body.signature, 'AQID')
    assert.equal(calls[1].body.challengeId, 'proof')
    change = true
    calls.length = 0
    await assert.rejects(bridge.linkSolanaWallet(), /Account changed/)
    assert.equal(calls.length, 1)
  } finally {
    globalThis.solana = original
  }
})

test('blocked social popup does not create a handoff or navigate away', async () => {
  const original = globalThis.open
  globalThis.open = () => null
  const bridge = createIdentityAuthBridge(
    'https://game.test/identity',
    {},
    {
      storage: null,
      fetcher: () => {
        throw new Error('must not request')
      },
    }
  )
  try {
    await assert.rejects(bridge.linkSocialAccount('discord'), /Allow popups/)
  } finally {
    globalThis.open = original
  }
})

test('social linking refreshes through the gateway even when OAuth severs the popup reference', async () => {
  const original = globalThis.open
  const calls = []
  let closed = false
  const popup = {
    closed: false,
    location: {
      replace: () => {
        popup.closed = true
      },
    },
    close: () => {
      closed = true
    },
  }
  globalThis.open = () => popup
  const bridge = createIdentityAuthBridge(
    'https://game.test/identity',
    {},
    {
      storage: null,
      fetcher: async (url, init) => {
        calls.push({ url, body: init.body && JSON.parse(init.body) })
        return Response.json(
          url.endsWith('/manage')
            ? { url: 'https://identity.test/api/auth/session-handoff?token=test', state: 'opaque-state' }
            : { complete: true, credentials: [{ kind: 'social', provider: 'discord' }] }
        )
      },
    }
  )
  try {
    const result = await bridge.linkSocialAccount('discord')
    assert.equal(result.credentials[0].provider, 'discord')
    assert.deepEqual(calls[0].body, { provider: 'discord', popup: true })
    assert.equal(calls[1].url, 'https://game.test/identity/link-status?state=opaque-state')
    assert.equal(closed, true)
  } finally {
    globalThis.open = original
  }
})
