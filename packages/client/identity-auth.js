const GUEST_CHOICE = 'identity-continue-as-guest'
const PENDING_SIGN_OUT = 'identity-sign-out-pending'
const normalize = value => (typeof value === 'string' ? value.toLowerCase() : '')

export function createIdentityAuthBridge(
  baseUrl,
  walletBridge,
  { fetcher = fetch, provider = () => globalThis.ethereum, storage = globalThis.localStorage } = {}
) {
  let initialized, login, loginController, verification, invalidating, transport, trackedProvider
  let selectingWallet = false,
    observedAddress = '',
    tracking = false,
    epoch = 0
  let connectionIdentity = null,
    connectionKnown = false
  let state = { phase: 'idle', error: '' }
  const listeners = new Set()
  const read = key => {
    try {
      return storage?.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key, value) => {
    try {
      if (value === null) storage?.removeItem(key)
      else storage?.setItem(key, value)
    } catch {}
  }
  function publish(phase, error = '') {
    state = { phase, error }
    for (const listener of listeners) listener(state)
  }
  function suspend() {
    walletBridge.clearRuntimeAuthState?.()
    transport?.suspend()
    connectionIdentity = null
    publish('switching')
  }
  async function request(path, body, signal) {
    const response = await fetcher(`${baseUrl}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      signal: signal || AbortSignal.timeout(8000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.error || 'Unable to sign in'), { status: response.status })
    return data
  }
  async function readSession() {
    try {
      return await request('me')
    } catch (error) {
      if (error.status === 401) return null
      throw error
    }
  }
  async function resume(version = epoch) {
    if (connectionKnown) {
      if (!transport) throw new Error('The world connection is not ready. Try again.')
      await transport.reconnect()
    }
    if (version === epoch) publish('idle')
  }
  function invalidateSession() {
    if (invalidating) return invalidating
    epoch++
    write(PENDING_SIGN_OUT, '1')
    write(GUEST_CHOICE, null)
    loginController?.abort()
    suspend()
    if (!invalidating)
      invalidating = (async () => {
        // Let an in-flight verification response finish before clearing its cookie.
        await verification?.catch(() => {})
        await request('logout', {})
        write(PENDING_SIGN_OUT, null)
        await resume()
      })()
        .catch(error => {
          publish('error', error.message)
          throw error
        })
        .finally(() => {
          invalidating = null
        })
    return invalidating
  }
  const accountChanged = accounts => {
    const next = normalize(accounts?.[0])
    if (next === observedAddress) return
    observedAddress = next
    if (
      !tracking ||
      selectingWallet ||
      (connectionIdentity?.authenticatedWith === 'identity' && !connectionIdentity.walletAddress)
    )
      return
    void invalidateSession().catch(() => {})
  }
  const disconnected = () => accountChanged([])
  async function initialize() {
    if (initialized) return initialized
    initialized = (async () => {
      if (read(PENDING_SIGN_OUT)) {
        await request('logout', {})
        write(PENDING_SIGN_OUT, null)
      }
      trackedProvider?.removeListener?.('accountsChanged', accountChanged)
      trackedProvider?.removeListener?.('disconnect', disconnected)
      trackedProvider = provider()
      trackedProvider?.on?.('accountsChanged', accountChanged)
      trackedProvider?.on?.('disconnect', disconnected)
      const session = await readSession()
      const accounts = await trackedProvider?.request?.({ method: 'eth_accounts' }).catch(() => [])
      observedAddress = normalize(accounts?.[0])
      tracking = true
      if (session?.user?.wallet?.address && normalize(session.user.wallet.address) !== observedAddress) {
        await invalidateSession()
        return null
      }
      return session
    })().catch(error => {
      initialized = null
      throw error
    })
    return initialized
  }
  async function rejoin() {
    const version = epoch
    suspend()
    try {
      await resume(version)
    } catch (error) {
      if (version === epoch) publish('error', error.message)
      throw error
    }
  }
  async function performLogin() {
    await initialize()
    if (invalidating) await invalidating
    if (state.phase !== 'idle') throw new Error('Reconnect to the world before signing in.')
    const wallet = provider()
    if (!wallet?.request) throw new Error('Open this page in a browser with an EVM wallet installed.')
    const version = epoch
    loginController = new AbortController()
    let address
    selectingWallet = true
    try {
      const accounts = await wallet.request({ method: 'eth_requestAccounts' })
      address = accounts?.[0]
      observedAddress = normalize(address)
    } finally {
      selectingWallet = false
    }
    if (!/^0x[0-9a-f]{40}$/i.test(address || '')) throw new Error('Select an EVM wallet account.')
    const chainId = Number(await wallet.request({ method: 'eth_chainId' }))
    const challenge = await request('challenge', { address, chainId }, loginController.signal)
    const message = `0x${Array.from(new TextEncoder().encode(challenge.message), byte => byte.toString(16).padStart(2, '0')).join('')}`
    const signature = await wallet.request({ method: 'personal_sign', params: [message, address] })
    const current = await wallet.request({ method: 'eth_accounts' })
    if (version !== epoch || normalize(current?.[0]) !== normalize(address)) {
      if (version === epoch) await invalidateSession()
      throw Object.assign(new Error('Wallet changed. Sign in again.'), { skipAuth: true })
    }
    // Do not abort verify: logout must run after the response that sets the cookie.
    verification = request('verify', { signature })
    await verification
    verification = null
    if (version !== epoch) throw Object.assign(new Error('Wallet changed. Sign in again.'), { skipAuth: true })
    const session = await request('me')
    if (version !== epoch) throw Object.assign(new Error('Wallet changed. Sign in again.'), { skipAuth: true })
    write(GUEST_CHOICE, null)
    await rejoin()
    return session
  }
  const bridge = {
    ...walletBridge,
    mode: 'identity',
    enabled: true,
    initialize,
    allowsUnscopedWalletAccess: () => false,
    isReconnecting: () => state.phase !== 'idle',
    getState: () => state,
    shouldOfferSignIn: () => !read(GUEST_CHOICE),
    continueAsGuest: () => write(GUEST_CHOICE, '1'),
    setConnectionIdentity(identity) {
      connectionIdentity = identity
      connectionKnown = true
    },
    attachTransport(value) {
      transport = value
      return () => {
        if (transport === value) transport = null
      }
    },
    onStateChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async getSessionUser() {
      if (state.phase !== 'idle' || (connectionKnown && !connectionIdentity)) return null
      const session = await readSession().catch(() => null)
      if (state.phase !== 'idle') return null
      return connectionKnown && connectionIdentity?.userId !== session?.user?.id ? null : session
    },
    connectWalletSession() {
      if (!login)
        login = performLogin().finally(() => {
          login = null
          loginController = null
        })
      return login
    },
    async ensureWalletSession() {
      await initialize()
      if (state.phase !== 'idle') return false
      const session = await readSession()
      const accounts = await provider()
        ?.request?.({ method: 'eth_accounts' })
        .catch(() => [])
      if (
        session?.user?.id &&
        session.user.wallet?.address &&
        normalize(session.user.wallet.address) === normalize(accounts?.[0])
      ) {
        if (connectionKnown && connectionIdentity?.userId === session.user.id) return true
        await rejoin()
      } else if (session?.user?.id && session.identity?.authenticatedWith === 'identity') {
        const wallet = provider()
        if (!wallet?.request) throw new Error('Connect an EVM wallet linked to your Peezy Identity for this action.')
        selectingWallet = true
        let selected
        try {
          selected = await wallet.request({ method: 'eth_requestAccounts' })
        } finally {
          selectingWallet = false
        }
        const address = selected?.[0]
        await request('bind-wallet', { address })
        observedAddress = normalize(address)
        await rejoin()
      } else {
        await bridge.connectWalletSession()
      }
      return state.phase === 'idle' && !!connectionIdentity
    },
    identityCapabilities: () => request('capabilities'),
    linkedCredentials: () => request('linked'),
    async linkSolanaWallet() {
      const version = epoch
      const wallet = globalThis.phantom?.solana || globalThis.solana
      if (!wallet?.connect || !wallet?.signMessage)
        throw new Error('Open the game in a browser with a Solana wallet such as Phantom installed.')
      const connected = await wallet.connect()
      const address = (connected?.publicKey || wallet.publicKey)?.toString()
      if (!address) throw new Error('Select a Solana wallet account.')
      const challenge = await request('wallet-link/challenge', { address, family: 'solana' })
      const signed = await wallet.signMessage(new TextEncoder().encode(challenge.message), 'utf8')
      if (version !== epoch || wallet.publicKey?.toString() !== address)
        throw new Error('Account changed. Try linking again.')
      const signature = btoa(String.fromCharCode(...signed.signature))
      await request('wallet-link/verify', { challengeId: challenge.challengeId, message: challenge.message, signature })
      if (version !== epoch) throw new Error('Session ended.')
      return request('linked')
    },
    async linkSocialAccount(providerName, { signal } = {}) {
      // Open synchronously so browser popup blockers see the user's click.
      const popup = globalThis.open('about:blank', '_blank', 'popup,width=520,height=720')
      if (!popup) throw new Error('Allow popups for this game, then try again.')
      const version = epoch
      try {
        const { url, state: linkState } = await request('manage', { provider: providerName, popup: true })
        const destination = new URL(url)
        if (destination.protocol !== 'https:') throw new Error('Invalid authorization destination')
        if (version !== epoch || popup.closed) throw new Error('Linking cancelled.')
        popup.location.replace(destination.toString())
        const deadline = Date.now() + 15 * 60_000
        while (Date.now() < deadline) {
          if (version !== epoch || signal?.aborted) throw new Error('Linking cancelled.')
          const result = await request(`link-status?state=${encodeURIComponent(linkState)}`)
          if (version !== epoch || signal?.aborted) throw new Error('Linking cancelled.')
          if (result.complete) return result
          // Poll the gateway: OAuth providers can sever the popup's window reference.
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        throw new Error('Authorization expired. Try again.')
      } finally {
        popup.close()
      }
    },
    async manageLinkedAccounts() {
      const { url } = await request('manage', {})
      const destination = new URL(url)
      if (destination.protocol !== 'https:') throw new Error('Invalid account management destination')
      globalThis.location.assign(destination.toString())
    },
    async signInWithIdentity() {
      const { url } = await request('sign-in', {})
      const destination = new URL(url)
      if (destination.protocol !== 'https:') throw new Error('Invalid sign-in destination')
      write(GUEST_CHOICE, null)
      globalThis.location.assign(destination.toString())
    },
    retrySession: () => (read(PENDING_SIGN_OUT) ? invalidateSession() : rejoin()),
    logoutAndClearSession: invalidateSession,
    async updateProfile() {
      throw new Error('Manage your profile in your account settings.')
    },
    dispose() {
      trackedProvider?.removeListener?.('accountsChanged', accountChanged)
      trackedProvider?.removeListener?.('disconnect', disconnected)
      listeners.clear()
    },
  }
  return bridge
}
