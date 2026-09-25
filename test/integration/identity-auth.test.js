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
  let reloads = 0
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
      reload: () => {
        calls.push('reload')
        reloads++
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
        if (path === 'verify') signedIn = true
        return Response.json(path === 'challenge' ? { message: 'Sign this nonce' } : {})
      },
    }
  )
  return {
    bridge,
    calls,
    storage,
    get reloads() {
      return reloads
    },
    change(next) {
      currentAccounts = next
      events.get('accountsChanged')?.(next)
    },
    failLogout() {
      failLogout = true
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
  assert.equal(f.reloads, 0)
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
  assert.equal(await f.bridge.ensureWalletSession(), false)
  assert.equal(f.reloads, 1)
  assert.equal(f.calls.includes('personal_sign'), false)
  const live = fixture({ signedIn: true, accounts: [address] })
  live.bridge.setConnectionIdentity({ userId: session.user.id })
  assert.equal(await live.bridge.ensureWalletSession(), true)
  assert.equal(live.reloads, 0)
})

test('wallet login is single-flight and reconnects only after verification', async () => {
  const f = fixture()
  const first = f.bridge.connectWalletSession()
  assert.equal(first, f.bridge.connectWalletSession())
  assert.deepEqual(await first, session)
  assert.equal(f.reloads, 1)
  assert.equal(f.calls.filter(x => x === 'personal_sign').length, 1)
  assert.equal(f.calls.includes('logout'), false)
  assert.ok(f.calls.indexOf('verify') < f.calls.indexOf('reload'))
  assert.equal(await f.bridge.getSessionUser(), null)
})

test('account changes and disconnects close the world before logout and reload, including guests', async () => {
  for (const signedIn of [false, true]) {
    for (const accounts of [[otherAddress], []]) {
      const f = fixture({ signedIn, accounts: [address] })
      await f.bridge.initialize()
      f.bridge.onTransition(() => f.calls.push('close-world'))
      f.change([address.toUpperCase()])
      assert.equal(f.reloads, 0)
      f.change(accounts)
      f.change(accounts)
      await tick()
      assert.equal(f.reloads, 1)
      assert.ok(f.calls.indexOf('close-world') < f.calls.indexOf('logout'))
      assert.ok(f.calls.indexOf('logout') < f.calls.indexOf('reload'))
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
  assert.equal(f.reloads, 1)
})

test('failed wallet-change logout is retried before restoring a session on the next page', async () => {
  const f = fixture({ signedIn: true, accounts: [address] })
  await f.bridge.initialize()
  f.failLogout()
  f.change([otherAddress])
  await tick()
  assert.equal(f.reloads, 1)
  const next = fixture({ signedIn: true, accounts: [otherAddress], storage: f.storage })
  assert.equal(await next.bridge.initialize(), null)
  assert.equal(next.calls[0], 'logout')
  assert.equal(next.reloads, 0)
})

test('a changed wallet detected on page load invalidates the remembered identity before joining', async () => {
  const f = fixture({ signedIn: true, accounts: [otherAddress] })
  await assert.rejects(f.bridge.initialize(), /Wallet changed/)
  assert.equal(f.reloads, 1)
  assert.equal(f.calls.includes('logout'), true)
})
